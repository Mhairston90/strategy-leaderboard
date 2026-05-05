# Basket Breakout Aggressive v2 — Runner Variant

**Status:** PAPER (offline-simulated, nightly routine)
**Spec freeze:** 2026-05-05
**Paper trading start:** 2026-04-16 (back-simulated)
**Author:** Claude, derivative of `basket-breakout-v1-spec.md`
**Sibling:** `basket-breakout-aggressive-v1-spec.md` (the "wider net" sibling — more trades, faster partials)
**Parent:** `basket-breakout-v1-spec.md`

---

## 1. Purpose

Test the hypothesis that v1 takes profit too early. Same setup, same gate, same heat cap (almost) — but **no partial profit-take, fatter risk-per-trade, wider trail**. Let winners run to their full extent and accept larger per-trade volatility.

This variant exists to answer: **"Is v1's +2R partial leaving most of the move on the table?"** Many breakout systems get killed by reversals before partial; many also leave 5R+ runners on the table when they take 50% off at 2R. We don't know which side v1 is on. This variant flips to the opposite extreme.

## 2. Edge Thesis

Trend-following literature consistently shows that the bulk of long-run PF in breakout systems comes from a small number of large winners. Anything that trims winners early (fixed take-profits, partial exits, tight trails) reduces PF. v1 takes 50% off at 2R, which historically caps the upside contribution of any individual trade at ~3–4R total (2R partial + ~1–2R on the runner).

**If the basket produces enough 5R+ winners**, removing the partial and widening the trail will improve PF — even at higher per-trade risk and higher path DD. **If most winners reverse before reaching 5R**, this variant will underperform v1 on PF (because the partial would have locked in profit before the reversal).

The two aggressive variants — wider-net v1 and runner v2 — are intentional opposites on the trade-frequency / trade-size axis.

## 3. Universe & Direction

**Identical to v1**: 8 Kraken USD pairs, long-only, 1H bars, 4H regime gate.

## 4. Parameter Deltas vs v1

| Parameter | v1 | Aggressive v2 (Runner) | Reasoning |
|---|---|---|---|
| Per-trade risk | 0.5% | **2.0%** | 4× capital exposure per signal |
| Heat cap (max concurrent) | 4 | **6** | slight loosening; no partial means equity ties up longer |
| 4H regime gate | required | **kept (required)** | this variant is about per-trade size, not signal frequency |
| Strong-close minimum | 0.85 | 0.85 (kept) | |
| Breakout lookback | 120 | 120 (kept) | |
| Stop ATR mult | 1.5 | 1.5 (kept) | same R-distance |
| Partial profit | 50% at +2R | **NONE** | full size held; no partial close ever |
| Trail ATR mult | 2.0 | **2.5** | wider trail; gives runners more room before stop-out |
| Trail trigger | activated immediately after partial | **activated as soon as price > entry + 1R** | simple breakeven shift, then trail |
| Daily loss circuit | −3% | **−6%** | doubled to match per-trade risk increase |

## 5. Position Sizing

```
risk_per_trade = 0.020 × current_equity
position_size = risk_per_trade / (entry − stop)
```

With heat cap 6 and 2% per trade, max simultaneous open risk = **12% of equity** (same as wider-net sibling, by coincidence — different routes to the same heat ceiling).

A v1 trade that hits its full +3.4R historical average winner would return 3.4 × 0.5% = **1.7% account**. The same trade in this variant returns 3.4 × 2.0% = **6.8% account** (4× as much). Conversely, a 1R stop-out costs **2%** of account here vs **0.5%** on v1.

**No leverage. Spot only.** Same venue as v1.

## 6. Heat & Loss Controls

- **Max concurrent: 6** — one slot per symbol up to 6, no doubling
- **Trail activates above +1R:** stop moves to entry once close > entry + 1R, then trails at 2.5×ATR below highest close
- **Daily loss circuit: −6%** — if realized PnL for the UTC day hits −6% × starting-of-day equity, halt new entries until next 00:00 UTC
- **Weekly review gate:** PAUSE/CONTINUE/KILL at each Sunday close

## 7. Pipeline

Identical to the leveraged variant — see `basket-breakout-leveraged-v1-spec.md` §10. Nightly Python routine, full restated trade-log markdown, leaderboard adapter via `codex-local` source.

## 8. Expected Behavior

| Metric | v1 | Aggressive v2 | Notes |
|---|---|---|---|
| Trades per week (basket) | 5–15 | **5–15** (same — same gate + lookback) | per-trade risk changed, signal definition didn't |
| Win rate | 35–45% | **30–40%** (slightly lower without partial) | partials lock in some marginal wins this variant lets reverse |
| Avg winner / avg loser | 2.0–3.0 | **3.0–6.0** | the whole point of the variant |
| PF | 1.0–1.3 | **0.9–1.5** (wider band) | depends entirely on whether 5R+ winners materialize |
| 6wk DD | 8–15% | **15–30%** | 4× per-trade risk → 4× DD if PF held; partial-removal partially offsets |
| Tail (P99) DD | 23% | **40%+** | losing streak at 4× risk is brutal |

**Kill switch DD threshold for leaderboard:** **25%**. Tints amber at 22.5%.

## 9. Validation

Same as the wider-net sibling: smoke backtest over 2024-Q4 to confirm:
- Simulator emits trades at v1-comparable frequency (sanity that signal definition unchanged)
- Simulator does NOT emit any PARTIAL events (sanity that partial is disabled)
- DD over the 90-day window is < 35% (sanity check on per-trade risk wiring)

The live paper-trade window is the real validation.

## 10. Known Risks

1. **The "let runners run" thesis is well-known and frequently wrong on noisy 1H crypto.** Crypto breakouts often get one big push, then mean-revert. Without the partial, this variant gives back the entire move on every reversal.
2. **2% per-trade risk + 6 concurrent positions = 12% max heat.** A correlated basket-wide reversal day can stop out 4-6 positions simultaneously, costing 8-12% in one session.
3. **Wider trail (2.5×ATR) means later stop-outs.** Runners will give back more before stop fires. If average winner doesn't reach the 4–6R band, this is pure cost.
4. **Trail-activation at +1R is the sole concession to risk management.** Once a trade goes 1R in our favor, the worst case is now break-even (minus fees). But until +1R, the position is at full 1R risk.
5. **No partial means the strategy is pure trend-following.** Choppy regimes will be more punishing than they are for v1, where the partial books +2R wins on bars that subsequently reverse.

## 11. Sibling Variant

See `basket-breakout-aggressive-v1-spec.md` for the wider-net sibling. The two are designed to fail in opposite ways: aggressive-v1 fails if the gate was earning its keep (more trades = more losers), aggressive-v2 fails if winners don't run far enough (no partial = no locked-in wins).

If both win on the leaderboard vs parent v1, the answer is "v1 was over-conservative everywhere." If only one wins, that direction is the lever. If neither, v1's parameters were well-calibrated.

## 12. Out of Scope

- Leverage
- Short side
- Adaptive sizing (Kelly-fractional based on rolling win-rate)
- Adding partials back at higher R-multiples (3R, 4R) — that's a v3 idea
