# Fill-Realism Parity Study — 2026-06-10

> Generated 2026-06-11T04:26:05Z by `fable_engine.fill_study`. Window: 2026-04-16T13:30:00Z → today (backfill).
> REALISTIC = next-bar-open entries + adverse slippage on every fill (7.5 bps equities, 20 bps crypto).
> Official logs are UNCHANGED — June specs are frozen and fill model is part of the spec.

| Strategy | Closes (base) | PnL signal-close | Closes (real) | PnL realistic | Delta | Survival |
|---|---|---|---|---|---|---|
| FABLE Equities Snapback L/S v1 | 67 | +618.90 | 69 | +131.34 | -487.56 | 21% |
| FABLE Equities Snapback Turbo | 59 | +1192.17 | 62 | +446.71 | -745.47 | 37% |
| FABLE Equities Afterburner v1 | 29 | +675.71 | 29 | +482.02 | -193.70 | 71% |
| FABLE Equities Fader v1 | 80 | -238.06 | 78 | -750.98 | -512.93 | 315% |
| FABLE Equities Gap Snap v1 | 49 | +67.88 | 49 | -637.54 | -705.41 | -939% |
| FABLE Crypto Pulse L/S v1 | 43 | +365.44 | 41 | -221.35 | -586.79 | -61% |
| FABLE Crypto Drift v1 | 21 | +1691.60 | 21 | +1218.38 | -473.22 | 72% |

## Reading

Survival = realistic PnL as a share of signal-close PnL on the same
signals. Below ~60% means the paper edge leans heavily on fills you
cannot get. Mean-reversion entries (limit-like, fading moves) are
expected to degrade modestly; breakout/continuation entries (chasing
moves) are expected to degrade most — the next bar opens further in
the direction being chased.

## Recommendation

Adopt REALISTIC fills as the standard for all NEW specs from July
(board-wide), and treat any strategy whose backfill edge does not
survive realistic fills as unproven regardless of its paper numbers.
