"""FABLE strategy family — configs and signal builders.

Seven independent strategies entered into the leaderboard 2026-06-10 by the
FABLE agent (Claude Fable 5). Design goal: an uncorrelated book — two-way
mean reversion, a dedicated short leg, a trend leg, a gap-fade leg, and two
crypto legs — so the top-5-profit score has earning legs in any regime,
with high trade frequency from a wide-15 equity universe and a 24/7
8-pair crypto universe.

All signals are computed on cached OHLC shared with the rest of the repo
(yfinance equities cache + Kraken crypto cache). Daily/4H regime columns are
shifted one completed bar — no look-ahead.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from .indicators import ema, rsi, atr, adx, zscore, bollinger_pct_b, align_daily_to_intraday

STOCKS_DATA = Path(r"C:\trading\Claude\Trading Strategy\basket_breakout_stocks\data")
CRYPTO_DATA = Path(r"C:\trading\Claude\Trading Strategy\basket_breakout\data")

WIDE15 = ["NVDA", "AMD", "AVGO", "AAPL", "PLTR", "META", "NFLX", "DIS",
          "TSLA", "NKE", "OXY", "JPM", "LLY", "CAT", "FCX"]
CRYPTO8 = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "DOT", "LINK"]

PAPER_START_ISO = "2026-04-16T13:30:00Z"
LIVE_START_ISO = "2026-06-10T00:00:00Z"   # honest creation date — pre-today is backtest


@dataclass
class FableConfig:
    key: str
    display_name: str
    venue: str
    edge_line: str
    entry_line: str
    exit_line: str
    asset_class: str                  # "stocks" | "crypto"
    bar_suffix: str                   # "_1h" | "_4h"
    universe: list = field(default_factory=list)
    risk_per_trade: float = 0.01
    max_concurrent: int = 4
    daily_loss_pct: float = 0.04
    stop_atr_mult: float = 2.0
    time_stop_bars: int | None = 24
    trail_atr_mult: float | None = None
    trail_activate_r: float = 1.0
    commission_pct_roundtrip: float = 0.001   # equities ~0.10% RT; crypto 0.52%
    entry_reason_tag: str = "entry-fable"
    signal_builder: str = ""


# ---------------------------------------------------------------- loaders

def _load(sym: str, cfg: FableConfig) -> tuple[pd.DataFrame, pd.DataFrame]:
    base = STOCKS_DATA if cfg.asset_class == "stocks" else CRYPTO_DATA
    intraday = pd.read_csv(base / f"{sym}{cfg.bar_suffix}.csv")
    if cfg.asset_class == "stocks":
        higher = pd.read_csv(base / f"{sym}_1d.csv")
    else:
        higher = pd.read_csv(base / f"{sym}_4h.csv")
    return intraday, higher


def _higher_tf_regime(higher: pd.DataFrame) -> pd.DataFrame:
    h = higher.copy()
    h["ema20_h"] = ema(h["close"], 20)
    h["ema50_h"] = ema(h["close"], 50)
    h["ema200_h"] = ema(h["close"], 200)
    h["adx_h"] = adx(h, 14)
    return h


def _attach_regime(intraday: pd.DataFrame, higher: pd.DataFrame) -> pd.DataFrame:
    h = _higher_tf_regime(higher)
    return align_daily_to_intraday(
        intraday, h, ["ema20_h", "ema50_h", "ema200_h", "adx_h"])


# ---------------------------------------------------------------- signals

def sig_snapback(intraday, higher, cfg, *, turbo: bool = False):
    df = _attach_regime(intraday, higher)
    df["atr"] = atr(df, 14)
    df["z"] = zscore(df["close"], 20)
    up = df["ema50_h"] > df["ema200_h"]
    dn = df["ema50_h"] < df["ema200_h"]
    df["long_entry"] = up & (df["z"] < -2.0)
    df["short_entry"] = dn & (df["z"] > 2.2) & ~df["long_entry"]
    exit_z = 0.5 if turbo else 0.0
    df["exit_long"] = df["z"] >= exit_z
    df["exit_short"] = df["z"] <= -exit_z
    df["entry_target"] = np.nan
    return df


def sig_afterburner(intraday, higher, cfg):
    df = _attach_regime(intraday, higher)
    df["atr"] = atr(df, 14)
    df["ema20"] = ema(df["close"], 20)
    df["ema50"] = ema(df["close"], 50)
    hh = df["close"].rolling(40).max()
    df["long_entry"] = (
        (df["ema50_h"] > df["ema200_h"]) & (df["adx_h"] > 18)
        & (df["ema20"] > df["ema50"]) & (df["close"] >= hh)
    )
    df["short_entry"] = False
    df["exit_long"] = False          # trail/time only
    df["exit_short"] = False
    df["entry_target"] = np.nan
    return df


def sig_fader(intraday, higher, cfg):
    df = _attach_regime(intraday, higher)
    df["atr"] = atr(df, 14)
    df["z"] = zscore(df["close"], 20)
    df["rsi2"] = rsi(df["close"], 2)
    extended = df["close"] > df["ema20_h"] * 1.06
    df["short_entry"] = (extended | (df["z"] > 2.5)) & (df["rsi2"] > 95)
    df["long_entry"] = False
    df["exit_short"] = (df["rsi2"] < 30) | (df["z"] <= 0.0)
    df["exit_long"] = False
    df["entry_target"] = np.nan
    return df


def sig_gap_snap(intraday, higher, cfg):
    df = _attach_regime(intraday, higher)
    df["atr"] = atr(df, 14)
    ts = pd.to_datetime(df["time"], unit="s", utc=True)
    day = ts.dt.date
    first_bar = day != day.shift(1)
    prior_close = df["close"].shift(1)
    gap = (df["open"] - prior_close) / prior_close
    up = df["ema50_h"] > df["ema200_h"]
    dn = df["ema50_h"] < df["ema200_h"]
    long_sig = first_bar & (gap < -0.0125) & up & (df["close"] < prior_close)
    short_sig = first_bar & (gap > 0.0125) & dn & (df["close"] > prior_close)
    df["long_entry"] = long_sig
    df["short_entry"] = short_sig & ~long_sig
    df["exit_long"] = False
    df["exit_short"] = False
    df["entry_target"] = np.where(long_sig | short_sig, prior_close, np.nan)
    return df


def sig_crypto_pulse(intraday, higher, cfg):
    df = _attach_regime(intraday, higher)
    df["atr"] = atr(df, 14)
    pct_b, mid, width = bollinger_pct_b(df["close"], 20, 2.0)
    df["pct_b"] = pct_b
    df["bb_mid"] = mid
    fee_clearing = width > (3.0 * cfg.commission_pct_roundtrip)
    up = df["ema50_h"] > df["ema200_h"]
    dn = df["ema50_h"] < df["ema200_h"]
    df["long_entry"] = up & (pct_b < 0.0) & fee_clearing
    df["short_entry"] = dn & (pct_b > 1.0) & fee_clearing & ~df["long_entry"]
    df["exit_long"] = df["close"] >= df["bb_mid"]
    df["exit_short"] = df["close"] <= df["bb_mid"]
    df["entry_target"] = np.nan
    return df


def sig_crypto_drift(intraday, higher, cfg):
    # intraday here is the 4H series itself; regime attach shifts one
    # completed 4H bar (no look-ahead).
    df = _attach_regime(intraday, higher)
    df["atr"] = atr(df, 14)
    e20, e50, e200 = ema(df["close"], 20), ema(df["close"], 50), ema(df["close"], 200)
    hh = df["close"].rolling(30).max()
    ll = df["close"].rolling(30).min()
    df["long_entry"] = (e20 > e50) & (e50 > e200) & (df["close"] >= hh)
    df["short_entry"] = (e20 < e50) & (e50 < e200) & (df["close"] <= ll) & ~df["long_entry"]
    df["exit_long"] = False
    df["exit_short"] = False
    df["entry_target"] = np.nan
    return df


SIGNALS = {
    "snapback": lambda i, h, c: sig_snapback(i, h, c, turbo=False),
    "snapback_turbo": lambda i, h, c: sig_snapback(i, h, c, turbo=True),
    "afterburner": sig_afterburner,
    "fader": sig_fader,
    "gap_snap": sig_gap_snap,
    "crypto_pulse": sig_crypto_pulse,
    "crypto_drift": sig_crypto_drift,
}


CONFIGS = {
    "fable_snapback_ls": FableConfig(
        key="fable_snapback_ls",
        display_name="FABLE Equities Snapback L/S v1",
        venue="US equities 1H RTH - wide-15, two-way z-score mean reversion",
        edge_line="Regime-aligned two-way reversion: buy 2-sigma dips in daily uptrends, fade 2.2-sigma rips in daily downtrends",
        entry_line="long z(20)<-2.0 in EMA50>EMA200 regime; short z(20)>+2.2 in EMA50<EMA200 regime",
        exit_line="z mean-touch TP | 2.0xATR stop | 24-bar time stop",
        asset_class="stocks", bar_suffix="_1h", universe=WIDE15,
        risk_per_trade=0.01, max_concurrent=5, daily_loss_pct=0.04,
        stop_atr_mult=2.0, time_stop_bars=24,
        entry_reason_tag="entry-zscore-snapback", signal_builder="snapback",
    ),
    "fable_snapback_turbo": FableConfig(
        key="fable_snapback_turbo",
        display_name="FABLE Equities Snapback Turbo",
        venue="US equities 1H RTH - wide-15, two-way z-score MR, magnitude sizing",
        edge_line="Snapback signals at 2.5% risk with extended exit (z>+0.5) - the top-5-profit magnitude leg",
        entry_line="same signals as Snapback L/S v1",
        exit_line="z>+0.5 TP | 2.5xATR stop | 30-bar time stop",
        asset_class="stocks", bar_suffix="_1h", universe=WIDE15,
        risk_per_trade=0.025, max_concurrent=6, daily_loss_pct=0.08,
        stop_atr_mult=2.5, time_stop_bars=30,
        entry_reason_tag="entry-zscore-snapback", signal_builder="snapback_turbo",
    ),
    "fable_afterburner": FableConfig(
        key="fable_afterburner",
        display_name="FABLE Equities Afterburner v1",
        venue="US equities 1H RTH - wide-15, ADX-gated trend continuation",
        edge_line="Confirmed-trend continuation rides the fat right tail; daily ADX gate keeps it out of chop",
        entry_line="daily EMA50>EMA200 + daily ADX>18 + 1h EMA20>EMA50 + 40-bar closing high",
        exit_line="3.0xATR trail from +1R | 2.5xATR initial stop | 60-bar time stop",
        asset_class="stocks", bar_suffix="_1h", universe=WIDE15,
        risk_per_trade=0.015, max_concurrent=4, daily_loss_pct=0.05,
        stop_atr_mult=2.5, time_stop_bars=60,
        trail_atr_mult=3.0, trail_activate_r=1.0,
        entry_reason_tag="entry-trend-continuation", signal_builder="afterburner",
    ),
    "fable_fader": FableConfig(
        key="fable_fader",
        display_name="FABLE Equities Fader v1",
        venue="US equities 1H RTH - wide-15, short-only extension fade",
        edge_line="Dedicated short leg / regime insurance: fade extensions (>6% over daily EMA20 or z>+2.5) at RSI(2)>95 exhaustion; expected to bleed slightly in bull tapes and pay in selloffs",
        entry_line="short when (close>1.06x daily EMA20 OR z(20)>+2.5) AND RSI(2)>95",
        exit_line="RSI(2)<30 or z mean-touch TP | 2.0xATR stop | 16-bar time stop",
        asset_class="stocks", bar_suffix="_1h", universe=WIDE15,
        risk_per_trade=0.01, max_concurrent=3, daily_loss_pct=0.04,
        stop_atr_mult=2.0, time_stop_bars=16,
        entry_reason_tag="entry-extension-fade", signal_builder="fader",
    ),
    "fable_gap_snap": FableConfig(
        key="fable_gap_snap",
        display_name="FABLE Equities Gap Snap v1",
        venue="US equities 1H RTH - wide-15, regime-aligned overnight gap fade",
        edge_line="Fade >1.25% overnight gaps against the daily trend; target = gap fill at prior close",
        entry_line="first RTH bar: gap-down >1.25% in uptrend -> long; gap-up >1.25% in downtrend -> short",
        exit_line="gap-fill target | 1.5xATR stop | 6-bar (EOD) time stop",
        asset_class="stocks", bar_suffix="_1h", universe=WIDE15,
        risk_per_trade=0.0125, max_concurrent=4, daily_loss_pct=0.04,
        stop_atr_mult=1.5, time_stop_bars=6,
        entry_reason_tag="entry-gap-fade", signal_builder="gap_snap",
    ),
    "fable_crypto_pulse": FableConfig(
        key="fable_crypto_pulse",
        display_name="FABLE Crypto Pulse L/S v1",
        venue="Kraken USD spot 4H - 8 pairs, two-way Bollinger reversion, fee-aware",
        edge_line="Band reversion both ways, gated to setups where band width >3x round-trip fee - the commission-drag fix built in from day one",
        entry_line="long pctB<0 in 4H EMA50>EMA200; short pctB>1 in 4H EMA50<EMA200; band width must clear 3x fees",
        exit_line="mid-band TP | 2.5xATR stop | 18-bar (3-day) time stop",
        asset_class="crypto", bar_suffix="_4h", universe=CRYPTO8,
        risk_per_trade=0.015, max_concurrent=4, daily_loss_pct=0.05,
        stop_atr_mult=2.5, time_stop_bars=18,
        commission_pct_roundtrip=0.0052,
        entry_reason_tag="entry-band-reversion", signal_builder="crypto_pulse",
    ),
    "fable_crypto_drift": FableConfig(
        key="fable_crypto_drift",
        display_name="FABLE Crypto Drift v1",
        venue="Kraken USD spot 4H - 8 pairs, stacked-EMA trend rider, long and short",
        edge_line="Crypto trends hard both directions; stacked EMA alignment + 30-bar extreme entry, wide trail, no TP",
        entry_line="long EMA20>50>200 + 30-bar closing high; short EMA20<50<200 + 30-bar closing low",
        exit_line="3.0xATR trail from +1R | 2.5xATR initial stop | no time stop",
        asset_class="crypto", bar_suffix="_4h", universe=CRYPTO8,
        risk_per_trade=0.02, max_concurrent=3, daily_loss_pct=0.06,
        stop_atr_mult=2.5, time_stop_bars=None,
        trail_atr_mult=3.0, trail_activate_r=1.0,
        commission_pct_roundtrip=0.0052,
        entry_reason_tag="entry-trend-drift", signal_builder="crypto_drift",
    ),
}


