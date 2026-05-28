> **ARCHIVED 2026-05-16 by Claude.** This strategy is no longer running on the leaderboard.
>
> **Reason for archive:** Out-of-sample collapse identified via `scripts/basket_oos_audit.js` and surfaced by `scripts/claude_hermes_supervisor.js`. The 50/50 IS/OOS split on 11 closed exits showed PF 3.51 → 0.02, win rate 60% → 17%, OOS PnL −$1,198.21. Three drift flags fired: PF collapse, OOS turned negative, win-rate drop >15pp. Three independent variants of the same stocks-breakout template (v1, Aggressive v1, Aggressive v2) collapsed in OOS simultaneously, indicating template-level regime failure rather than per-variant noise.
>
> **Final standing:** This strategy was the #1 row on the leaderboard at +7.79% cumulative when archived, but that figure was a stale snapshot from `aggressive_v2_portfolio.md` last regenerated 2026-05-14T15:14:53Z; the underlying trade log had already turned cumulative-negative (IS +$1,039 + OOS −$1,198 ≈ −$159). Lead was a fossil; archiving locks in the honest read.
>
> **Successor:** see `strategies/stocks-basket-breakout-v3-spec.md` — addresses the regime-gate failure mode.
>
> **Per COMPETITION.md:** trade log preserved at `data/stock_variants/stocks_aggressive_v2_trade_log.md` for the historical record. Registry entry removed; nightly regenerator should also be paused at the source (in `Claude/Trading Strategy/basket_breakout_stocks/generate_logs.py`).

---
# Stocks Basket Breakout Aggressive v2 — Runner Variant

**Status:** PAPER (offline-simulated)
**Spec freeze:** 2026-05-06
**Paper backfill start:** 2026-04-16
**Live execution earliest:** 2026-06-08
**Parent:** `stocks-basket-breakout-v1-spec.md`
**Sibling:** `stocks-basket-breakout-aggressive-v1-spec.md` (wider net)

---

## 1. Purpose

Equity port of the crypto runner variant. Same setup as parent Stocks v1, same regime gate, same heat cap (almost) — but **no partial profit-take, fatter risk-per-trade, wider trail**. Tests whether v1 takes profit too early on equity breakouts that, once they trigger, often run for several days.

## 2. Edge Thesis

Trend-following literature consistently shows that the bulk of long-run PF in breakout systems comes from a small number of large winners. Anything that trims winners early (fixed take-profits, partial exits, tight trails) reduces PF. v1 takes 50% off at +2R, capping individual trade contribution at ~3-4R total. Equity breakouts on momentum names like NVDA / TSLA / AMD often run for 5-8 trading days when they catch a real move; v1's partial may be leaving 3-5R per trade on the table for those runners.

This variant tests the opposite extreme: hold full size, let the trail stop manage the exit, accept higher per-trade volatility for the chance at fat-tail winners.

## 3. Universe & Direction

Identical to Stocks v1: 8-symbol basket, 1H bars during RTH, long-only, daily regime gate **kept**.

## 4. Parameter Deltas vs Stocks v1

| Parameter | Stocks v1 | Aggressive v2 (Runner) | Reasoning |
|---|---|---|---|
| Per-trade risk | 0.5% | **2.0%** | 4× exposure per signal |
| Heat cap | 4 | **6** | slight loosening; no partial means equity ties up longer |
| Daily regime gate | required | **kept (required)** | this variant is about per-trade size, not signal frequency |
| Strong-close minimum | 0.85 | 0.85 (kept) | |
| Breakout lookback | 120 | 120 (kept) | |
| Stop ATR mult | 1.5 | 1.5 (kept) | same R-distance |
| Partial profit | 50% at +2R | **NONE** | full size held; no partial close ever |
| Trail ATR mult | 2.0 | **2.5** | wider trail; gives runners more room |
| Trail trigger | activates immediately after partial | **activates after price > entry + 1R** | breakeven shift then trail |
| Daily loss circuit | −3% | **−6%** | doubled to match per-trade risk |

## 5. Position Sizing

