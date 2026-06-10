# Hermes Stale Trade Sentinel Design

## Goal

Add a high-risk Hermes sentinel that replays the paper-cycle decision path for the Regime Plus worktree strategies and reports whether expected opens or closes were missed.

This first milestone is review-only. It produces evidence for Hermes and the leaderboard, but it does not mutate trade logs, portfolios, optimized configs, leaderboard rows, automation schedules, or broker/exchange settings.

## Scope

The first release covers the high-risk Regime Plus worktree strategies:

- CODEX Regime Plus v1
- CODEX Regime Short Plus v1
- CODEX Regime Plus L/S v1

The sentinel will run a paper-cycle replay for each strategy, capture expected close and open actions, compare those expectations with the existing paper logs and routine status, and export a report for the Hermes monitor.

The design intentionally does not replay every strategy yet. The same interface should allow later expansion to Aggro Plus, Pulse, Apex, equities, and the rest of the paper book.

## Non-Goals

- No automatic repair execution.
- No live order placement.
- No strategy promotion, demotion, sizing, routing, or registration changes.
- No pruning or rewriting of existing leaderboard strategies or CODEX snapshots.
- No broad refactor of the paper-cycle runner beyond the small extraction needed to make replay expectations testable.

## Architecture

The main implementation should live in `C:\trading\trading-codex`, where the paper-cycle logic and worktree strategy code already live.

Add a dedicated sentinel module and CLI:

- `scripts\stale_trade_sentinel.py`
- tests in `tests\test_stale_trade_sentinel.py`

The sentinel will call a shared paper-cycle replay function rather than scraping CLI text. If needed, `scripts\paper_cycle.py` in the Regime Plus worktree should expose a small deterministic replay result object containing:

- strategy key and strategy name
- cycle time
- data source and data quality
- expected close rows
- expected open rows
- expected close pairs/sleeves
- expected open pairs/sleeves
- skipped reason, if any

The existing `run_cycle(..., dry_run=True)` behavior can be reused, but counts alone are not enough. The sentinel needs the expected rows or normalized expected actions so it can explain what was missed.

## Data Flow

1. The Hermes automation runs the sentinel before `export_leaderboard.py`.
2. The sentinel loads the Regime Plus worktree paper-cycle config for the high-risk strategies.
3. For each strategy, it performs a dry replay using the same current market-data path as the paper cycle.
4. It compares expected actions with the current trade log and latest routine status.
5. It writes:
   - `memory\hermes_stale_trade_sentinel.json`
   - `memory\hermes_stale_trade_sentinel.md`
6. `export_leaderboard.py` copies those artifacts to `data\codex`.
7. Hermes Monitor renders the summary as a dedicated panel or artifact preview.

## Finding Rules

The first version should use conservative severity:

- `error`: replay expected one or more closes, but the trade log or latest routine status did not show those closes.
- `warn`: replay expected one or more opens, but the trade log or latest routine status did not show those opens.
- `warn`: replay could not evaluate because market data was unavailable, stale, blocked, or only cache-backed when live data was expected.
- `ok`: replay expected no missed action, or replay expectations match the recorded paper state.

For each finding, include the strategy, action type, pair, sleeve, expected reason tag when available, cycle time, and a short explanation.

## Monitor Changes

Hermes Monitor should add a concise Stale Trade Sentinel section showing:

- overall status
- generated timestamp
- strategy count scanned
- errors and warnings
- one row per finding

The panel should preserve the current Hermes safety message: Hermes is review-only and proposals/findings are logged, not executed automatically.

## Error Handling

Missing worktree, missing trade log, missing portfolio, malformed report, or unavailable market data should produce `warn` findings unless they prevent all high-risk strategies from being evaluated. If all high-risk strategies cannot be evaluated, status should be `error`.

The sentinel should never fail by partially writing corrupt output. Write JSON/Markdown atomically or through the existing retry pattern used by other automation reports.

## Testing

Implementation should add focused tests for:

- expected close becomes an `error` when it is not reflected in the actual log/status
- expected open becomes a `warn` when it is not reflected in the actual log/status
- no finding when replay and recorded state agree
- unavailable data creates a warning and does not mutate logs
- JSON and Markdown reports include the high-risk strategies and counts
- export copies the sentinel artifacts to `data\codex`
- Hermes Monitor parses and renders the sentinel summary

Final verification should include:

- Python tests for the sentinel and related paper-cycle replay extraction
- leaderboard monitor/unit tests
- `npm run smoke`
- CODEX snapshot integrity tests

Before finishing implementation, verify the leaderboard strategy count is unchanged and protected CODEX rows still retain non-empty forward trade histories.

## Rollout

The first rollout should update `codex-hermes-research-supervisor` to run the sentinel before export, then leave the new report visible in Hermes Monitor. It should not add automatic repair commands until the later approved Repair Queue milestone.
