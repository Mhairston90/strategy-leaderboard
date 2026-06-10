# Hermes Missed Trade Auditor

Review-only; no strategy state, trade logs, or portfolios changed.

- Generated: 2026-06-10T21:11:59Z
- Status: warn
- Scanned: 3
- Errors: 0
- Warnings: 4

| Strategy | Name | Cycle time | Replay status | Expected opens | Expected closes | Matched opens | Matched closes | Routine status | Routine message | Forensics quality | Forensics message | Errors | Warnings |
|----------|------|------------|---------------|----------------|-----------------|---------------|----------------|----------------|-----------------|-------------------|------------------|--------|----------|
| regime_plus | CODEX Regime Plus v1 | 2026-06-10T20:00:00Z | ok | 0 | 0 | 0 | 0 | cache | opened=0 closed=0; fetch warnings=10 | missing | trade_forensics.md missing or no row for strategy | 0 | 0 |
| regime_short_plus | CODEX Regime Short Plus v1 | 2026-06-10T20:00:00Z | ok | 1 | 0 | 0 | 0 | skipped | cycle already recorded | missing | trade_forensics.md missing or no row for strategy | 0 | 2 |
| regime_plus_ls | CODEX Regime Plus L/S v1 | 2026-06-10T20:00:00Z | ok | 1 | 0 | 0 | 0 | skipped | cycle already recorded | missing | trade_forensics.md missing or no row for strategy | 0 | 2 |

## Findings

| Severity | Strategy | Action | Pair | Sleeve | Reason | Cycle time | Evidence | Message |
|----------|----------|--------|------|--------|--------|------------|----------|---------|
| warn | regime_short_plus | OPEN | ADA/USD | regime_short_plus_trend | regime_short_plus_trend | 2026-06-10T20:00:00Z | no matching trade-log row | expected open was not found in the strategy trade log |
| warn | regime_short_plus | EVIDENCE | - | - | skipped | 2026-06-10T18:57:46Z | routine:skipped | cycle already recorded |
| warn | regime_plus_ls | OPEN | ADA/USD | regime_plus_ls_short_trend | regime_plus_ls_short_trend | 2026-06-10T20:00:00Z | no matching trade-log row | expected open was not found in the strategy trade log |
| warn | regime_plus_ls | EVIDENCE | - | - | skipped | 2026-06-10T18:58:12Z | routine:skipped | cycle already recorded |
