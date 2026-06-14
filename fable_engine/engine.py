"""FABLE engine — bar-by-bar long/short paper-trade simulator.

Processes a multi-symbol signal set on a single global timeline so the heat
cap and daily-loss circuit apply across the whole book, exactly like a real
account. Supports:
  * long and short entries (signal columns long_entry / short_entry)
  * boolean TP-exit signals evaluated at bar close (exit_long / exit_short)
  * fixed ATR initial stop, gap-aware intrabar stop fills
  * optional price target attached at entry (column entry_target), intrabar
  * optional ATR trailing stop activated at +activate_r R
  * optional time stop (bars held)
  * round-trip commission as pct of entry notional
  * per-strategy heat cap and UTC-daily realized-loss circuit breaker

Convention notes (leaderboard parity):
  * entries fill at the SIGNAL BAR CLOSE
  * the simulator does not mark open positions to market
  * R at exit = realized pnl / dollar risk at entry
"""
from __future__ import annotations
import datetime as dt
from dataclasses import dataclass, field

import pandas as pd


@dataclass
class SimulationResult:
    events: list = field(default_factory=list)
    closed_pnls: list = field(default_factory=list)
    closed_r_multiples: list = field(default_factory=list)
    realized_pnl_total: float = 0.0
    starting_equity: float = 10000.0
    ending_equity: float = 10000.0
    open_at_end: list = field(default_factory=list)


