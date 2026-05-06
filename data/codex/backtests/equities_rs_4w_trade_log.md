# CODEX Equities RS Pullback v1 4W Backtest Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries
| 2026-04-10T17:30:00Z | OPEN | AVGO | long | 5.348278 | 373.9521 | 364.6033 | 387.0405 | - | - | equities_relative_strength_pullback | equities_rs_pullback |
| 2026-04-10T19:30:00Z | CLOSE | AVGO | long | 5.348278 | 371.5600 | - | - | -0.46 | -23.16 | eod-exit | equities_rs_pullback |
| 2026-04-14T15:30:00Z | OPEN | HOOD | long | 25.207300 | 79.1583 | 77.1794 | 81.9289 | - | - | equities_relative_strength_pullback | equities_rs_pullback |
| 2026-04-14T15:30:00Z | OPEN | SMCI | long | 72.352905 | 27.5783 | 26.8888 | 28.5435 | - | - | equities_relative_strength_pullback | equities_rs_pullback |
| 2026-04-14T19:30:00Z | CLOSE | HOOD | long | 25.207300 | 79.0900 | - | - | -0.24 | -12.09 | eod-exit | equities_rs_pullback |
| 2026-04-14T19:30:00Z | CLOSE | SMCI | long | 72.352905 | 27.2200 | - | - | -0.73 | -36.23 | eod-exit | equities_rs_pullback |
| 2026-04-14T19:30:00Z | OPEN | HOOD | long | 25.099362 | 79.1137 | 77.1359 | 81.8827 | - | - | equities_relative_strength_pullback | equities_rs_pullback |
| 2026-04-15T13:30:00Z | CLOSE | HOOD | long | 25.099362 | 85.8198 | - | - | +3.17 | +157.56 | target-hit | equities_rs_pullback |
| 2026-04-22T16:30:00Z | OPEN | PLTR | long | 13.261943 | 152.1056 | 148.3030 | 157.4293 | - | - | equities_relative_strength_pullback | equities_rs_pullback |
| 2026-04-22T19:30:00Z | CLOSE | PLTR | long | 13.261943 | 152.6000 | - | - | -0.08 | -3.95 | eod-exit | equities_rs_pullback |
| 2026-05-04T16:30:00Z | OPEN | HOOD | long | 26.108293 | 77.2332 | 75.3023 | 79.9363 | - | - | equities_relative_strength_pullback | equities_rs_pullback |
| 2026-05-04T17:30:00Z | OPEN | SMCI | long | 71.272794 | 28.2746 | 27.5677 | 29.2642 | - | - | equities_relative_strength_pullback | equities_rs_pullback |
| 2026-05-04T19:30:00Z | CLOSE | HOOD | long | 26.108293 | 76.5800 | - | - | -0.55 | -27.49 | eod-exit | equities_rs_pullback |
| 2026-05-04T19:30:00Z | CLOSE | SMCI | long | 71.272794 | 27.9100 | - | - | -0.72 | -36.40 | eod-exit | equities_rs_pullback |
