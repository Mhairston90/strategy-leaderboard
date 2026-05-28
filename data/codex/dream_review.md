# CODEX Dream Review

> Generated: 2026-05-25T13:56:10Z
> No trading action was taken.
> This report is derived from routine, goal, optimizer, smoke, and trade-state memory.

## Executive Summary

- Routine friction items: 15
- Goal attention items: 0
- Optimizer rejections: 1
- Leaderboard smoke warnings: 0

## Repeated Mistakes And Friction

- CODEX Automation Health: error (local; run_id=automation-health-20260525T135445Z errors=1 warnings=23 cache_routines=12 stale_routines=4 guardrail_errors=0)
- CODEX Aggro v0: routine used cached data
- CODEX Apex WFO v1: routine used cached data
- CODEX Apex v0: routine used cached data
- CODEX Equities Breakout Runner v1: routine used cached data
- CODEX Equities Gap Fade v0: routine used cached data
- CODEX Equities Mean Reversion v1: routine used cached data
- CODEX Equities Regime Hedge v1: routine used cached data
- CODEX Pulse v0: routine used cached data
- CODEX Regime WFO v1: routine used cached data
- CODEX Regime v0: routine used cached data
- CODEX v0: routine used cached data
- CODEX Open Trade Health: error (local; errors=3 warnings=5 open_positions=5)
- CODEX Overnight Foundry: routine used cached data
- CODEX Weekly Optimizer: routine used cached data
- CODEX Apex WFO v1: REJECTED apex_t0.045_w0.55_r2.2 with OOS PF 0.31, OOS DD 25.66%, OOS trades 60

## Promising Patterns

- CODEX Aggro v0: collecting with PF 4.87, 8 closed trades, 2.9 observed weeks
- CODEX Equities Regime Hedge v1: collecting with PF Inf, 1 closed trades, 0.9 observed weeks
- CODEX Regime v0: collecting with PF 2.57, 6 closed trades, 1.1 observed weeks
- CODEX Regime WFO v1: collecting with PF 2.58, 6 closed trades, 1.1 observed weeks
- CODEX Apex v0: collecting with PF 2.59, 4 closed trades, 1.9 observed weeks
- CODEX Apex WFO v1: collecting with PF 2.59, 4 closed trades, 1.9 observed weeks

## Stale Or Provisional Assumptions

- CODEX v0: sample remains provisional at 4 trades over 2.0 weeks.
- CODEX Aggro v0: sample remains provisional at 8 trades over 2.9 weeks.
- CODEX Pulse v0: sample remains provisional at 15 trades over 2.9 weeks.
- CODEX Equities Gap Fade v0: Sharpe is still unavailable.
- CODEX Equities Gap Fade v0: sample remains provisional at 2 trades over 0.9 weeks.
- CODEX Equities Breakout Runner v1: Sharpe is still unavailable.
- CODEX Equities Breakout Runner v1: sample remains provisional at 0 trades over 0.0 weeks.
- CODEX Equities Mean Reversion v1: Sharpe is still unavailable.
- CODEX Equities Mean Reversion v1: sample remains provisional at 0 trades over 0.0 weeks.
- CODEX Equities Regime Hedge v1: needs 29 more closed trades; needs 5.1 more observed weeks; PF is infinite until a losing trade closes
- CODEX Equities Regime Hedge v1: Sharpe is still unavailable.
- CODEX Equities Regime Hedge v1: sample remains provisional at 1 trades over 0.9 weeks.
- CODEX Regime v0: sample remains provisional at 6 trades over 1.1 weeks.
- CODEX Regime WFO v1: sample remains provisional at 6 trades over 1.1 weeks.
- CODEX Apex v0: sample remains provisional at 4 trades over 1.9 weeks.
- CODEX Apex WFO v1: sample remains provisional at 4 trades over 1.9 weeks.

## Recommended Next Experiments

- Track cache usage frequency so stale market data does not masquerade as signal quality.
- For rejected WFO variants, test tighter drawdown/PF filters before seeking promotion.
- Keep collecting samples before promotion decisions.

## Evidence Reviewed

- memory/routine_status.md
- memory/goal_status.md
- memory/optimization_report.md
- memory\leaderboard_smoke_latest.txt
