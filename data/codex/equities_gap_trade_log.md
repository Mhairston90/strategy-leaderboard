# CODEX Equities Gap Fade v0 Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries

| 2026-05-06T16:47:53Z | OPEN | AMD | short | 4.928861 | 405.7732 | 419.9753 | 389.5423 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-05-06T16:47:53Z | OPEN | SMCI | short | 62.256116 | 32.1254 | 33.2497 | 30.8403 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-05-11T20:00:00Z | CLOSE | AMD | short | 4.928861 | 458.7900 | - | - | -3.89 | -272.39 | stop-hit | equities_gap_fade |
| 2026-05-11T20:00:00Z | CLOSE | SMCI | short | 62.256116 | 33.5200 | - | - | -1.39 | -97.45 | stop-hit | equities_gap_fade |