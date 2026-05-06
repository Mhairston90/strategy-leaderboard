# CODEX Regime WFO v1 4W Backtest Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries
| 2026-04-09T16:00:00Z | OPEN | SOL/USD | long | 29.694006 | 84.1921 | 80.4617 | 92.0258 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-10T04:00:00Z | OPEN | AVAX/USD | long | 268.542190 | 9.2746 | 8.7700 | 10.3343 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-10T16:00:00Z | OPEN | LINK/USD | long | 275.609458 | 9.1666 | 8.7284 | 10.0870 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-11T16:00:00Z | CLOSE | SOL/USD | long | 29.694006 | 86.0400 | - | - | +0.38 | +41.73 | time-stop | regime_trend |
| 2026-04-11T16:00:00Z | OPEN | SOL/USD | long | 29.481336 | 86.0830 | 83.0701 | 92.4101 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-12T00:00:00Z | CLOSE | SOL/USD | long | 29.481336 | 82.4000 | - | - | -1.37 | -121.49 | stop-hit | regime_trend |
| 2026-04-12T04:00:00Z | CLOSE | AVAX/USD | long | 268.542190 | 9.0200 | - | - | -0.60 | -81.14 | time-stop | regime_trend |
| 2026-04-12T12:00:00Z | CLOSE | LINK/USD | long | 275.609458 | 8.7211 | - | - | -1.12 | -135.60 | stop-hit | regime_trend |
| 2026-04-13T20:00:00Z | OPEN | LINK/USD | long | 259.051246 | 9.3645 | 8.9750 | 10.1824 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-13T20:00:00Z | OPEN | AVAX/USD | long | 251.000276 | 9.6648 | 9.2739 | 10.4858 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-13T20:00:00Z | OPEN | SOL/USD | long | 28.004882 | 86.6233 | 83.5915 | 92.9901 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-15T00:00:00Z | CLOSE | SOL/USD | long | 28.004882 | 83.5000 | - | - | -1.18 | -99.85 | stop-hit | regime_trend |
| 2026-04-15T04:00:00Z | CLOSE | AVAX/USD | long | 251.000276 | 9.2700 | - | - | -1.14 | -111.45 | stop-hit | regime_trend |
| 2026-04-15T16:00:00Z | OPEN | AVAX/USD | long | 248.382195 | 9.5448 | 9.2107 | 10.2463 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-15T16:00:00Z | OPEN | SOL/USD | long | 27.701264 | 85.5828 | 82.5874 | 91.8731 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-15T20:00:00Z | CLOSE | LINK/USD | long | 259.051246 | 9.2597 | - | - | -0.39 | -39.68 | time-stop | regime_trend |
| 2026-04-15T20:00:00Z | OPEN | LINK/USD | long | 253.879633 | 9.2644 | 8.9401 | 9.9453 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-16T04:00:00Z | OPEN | LTC/USD | long | 42.436798 | 55.5878 | 53.6422 | 59.6735 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-17T16:00:00Z | CLOSE | AVAX/USD | long | 248.382195 | 9.8000 | - | - | +0.61 | +50.89 | time-stop | regime_trend |
| 2026-04-17T16:00:00Z | CLOSE | SOL/USD | long | 27.701264 | 89.2700 | - | - | +1.08 | +89.55 | time-stop | regime_trend |
| 2026-04-17T16:00:00Z | OPEN | SOL/USD | long | 27.283507 | 89.3146 | 85.8578 | 96.5739 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-17T16:00:00Z | OPEN | AVAX/USD | long | 248.530477 | 9.8049 | 9.4617 | 10.5256 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-17T20:00:00Z | CLOSE | LINK/USD | long | 253.879633 | 9.6243 | - | - | +0.96 | +78.90 | time-stop | regime_trend |
| 2026-04-17T20:00:00Z | OPEN | LINK/USD | long | 251.259216 | 9.6291 | 9.2921 | 10.3368 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-18T04:00:00Z | CLOSE | LTC/USD | long | 42.436798 | 56.6300 | - | - | +0.39 | +31.85 | time-stop | regime_trend |
| 2026-04-18T04:00:00Z | OPEN | LTC/USD | long | 42.547645 | 56.6583 | 54.6753 | 60.8227 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-18T08:00:00Z | CLOSE | AVAX/USD | long | 248.530477 | 9.4000 | - | - | -1.33 | -113.04 | stop-hit | regime_trend |
| 2026-04-18T16:00:00Z | CLOSE | LINK/USD | long | 251.259216 | 9.2889 | - | - | -1.16 | -97.84 | stop-hit | regime_trend |
| 2026-04-19T00:00:00Z | CLOSE | SOL/USD | long | 27.283507 | 85.6400 | - | - | -1.19 | -112.67 | stop-hit | regime_trend |
| 2026-04-19T20:00:00Z | CLOSE | LTC/USD | long | 42.547645 | 54.0800 | - | - | -1.45 | -121.95 | stop-hit | regime_trend |
| 2026-04-22T08:00:00Z | OPEN | SOL/USD | long | 26.187410 | 88.3842 | 85.2907 | 94.8804 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-04-24T08:00:00Z | CLOSE | SOL/USD | long | 26.187410 | 86.2300 | - | - | -0.84 | -68.30 | time-stop | regime_trend |
