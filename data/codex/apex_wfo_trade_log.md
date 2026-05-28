# CODEX Apex WFO v1 Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries

| 2026-05-05T16:00:00Z | OPEN | DOGE/USD | long | 35141.627217 | 0.1138 | 0.1104 | 0.1207 | - | - | apex_long_cross_sectional_momentum | apex_long_momentum |
| 2026-05-06T16:00:00Z | CLOSE | DOGE/USD | long | 35141.627217 | 0.1133 | - | - | -0.32 | -37.95 | time-stop | apex_long_momentum |
| 2026-05-10T12:00:00Z | OPEN | LINK/USD | long | 375.943635 | 10.5995 | 10.2815 | 11.2355 | - | - | apex_long_cross_sectional_momentum | apex_long_momentum |
| 2026-05-12T04:00:00Z | CLOSE | LINK/USD | long | 375.943635 | 10.4423 | - | - | -0.67 | -79.65 | time-stop | apex_long_momentum |
| 2026-05-12T16:00:00Z | OPEN | AVAX/USD | short | 406.549744 | 9.7232 | 10.0149 | 9.1398 | - | - | apex_short_cross_sectional_momentum | apex_short_momentum |
| 2026-05-12T16:00:00Z | OPEN | LINK/USD | short | 388.173156 | 10.1835 | 10.4890 | 9.5725 | - | - | apex_short_cross_sectional_momentum | apex_short_momentum |
| 2026-05-17T08:00:00Z | CLOSE | AVAX/USD | short | 406.549744 | 9.2900 | - | - | +1.32 | +156.02 | time-stop | apex_short_momentum |
| 2026-05-17T08:00:00Z | CLOSE | LINK/USD | short | 388.173156 | 9.7490 | - | - | +1.25 | +148.55 | time-stop | apex_short_momentum |