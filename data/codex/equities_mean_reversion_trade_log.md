# CODEX Equities Mean Reversion v1 Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries

| 2026-05-22T19:30:00Z | OPEN | HOOD | long | 27.148294 | 73.6695 | 71.4594 | 76.6162 | - | - | equities_mean_reversion_late_rebound | equities_mean_reversion |
| 2026-05-25T15:40:00Z | CLOSE | HOOD | long | 27.148294 | 73.6695 | - | - | +0.00 | +0.00 | correction-previous-row | equities_mean_reversion |

| 2026-05-26T13:30:00Z | OPEN | HOOD | long | 27.148294 | 73.6695 | 71.4594 | 76.6162 | - | - | equities_mean_reversion_late_rebound | equities_mean_reversion |
| 2026-05-27T18:30:00Z | CLOSE | HOOD | long | 27.148294 | 76.2300 | - | - | +0.98 | +58.93 | time-stop | equities_mean_reversion |