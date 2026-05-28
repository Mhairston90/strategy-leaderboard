# BULL v0 Missed Scheduler Replay Overlay

> Counterfactual audit overlay folded into the live `BULL v0` leaderboard row.
> Source: Kraken public 1H/4H OHLC replay of BULL v0.4 rules across the missed post-2026-05-19 weekday trading windows.
> Rows are tagged with sleeve `missed_scheduler_replay` so the replay delta stays auditable inside the BULL v0 score.
> If identical rows are later published in `Mhairston90/trading-bull/main`, remove this overlay from `registry.js` to avoid double-counting.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries

| 2026-05-20T13:00:00Z | OPEN | HYPE/USD | long | 51.165356 | 50.01499 | 48.01639 | 58.00942 | - | - | routine-01-overnight-missed-scheduler-entry | missed_scheduler_replay |
| 2026-05-21T04:00:00Z | OPEN | TAO/USD | long | 9.515117 | 277.83675 | 271.62362 | 302.68925 | - | - | routine-03-eod-missed-scheduler-entry | missed_scheduler_replay |
| 2026-05-21T08:00:00Z | CLOSE | HYPE/USD | long | 51.165356 | 58.38080 | - | - | +4.04 | +413.62 | exit-4R-target | missed_scheduler_replay |
| 2026-05-21T13:00:00Z | OPEN | HYPE/USD | long | 46.123284 | 57.74886 | 55.19075 | 67.98128 | - | - | routine-01-overnight-missed-scheduler-entry | missed_scheduler_replay |
| 2026-05-22T01:00:00Z | CLOSE | TAO/USD | long | 9.515117 | 276.14136 | - | - | -0.50 | -29.84 | exit-ema20-confirm | missed_scheduler_replay |
| 2026-05-22T02:00:00Z | CLOSE | HYPE/USD | long | 46.123284 | 57.31133 | - | - | -0.29 | -33.98 | exit-ema20-confirm | missed_scheduler_replay |
| 2026-05-22T04:00:00Z | OPEN | AVAX/USD | long | 278.438254 | 9.50475 | 9.36712 | 10.05526 | - | - | routine-03-eod-missed-scheduler-entry | missed_scheduler_replay |
| 2026-05-22T13:00:00Z | OPEN | SOL/USD | long | 30.207436 | 87.70383 | 86.64637 | 91.93366 | - | - | routine-01-overnight-missed-scheduler-entry | missed_scheduler_replay |
| 2026-05-22T15:00:00Z | CLOSE | SOL/USD | long | 30.207436 | 86.64637 | - | - | -1.43 | -45.64 | exit-stop-hit | missed_scheduler_replay |
| 2026-05-22T16:00:00Z | CLOSE | AVAX/USD | long | 278.438254 | 9.42529 | - | - | -0.94 | -35.83 | exit-ema20-confirm | missed_scheduler_replay |

## Replay Summary

- Opens: 5
- Closed trades: 5
- Replay realized PnL: $+268.34
- Replay average R: +0.18
- Largest replay winner: HYPE/USD +$413.62
- Largest replay loser: SOL/USD -$45.64
