# CODEX Donchian Ensemble 4W Backtest Trade Log

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
| 2026-05-04T00:00:00Z | OPEN | BTC/USD | long | 0.029654 | 80339.5497 | 77527.6655 | 85963.3182 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-04T00:00:00Z | OPEN | DOGE/USD | long | 21093.265202 | 0.1129 | 0.1073 | 0.1242 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-04T00:00:00Z | OPEN | ETH/USD | long | 0.998522 | 2385.8923 | 2302.3861 | 2552.9048 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-04T08:00:00Z | OPEN | LINK/USD | long | 248.505946 | 9.4398 | 9.1094 | 10.1006 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-06T08:00:00Z | CLOSE | LINK/USD | long | 248.505946 | 10.1801 | - | - | +2.09 | +171.29 | target-hit | donchian_trend |
| 2026-05-06T08:00:00Z | OPEN | LINK/USD | long | 242.135554 | 10.1852 | 9.8287 | 10.8982 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-07T00:00:00Z | CLOSE | BTC/USD | long | 0.029654 | 80825.2000 | - | - | +0.02 | +1.98 | time-stop | donchian_trend |
| 2026-05-07T00:00:00Z | CLOSE | DOGE/USD | long | 21093.265202 | 0.1103 | - | - | -0.57 | -67.26 | time-stop | donchian_trend |
| 2026-05-07T00:00:00Z | CLOSE | ETH/USD | long | 0.998522 | 2322.0000 | - | - | -0.91 | -76.02 | time-stop | donchian_trend |
| 2026-05-07T04:00:00Z | OPEN | SOL/USD | long | 26.449521 | 90.2051 | 87.0479 | 96.5194 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-08T12:00:00Z | OPEN | DOT/USD | long | 1750.579615 | 1.3594 | 1.3118 | 1.4545 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-08T16:00:00Z | OPEN | AVAX/USD | long | 234.759647 | 9.9150 | 9.5679 | 10.6090 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-09T08:00:00Z | CLOSE | LINK/USD | long | 242.135554 | 10.4649 | - | - | +0.63 | +54.72 | time-stop | donchian_trend |
| 2026-05-10T04:00:00Z | CLOSE | SOL/USD | long | 26.449521 | 93.4500 | - | - | +0.88 | +73.20 | time-stop | donchian_trend |
| 2026-05-10T12:00:00Z | OPEN | ADA/USD | long | 8670.082797 | 0.2816 | 0.2718 | 0.3013 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-10T16:00:00Z | OPEN | XRP/USD | long | 1670.882071 | 1.4872 | 1.4351 | 1.5913 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-11T12:00:00Z | CLOSE | DOT/USD | long | 1750.579615 | 1.3676 | - | - | +0.02 | +1.94 | time-stop | donchian_trend |
| 2026-05-11T16:00:00Z | CLOSE | AVAX/USD | long | 234.759647 | 10.2000 | - | - | +0.67 | +54.63 | time-stop | donchian_trend |
| 2026-05-11T16:00:00Z | OPEN | SOL/USD | long | 24.748479 | 98.2491 | 94.8104 | 105.1265 | - | - | donchian_ensemble_breakout | donchian_trend |
| 2026-05-12T12:00:00Z | CLOSE | ADA/USD | long | 8670.082797 | 0.2691 | - | - | -1.42 | -120.89 | stop-hit | donchian_trend |
| 2026-05-12T12:00:00Z | CLOSE | XRP/USD | long | 1670.882071 | 1.4238 | - | - | -1.36 | -118.66 | stop-hit | donchian_trend |
| 2026-05-12T12:00:00Z | CLOSE | SOL/USD | long | 24.748479 | 93.8300 | - | - | -1.43 | -121.73 | stop-hit | donchian_trend |
