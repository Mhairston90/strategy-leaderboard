# CODEX Equities Gap Fade v1 4W Backtest Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries
| 2026-04-17T14:30:00Z | OPEN | NFLX | long | 20.528721 | 97.4245 | 94.6966 | 99.7627 | - | - | equities_gap_v1_down_reversal_fade | equities_gap_fade_v1 |
| 2026-04-17T19:30:00Z | CLOSE | NFLX | long | 20.528721 | 97.2800 | - | - | -0.24 | -13.36 | eod-exit | equities_gap_fade_v1 |
| 2026-04-23T14:30:00Z | OPEN | SMCI | long | 73.322143 | 27.2404 | 26.4777 | 27.8942 | - | - | equities_gap_v1_down_reversal_fade | equities_gap_fade_v1 |
| 2026-04-23T19:30:00Z | CLOSE | SMCI | long | 73.322143 | 26.7300 | - | - | -0.85 | -47.71 | eod-exit | equities_gap_fade_v1 |
| 2026-05-04T14:30:00Z | OPEN | PLTR | short | 13.610238 | 146.0508 | 150.1402 | 142.5456 | - | - | equities_gap_v1_up_reversal_fade | equities_gap_fade_v1 |
| 2026-05-04T19:30:00Z | CLOSE | PLTR | short | 13.610238 | 146.1900 | - | - | -0.22 | -12.24 | eod-exit | equities_gap_fade_v1 |
