# CODEX Aggro v0 Trade Log

> Append-only. Source of truth for Aggro paper portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries

| 2026-05-05T16:00:00Z | OPEN | DOGE/USD | long | 30755.070526 | 0.1138 | 0.1098 | 0.1223 | - | - | aggro_long_momentum_breakout | aggro_momentum |
| 2026-05-06T16:00:00Z | CLOSE | DOGE/USD | long | 30755.070526 | 0.1133 | - | - | -0.27 | -33.21 | time-stop | aggro_momentum |
| 2026-05-12T16:00:00Z | OPEN | AVAX/USD | short | 358.696974 | 9.7251 | 10.0655 | 8.9957 | - | - | aggro_short_momentum_breakdown | aggro_momentum |
| 2026-05-12T16:00:00Z | OPEN | LINK/USD | short | 342.483395 | 10.1855 | 10.5420 | 9.4216 | - | - | aggro_short_momentum_breakdown | aggro_momentum |
| 2026-05-12T16:00:00Z | OPEN | ADA/USD | short | 12998.590543 | 0.2684 | 0.2778 | 0.2482 | - | - | aggro_short_momentum_breakdown | aggro_momentum |
| 2026-05-12T16:00:00Z | OPEN | SOL/USD | short | 37.097381 | 94.0330 | 97.3241 | 86.9805 | - | - | aggro_short_momentum_breakdown | aggro_momentum |
| 2026-05-12T16:00:00Z | OPEN | DOT/USD | short | 2653.277756 | 1.3147 | 1.3608 | 1.2161 | - | - | aggro_short_momentum_breakdown | aggro_momentum |
| 2026-05-12T16:00:00Z | OPEN | BTC/USD | short | 0.031123 | 80059.8500 | 82861.9448 | 74055.3613 | - | - | aggro_short_momentum_breakdown | aggro_momentum |
| 2026-05-17T08:00:00Z | CLOSE | AVAX/USD | short | 358.696974 | 9.2900 | - | - | +1.13 | +138.34 | time-stop | aggro_momentum |
| 2026-05-17T08:00:00Z | CLOSE | LINK/USD | short | 342.483395 | 9.7490 | - | - | +1.08 | +131.75 | time-stop | aggro_momentum |
| 2026-05-17T08:00:00Z | CLOSE | ADA/USD | short | 12998.590543 | 0.2557 | - | - | +1.21 | +147.25 | time-stop | aggro_momentum |
| 2026-05-17T08:00:00Z | CLOSE | SOL/USD | short | 37.097381 | 86.7900 | - | - | +2.06 | +251.26 | target-hit | aggro_momentum |
| 2026-05-17T08:00:00Z | CLOSE | DOT/USD | short | 2653.277756 | 1.2768 | - | - | +0.68 | +82.68 | time-stop | aggro_momentum |
| 2026-05-17T08:00:00Z | CLOSE | BTC/USD | short | 0.031123 | 78048.0000 | - | - | +0.57 | +49.82 | time-stop | aggro_momentum |
| 2026-05-21T16:00:00Z | OPEN | SOL/USD | long | 43.064800 | 87.5137 | 84.4508 | 94.0773 | - | - | aggro_long_momentum_breakout | aggro_momentum |
| 2026-05-22T20:00:00Z | CLOSE | SOL/USD | long | 43.064800 | 84.9100 | - | - | -1.00 | -131.43 | time-stop | aggro_momentum |
| 2026-05-24T04:00:00Z | OPEN | SOL/USD | long | 43.145878 | 86.2831 | 83.2632 | 92.7544 | - | - | aggro_long_momentum_breakout | aggro_momentum |
| 2026-05-24T04:00:00Z | OPEN | ETH/USD | long | 1.753000 | 2123.6513 | 2049.3235 | 2282.9251 | - | - | aggro_long_momentum_breakout | aggro_momentum |
| 2026-05-25T12:00:00Z | CLOSE | SOL/USD | long | 43.145878 | 86.1600 | - | - | -0.19 | -24.66 | time-stop | aggro_momentum |
| 2026-05-25T12:00:00Z | CLOSE | ETH/USD | long | 1.753000 | 2127.0800 | - | - | -0.10 | -13.36 | time-stop | aggro_momentum |