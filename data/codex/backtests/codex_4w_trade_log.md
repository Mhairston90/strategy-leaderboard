# CODEX v0 4W Backtest Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries
| 2026-04-08T20:00:00Z | OPEN | ETH/USD | long | 1.597098 | 2191.4752 | 2059.9867 | 2454.4522 | - | - | trend_sma20_positive_30bar | trend |
| 2026-04-08T20:00:00Z | OPEN | BTC/USD | long | 0.035140 | 71144.5545 | 66875.8812 | 79681.9010 | - | - | trend_sma20_positive_30bar | trend |
| 2026-04-09T04:00:00Z | OPEN | SOL/USD | long | 0.104565 | 82.3512 | 77.4101 | 92.2333 | - | - | trend_sma20_positive_30bar | trend |
| 2026-04-11T16:00:00Z | OPEN | BTC/USD | long | 0.013725 | 73732.2477 | 68570.9904 | 84792.0849 | - | - | breakout_prior_30bar_high | breakout |
| 2026-04-13T20:00:00Z | OPEN | SOL/USD | long | 10.359291 | 86.6233 | 80.5597 | 99.6168 | - | - | breakout_prior_30bar_high | breakout |
| 2026-05-04T00:00:00Z | CLOSE | BTC/USD | long | 0.035140 | 80299.4000 | - | - | +2.05 | +307.86 | target-hit | trend |
| 2026-05-04T00:00:00Z | OPEN | BTC/USD | long | 0.005726 | 80339.5497 | 75519.1767 | 89980.2957 | - | - | trend_sma20_positive_30bar | trend |
| 2026-05-06T16:00:00Z | CLOSE | ETH/USD | long | 1.597098 | 2358.5500 | - | - | +1.18 | +247.94 | backtest-final-mark | trend |
| 2026-05-06T16:00:00Z | CLOSE | SOL/USD | long | 0.104565 | 89.2100 | - | - | +1.30 | +0.67 | backtest-final-mark | trend |
| 2026-05-06T16:00:00Z | CLOSE | BTC/USD | long | 0.013725 | 81654.8000 | - | - | +1.46 | +103.19 | backtest-final-mark | breakout |
| 2026-05-06T16:00:00Z | CLOSE | SOL/USD | long | 10.359291 | 89.2100 | - | - | +0.35 | +22.06 | backtest-final-mark | breakout |
| 2026-05-06T16:00:00Z | CLOSE | BTC/USD | long | 0.005726 | 81654.8000 | - | - | +0.19 | +5.12 | backtest-final-mark | trend |
