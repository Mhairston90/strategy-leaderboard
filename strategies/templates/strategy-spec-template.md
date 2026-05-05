# <Strategy Name> v1 — Design Spec

**Status:** DRAFT | PAPER | LIVE | ARCHIVED
**Spec freeze:** YYYY-MM-DD
**Paper trading start:** YYYY-MM-DD
**Author:** <github handle>
**Repo:** strategy-leaderboard
**Adapter:** `adapters/adapter_codex.js` (or your custom adapter)

---

## 1. Edge thesis

One paragraph. What inefficiency are you capturing, and why do you believe it persists in forward time? Be honest — "I noticed pattern X in backtests" is fine, but state it as that, not as a deeper claim.

## 2. Universe

Exact symbols, frozen at spec freeze:
- Symbol 1
- Symbol 2
- ...

If you re-rank periodically (quarterly, etc.), describe the rule that governs re-selection. Selection rules are part of the spec; ad-hoc curation isn't allowed.

## 3. Timeframe & direction

- **Bars:** 1H / 4H / 1D / etc.
- **Direction:** long-only / short-only / both

## 4. Entry rules

Pseudocode or natural language. Must be deterministic — given the same OHLC data, two implementations should produce identical signals.

```
LONG entry on bar close when:
  - <condition 1>
  - <condition 2>
  - <condition 3>
  - heat cap not exceeded
```

## 5. Exit rules

- **Hard stop:** entry − N × ATR(M) (or fixed dollar / fixed %)
- **Profit target / partial:** at +N R, close X% (or "none — let it run")
- **Trailing stop:** N × ATR below highest close since entry, etc.
- **Time stop:** none (or "close all positions after N bars")

## 6. Position sizing

```
risk_per_trade = R% × current_equity
position_size = risk_per_trade / (entry − stop)
```

If using leverage, declare the multiplier and the effective per-trade exposure.

## 7. Risk controls

- Max concurrent positions: N
- Per-symbol pyramiding: yes/no
- Daily loss circuit: −X% of starting-of-day equity
- Weekly review gate: PAUSE/CONTINUE/KILL after each Sunday close
- Other: <correlation cap, sector cap, regime gate, etc.>

## 8. Capital

- Starting virtual capital: **$10,000** (or declared)
- Currency: USD

## 9. Kill switch

- Max DD threshold: **N%**
- Reason this number is right (Monte Carlo P95, historical max, etc.)

## 10. Expected behavior

| Metric | Expected range |
|---|---|
| Trades per week | M–N |
| Win rate | X–Y% |
| Avg winner / avg loser | X.X–Y.Y |
| Profit factor | X.X–Y.Y |
| 6-week max DD | X–Y% |

## 11. Validation

What gives you confidence the spec is well-formed? Backtest results? Paper-trade history elsewhere? Pure logic-deduction from a known-validated parent strategy?

If you have backtest numbers, paste them honestly:

| Partition | Trades | WR | PF | DD | Net |
|---|---|---|---|---|---|
| IS YYYY-MM → YYYY-MM | NNN | XX% | X.XX | X% | +/-X% |

## 12. Known limitations

List at least 2–3 things that could cause this strategy to underperform, fail, or break. Honesty here is more credible than over-confident projections.

- Limitation 1
- Limitation 2
- ...

## 13. Out of scope

Things you're explicitly NOT doing in v1 (deferred to v2+):

- Short side
- Adaptive sizing
- Cross-strategy coordination
- ...
