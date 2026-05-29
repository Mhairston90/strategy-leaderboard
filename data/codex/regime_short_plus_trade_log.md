# CODEX Regime Short Plus v1 Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries

| 2026-05-28T16:00:00Z | OPEN | LINK/USD | short | 220.860982 | 9.0555 | 9.3271 | 8.5393 | - | - | regime_short_plus_failed_rally | regime_short_plus_failed_rally |
| 2026-05-29T16:00:00Z | CLOSE | LINK/USD | short | 220.860982 | 9.0795 | - | - | -0.26 | -15.72 | time-stop | regime_short_plus_failed_rally |