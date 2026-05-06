# CODEX Apex v0 4W Backtest Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries
| 2026-04-09T00:00:00Z | OPEN | AVAX/USD | short | 443.769619 | 9.0137 | 9.4501 | 8.1409 | - | - | apex_short_cross_sectional_momentum | apex_short_momentum |
| 2026-04-09T00:00:00Z | OPEN | ADA/USD | short | 16056.487139 | 0.2491 | 0.2589 | 0.2295 | - | - | apex_short_cross_sectional_momentum | apex_short_momentum |
| 2026-04-09T04:00:00Z | OPEN | LINK/USD | short | 454.191783 | 8.7537 | 9.1006 | 8.0598 | - | - | apex_short_cross_sectional_momentum | apex_short_momentum |
| 2026-04-09T04:00:00Z | OPEN | DOT/USD | short | 3165.174733 | 1.2561 | 1.3097 | 1.1489 | - | - | apex_short_cross_sectional_momentum | apex_short_momentum |
| 2026-04-09T12:00:00Z | CLOSE | AVAX/USD | short | 443.769619 | 9.3300 | - | - | -0.83 | -161.53 | time-stop | apex_short_momentum |
| 2026-04-09T12:00:00Z | CLOSE | ADA/USD | short | 16056.487139 | 0.2546 | - | - | -0.69 | -108.61 | time-stop | apex_short_momentum |
| 2026-04-09T16:00:00Z | CLOSE | LINK/USD | short | 454.191783 | 9.0142 | - | - | -0.88 | -139.31 | time-stop | apex_short_momentum |
| 2026-04-09T16:00:00Z | CLOSE | DOT/USD | short | 3165.174733 | 1.3081 | - | - | -1.09 | -185.69 | time-stop | apex_short_momentum |
| 2026-04-12T04:00:00Z | OPEN | ADA/USD | short | 15576.967533 | 0.2415 | 0.2488 | 0.2270 | - | - | apex_short_cross_sectional_momentum | apex_short_momentum |
| 2026-04-12T12:00:00Z | OPEN | AVAX/USD | short | 421.754182 | 8.9637 | 9.2326 | 8.4259 | - | - | apex_short_cross_sectional_momentum | apex_short_momentum |
| 2026-04-12T16:00:00Z | CLOSE | ADA/USD | short | 15576.967533 | 0.2383 | - | - | +0.27 | +30.62 | time-stop | apex_short_momentum |
| 2026-04-12T16:00:00Z | OPEN | ADA/USD | short | 15760.464643 | 0.2381 | 0.2453 | 0.2238 | - | - | apex_short_cross_sectional_momentum | apex_short_momentum |
| 2026-04-12T16:00:00Z | OPEN | DOT/USD | short | 3034.758657 | 1.2366 | 1.2737 | 1.1624 | - | - | apex_short_cross_sectional_momentum | apex_short_momentum |
| 2026-04-13T00:00:00Z | CLOSE | AVAX/USD | short | 421.754182 | 9.0700 | - | - | -0.57 | -64.61 | time-stop | apex_short_momentum |
| 2026-04-13T04:00:00Z | CLOSE | ADA/USD | short | 15760.464643 | 0.2381 | - | - | -0.18 | -20.22 | time-stop | apex_short_momentum |
| 2026-04-13T04:00:00Z | CLOSE | DOT/USD | short | 3034.758657 | 1.1883 | - | - | +1.13 | +127.45 | time-stop | apex_short_momentum |
| 2026-04-13T04:00:00Z | OPEN | DOT/USD | short | 3192.708682 | 1.1875 | 1.2242 | 1.1139 | - | - | apex_short_cross_sectional_momentum | apex_short_momentum |
| 2026-04-13T16:00:00Z | CLOSE | DOT/USD | short | 3192.708682 | 1.2011 | - | - | -0.54 | -63.25 | time-stop | apex_short_momentum |
| 2026-04-13T20:00:00Z | OPEN | ETH/USD | long | 1.588301 | 2371.0486 | 2284.3734 | 2544.3990 | - | - | apex_long_cross_sectional_momentum | apex_long_momentum |
| 2026-04-13T20:00:00Z | OPEN | LINK/USD | long | 402.072024 | 9.3663 | 9.0525 | 9.9940 | - | - | apex_long_cross_sectional_momentum | apex_long_momentum |
| 2026-04-13T20:00:00Z | OPEN | AVAX/USD | long | 389.576158 | 9.6668 | 9.3552 | 10.2898 | - | - | apex_long_cross_sectional_momentum | apex_long_momentum |
| 2026-04-14T00:00:00Z | OPEN | SOL/USD | long | 43.052706 | 86.1102 | 83.5269 | 91.2768 | - | - | apex_long_cross_sectional_momentum | apex_long_momentum |
| 2026-04-14T00:00:00Z | OPEN | BTC/USD | long | 0.049751 | 74515.9247 | 72280.4469 | 78986.8801 | - | - | apex_long_cross_sectional_momentum | apex_long_momentum |
| 2026-04-14T08:00:00Z | CLOSE | ETH/USD | long | 1.588301 | 2374.9000 | - | - | -0.10 | -13.48 | time-stop | apex_long_momentum |
| 2026-04-14T08:00:00Z | CLOSE | LINK/USD | long | 402.072024 | 9.1848 | - | - | -0.73 | -92.38 | time-stop | apex_long_momentum |
| 2026-04-14T08:00:00Z | CLOSE | AVAX/USD | long | 389.576158 | 9.3900 | - | - | -1.05 | -127.14 | time-stop | apex_long_momentum |
| 2026-04-14T08:00:00Z | OPEN | ETH/USD | long | 1.542154 | 2376.5624 | 2289.9787 | 2549.7299 | - | - | apex_long_cross_sectional_momentum | apex_long_momentum |
| 2026-04-14T08:00:00Z | OPEN | LINK/USD | long | 398.753221 | 9.1912 | 8.8748 | 9.8241 | - | - | apex_long_cross_sectional_momentum | apex_long_momentum |
| 2026-04-14T12:00:00Z | CLOSE | SOL/USD | long | 43.052706 | 85.9800 | - | - | -0.22 | -24.87 | time-stop | apex_long_momentum |
| 2026-04-14T12:00:00Z | CLOSE | BTC/USD | long | 0.049751 | 75357.7000 | - | - | +0.20 | +22.49 | time-stop | apex_long_momentum |
| 2026-04-14T12:00:00Z | OPEN | BTC/USD | long | 0.048488 | 75410.4504 | 73148.1369 | 79935.0774 | - | - | apex_long_cross_sectional_momentum | apex_long_momentum |
| 2026-04-14T12:00:00Z | OPEN | DOGE/USD | long | 38290.257177 | 0.0955 | 0.0926 | 0.1012 | - | - | apex_long_cross_sectional_momentum | apex_long_momentum |
| 2026-04-14T20:00:00Z | CLOSE | ETH/USD | long | 1.542154 | 2323.2100 | - | - | -0.76 | -101.12 | time-stop | apex_long_momentum |
| 2026-04-14T20:00:00Z | CLOSE | LINK/USD | long | 398.753221 | 9.0239 | - | - | -0.68 | -85.61 | time-stop | apex_long_momentum |
| 2026-04-14T20:00:00Z | OPEN | DOT/USD | short | 3031.667648 | 1.1660 | 1.2068 | 1.0843 | - | - | apex_short_cross_sectional_momentum | apex_short_momentum |
| 2026-04-15T00:00:00Z | CLOSE | BTC/USD | long | 0.048488 | 74360.5000 | - | - | -0.64 | -69.79 | time-stop | apex_long_momentum |
| 2026-04-15T00:00:00Z | CLOSE | DOGE/USD | long | 38290.257177 | 0.0932 | - | - | -0.97 | -107.71 | time-stop | apex_long_momentum |
| 2026-04-15T08:00:00Z | CLOSE | DOT/USD | short | 3031.667648 | 1.1713 | - | - | -0.28 | -34.49 | time-stop | apex_short_momentum |
