"""FABLE engine — indicator library.

Independent implementation for the FABLE strategy family (entered the
leaderboard 2026-06-10). Wilder-style RSI/ATR/ADX, EMA, rolling z-score,
Bollinger %B. Pure pandas/numpy; no dependency on other competitors' code.
"""
from __future__ import annotations
import numpy as np
import pandas as pd


def ema(series: pd.Series, length: int) -> pd.Series:
    return series.ewm(span=length, adjust=False).mean()


def wilder_rma(series: pd.Series, length: int) -> pd.Series:
    return series.ewm(alpha=1.0 / length, adjust=False).mean()


def rsi(close: pd.Series, length: int = 2) -> pd.Series:
    delta = close.diff()
    gain = wilder_rma(delta.clip(lower=0.0), length)
    loss = wilder_rma((-delta).clip(lower=0.0), length)
    rs = gain / loss.replace(0.0, np.nan)
    out = 100.0 - 100.0 / (1.0 + rs)
    return out.fillna(50.0)


def atr(df: pd.DataFrame, length: int = 14) -> pd.Series:
    prev_close = df["close"].shift(1)
    tr = pd.concat([
        df["high"] - df["low"],
        (df["high"] - prev_close).abs(),
        (df["low"] - prev_close).abs(),
    ], axis=1).max(axis=1)
    return wilder_rma(tr, length)


def adx(df: pd.DataFrame, length: int = 14) -> pd.Series:
    up = df["high"].diff()
    dn = -df["low"].diff()
    plus_dm = pd.Series(np.where((up > dn) & (up > 0), up, 0.0), index=df.index)
    minus_dm = pd.Series(np.where((dn > up) & (dn > 0), dn, 0.0), index=df.index)
    tr = atr(df, length)
    plus_di = 100.0 * wilder_rma(plus_dm, length) / tr.replace(0.0, np.nan)
    minus_di = 100.0 * wilder_rma(minus_dm, length) / tr.replace(0.0, np.nan)
    dx = 100.0 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0.0, np.nan)
    return wilder_rma(dx.fillna(0.0), length)


def zscore(close: pd.Series, length: int = 20) -> pd.Series:
    mean = close.rolling(length).mean()
    std = close.rolling(length).std(ddof=0)
    return (close - mean) / std.replace(0.0, np.nan)


def bollinger_pct_b(close: pd.Series, length: int = 20, mult: float = 2.0):
    """Returns (%B, mid, band_width_pct). band_width_pct = (upper-mid)/mid."""
    mid = close.rolling(length).mean()
    std = close.rolling(length).std(ddof=0)
    upper = mid + mult * std
    lower = mid - mult * std
    rng = (upper - lower).replace(0.0, np.nan)
    pct_b = (close - lower) / rng
    width_pct = (upper - mid) / mid
    return pct_b, mid, width_pct


def align_daily_to_intraday(intraday: pd.DataFrame, daily: pd.DataFrame,
                            cols: list[str]) -> pd.DataFrame:
    """Attach daily-bar columns to intraday bars using only COMPLETED daily
    bars (the daily bar is shifted forward one day) — no look-ahead."""
    d = daily.copy().sort_values("time").reset_index(drop=True)
    # value known starting the bar AFTER the daily bar's own session
    d_shift = d[cols].shift(1)
    d_shift["time"] = d["time"]
    merged = pd.merge_asof(
        intraday.sort_values("time"), d_shift.sort_values("time"),
        on="time", direction="backward", suffixes=("", "_d"),
    )
    return merged
