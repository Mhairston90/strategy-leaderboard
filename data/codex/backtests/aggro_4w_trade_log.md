# CODEX Aggro v0 4W Backtest Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries
| 2026-04-08T20:00:00Z | OPEN | LINK/USD | short | 395.095912 | 8.8586 | 9.1687 | 8.1942 | - | - | aggro_short_momentum_breakdown | aggro_momentum |
| 2026-04-08T20:00:00Z | OPEN | ADA/USD | short | 13968.227702 | 0.2506 | 0.2593 | 0.2318 | - | - | aggro_short_momentum_breakdown | aggro_momentum |
| 2026-04-08T20:00:00Z | OPEN | AVAX/USD | short | 386.506719 | 9.0555 | 9.3724 | 8.3763 | - | - | aggro_short_momentum_breakdown | aggro_momentum |
| 2026-04-09T00:00:00Z | OPEN | DOT/USD | short | 2811.816603 | 1.2536 | 1.2974 | 1.1596 | - | - | aggro_short_momentum_breakdown | aggro_momentum |
| 2026-04-09T12:00:00Z | CLOSE | LINK/USD | short | 395.095912 | 8.9420 | - | - | -0.42 | -51.22 | time-stop | aggro_momentum |
| 2026-04-09T12:00:00Z | CLOSE | ADA/USD | short | 13968.227702 | 0.2546 | - | - | -0.61 | -73.59 | time-stop | aggro_momentum |
| 2026-04-09T12:00:00Z | CLOSE | AVAX/USD | short | 386.506719 | 9.3300 | - | - | -1.02 | -124.57 | time-stop | aggro_momentum |
| 2026-04-09T16:00:00Z | CLOSE | DOT/USD | short | 2811.816603 | 1.3081 | - | - | -1.40 | -171.97 | stop-hit | aggro_momentum |
| 2026-04-10T16:00:00Z | OPEN | DOGE/USD | long | 35235.371039 | 0.0951 | 0.0918 | 0.1023 | - | - | aggro_long_momentum_breakout | aggro_momentum |
| 2026-04-11T08:00:00Z | CLOSE | DOGE/USD | long | 35235.371039 | 0.0930 | - | - | -0.79 | -92.21 | time-stop | aggro_momentum |
| 2026-04-11T12:00:00Z | OPEN | ADA/USD | short | 13373.248621 | 0.2483 | 0.2570 | 0.2297 | - | - | aggro_short_momentum_breakdown | aggro_momentum |
| 2026-04-11T16:00:00Z | OPEN | ETH/USD | long | 1.420496 | 2318.0184 | 2236.8878 | 2491.8698 | - | - | aggro_long_momentum_breakout | aggro_momentum |
| 2026-04-11T16:00:00Z | OPEN | LINK/USD | long | 355.147061 | 9.2715 | 8.9470 | 9.9668 | - | - | aggro_long_momentum_breakout | aggro_momentum |
| 2026-04-11T16:00:00Z | OPEN | LTC/USD | long | 59.117855 | 55.6978 | 53.7484 | 59.8752 | - | - | aggro_long_momentum_breakout | aggro_momentum |
| 2026-04-11T16:00:00Z | OPEN | SOL/USD | long | 38.250709 | 86.0830 | 83.0701 | 92.5392 | - | - | aggro_long_momentum_breakout | aggro_momentum |
| 2026-04-11T16:00:00Z | OPEN | XRP/USD | long | 1636.398808 | 1.3722 | 1.3242 | 1.4751 | - | - | aggro_long_momentum_breakout | aggro_momentum |
| 2026-04-12T00:00:00Z | CLOSE | ETH/USD | long | 1.420496 | 2214.4400 | - | - | -1.42 | -163.87 | stop-hit | aggro_momentum |
| 2026-04-12T00:00:00Z | CLOSE | LINK/USD | long | 355.147061 | 8.8000 | - | - | -1.60 | -184.14 | stop-hit | aggro_momentum |
| 2026-04-12T00:00:00Z | CLOSE | SOL/USD | long | 38.250709 | 82.4000 | - | - | -1.37 | -157.63 | stop-hit | aggro_momentum |
| 2026-04-12T04:00:00Z | CLOSE | ADA/USD | short | 13373.248621 | 0.2417 | - | - | +0.61 | +71.55 | time-stop | aggro_momentum |
| 2026-04-12T08:00:00Z | CLOSE | LTC/USD | long | 59.117855 | 53.9000 | - | - | -1.07 | -123.13 | time-stop | aggro_momentum |
| 2026-04-12T08:00:00Z | CLOSE | XRP/USD | long | 1636.398808 | 1.3337 | - | - | -0.95 | -74.58 | time-stop | aggro_momentum |