```
risk_per_trade = 0.020 × current_equity   # 2% (4× v1)
position_size  = risk_per_trade / (entry − stop)
```

Heat cap 6 × 2% = **12% max simultaneous open risk** (same as wider-net sibling — different routes to the same heat ceiling). Cash account, no leverage.

A v1 trade hitting the historical average winner (~3.4R) returns 3.4 × 0.5% = **1.7%**. The same trade in this variant returns 3.4 × 2.0% = **6.8%** — 4× as much. Inversely, a 1R stop-out costs 2% (vs 0.5% on v1).

## 6. Heat & Loss Controls

- Max concurrent: **6** — one slot per symbol
- Trail activates above +1R: stop moves to entry once close > entry + 1R, then trails at 2.5×ATR below highest close
- Daily loss circuit: **−6%** of starting-of-day equity, hard halt until next 00:00 UTC
- Weekly review: PAUSE/CONTINUE/KILL each Sunday close

## 7. Expected Behavior

| Metric | Stocks v1 | Aggressive v2 |
|---|---|---|
| Trades/wk basket | 3-12 | **3-12** (same — same gate + lookback) |
| Win rate | 35-50% | **30-45%** (no partial = some fewer locked-in wins) |
| Avg winner / avg loser | 2.0-3.5 | **3.5-7.0** (the whole point of the variant) |
| PF | 1.0-1.3 | **0.9-1.6** (wider band; depends on whether 5R+ runners materialize) |
| 6-week DD | 6-12% | **12-20%** |
| Tail (P99) DD | ~20% | **30-40%** |

**Kill switch:** 25%. Tints amber at 22.5%.

## 8. First-Window Observation (2026-04-16 → 2026-05-06 backfill)

The runner variant is currently the strongest of the three stock variants in initial back-simulation:

- **6 closed legs over 3 weeks** (right at the low end of the 3-12 expected range)
- **50% win rate** (in expected band)
- **Cumulative PnL: +$773.55 (+7.7%)** vs Stocks v1 +$43 and Aggressive v1 −$416
- **Best trade: AMD +6.25R, +$1191** — entry at $295, exit at $335 via trailing stop after 5 trading days. Without the partial, the full position rode the trend.
- **One `exit-stop-gap` event** correctly fired on NVDA when the stock gapped down through the trail at the open — the gap-aware fill closed at $209.51 (open) instead of the trail level.

Caveat: 6 trades is small-N. The runner thesis depends on sustained trends, and this 3-week window happened to feature one. Don't extrapolate.

## 9. Known Risks Specific to This Variant

1. **The "let runners run" thesis is well-known and frequently wrong on noisy intraday data.** Equity breakouts often get one big push then mean-revert before forming a sustained trend. Without the partial, this variant gives back the entire move on every reversal.
2. **2% per-trade risk + 6 concurrent positions = 12% max heat.** A correlated basket-wide reversal day can stop out 4-6 positions simultaneously, costing 8-12% in one session.
3. **Wider trail (2.5×ATR) means later stop-outs.** Runners give back more before stop fires.
4. **Trail-activation at +1R is the sole concession to risk management.** Until +1R, the position is at full 1R risk (= 2% account).
5. **Pure trend-following — choppy regimes will be more punishing than for v1.** Whenever the basket is in chop, this variant underperforms.
6. **Equity-specific gap risk.** A stock that gaps down 10% overnight (rare but possible on earnings or news) at full 2% risk and 5x ATR distance could lose 6-8% on a single position.

## 10. Sibling Variant

See `stocks-basket-breakout-aggressive-v1-spec.md` for the wider-net sibling. The two are designed to fail in opposite ways: aggressive-v1 fails if the gate was earning its keep (more trades = more losers), aggressive-v2 fails if winners don't run far enough (no partial = no locked-in wins). If both win on the leaderboard vs parent v1, the answer is "v1 was over-conservative everywhere."

## 11. Out of Scope

- Leverage, shorts, earnings filter, corporate-action awareness — same as parent
- Adding partial back at higher R-multiples (3R, 4R) — that's a v3 idea
