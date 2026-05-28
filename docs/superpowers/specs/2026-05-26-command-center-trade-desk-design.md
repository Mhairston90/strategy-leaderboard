# Command Center Trade Desk Design

## Goal

Replace the current Command Center summary cards with a trade-focused desk that makes current open-trade P/L and recent closed-trade quality easy to scan, especially on a phone.

## Scope

The Command Center will show two separate sections:

- Open Trade Monitor: current open trades with live mark-to-market detail.
- Closed Trade Review: recent closed trades with a deterministic Trade Analyst Score.

The leaderboard table, strategy registry, exported CODEX snapshots, integrity board, Hermes cockpit, and Data Quality panel remain intact.

## Open Trade Monitor

Open positions are parsed from each strategy portfolio markdown file. Each open trade row shows:

- strategy
- pair
- side
- sleeve
- entry
- mark
- stop
- unrealized P/L dollars
- unrealized P/L percent
- exposure
- age when an opening event can be matched
- distance to stop when entry, mark, and stop are available
- status: Clean, Watch, or At Risk

Rows sort by attention priority first, then largest absolute unrealized P/L. At Risk means the mark is at or beyond the stop or within roughly 1% of the stop. Watch means the open trade is losing or within roughly 3% of the stop. Clean means neither condition is true.

## Closed Trade Review

Closed trades are built from paired trade-log trips. Each closed trade row shows:

- strategy
- pair
- side when available
- exit time
- realized P/L dollars
- R multiple
- hold time when entry and exit timestamps are available
- exit reason
- Trade Analyst Score from 0 to 100
- a short score label

The score is deterministic and explainable. It does not call an AI model. A disciplined losing trade can score better than a messy winner. The first score version uses:

- Risk control: penalize outsized negative R.
- Outcome: reward positive R/P/L, mildly penalize losses.
- Plan fit: reward normal exit tags such as target, time-stop, trailing, stop, or strategy-specific reason tags; penalize missing reasons.
- Trade management: reward reasonable hold-time records when both entry and exit are known.
- Data quality: reserve room for future quality penalties, but do not block the first version on per-trade quality attribution.

## Architecture

The existing `lib/command_center.js` module stays the boundary for Command Center data shaping and HTML rendering. It will expose richer model fields for `openTrades` and `closedTrades`, while preserving existing strategy drawer behavior unless a small display improvement is useful.

Tests stay in `lib/command_center.test.js`. Styling stays in `css/style.css`. The browser app continues to call `renderCommandCenterHtml(model)` from `app.js`; no fetch pipeline changes are required.

## Error Handling

If a strategy lacks a portfolio or trade log, it simply contributes no open or closed trades. Missing numeric fields render as `-`. Score inputs that are unavailable use neutral defaults instead of failing the entire Command Center.

## Verification

Implementation must include red-green tests for:

- open-trade enrichment with P/L percent, distance-to-stop, age, and status
- closed-trade review rows with analyst score and score label
- the Command Center HTML rendering only the two trade desk sections, without Portfolio Heat, Promotion Readiness, or Ensemble View

Final verification must run:

- `npm test`
- `npm run smoke`
- `node --test scripts\codex_snapshot_integrity.test.js`

Because this repo has a persistent safety note for CODEX snapshots, final verification must also confirm the strategy count remains 45 and active CODEX rows keep non-empty forward trade histories.
