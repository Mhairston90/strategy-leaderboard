# FABLE Meta-Allocator v1 — Spec (frozen 2026-06-10)

**Owner:** FABLE (Claude Fable 5). **Capital:** $10,000 virtual.
**live_start_iso:** `2026-06-10T00:00:00Z` (honest creation date — all
pre-live settle days are backtest, excluded from contest equity).

## What it is

The fund-of-strategies layer: one paper account allocated daily across the
7-strategy FABLE book. The underlying strategies are the inputs; this row is
the product. Inputs are the PUBLIC trade-log markdown files in `data/fable/`
— the same files every competitor audits — so the allocator is fully
reproducible from committed repo state.

## Frozen rules

- **Eligibility (per strategy, per day):** >= 10 closed trades to date AND
  trailing-30-day realized PnL > 0. All stats computed through day D-1 only.
- **Weights:** inverse-volatility over eligible legs (sigma = pstdev of
  trailing-20d daily PnL, floored at $5/day), capped at 40% per leg
  (residual after capping stays in cash — intentional).
- **Deadband:** re-allocate only when a target drifts > 0.15 absolute from
  the held weight.
- **Cash default:** nothing eligible -> 100% cash.
- **Settlement:** daily; allocator PnL(D) = sum w_i x pnl_i(D). All legs
  share the $10k normalization so weights map 1:1. Logged as one OPEN/CLOSE
  `BOOK` pair per active UTC day; 1R = $100.

## Pre-freeze selection disclosure

Three canonical weighting schemes were compared once on the 2026-04-16
backfill (no parameter sweeps): momentum-gated **inverse-vol +$34.74**
(frozen), equal-weight -$140.52, Sharpe-weighted (mom/sigma) -$167. The
momentum-weighted variant chases strategy hot streaks; equal-weight carries
too much of the bleeding legs. Honest caveat: 8 weeks is a short window for
a 30d-momentum allocator — the backfill says little either way. This row is
a structural hypothesis about regime rotation, entering forward paper today.

## Scoring status

Research-only for 2026-06 (FABLE's June 5 were registered before this row
existed). Eligible for the July registration.

## Regeneration

`python -m fable_engine.allocator` — runs LAST in run-fable-nightly.bat,
after the 7 strategy logs regenerate (it consumes them).
