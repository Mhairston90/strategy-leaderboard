# Leaderboard Health Repair Design

**Date:** 2026-07-23

## Objective

Make every registered leaderboard strategy visible with truthful source-health
state, preserve all existing forward trade histories, recover safe local
strategy refreshes, and prevent the current stale-cache failure from recurring.

The live baseline is 80 registered strategies. The repair must not remove,
prune, hide, rename, or zero any strategy or CODEX snapshot. In particular,
CODEX v0, CODEX Aggro v0, CODEX Pulse v0, CODEX Regime v0, CODEX Apex v0,
CODEX Regime WFO v1, and CODEX Apex WFO v1 must retain non-empty forward trade
histories.

## Diagnosis

The application and smoke test load all 80 rows successfully, and the complete
Node test suite passes. Fifteen rows are nevertheless labeled `error` because
new snapshot-age checks promote readable but old portfolio snapshots to the same
fatal state used for missing or unparsable data.

The stale snapshots have three causes:

- The BULL GitHub snapshots have not been rebuilt on their expected cadence.
- The crypto basket refresh stopped after transient Kraken DNS failures.
- Windows resumed missed Stock Nightly and FABLE Nightly tasks at the same time.
  FABLE checked the shared caches before Stock Nightly completed, failed closed,
  and left its last valid histories unchanged.

These are real freshness problems, but they are not data-loss or parsing
failures. Treating them as fatal `error` rows makes the display misleading while
also obscuring the useful historical record.

## Chosen Approach

Use a layered repair:

1. Introduce a distinct `stale` strategy state for readable snapshots that fail
   a configured freshness limit.
2. Keep stale rows visible with their complete metrics and histories, render
   them with an amber badge, and sort them below current rows but above fatal
   errors.
3. Exclude stale rows from contest scoring until their sources refresh.
4. Reserve `error` for missing, unreadable, malformed, or otherwise unusable
   source data.
5. Refresh safe local, deterministic paper-strategy outputs from current public
   market caches when source connectivity permits. Do not invent timestamps,
   fabricate trades, or rewrite external BULL history.
6. Harden the FABLE nightly entry point so it waits for a concurrently running
   Stock Nightly refresh and retries cache validation for a bounded period
   before failing closed.
7. Add explicit integrity tests for the registry count and the protected CODEX
   forward histories.

## Architecture and Data Flow

### Snapshot classification

The existing BULL and CODEX adapters continue parsing trade logs first and
building metrics from the trade-log source of truth. Their freshness helpers
return whether a successfully read portfolio snapshot is stale. A stale
snapshot appends the precise age message to `errors` for diagnostics but sets
the row status to `stale`, not `error`.

Missing trade logs remain fatal and return an error row. Missing portfolio files
continue to surface a warning while trade-log history remains usable, matching
the existing adapter contract.

### Rendering and source health

The normalized `StrategyRow` contract gains `stale` as an allowed status.
Rendering adds an amber stale badge. Metric sorting uses a health rank:

1. current non-error rows;
2. stale rows;
3. fatal error rows.

The overall file-source indicator treats stale rows as `warn`. Fatal file-source
failures remain `error`. Informational messages such as pre-live-start trade
exclusions remain warnings and do not change strategy status.

### Contest scoring and cache safety

Only current, non-fatal rows are eligible for the top-five forward-P&L
scoreboard. Both `stale` and `error` rows are excluded, so the new visual state
does not weaken contest integrity.

Browser cache protection continues rejecting truncated or error-dominated
snapshots and any snapshot that loses protected CODEX history. Stale rows with
intact histories may be cached so the dashboard can continue displaying the
last valid evidence during an upstream outage.

### Local automation handoff

FABLE depends on stock and crypto caches refreshed by Stock Nightly. Its launcher
will perform bounded, condition-based waiting when the upstream refresh is
running or cache validation reports staleness. It will retry only source-health
checks; it will not generate from suspect data. On timeout or persistent
connectivity failure it will exit nonzero and leave the previous valid strategy
files untouched.

Local strategy regeneration remains deterministic and paper-only. The repair
will not change strategy rules, broker settings, allocation, live routing, or
external BULL files.

## Error Handling

- A missing or unreadable trade log produces `error` with zero synthetic
  metrics, as today.
- A valid trade log plus an old portfolio timestamp produces `stale` with the
  full computed history.
- A missing or invalid required freshness timestamp produces `stale`, because
  the history is readable but recency cannot be established.
- A future timestamp beyond the existing tolerance produces `stale` and a
  diagnostic message.
- A failed cache refresh never overwrites the last valid strategy artifacts.
- A bounded automation wait times out with a nonzero result and an actionable
  log entry rather than hanging indefinitely.

## Testing and Verification

Implementation follows test-driven development:

- adapter tests first fail expecting `stale` instead of `error` for old,
  readable BULL and local portfolio snapshots;
- source-health and sorting tests first fail for the new health rank;
- contest tests first fail unless stale strategies are excluded;
- automation tests first reproduce the concurrent/missed-schedule cache race;
- integrity tests first enforce at least the 80-row baseline and non-empty
  forward histories for all protected CODEX rows.

Final verification includes:

- the complete `npm test` suite;
- the live `npm run smoke` workflow;
- zero fatal row errors when all required sources are readable;
- all 80 current strategies still present;
- protected CODEX trade counts remain non-zero and no lower than the captured
  baseline where deterministic regeneration is not involved;
- all stale rows retain their historical metrics and are absent from scoring;
- local nightly handoff tests and a non-trading cache-health dry run;
- static rendered-HTML assertions for the amber stale badge and row ordering.

Live browser automation is unavailable in the current Codex session, so visual
verification will use renderer tests and generated HTML inspection unless a
browser connection becomes available before completion.

## Non-Goals

- Removing or archiving strategies.
- Fabricating fresh timestamps or suppressing source-health messages.
- Changing strategy parameters, paper trades, portfolio allocations, or broker
  execution.
- Writing to the external BULL repository.
- Publishing, pushing, or deploying unrelated dirty-worktree changes.
