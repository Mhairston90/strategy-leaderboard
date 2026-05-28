# CODEX Donchian Ensemble IQR 4W Backtest Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries
| 2026-04-15T16:00:00Z | OPEN | XRP/USD | long | 1784.222886 | 1.4012 | 1.3521 | 1.4993 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-04-16T12:00:00Z | OPEN | LTC/USD | long | 44.934993 | 55.9179 | 53.9608 | 59.8322 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-04-16T12:00:00Z | OPEN | LINK/USD | long | 265.357680 | 9.4690 | 9.1299 | 10.1472 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-04-16T16:00:00Z | OPEN | SOL/USD | long | 27.442227 | 90.1751 | 87.0014 | 96.5225 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-04-18T08:00:00Z | CLOSE | SOL/USD | long | 27.442227 | 86.5600 | - | - | -1.28 | -111.82 | stop-hit | donchian_trend |
| 2026-04-18T16:00:00Z | CLOSE | XRP/USD | long | 1784.222886 | 1.4275 | - | - | +0.39 | +33.87 | time-stop | donchian_trend |
| 2026-04-19T12:00:00Z | CLOSE | LTC/USD | long | 44.934993 | 55.5000 | - | - | -0.36 | -31.80 | time-stop | donchian_trend |
| 2026-04-19T12:00:00Z | CLOSE | LINK/USD | long | 265.357680 | 9.2942 | - | - | -0.66 | -59.32 | time-stop | donchian_trend |
| 2026-04-22T12:00:00Z | OPEN | BTC/USD | long | 0.030964 | 79374.3673 | 76596.2645 | 84930.5731 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-04-24T16:00:00Z | OPEN | LTC/USD | long | 43.071625 | 56.7484 | 54.7622 | 60.7207 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-04-25T12:00:00Z | CLOSE | BTC/USD | long | 0.030964 | 77365.0000 | - | - | -0.87 | -74.84 | time-stop | donchian_trend |
| 2026-04-27T00:00:00Z | OPEN | DOGE/USD | long | 24311.039435 | 0.1003 | 0.0968 | 0.1073 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-04-27T00:00:00Z | OPEN | LINK/USD | long | 254.895643 | 9.5658 | 9.2310 | 10.2354 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-04-27T12:00:00Z | CLOSE | LINK/USD | long | 254.895643 | 9.1823 | - | - | -1.29 | -110.18 | stop-hit | donchian_trend |
| 2026-04-27T16:00:00Z | CLOSE | LTC/USD | long | 43.071625 | 55.3300 | - | - | -0.86 | -73.64 | time-stop | donchian_trend |
| 2026-04-29T08:00:00Z | CLOSE | DOGE/USD | long | 24311.039435 | 0.1097 | - | - | +2.53 | +215.20 | target-hit | donchian_trend |
| 2026-04-29T08:00:00Z | OPEN | DOGE/USD | long | 22294.361858 | 0.1098 | 0.1059 | 0.1174 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-04-29T08:00:00Z | OPEN | LTC/USD | long | 43.049545 | 56.8384 | 54.8491 | 60.8171 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-04-29T12:00:00Z | CLOSE | DOGE/USD | long | 22294.361858 | 0.1033 | - | - | -1.80 | -156.90 | stop-hit | donchian_trend |
| 2026-04-29T16:00:00Z | CLOSE | LTC/USD | long | 43.049545 | 54.7800 | - | - | -1.18 | -101.11 | stop-hit | donchian_trend |
| 2026-05-04T08:00:00Z | OPEN | LINK/USD | long | 252.374051 | 9.4398 | 9.1094 | 10.1006 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-05T00:00:00Z | OPEN | BTC/USD | long | 0.029494 | 80919.7397 | 78087.5488 | 86584.1214 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-05T04:00:00Z | OPEN | ADA/USD | long | 9320.812622 | 0.2567 | 0.2477 | 0.2746 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-05T12:00:00Z | OPEN | DOT/USD | long | 1858.064475 | 1.2743 | 1.2297 | 1.3635 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-06T08:00:00Z | CLOSE | LINK/USD | long | 252.374051 | 10.1801 | - | - | +2.09 | +173.96 | target-hit | donchian_trend |
| 2026-05-08T00:00:00Z | CLOSE | BTC/USD | long | 0.029494 | 79565.7000 | - | - | -0.63 | -52.24 | time-stop | donchian_trend |
| 2026-05-08T04:00:00Z | CLOSE | ADA/USD | long | 9320.812622 | 0.2619 | - | - | +0.43 | +36.35 | time-stop | donchian_trend |
| 2026-05-08T12:00:00Z | CLOSE | DOT/USD | long | 1858.064475 | 1.3587 | - | - | +1.74 | +144.10 | time-stop | donchian_trend |
| 2026-05-11T16:00:00Z | OPEN | SOL/USD | long | 25.017099 | 98.2491 | 94.8104 | 105.1265 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-12T12:00:00Z | CLOSE | SOL/USD | long | 25.017099 | 93.8300 | - | - | -1.43 | -123.05 | stop-hit | donchian_trend |