def _iso(unix: int) -> str:
    return dt.datetime.fromtimestamp(unix, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _utc_date(unix: int) -> dt.date:
    return dt.datetime.fromtimestamp(unix, dt.timezone.utc).date()


def simulate(signals: dict[str, pd.DataFrame], cfg, starting_equity: float) -> SimulationResult:
    res = SimulationResult(starting_equity=starting_equity, ending_equity=starting_equity)
    equity = starting_equity

    # Global timeline: (time, symbol, row) sorted by time then symbol.
    timeline = []
    for sym, df in signals.items():
        for row in df.itertuples(index=False):
            timeline.append((int(row.time), sym, row))
    timeline.sort(key=lambda t: (t[0], t[1]))

    open_pos: dict[str, dict] = {}     # symbol -> position
    pending: dict[str, dict] = {}      # symbol -> entry signal awaiting next-bar-open fill
    day_realized: dict[dt.date, float] = {}
    slip = getattr(cfg, "slippage_bps", 0.0) / 10000.0
    next_open_fills = bool(getattr(cfg, "fill_next_open", False))

    def slipped(price: float, side: str, is_entry: bool) -> float:
        if slip == 0.0:
            return price
        adverse = 1.0 + slip if (side == "long") == is_entry else 1.0 - slip
        return price * adverse

    def circuit_tripped(unix: int) -> bool:
        d = _utc_date(unix)
        return day_realized.get(d, 0.0) <= -cfg.daily_loss_pct * starting_equity

    def _fill(side, entry, atr0, target, sym, unix):
        if side == "long":
            stop = entry - cfg.stop_atr_mult * atr0
        else:
            stop = entry + cfg.stop_atr_mult * atr0
        risk_per_unit = abs(entry - stop)
        if risk_per_unit <= 0:
            return
        risk_usd = cfg.risk_per_trade * starting_equity
        size = risk_usd / risk_per_unit
        open_pos[sym] = {
            "symbol": sym, "side": side, "entry": entry, "stop": stop,
            "size": size, "risk_usd": risk_usd, "risk_per_unit": risk_per_unit,
            "atr0": atr0, "entry_unix": unix, "bars_held": 0,
            "trail_on": False, "target": target,
            "entry_time": _iso(unix),
        }
        res.events.append({
            "time": _iso(unix), "action": "OPEN", "symbol": sym, "side": side,
            "size": size, "price": round(entry, 6), "stop": round(stop, 6),
            "r": None, "pnl": None, "reason": cfg.entry_reason_tag,
        })

    def book_close(pos, unix, price, reason):
        nonlocal equity
        price = slipped(price, pos["side"], is_entry=False)
        if pos["side"] == "long":
            gross = (price - pos["entry"]) * pos["size"]
        else:
            gross = (pos["entry"] - price) * pos["size"]
        fee = cfg.commission_pct_roundtrip * pos["entry"] * pos["size"]
        pnl = gross - fee
        r = pnl / pos["risk_usd"] if pos["risk_usd"] > 0 else 0.0
        equity += pnl
        res.realized_pnl_total += pnl
        res.closed_pnls.append(pnl)
        res.closed_r_multiples.append(r)
        d = _utc_date(unix)
        day_realized[d] = day_realized.get(d, 0.0) + pnl
        res.events.append({
            "time": _iso(unix), "action": "CLOSE", "symbol": pos["symbol"],
            "side": pos["side"], "size": pos["size"], "price": round(price, 6),
            "stop": None, "r": round(r, 3), "pnl": round(pnl, 4), "reason": reason,
        })

    last_close: dict[str, float] = {}
    live_start = getattr(cfg, "live_start_unix", None)

    for unix, sym, row in timeline:
        last_close[sym] = float(row.close)
        pos = open_pos.get(sym)

        # ---- live-boundary flatten: backtest inventory never crosses into
        # the forward period. A competitor going live starts FLAT; pre-live
        # positions are closed at the first live bar's open (their entries
        # are pre-live, so these closes are excluded from contest equity).
        if (pos is not None and live_start is not None
                and pos["entry_unix"] < live_start and unix >= live_start):
            book_close(pos, unix, float(row.open), "exit-live-boundary-flatten")
            del open_pos[sym]
            pos = None

        # ---- manage open position on this symbol's new bar ----
        if pos is not None and unix > pos["entry_unix"]:
            pos["bars_held"] += 1
            closed = False
            if pos["side"] == "long":
                # gap-aware stop
                if row.open <= pos["stop"]:
                    book_close(pos, unix, row.open, "exit-stop-gap"); closed = True
                elif row.low <= pos["stop"]:
                    book_close(pos, unix, pos["stop"], "exit-stop"); closed = True
                elif pos["target"] is not None and row.high >= pos["target"]:
                    book_close(pos, unix, pos["target"], "exit-target"); closed = True
            else:
                if row.open >= pos["stop"]:
                    book_close(pos, unix, row.open, "exit-stop-gap"); closed = True
                elif row.high >= pos["stop"]:
                    book_close(pos, unix, pos["stop"], "exit-stop"); closed = True
                elif pos["target"] is not None and row.low <= pos["target"]:
                    book_close(pos, unix, pos["target"], "exit-target"); closed = True

            if not closed:
                # TP signal at close
                tp = (pos["side"] == "long" and bool(getattr(row, "exit_long", False))) or \
                     (pos["side"] == "short" and bool(getattr(row, "exit_short", False)))
                if tp:
                    book_close(pos, unix, row.close, "exit-signal-tp"); closed = True
                elif cfg.time_stop_bars and pos["bars_held"] >= cfg.time_stop_bars:
                    book_close(pos, unix, row.close, "exit-time-stop"); closed = True

            if not closed and cfg.trail_atr_mult:
                # activate trail once price has travelled +activate_r R
                move = (row.close - pos["entry"]) if pos["side"] == "long" else (pos["entry"] - row.close)
                if not pos["trail_on"] and move >= cfg.trail_activate_r * pos["risk_per_unit"]:
                    pos["trail_on"] = True
                if pos["trail_on"]:
                    if pos["side"] == "long":
                        cand = row.close - cfg.trail_atr_mult * pos["atr0"]
                        if cand > pos["stop"]:
                            pos["stop"] = cand
                    else:
                        cand = row.close + cfg.trail_atr_mult * pos["atr0"]
                        if cand < pos["stop"]:
                            pos["stop"] = cand

            if closed:
                del open_pos[sym]
                pos = None

        # ---- pending next-open fill (realistic fill mode) ----
        if next_open_fills and sym in pending:
            sig = pending.pop(sym)
            if pos is None and len(open_pos) < cfg.max_concurrent and not circuit_tripped(unix):
                _fill(sig["side"], slipped(float(row.open), sig["side"], True),
                      sig["atr"], sig.get("target"), sym, unix)
                pos = open_pos.get(sym)

        # ---- entries at bar close ----
        if pos is None and len(open_pos) < cfg.max_concurrent and not circuit_tripped(unix):
            want_long = bool(getattr(row, "long_entry", False))
            want_short = bool(getattr(row, "short_entry", False))
            if (want_long or want_short) and row.atr and row.atr > 0:
                side = "long" if want_long else "short"
                if next_open_fills:
                    tgt = getattr(row, "entry_target", None)
                    pending[sym] = {"side": side, "atr": float(row.atr),
                                    "target": None if (tgt is None or pd.isna(tgt)) else float(tgt)}
                    continue
                tgt = getattr(row, "entry_target", None)
                _fill(side, slipped(float(row.close), side, True), float(row.atr),
                      None if (tgt is None or pd.isna(tgt)) else float(tgt), sym, unix)

    res.ending_equity = equity
    def _unreal(p):
        lc = last_close.get(p["symbol"], p["entry"])
        gross = (lc - p["entry"]) * p["size"] if p["side"] == "long" else (p["entry"] - lc) * p["size"]
        return gross - cfg.commission_pct_roundtrip * p["entry"] * p["size"]

    res.open_at_end = [
        {"symbol": p["symbol"], "side": p["side"], "entry": p["entry"], "stop": p["stop"],
         "size": p["size"], "entry_time": p["entry_time"], "bars_held": p["bars_held"],
         "last_close": last_close.get(p["symbol"], p["entry"]),
         "unrealized": _unreal(p)}
        for p in open_pos.values()
    ]
    return res
