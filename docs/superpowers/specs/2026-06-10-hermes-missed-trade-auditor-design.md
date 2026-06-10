# Hermes Missed Trade Auditor Design

## Goal

Add a review-only Hermes auditor that checks whether high-risk Regime Plus paper-cycle actions were faithfully recorded.

The Stale Trade Sentinel answers "is there a high-risk action still pending right now?" The Missed Trade Auditor answers "what did replay expect, what evidence exists in the paper logs/routine records, and did the cycle miss an open or close?"

## Scope

The first release covers the same high-risk Regime Plus worktree strategies as the sentinel:

- CODEX Regime Plus v1
- CODEX Regime Short Plus v1
- CODEX Regime Plus L/S v1

This scope is intentionally narrow. After the auditor proves useful, the same interface can expand to Aggro Plus, Pulse, Apex, equities, and the rest of the paper book.

## Non-Goals

- No automatic repair execution.
- No live order placement.
- No mutation of trade logs, portfolio state, optimized configs, foundry banks, leaderboard registry rows, exported CODEX snapshots, or automation schedules.
- No promotion, demotion, allocation, routing, or strategy-registration decisions.
- No all-strategy audit in v1.

## Architecture

The implementation should live in `C:\trading\trading-codex`, next to the sentinel and paper-cycle tooling.

Add a dedicated auditor module and CLI:

- `scripts\missed_trade_auditor.py`
- tests in `tests\test_missed_trade_auditor.py`

The auditor should reuse the Regime Plus `paper_cycle.py --replay-json` contract created for the sentinel. It should not create a second paper-cycle implementation.

Where practical, shared constants or helpers can be imported from `scripts\stale_trade_sentinel.py`, such as the high-risk strategy list and worktree replay subprocess runner. Do not couple the auditor to sentinel finding severity or markdown layout; the two reports have different purposes.

## Data Flow

1. Hermes automation runs the auditor after the stale-trade sentinel and before export.
2. The auditor invokes replay JSON for each high-risk strategy.
3. It reads current paper evidence:
   - the strategy trade log
   - `memory\routine_status.md`
   - `memory\trade_forensics.md` when available
4. It builds a per-strategy audit record with:
   - replay status and cycle time
   - expected close/open actions
   - actual matching close/open evidence
   - latest routine status evidence
   - latest trade-forensics evidence when present
   - missed-action findings, if any
5. It writes:
   - `memory\hermes_missed_trade_auditor.json`
   - `memory\hermes_missed_trade_auditor.md`
6. `export_leaderboard.py` copies those artifacts to `data\codex`.
7. Hermes Monitor renders the summary below Stale Trade Sentinel.

## Matching Rules

For v1, match expected actions conservatively:

- Expected close matches an actual trade-log close when strategy log contains the same action, pair, sleeve, and a timestamp greater than or equal to the expected cycle/action time.
- Expected open matches an actual trade-log open when strategy log contains the same action, pair, sleeve, and a timestamp greater than or equal to the expected cycle/action time.
- If exact timestamp matching is too brittle because a time-stop can use `time_stop_as_of`, allow a small configurable tolerance window, defaulting to one cycle interval.
- Routine status and trade-forensics are supporting evidence, not sole proof of a trade. They can explain why an expected action was skipped, blocked, or cache-backed.

The auditor should record clean audit rows even when there are no findings, so Hermes can show that all high-risk strategies were checked.

## Finding Rules

The first version should use conservative severity:

- `error`: replay expected a close and no matching close was recorded.
- `warn`: replay expected an open and no matching open was recorded.
- `warn`: replay could not evaluate because data was unavailable, replay failed, the trade log was missing, or routine status was missing.
- `warn`: routine status or trade-forensics shows `data-blocked`, `data-unavailable`, cache fallback, or skipped state while replay expected an action.
- `ok`: replay and recorded evidence agree.

Each finding should include:

- strategy key and display name
- action type
- pair
- sleeve
- expected reason tag when available
- expected cycle/action time
- evidence summary
- short message

## Artifacts

The JSON artifact should expose:

- `version`
- `generated_at`
- `status`
- `scanned`
- `errors`
- `warnings`
- `audits`
- `findings`

Each audit row should expose enough data for the monitor to render without reparsing markdown:

- `strategy`
- `strategy_name`
- `cycle_time`
- `replay_status`
- `expected_opens`
- `expected_closes`
- `matched_opens`
- `matched_closes`
- `routine_status`
- `routine_message`
- `forensics_quality`
- `forensics_message`

The Markdown artifact should be human-readable and summarize each high-risk strategy in a compact table.

## Monitor Changes

Hermes Monitor should add a Missed Trade Auditor section below Stale Trade Sentinel showing:

- overall status
- generated timestamp
- strategy count scanned
- errors and warnings
- a compact table/list of missed-action findings
- a clean empty state when all replay expectations match recorded state

The panel should preserve Hermes' review-only language.

## Error Handling

Missing or unreadable artifacts should show as pending/warn in the monitor rather than breaking the page.

The auditor should never write partial corrupt output. Use atomic writes or the repo's existing retry pattern.

Subprocess replay failures should produce warning findings per strategy, unless every high-risk strategy fails to evaluate. If every strategy fails, the overall report status should be `error`.

## Testing

Implementation should add focused tests for:

- expected close with no matching log row becomes an `error`
- expected open with no matching log row becomes a `warn`
- matching open/close rows produce no missed-action finding
- data-unavailable or replay failure produces warning findings
- routine status / forensics blocker is included as supporting evidence
- JSON and Markdown artifacts are written atomically
- export copies auditor artifacts to `data\codex`
- Hermes Monitor parses and renders the auditor summary

Final verification should include:

- Regime Plus paper-cycle replay tests
- missed-trade auditor tests
- export tests
- Hermes monitor tests
- `npm test`
- `npm run smoke`
- CODEX snapshot integrity and registry tests

Before finishing implementation, verify the leaderboard strategy count is unchanged and protected CODEX rows still retain non-empty forward trade histories.

## Rollout

Update `codex-hermes-research-supervisor` so its sequence becomes:

1. `python scripts\hermes_supervisor.py`
2. `python scripts\stale_trade_sentinel.py`
3. `python scripts\missed_trade_auditor.py`
4. `python scripts\hermes_review_cycle.py`
5. `python scripts\export_leaderboard.py`

The automation report should include missed-trade auditor status and top findings, while preserving all current no-mutation guardrails.
