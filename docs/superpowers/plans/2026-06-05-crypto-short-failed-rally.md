# Crypto Short Failed-Rally Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a net-short, regime-gated crypto "failed-rally" sleeve (standard + aggressive) that plugs the BULL book's structural long-bias hole.

**Architecture:** A new self-contained Python module `crypto_short_mr/` mirrors the existing `crypto_mean_reversion/` layout but inverts the edge to the short side and ships its OWN short-aware simulator. It does NOT modify `stocks_mean_reversion/portfolio.py` (the long-only engine shared by ~17 live strategies). Output markdown is consumed by the existing `adaptCodex` leaderboard adapter with no adapter changes.

**Tech Stack:** Python 3.11 + pandas (data/sim), Node.js (leaderboard smoke test), the `MeanReversionConfig`-style frozen-dataclass config pattern.

**Spec:** `strategies/crypto-short-failed-rally-2026-06-05-design.md`

**Two repos involved (use absolute paths):**
- Code: `C:\trading\Claude\Trading Strategy\` (NOT a git repo — edits live on disk)
- Leaderboard: `C:\trading\strategy-leaderboard\` (git repo `main` — registry, data, commits)

**Python invocation:** `"C:/Users/Mhair/AppData/Local/Programs/Python/Python311/python.exe"`, run with CWD = `C:\trading\Claude\Trading Strategy` (so `-m crypto_short_mr.<x>` resolves).

---

## File Structure

| File | Responsibility |
|---|---|
| `crypto_short_mr/__init__.py` | Package marker (empty). |
| `crypto_short_mr/config.py` | `ShortMRConfig` frozen dataclass + `CONFIGS` (`standard`, `aggressive`) + ISO constants. |
| `crypto_short_mr/signals.py` | `compute_short_signals(df1h, df4h, cfg)` → adds `rsi`, `atr`, `regime_down`, `filter_ema`, `short_entry`. |
| `crypto_short_mr/portfolio.py` | `simulate_short(...)` short-aware simulator + `SimulationResult`/`_Position`. THE new mechanic. |
| `crypto_short_mr/generate_log.py` | Reads crypto cache, runs signals+sim per variant, writes leaderboard markdown. |
| `crypto_short_mr/test_portfolio.py` | Unit test for the short simulator (pytest-free, runnable with plain python). |
| `strategy-leaderboard/registry.js` | +2 strategy entries. |
| `strategy-leaderboard/data/crypto_variants/*` | +2 file pairs from first regen. |
| `Trading Strategy/run-stock-nightly.bat` | +2 nightly regen lines (after crypto cache refresh). |

---

### Task 1: Scaffold module + config

**Files:**
- Create: `C:\trading\Claude\Trading Strategy\crypto_short_mr\__init__.py`
- Create: `C:\trading\Claude\Trading Strategy\crypto_short_mr\config.py`

- [ ] **Step 1: Create the empty package marker**

Create `crypto_short_mr/__init__.py` with a single line:

```python
"""Crypto Short Failed-Rally — net-short, regime-gated mirror of the long Connors MR."""
```

- [ ] **Step 2: Create the config**

Create `crypto_short_mr/config.py`:

```python
"""Crypto Short Failed-Rally variant configs.

Net-short mirror of the proven long Connors MR (crypto_mean_reversion):
short overbought RSI(2) rips while the 4H regime is DOWN (EMA50<EMA200)
and price is BELOW the 4H trend EMA — i.e. failed rallies in a downtrend.

Self-contained config (own dataclass) so the short module shares NO code
with the long-only simulator that ~17 live strategies depend on. Funding
drag is modeled because spot crypto cannot be shorted without margin.
"""
from __future__ import annotations
from dataclasses import dataclass

PAPER_START_ISO = "2026-04-16T00:00:00Z"
SPEC_FREEZE_ISO = "2026-06-05T00:00:00Z"
LIVE_START_ISO  = "2026-06-05T00:00:00Z"   # HONEST creation date; pre-today = backtest
DEFAULT_STARTING_CAPITAL = 10_000.0


@dataclass(frozen=True)
class ShortMRConfig:
    key: str
    display_name: str
    venue: str
    universe_path: str = "basket_breakout/universe.json"  # resolved by generate_log

    # Signal parameters (RSI interpreted in the SHORT direction)
    rsi_length: int = 2
    rsi_entry_threshold: float = 90.0   # SHORT when RSI > this (overbought rip)
    rsi_exit_threshold: float = 30.0    # COVER when RSI < this (snapped back down)
    atr_len: int = 14
    ema_fast_4h: int = 50
    ema_slow_4h: int = 200
    filter_ema_4h: int = 50             # short only when close < this 4H EMA

    # Exit parameters
    stop_atr_mult: float = 2.0          # stop sits ABOVE entry for a short
    time_stop_bars: int = 24

    # Portfolio parameters
    risk_per_trade: float = 0.005
    max_concurrent: int = 4
    daily_loss_pct: float = 0.03
    commission_pct_roundtrip: float = 0.0052   # Kraken taker ~0.26%/side
    funding_pct_per_4h: float = 0.0002          # margin-short funding drag ~0.02%/4h


CONFIGS: dict[str, ShortMRConfig] = {
    "standard": ShortMRConfig(
        key="crypto_short_failed_rally",
        display_name="Crypto Short Failed-Rally",
        venue="Kraken USD margin — short overbought rips in 4H downtrend",
    ),
    "aggressive": ShortMRConfig(
        key="crypto_short_failed_rally_agg",
        display_name="Crypto Short Failed-Rally Aggressive",
        venue="Kraken USD margin — concentrated high-risk short failed-rally",
        rsi_exit_threshold=20.0,   # hold the short further into the drop
        stop_atr_mult=2.5,         # wider stop = room for the snap-back
        risk_per_trade=0.030,      # 6x base — convex for top-5 scoring
        max_concurrent=2,          # concentrate into the 2 best setups
        daily_loss_pct=0.12,       # looser circuit (aggressive accepts big days)
    ),
}
```

- [ ] **Step 3: Verify it imports**

Run (CWD = `C:\trading\Claude\Trading Strategy`):
`"C:/Users/Mhair/AppData/Local/Programs/Python/Python311/python.exe" -c "from crypto_short_mr.config import CONFIGS; print(list(CONFIGS), CONFIGS['aggressive'].risk_per_trade)"`
Expected: `['standard', 'aggressive'] 0.03`

- [ ] **Step 4: Commit (leaderboard repo only — code dir is not git)**

Code lives outside git; no commit for Task 1. Proceed to Task 2.

---

### Task 2: Short signal generator

**Files:**
- Create: `C:\trading\Claude\Trading Strategy\crypto_short_mr\signals.py`
- Create: `C:\trading\Claude\Trading Strategy\crypto_short_mr\test_signals.py`

- [ ] **Step 1: Write the failing test**

Create `crypto_short_mr/test_signals.py`:

```python
"""Run: python -m crypto_short_mr.test_signals  (prints OK or raises)."""
import numpy as np
import pandas as pd
from crypto_short_mr.config import CONFIGS
from crypto_short_mr.signals import compute_short_signals


def _make_frames():
    # 1H frame: 300 bars, a clean downtrend with one sharp overbought rip near the end.
    n = 300
    t0 = 1_700_000_000
    time = [t0 + i * 3600 for i in range(n)]
    # Steady downtrend, then a 6-bar rip up (creates RSI(2) > 90) while still below trend.
    close = list(np.linspace(100.0, 60.0, n - 6)) + [61, 63, 66, 70, 74, 78]
    high = [c * 1.01 for c in close]
    low = [c * 0.99 for c in close]
    df1h = pd.DataFrame({"time": time, "open": close, "high": high, "low": low, "close": close})
    # 4H frame spanning the same period, monotonic down so EMA50 < EMA200 (regime_down).
    n4 = 100
    time4 = [t0 - 50 * 3600 + i * 4 * 3600 for i in range(n4)]
    close4 = list(np.linspace(140.0, 60.0, n4))
    df4h = pd.DataFrame({"time": time4, "open": close4,
                         "high": [c * 1.01 for c in close4],
                         "low": [c * 0.99 for c in close4], "close": close4})
    return df1h, df4h


def main():
    cfg = CONFIGS["standard"]
    df1h, df4h = _make_frames()
    sig = compute_short_signals(df1h, df4h, cfg)
    assert "short_entry" in sig.columns, "missing short_entry column"
    assert "regime_down" in sig.columns, "missing regime_down column"
    # Regime must read DOWN on the latest bar (EMA50 < EMA200 in a falling 4H series).
    assert bool(sig.iloc[-1]["regime_down"]), "expected regime_down True in a downtrend"
    # The rip at the end should trip at least one short_entry (RSI>90, below trend EMA).
    assert int(sig["short_entry"].sum()) >= 1, "expected >=1 short_entry on the rip"
    # No entry should fire while RSI <= threshold.
    bad = sig[(sig["short_entry"]) & (sig["rsi"] <= cfg.rsi_entry_threshold)]
    assert len(bad) == 0, "short_entry fired without RSI overbought"
    print("OK: signals", int(sig["short_entry"].sum()), "entries")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `"C:/Users/Mhair/AppData/Local/Programs/Python/Python311/python.exe" -m crypto_short_mr.test_signals`
Expected: FAIL — `ModuleNotFoundError: No module named 'crypto_short_mr.signals'`

- [ ] **Step 3: Write the signals module**

Create `crypto_short_mr/signals.py`:

```python
"""Short failed-rally signal generator — Connors-style fast RSI on 1H bars,
gated by a 4H DOWN regime + price-BELOW-4H-trend filter. Inverse of the long
crypto_mean_reversion.signals.

Entry (short only) on 1H bar close:
  1. RSI(rsi_length, 1H) > rsi_entry_threshold   — short-term overbought rip
  2. 4H EMA50 < 4H EMA200                          — confirmed downtrend regime
  3. close < 4H EMA(filter_ema_4h)                 — rip failing below trend
  4. ATR(atr_len, 1H) present and > 0              — for stop sizing
"""
from __future__ import annotations
import pandas as pd

from .config import ShortMRConfig


def _ema(series: pd.Series, length: int) -> pd.Series:
    return series.ewm(span=length, adjust=False).mean()


def _atr(df: pd.DataFrame, length: int) -> pd.Series:
    hl = df["high"] - df["low"]
    hc = (df["high"] - df["close"].shift(1)).abs()
    lc = (df["low"] - df["close"].shift(1)).abs()
    tr = pd.concat([hl, hc, lc], axis=1).max(axis=1)
    return tr.ewm(alpha=1.0 / length, adjust=False).mean()


def _rsi(close: pd.Series, length: int) -> pd.Series:
    """Wilder RSI — identical smoothing to the long MR implementation."""
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0).ewm(alpha=1.0 / length, adjust=False).mean()
    loss = (-delta.where(delta < 0, 0.0)).ewm(alpha=1.0 / length, adjust=False).mean()
    rs = gain / loss.replace(0, 1e-9)
    return 100 - (100 / (1 + rs))


def _align_4h_to_1h(df1h: pd.DataFrame, df4h: pd.DataFrame, cfg: ShortMRConfig) -> pd.DataFrame:
    """Attach 4H regime + filter-EMA to each 1H bar from the most recently CLOSED
    4H bar. No-lookahead: shift the 4H timestamp +4h before the backward merge."""
    df4h = df4h.sort_values("time").reset_index(drop=True).copy()
    df4h["ema_fast"] = _ema(df4h["close"], cfg.ema_fast_4h)
    df4h["ema_slow"] = _ema(df4h["close"], cfg.ema_slow_4h)
    df4h["regime_down"] = (df4h["ema_fast"] < df4h["ema_slow"]).astype(int)
    df4h["filter_ema"] = _ema(df4h["close"], cfg.filter_ema_4h)

    aligned = pd.DataFrame({
        "time_closed": df4h["time"].astype(int) + 4 * 3600,
        "regime_down": df4h["regime_down"],
        "filter_ema": df4h["filter_ema"],
    }).sort_values("time_closed")

    left = df1h[["time"]].copy().sort_values("time")
    left["time"] = left["time"].astype(int)
    return pd.merge_asof(left, aligned, left_on="time", right_on="time_closed", direction="backward")


def compute_short_signals(df1h: pd.DataFrame, df4h: pd.DataFrame, cfg: ShortMRConfig) -> pd.DataFrame:
    out = df1h.copy().sort_values("time").reset_index(drop=True)
    out["rsi"] = _rsi(out["close"], cfg.rsi_length)
    out["atr"] = _atr(out, cfg.atr_len)

    aligned = _align_4h_to_1h(out, df4h, cfg)
    out["regime_down"] = aligned["regime_down"].fillna(0).astype(bool).values
    out["filter_ema"] = aligned["filter_ema"].values

    below_filter = (out["close"] < out["filter_ema"]).fillna(False)

    out["short_entry"] = (
        (out["rsi"] > cfg.rsi_entry_threshold) &
        out["regime_down"] &
        below_filter &
        out["atr"].notna() & (out["atr"] > 0) &
        out["rsi"].notna()
    )
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `"C:/Users/Mhair/AppData/Local/Programs/Python/Python311/python.exe" -m crypto_short_mr.test_signals`
Expected: `OK: signals <N> entries` (N >= 1)

- [ ] **Step 5: Commit the spec-adjacent note**

Code dir is not git; nothing to commit yet. Proceed to Task 3.

---

### Task 3: Short-aware simulator (THE new mechanic)

**Files:**
- Create: `C:\trading\Claude\Trading Strategy\crypto_short_mr\portfolio.py`
- Create: `C:\trading\Claude\Trading Strategy\crypto_short_mr\test_portfolio.py`

- [ ] **Step 1: Write the failing test**

Create `crypto_short_mr/test_portfolio.py`:

```python
"""Run: python -m crypto_short_mr.test_portfolio  (prints OK or raises).

Verifies the SHORT mechanics that differ from the long engine:
  - a short opens on short_entry
  - stop sits ABOVE entry
  - a DOWN move books POSITIVE pnl
  - an UP move to the stop books ~ -1R (minus fees/funding)
  - funding drag accrues with bars held
"""
import pandas as pd
from crypto_short_mr.config import ShortMRConfig
from crypto_short_mr.portfolio import simulate_short


def _bars(rows):
    # rows: list of dicts with time, open, high, low, close, rsi, atr, short_entry
    return pd.DataFrame(rows)


def test_winning_short():
    cfg = ShortMRConfig(key="t", display_name="t", venue="t",
                        rsi_entry_threshold=90, rsi_exit_threshold=30,
                        stop_atr_mult=2.0, time_stop_bars=24,
                        risk_per_trade=0.01, max_concurrent=4, daily_loss_pct=0.5,
                        commission_pct_roundtrip=0.0, funding_pct_per_4h=0.0)
    t0 = 1_700_000_000
    rows = [
        # bar 0: entry signal, price 100, atr 1.0 -> stop = 100 + 2*1 = 102
        {"time": t0, "open": 100, "high": 100, "low": 100, "close": 100, "rsi": 95, "atr": 1.0, "short_entry": True},
        # bar 1: price falls to 90, rsi drops below exit -> cover at close 90
        {"time": t0 + 3600, "open": 99, "high": 99, "low": 90, "close": 90, "rsi": 10, "atr": 1.0, "short_entry": False},
    ]
    sim = simulate_short({"X": _bars(rows)}, cfg, 10_000.0)
    assert len(sim.closed_pnls) == 1, "expected one closed short"
    # size = (10000*0.01)/(102-100) = 50 units; pnl = (100-90)*50 = +500
    assert abs(sim.closed_pnls[0] - 500.0) < 1e-6, f"expected +500, got {sim.closed_pnls[0]}"
    assert sim.closed_r_multiples[0] > 0, "winning short should have positive R"
    opens = [e for e in sim.events if e["action"] == "OPEN"]
    assert opens and opens[0]["side"] == "short", "event side must be short"
    assert opens[0]["stop"] > opens[0]["price"], "short stop must sit ABOVE entry"


def test_stopped_short_is_minus_1R():
    cfg = ShortMRConfig(key="t", display_name="t", venue="t",
                        rsi_entry_threshold=90, rsi_exit_threshold=30,
                        stop_atr_mult=2.0, time_stop_bars=24,
                        risk_per_trade=0.01, max_concurrent=4, daily_loss_pct=0.5,
                        commission_pct_roundtrip=0.0, funding_pct_per_4h=0.0)
    t0 = 1_700_000_000
    rows = [
        {"time": t0, "open": 100, "high": 100, "low": 100, "close": 100, "rsi": 95, "atr": 1.0, "short_entry": True},
        # bar 1: high spikes to 103 >= stop 102 -> stopped at 102
        {"time": t0 + 3600, "open": 101, "high": 103, "low": 101, "close": 102, "rsi": 95, "atr": 1.0, "short_entry": False},
    ]
    sim = simulate_short({"X": _bars(rows)}, cfg, 10_000.0)
    assert len(sim.closed_pnls) == 1
    # size 50; pnl = (100-102)*50 = -100 ; risk was 10000*0.01 = 100 -> -1R
    assert abs(sim.closed_pnls[0] + 100.0) < 1e-6, f"expected -100, got {sim.closed_pnls[0]}"
    assert abs(sim.closed_r_multiples[0] + 1.0) < 1e-6, f"expected -1R, got {sim.closed_r_multiples[0]}"


def test_funding_drag_accrues():
    cfg = ShortMRConfig(key="t", display_name="t", venue="t",
                        rsi_entry_threshold=90, rsi_exit_threshold=30,
                        stop_atr_mult=2.0, time_stop_bars=2,
                        risk_per_trade=0.01, max_concurrent=4, daily_loss_pct=0.5,
                        commission_pct_roundtrip=0.0, funding_pct_per_4h=0.004)
    t0 = 1_700_000_000
    rows = [
        {"time": t0, "open": 100, "high": 100, "low": 100, "close": 100, "rsi": 95, "atr": 1.0, "short_entry": True},
        {"time": t0 + 3600, "open": 100, "high": 100, "low": 100, "close": 100, "rsi": 95, "atr": 1.0, "short_entry": False},
        # time_stop_bars=2 -> closes here at flat price; only funding should bite
        {"time": t0 + 7200, "open": 100, "high": 100, "low": 100, "close": 100, "rsi": 95, "atr": 1.0, "short_entry": False},
    ]
    sim = simulate_short({"X": _bars(rows)}, cfg, 10_000.0)
    assert len(sim.closed_pnls) == 1
    # flat price, zero fees, but funding > 0 over bars held -> pnl strictly negative
    assert sim.closed_pnls[0] < 0, f"funding should make a flat short negative, got {sim.closed_pnls[0]}"


def main():
    test_winning_short()
    test_stopped_short_is_minus_1R()
    test_funding_drag_accrues()
    print("OK: portfolio short mechanics")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `"C:/Users/Mhair/AppData/Local/Programs/Python/Python311/python.exe" -m crypto_short_mr.test_portfolio`
Expected: FAIL — `ModuleNotFoundError: No module named 'crypto_short_mr.portfolio'`

- [ ] **Step 3: Write the simulator**

Create `crypto_short_mr/portfolio.py`:

```python
"""Short-aware mean-reversion simulator. Self-contained — shares NO state with
the long-only stocks_mean_reversion.portfolio engine.

Short mechanics (vs the long engine):
  - entry OPENS a short at the bar close; stop sits ABOVE entry (entry + k*ATR)
  - size = risk_dollars / (stop - entry)
  - exits checked each bar, first-match wins:
      1. stop hit (gap-aware UP): bar_open >= stop -> fill at bar_open;
         else bar_high >= stop -> fill at stop
      2. time stop: bars_held >= time_stop_bars -> close at bar close
      3. cover on RSI: rsi < rsi_exit_threshold -> close at bar close
  - realized pnl = (entry - exit)*size - exit_fee - funding
  - funding = bars_held * (funding_pct_per_4h/4) * entry * size   (margin drag)
  - R = (entry - exit) / (stop - entry)
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone

import pandas as pd

from .config import ShortMRConfig


@dataclass
class _Position:
    symbol: str
    entry: float
    stop: float
    initial_stop: float
    size: float
    bar_time: int
    atr_at_entry: float
    bars_held: int = 0
    realized_pnl: float = 0.0


def _utc_iso(unix_ts: int) -> str:
    return datetime.fromtimestamp(int(unix_ts), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _utc_day(unix_ts: int) -> str:
    return datetime.fromtimestamp(int(unix_ts), tz=timezone.utc).strftime("%Y-%m-%d")


@dataclass
class SimulationResult:
    events: list[dict] = field(default_factory=list)
    closed_pnls: list[float] = field(default_factory=list)
    closed_r_multiples: list[float] = field(default_factory=list)
    starting_equity: float = 0.0
    ending_equity: float = 0.0
    realized_pnl_total: float = 0.0
    open_at_end: list[dict] = field(default_factory=list)


def simulate_short(per_symbol_signals: dict[str, pd.DataFrame], cfg: ShortMRConfig,
                   starting_equity: float) -> SimulationResult:
    one_side_fee = cfg.commission_pct_roundtrip / 2.0
    funding_per_bar = cfg.funding_pct_per_4h / 4.0  # 1H bars; 4 per 4H window

    merged: list[tuple[int, str, pd.Series]] = []
    for sym, df in per_symbol_signals.items():
        for _, row in df.iterrows():
            merged.append((int(row["time"]), sym, row))
    merged.sort(key=lambda x: x[0])

    open_positions: dict[str, _Position] = {}
    daily_realized: dict[str, float] = {}
    equity = starting_equity
    result = SimulationResult(starting_equity=starting_equity)

    def register_pnl(amount: float, day_utc: str) -> None:
        nonlocal equity
        daily_realized[day_utc] = daily_realized.get(day_utc, 0.0) + amount
        equity += amount

    def emit(event: dict) -> None:
        result.events.append(event)

    def close(pos: _Position, exit_price: float, bar_time: int, reason: str) -> None:
        gross = (pos.entry - exit_price) * pos.size               # short: profit when price falls
        exit_fee = exit_price * pos.size * one_side_fee
        funding = pos.bars_held * funding_per_bar * pos.entry * pos.size
        pnl = gross - exit_fee - funding
        pos.realized_pnl += pnl
        register_pnl(pnl, _utc_day(bar_time))
        r = (pos.entry - exit_price) / (pos.initial_stop - pos.entry)  # denom > 0 (stop above)
        emit({
            "time": _utc_iso(bar_time),
            "action": "CLOSE",
            "symbol": pos.symbol,
            "side": "short",
            "size": pos.size,
            "price": exit_price,
            "stop": None,
            "r": r,
            "pnl": pnl,
            "reason": reason,
        })
        result.closed_pnls.append(pnl)
        result.closed_r_multiples.append(r)
        del open_positions[pos.symbol]

    for bar_time, sym, row in merged:
        # Manage existing position FIRST
        if sym in open_positions:
            pos = open_positions[sym]
            pos.bars_held += 1
            bar_open = row["open"]
            bar_high = row["high"]
            bar_close = row["close"]
            bar_rsi = row.get("rsi")

            # 1. Stop hit (gap-aware on the UP side)
            if bar_open >= pos.stop:
                close(pos, bar_open, bar_time, "exit-stop-gap")
            elif bar_high >= pos.stop:
                close(pos, pos.stop, bar_time, "exit-stop-hit")
            # 2. Time stop
            elif pos.bars_held >= cfg.time_stop_bars:
                close(pos, bar_close, bar_time, "exit-time-stop")
            # 3. Cover on RSI snap-back
            elif bar_rsi is not None and not pd.isna(bar_rsi) and bar_rsi < cfg.rsi_exit_threshold:
                close(pos, bar_close, bar_time, "exit-rsi-cover")

        # Consider new entry (only if no open position on this symbol)
        if row.get("short_entry", False) and sym not in open_positions:
            atr = row["atr"]
            if pd.isna(atr) or atr <= 0:
                continue
            entry_price = float(row["close"])
            stop_price = entry_price + cfg.stop_atr_mult * float(atr)
            if stop_price <= entry_price:
                continue
            if len(open_positions) >= cfg.max_concurrent:
                continue
            day = _utc_day(bar_time)
            if daily_realized.get(day, 0.0) <= -cfg.daily_loss_pct * starting_equity:
                continue

            risk_dollars = equity * cfg.risk_per_trade
            risk_per_unit = stop_price - entry_price
            size = risk_dollars / risk_per_unit
            entry_fee = entry_price * size * one_side_fee
            equity -= entry_fee
            register_pnl(0.0, day)

            pos = _Position(
                symbol=sym, entry=entry_price, stop=stop_price, initial_stop=stop_price,
                size=size, bar_time=int(bar_time), atr_at_entry=float(atr),
                realized_pnl=-entry_fee,
            )
            open_positions[sym] = pos
            emit({
                "time": _utc_iso(int(bar_time)),
                "action": "OPEN",
                "symbol": sym,
                "side": "short",
                "size": size,
                "price": entry_price,
                "stop": stop_price,
                "r": None,
                "pnl": None,
                "reason": "entry-short-failed-rally",
            })

    result.ending_equity = equity
    result.realized_pnl_total = equity - starting_equity
    result.open_at_end = [
        {"symbol": p.symbol, "entry": p.entry, "stop": p.stop, "size": p.size,
         "entry_time": _utc_iso(p.bar_time), "bars_held": p.bars_held, "atr_at_entry": p.atr_at_entry}
        for p in open_positions.values()
    ]
    return result
```

> Note: `test_winning_short` and `test_stopped_short_is_minus_1R` use `commission_pct_roundtrip=0` and `funding_pct_per_4h=0`, so the entry_fee is 0 and the expected pnl numbers are exact. `test_funding_drag_accrues` isolates funding.

- [ ] **Step 4: Run test to verify it passes**

Run: `"C:/Users/Mhair/AppData/Local/Programs/Python/Python311/python.exe" -m crypto_short_mr.test_portfolio`
Expected: `OK: portfolio short mechanics`

- [ ] **Step 5: Re-run the signals test (no regression)**

Run: `"C:/Users/Mhair/AppData/Local/Programs/Python/Python311/python.exe" -m crypto_short_mr.test_signals`
Expected: `OK: signals <N> entries`

---

### Task 4: Generate-log entry point

**Files:**
- Create: `C:\trading\Claude\Trading Strategy\crypto_short_mr\generate_log.py`

- [ ] **Step 1: Write the generator**

Create `crypto_short_mr/generate_log.py`. This mirrors `crypto_mean_reversion/generate_log.py` (same cache, same markdown shape consumed by `adaptCodex`) but calls the SHORT signals + sim and tags rows `side=short`.

```python
"""Nightly entry point for Crypto Short Failed-Rally paper-trade logs.

Reads the crypto-basket OHLC cache (basket_breakout/data/{SYM}_1h.csv + _4h.csv)
— the same cache crypto_mean_reversion uses. Writes trade-log + portfolio
markdown to the leaderboard's data/crypto_variants/ dir in the exact format the
existing codex-local adapter consumes.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import subprocess
import time
from pathlib import Path

import pandas as pd

from .config import CONFIGS, ShortMRConfig, PAPER_START_ISO, SPEC_FREEZE_ISO, LIVE_START_ISO, DEFAULT_STARTING_CAPITAL
from .signals import compute_short_signals
from .portfolio import simulate_short, SimulationResult

HERE = Path(__file__).resolve().parent
TS_ROOT = HERE.parent  # "Trading Strategy"
CRYPTO_DATA_DIR = TS_ROOT / "basket_breakout" / "data"
LEADERBOARD_DATA_DIR = HERE.parents[2] / "strategy-leaderboard" / "data" / "crypto_variants"


def _to_unix(iso: str) -> int:
    return int(dt.datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp())


def _utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_universe(rel_path: str) -> list[str]:
    u = json.loads((TS_ROOT / rel_path).read_text(encoding="utf-8"))
    seen, out = set(), []
    for p in u["pairs"]:
        d = p["display"]
        if d not in seen:
            seen.add(d)
            out.append(d)
    return out


def load_signals(symbols: list[str], cfg: ShortMRConfig, start_unix: int) -> dict[str, pd.DataFrame]:
    end_unix = int(time.time())
    out: dict[str, pd.DataFrame] = {}
    for sym in symbols:
        f1h = CRYPTO_DATA_DIR / f"{sym}_1h.csv"
        f4h = CRYPTO_DATA_DIR / f"{sym}_4h.csv"
        if not (f1h.exists() and f4h.exists()):
            print(f"  skip {sym}: missing cached data", flush=True)
            continue
        sig = compute_short_signals(pd.read_csv(f1h), pd.read_csv(f4h), cfg)
        sig = sig[(sig["time"] >= start_unix) & (sig["time"] < end_unix)].reset_index(drop=True)
        out[sym] = sig
    return out


def _fmt_num(v, decimals: int = 6) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return "—"
    if isinstance(v, float):
        return f"{v:.{decimals}f}".rstrip("0").rstrip(".") or "0"
    return str(v)


def _fmt_signed(v, decimals: int = 2) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return "—"
    return f"{'+' if v >= 0 else ''}{v:.{decimals}f}"


def render_trade_log_md(cfg: ShortMRConfig, sim: SimulationResult, gen: str) -> str:
    n = len(sim.closed_pnls)
    wins = [p for p in sim.closed_pnls if p > 0]
    win_pct = round(100.0 * len(wins) / n, 1) if n else 0.0
    avg_r = round(sum(sim.closed_r_multiples) / len(sim.closed_r_multiples), 3) if sim.closed_r_multiples else 0.0
    lines = [
        f"# {cfg.display_name} — Trade Log",
        "",
        "> **Auto-generated by `crypto_short_mr.generate_log`. Do not edit by hand.**",
        f"> **Last regenerated:** {gen}",
        f"> **Paper backfill start:** {PAPER_START_ISO}",
        f"> **Spec freeze:** {SPEC_FREEZE_ISO}",
        f"> **Live start:** {LIVE_START_ISO} _(honest creation date; pre-today is backtest)_",
        f"> **Venue:** {cfg.venue}",
        f"> **Edge:** SHORT overbought RSI({cfg.rsi_length})>{cfg.rsi_entry_threshold} rips while 4H EMA50<EMA200 and close<4H EMA{cfg.filter_ema_4h} (failed rallies)",
        f"> **Risk/trade:** {cfg.risk_per_trade*100:.2f}%  |  **Heat cap:** {cfg.max_concurrent}  |  **Daily loss circuit:** {cfg.daily_loss_pct*100:.1f}%",
        f"> **Exit:** RSI < {cfg.rsi_exit_threshold} (cover) | {cfg.stop_atr_mult}×ATR stop (above) | {cfg.time_stop_bars}-bar time stop",
        f"> **Costs:** {cfg.commission_pct_roundtrip*100:.2f}% round-trip + {cfg.funding_pct_per_4h*100:.3f}%/4h margin funding",
        "",
        "## Summary",
        "",
        f"- Closed events: **{n}**",
        f"- Win rate: **{win_pct}%**",
        f"- Average R-multiple per closed leg: **{avg_r:+.3f}**",
        f"- Realized PnL (cumulative): **{_fmt_signed(sim.realized_pnl_total)}**",
        f"- Ending equity: **{sim.ending_equity:.2f}** (started {sim.starting_equity:.2f})",
        f"- Open at end: **{len(sim.open_at_end)}**",
        "",
        "## Schema",
        "",
        "| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag |",
        "|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|",
        "",
        "## Entries",
        "",
    ]
    if not sim.events:
        lines.append("_No trade events in window yet._")
    else:
        for ev in sim.events:
            lines.append(
                f"| {ev['time']} | {ev['action']} | {ev['symbol']} | {ev['side']} "
                f"| {_fmt_num(ev['size'], 6)} | {_fmt_num(ev['price'], 4)} | {_fmt_num(ev['stop'], 4)} | — "
                f"| {_fmt_signed(ev['r'], 3) if ev['r'] is not None else '—'} "
                f"| {_fmt_signed(ev['pnl'], 4) if ev['pnl'] is not None else '—'} | {ev['reason']} |"
            )
    return "\n".join(lines) + "\n"


def render_portfolio_md(cfg: ShortMRConfig, sim: SimulationResult, gen: str) -> str:
    cash = sim.starting_equity + sim.realized_pnl_total
    dd = max(0.0, (sim.starting_equity - sim.ending_equity) / sim.starting_equity * 100.0)
    body = (
        f"# {cfg.display_name} — Portfolio Snapshot\n\n"
        f"> Auto-generated by `crypto_short_mr.generate_log`. Last regenerated: {gen}\n\n"
        f"- Cash: **{cash:.2f}**\n"
        f"- Realized PnL (cumulative): **{_fmt_signed(sim.realized_pnl_total)}**\n"
        f"- Unrealized PnL: **0.00** _(simulator does not mark-to-market open positions)_\n"
        f"- Current equity: **{sim.ending_equity:.2f}**\n"
        f"- Equity peak: **{max(sim.starting_equity, sim.ending_equity):.2f}**\n"
        f"- Drawdown from peak: **{dd:.2f}%**\n\n"
        f"## Open positions ({len(sim.open_at_end)})\n\n"
    )
    if sim.open_at_end:
        body += "| Symbol | Entry | Stop | Size | Entry time | Bars held |\n"
        body += "|--------|-------|------|------|------------|-----------|\n"
        body += "\n".join(
            f"| {p['symbol']} | {p['entry']:.4f} | {p['stop']:.4f} | {p['size']:.4f} | {p['entry_time']} | {p['bars_held']} |"
            for p in sim.open_at_end
        )
    else:
        body += "_No open positions._"
    return body + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", default="standard", choices=list(CONFIGS))
    ap.add_argument("--starting-equity", type=float, default=DEFAULT_STARTING_CAPITAL)
    ap.add_argument("--git-commit", action="store_true")
    args = ap.parse_args()

    cfg = CONFIGS[args.variant]
    symbols = load_universe(cfg.universe_path)
    start_unix = _to_unix(PAPER_START_ISO)
    gen = _utc_now_iso()

    print(f"[crypto_short_mr] {cfg.display_name}  universe={cfg.universe_path}  symbols={symbols}", flush=True)
    signals = load_signals(symbols, cfg, start_unix)
    sim = simulate_short(signals, cfg, args.starting_equity)
    print(f"  events: {len(sim.events)}  closed: {len(sim.closed_pnls)}  realized: {sim.realized_pnl_total:+.2f}", flush=True)

    LEADERBOARD_DATA_DIR.mkdir(parents=True, exist_ok=True)
    (LEADERBOARD_DATA_DIR / f"{cfg.key}_trade_log.md").write_text(render_trade_log_md(cfg, sim, gen), encoding="utf-8")
    (LEADERBOARD_DATA_DIR / f"{cfg.key}_portfolio.md").write_text(render_portfolio_md(cfg, sim, gen), encoding="utf-8")
    print(f"  wrote data/crypto_variants/{cfg.key}_{{trade_log,portfolio}}.md", flush=True)

    if args.git_commit:
        repo = HERE.parents[2] / "strategy-leaderboard"
        if (repo / ".git").exists():
            rels = [str((LEADERBOARD_DATA_DIR / f"{cfg.key}_trade_log.md").relative_to(repo)),
                    str((LEADERBOARD_DATA_DIR / f"{cfg.key}_portfolio.md").relative_to(repo))]
            subprocess.run(["git", "-C", str(repo), "add", "--", *rels], check=True)
            if subprocess.run(["git", "-C", str(repo), "diff", "--cached", "--quiet"], check=False).returncode != 0:
                subprocess.run(["git", "-C", str(repo), "commit", "-m",
                                f"crypto-short nightly: regenerated {cfg.key} {gen}"], check=True)
                subprocess.run(["git", "-C", str(repo), "push"], check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: First real regen for both variants**

Run (CWD = `C:\trading\Claude\Trading Strategy`):
```
"C:/Users/Mhair/AppData/Local/Programs/Python/Python311/python.exe" -m crypto_short_mr.generate_log --variant standard
"C:/Users/Mhair/AppData/Local/Programs/Python/Python311/python.exe" -m crypto_short_mr.generate_log --variant aggressive
```
Expected: each prints `events: N  closed: M  realized: +/-X.XX` and `wrote data/crypto_variants/...`. In the current crypto downtrend, the standard variant should show **N >= 1** events (proves the gate + entry fire). If N == 0, STOP and check the regime gate (4H EMA50<EMA200 should hold now).

- [ ] **Step 3: Eyeball the output**

Read `C:\trading\strategy-leaderboard\data\crypto_variants\crypto_short_failed_rally_trade_log.md`.
Verify: rows show `Side = short`, OPEN price < Stop (stop above), reason `entry-short-failed-rally`, and the Costs header line is present.

---

### Task 5: Register on the leaderboard + smoke test

**Files:**
- Modify: `C:\trading\strategy-leaderboard\registry.js` (append two entries to the STRATEGIES array, before the closing `];`)

- [ ] **Step 1: Add the two registry entries**

In `registry.js`, locate the end of the `STRATEGIES` array (the last strategy object before `];`). Insert these two objects immediately after the last entry:

```javascript
  // ----- 2026-06-05 Crypto Short Failed-Rally (plugs BULL long-bias hole) -----
  // Spec: strategies/crypto-short-failed-rally-2026-06-05-design.md
  // Net-short mirror of the long Connors MR: short RSI(2)>90 overbought rips
  // while 4H EMA50<EMA200 and price<4H EMA50 (failed rallies in a downtrend).
  // live_start_iso = 2026-06-05 (HONEST). Pre-today is backtest, excluded from
  // contest equity by the adapter. Costs model Kraken margin-short (fees+funding).
  {
    name: 'Crypto Short Failed-Rally',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-06-05T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/crypto_variants/crypto_short_failed_rally_portfolio.md',
      trade_log_path: 'data/crypto_variants/crypto_short_failed_rally_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'Crypto Short Failed-Rally Aggressive',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-06-05T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/crypto_variants/crypto_short_failed_rally_agg_portfolio.md',
      trade_log_path: 'data/crypto_variants/crypto_short_failed_rally_agg_trade_log.md',
    },
    adapter: adaptCodex,
  },
```

(Confirm `adaptCodex` is already imported at the top of `registry.js` — it is, every CODEX/local strategy uses it.)

- [ ] **Step 2: Run the smoke test**

Run (CWD = `C:\trading\strategy-leaderboard`): `node scripts/smoke.js`
Expected: header reads `Fetching live data for all 72 strategies…`, the two `Crypto Short Failed-Rally` rows appear with `status live`, and the final line is `✅ All 72 rows have valid StrategyRow shape`.

- [ ] **Step 3: Commit (leaderboard repo)**

```bash
cd "C:/trading/strategy-leaderboard"
git add registry.js data/crypto_variants/crypto_short_failed_rally_portfolio.md data/crypto_variants/crypto_short_failed_rally_trade_log.md data/crypto_variants/crypto_short_failed_rally_agg_portfolio.md data/crypto_variants/crypto_short_failed_rally_agg_trade_log.md
git commit -m "feat: add Crypto Short Failed-Rally sleeve (standard + aggressive)

Net-short, regime-gated mirror of the long Connors MR. Plugs the BULL
long-bias hole found in the 2026-06-04 contest audit. New isolated
crypto_short_mr module with its own short-aware simulator; the long-only
engine shared by ~17 strategies is untouched."
```

> If commit fails with `index.lock exists` and no active git process, the lock is stale (a known nightly-crash artifact) — remove it with `rm -f .git/index.lock` and retry.

---

### Task 6: Wire into the nightly + final verify

**Files:**
- Modify: `C:\trading\Claude\Trading Strategy\run-stock-nightly.bat`

- [ ] **Step 1: Find where crypto is regenerated**

Read `run-stock-nightly.bat`. Find the line that runs `crypto_mean_reversion.generate_log` (or the crypto block). The short variants MUST run AFTER the crypto cache is refreshed (same cache-ordering lesson as the stocks fix) — i.e., after `basket_breakout` / crypto fetch, alongside `crypto_mean_reversion`.

- [ ] **Step 2: Add the two short-variant regen lines**

Immediately after the existing `crypto_mean_reversion` regen line(s), add:

```bat
"%PY%" -m crypto_short_mr.generate_log --variant standard --git-commit >> "%LOGFILE%" 2>&1
"%PY%" -m crypto_short_mr.generate_log --variant aggressive --git-commit >> "%LOGFILE%" 2>&1
```

(Match the exact `%PY%` / `%LOGFILE%` variable names already used in the file.)

- [ ] **Step 3: Dry-run the two lines manually to confirm they work in batch context**

Run (CWD = `C:\trading\Claude\Trading Strategy`):
```
"C:/Users/Mhair/AppData/Local/Programs/Python/Python311/python.exe" -m crypto_short_mr.generate_log --variant standard
"C:/Users/Mhair/AppData/Local/Programs/Python/Python311/python.exe" -m crypto_short_mr.generate_log --variant aggressive
```
Expected: both regenerate without error; `git status` in the leaderboard repo shows the 4 crypto_short files modified (or clean if unchanged since Task 5).

- [ ] **Step 4: Final smoke + confirm freshness**

Run (CWD = `C:\trading\strategy-leaderboard`): `node scripts/smoke.js | tail -6`
Expected: `✅ All 72 rows have valid StrategyRow shape`.

---

## Self-Review

**Spec coverage:**
- §2 edge (inverted RSI/regime/filter/exit/stop) → Task 2 signals + Task 3 simulator ✓
- §4 parameters (standard + aggressive) → Task 1 config ✓
- §5 architecture (new isolated module, no edit to shared engine) → Tasks 1-4, explicitly no change to `stocks_mean_reversion/portfolio.py` ✓
- §6 margin-short costs (0.52% RT + 0.02%/4h funding) → config fields + `close()` funding term + Task 3 funding test ✓
- §7 leaderboard integration (2 registry entries, codex-local, live_start today, data files) → Task 5 ✓
- §8 testing (unit-test short sim + smoke 72 rows + regime-fires sanity) → Tasks 3, 5, 4-step2 ✓
- §7 nightly wiring → Task 6 ✓

**Placeholder scan:** none — all code blocks are complete; no TBD/TODO.

**Type consistency:** `ShortMRConfig` fields referenced in signals (`ema_fast_4h`, `ema_slow_4h`, `filter_ema_4h`, `rsi_entry_threshold`) and portfolio (`stop_atr_mult`, `rsi_exit_threshold`, `time_stop_bars`, `risk_per_trade`, `max_concurrent`, `daily_loss_pct`, `commission_pct_roundtrip`, `funding_pct_per_4h`) all match the dataclass in Task 1. `compute_short_signals` / `simulate_short` / `SimulationResult` names are consistent across Tasks 2-4. Event dict keys (`action`, `symbol`, `side`, `size`, `price`, `stop`, `r`, `pnl`, `reason`) match what `render_trade_log_md` reads.

**Note on worktree:** the code dir (`Trading Strategy`) is not a git repo, so the brainstorming-skill worktree convention doesn't apply; edits are made in place and only the leaderboard repo receives commits (consistent with every prior strategy add this session).
