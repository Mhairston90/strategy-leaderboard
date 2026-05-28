> **PARKED 2026-05-16 by Claude — hypothesis falsified.** This spec is preserved as a research record. The strategy was NOT registered on the leaderboard.
>
> **What was tested:** The proposed v3 (ADX(14)>22 daily trend-strength gate added to v1's existing EMA-50/200 regime gate) plus an ADX-threshold sweep at 22, 25, 30, and 35.
>
> **Result:** No threshold passed the pre-live acceptance criteria. Summary across all 4 thresholds (full 2026-04-16 → 2026-05-16 window):
>
> | Threshold | Closed legs | Full PF | IS PF | OOS PF | OOS PnL | May 8-15 collapse PnL |
> |---|---|---|---|---|---|---|
> | ADX > 22 (this spec) | 13 | 0.54 | 3.97 | 0.01 | −$334 | −$287 (5 trades, all losers) |
> | ADX > 25 | 9 | 0.61 | 2.27 | 0.19 | −$167 | −$154 (3 trades, all losers) |
> | ADX > 30 | 6 | 1.53 | inf | 0.38 | −$64 | −$51 (1 trade, loser) |
> | ADX > 35 | 4 | 2.48 | inf | 0.00 | −$104 | −$52 (1 trade, loser) |
>
> **Why it failed:** The ADX gate at low thresholds (22, 25) is meaningless for high-vol tech names — ADX is rarely below those levels for NVDA/TSLA/AMD/PLTR. At high thresholds (30, 35), the gate DOES filter losers, but it filters proportionally more winners, leaving sample sizes too small (4-6 trades over a month) for any tradable strategy. The OOS half collapsed at every threshold — ADX did not distinguish the chopping regime that killed the breakout template.
>
> **The deeper diagnosis:** Mean Reversion v1 (Connors RSI(2)<10) earned PF 2.61 on the OOS half of the same window using the OPPOSITE signal type. The market regime in May 2026 favors mean reversion, not breakouts. Trying to make breakouts work via parameter tuning is fighting the tape.
>
> **What replaced this experiment:** `stocks-mean-reversion-v2-spec.md` — same parameters as MR v1 but on the diversified GICS-sector universe. OOS PF 4.28, collapse-window PF 5.33. Registered on leaderboard 2026-05-16.
>
> **Disposition of the trade-log files:** `data/stock_variants/stocks_v3_*` and `stocks_v3_adx{25,30,35}_*` preserved as research artifacts but not in the registry. The sweep variant configs in `basket_breakout_stocks/variants.py` (`stocks_v3_adx25/30/35`) were also removed; only `stocks_v3` remains as the canonical configuration the spec describes.

---
# Stocks Basket Breakout v3 — Trend-Strength-Gated Variant

**Status:** PROPOSED (not yet on leaderboard)
**Spec freeze:** pending backtest validation; target 2026-05-18
**Parent:** `stocks-basket-breakout-v1-spec.md`
**Archived sibling:** `archived/stocks-basket-breakout-aggressive-v2-spec.md` (out-of-sample collapse on the v1/Aggressive v1/Aggressive v2 template, 2026-05-16)

---

## 1. Purpose

Address the systematic out-of-sample failure observed in May 2026 across the entire stocks-basket-breakout template. All three variants (v1, Aggressive v1, Aggressive v2) collapsed simultaneously in the OOS half of their trade history — same window, same direction, same template. Per `data/codex/basket_oos_audit.md`:

| Variant | IS PF | OOS PF | IS win | OOS win | Drift flags |
|---|---|---|---|---|---|
| Stocks v1 | 1.97 | 0.01 | 71.4% | 14.3% | PF collapse; OOS turned negative; win-rate drop >15pp |
| Aggressive v1 | 0.89 | 0.36 | 60.0% | 40.0% | PF halved; win-rate drop >15pp; OOS losses accelerating |
| Aggressive v2 (archived) | 3.51 | 0.02 | 60.0% | 16.7% | PF collapse; OOS turned negative; win-rate drop >15pp |

Three independent variants of the same template collapsed in lock-step. This is a template-level regime failure, not per-variant noise. Meanwhile **Stocks Mean Reversion v1** (PF 1.47 → 2.61, 70% win in both halves) is thriving on the same universe in the same window — direct evidence that the May 2026 market is mean-reverting, not trending, and any breakout system in this regime is systematically wrong.

The proposed fix: stop trying to trade breakouts in chopping regimes. Add a trend-strength gate. Only fire entries when the market is actually trending.

## 2. Edge Thesis

The existing daily EMA-50/200 regime gate is necessary but not sufficient. It distinguishes bullish-overall from bearish-overall, but does not distinguish trending-bullish (breakouts work) from chopping-bullish (breakouts get faded). The May 2026 OOS window was almost certainly chopping-bullish for the basket universe — overall above EMA-200, but in a sideways range.

The fix is a second gate: ADX(14) on the daily timeframe of the specific symbol. ADX is direction-agnostic; it measures trend strength only. Threshold ADX > 22 filters out chop. Both gates must agree for an entry.

## 3. Universe & Direction

Identical to Stocks v1: 8-symbol basket (NVDA, TSLA, AMD, PLTR, META, NFLX, AVGO, AAPL), 1H bars during regular trading hours, long-only.

## 4. Parameter Deltas vs Stocks v1

| Parameter | Stocks v1 | v3 (Trend-Gated) | Reasoning |
|---|---|---|---|
| Per-trade risk | 0.5% | 0.5% (kept) | Risk sizing is not the failure mode |
| Heat cap | 4 | 4 (kept) | |
| Daily regime gate (EMA-50/200) | required | required (kept) | Overall bullish-vs-bearish filter |
| **Daily trend-strength gate (ADX-14)** | none | **ADX > 22 required** | NEW — filters chopping regimes |
| Strong-close minimum | 0.85 | 0.85 (kept) | |
| Breakout lookback | 120 | 120 (kept) | |
| Stop ATR mult | 1.5 | 1.5 (kept) | |
| Partial profit | 50% at +2R | 50% at +2R (kept) | |
| Trail ATR mult | 2.0 | 2.0 (kept) | |
| Daily loss circuit | −3% | −3% (kept) | |

Only one parameter changed. The minimal-perturbation principle: if v3 outperforms v1, attribution is unambiguous.

## 5. The Trend-Strength Gate

ADX (Average Directional Index, Welles Wilder 1978) measures trend strength regardless of direction. Standard interpretation:

- ADX 0-20: no trend / mean-reverting market
- ADX 20-25: developing trend
- ADX 25-50: strong trend
- ADX 50+: very strong trend (often near exhaustion)

**Threshold:** ADX > 22 on the daily timeframe of the candidate symbol.

**Computation:** Wilder's smoothing on the last 14 daily bars. Evaluate at the start of each US trading day; cache for that day. If the daily bar for today hasn't closed and ADX hasn't been evaluated, hold off on entries until it has.

**Per-symbol, not basket-wide:** Each of the 8 universe symbols has its own ADX. A breakout candidate on NVDA only requires NVDA's ADX to be above threshold, not the basket average. This preserves the variant's ability to find trending names within a chopping basket.

## 6. Position Sizing

Unchanged from v1: `risk_per_trade = 0.005 × current_equity`, `position_size = risk_per_trade / (entry − stop)`. Cash account, no leverage.

## 7. Heat & Loss Controls

Unchanged from v1: max 4 concurrent positions, daily loss circuit −3% of starting-of-day equity, weekly PAUSE/CONTINUE/KILL review.

## 8. Expected Behavior vs v1

| Metric | Stocks v1 | v3 (projected) |
|---|---|---|
| Trades/wk basket | 3-12 | 1.5-7 (50-60% of v1; gate filters chop) |
| Win rate | 35-50% | **45-60%** (higher; conditioned on real trends) |
| Avg winner / avg loser | 2.0-3.5 | 2.0-3.5 (same — signal logic unchanged) |
| PF | 1.0-1.3 | **1.3-1.7** (improvement from filtering bad regimes) |
| 6-week DD | 6-12% | 5-10% (fewer entries, higher conviction each) |
| Tail (P99) DD | ~20% | ~18% |

**Kill switch:** 18% (same as v1).

## 9. Pre-Live Acceptance Criteria

v3 graduates from PROPOSED to a registry entry only if **all** of the following hold over the full 2026-04-16 → freeze backtest window:

1. **PF > 1.20** over the entire backfill window
2. **OOS PF > 1.0** on the 2026-05-08 → 2026-05-15 window (the window in which v1/Aggressive v1/Aggressive v2 collapsed)
3. **Closed-trade count >= 15** (sample sufficiency)
4. **Max drawdown < 12%**
5. **Direction-of-edge consistency:** PF in 2-week rolling windows must be > 0.8 for at least 75% of windows (no single bad week tanks the average)

If any of these fail, the gate threshold is re-tuned (try ADX > 18, 20, 24, 25) before reconsidering. If no threshold passes, the v3 spec is parked and a different fix (volatility filter, mean-reversion fallback, or universe change) is drafted as v4.

## 10. Implementation Plan

1. **Add ADX(14) computation** to `Claude/Trading Strategy/basket_breakout_stocks/generate_logs.py`. Use `pandas-ta` (already imported in adjacent stockstats-style scripts) for the ADX function.
2. **Add gate to entry logic:** between the existing EMA-50/200 check and the breakout-signal check, insert `if daily_adx[symbol] < 22: skip`.
3. **Run regenerator** from 2026-04-16 against the standard universe.
4. **Validate** via `scripts/basket_oos_audit.js`: confirm OOS PF > 1.0 on the collapse window.
5. **Compare** v3 backfill results against v1 over identical windows. If v3 PF < v1 PF, the gate is hurting rather than helping; iterate threshold.
6. **Register** if criteria pass: add entry to `registry.js` with `live_start_iso: '2026-05-18T13:30:00Z'` (next US market open).
7. **Update README.md** stocks-basket-breakout table.
8. **Run `scripts/claude_hermes_supervisor.js --refresh`** to add v3 to supervised cohort.

## 11. Known Risks Specific to This Variant

1. **ADX is a lagging indicator.** When a trend exhausts, ADX stays elevated for several bars before dropping. The gate may permit entries right at the end of a move. Mitigation: the existing EMA-50/200 gate and the 120-bar breakout lookback together require both meso-scale and micro-scale agreement, so the lag is partially absorbed.
2. **Threshold tuning is empirical.** ADX > 22 is a common heuristic but may not be optimal for 1H breakouts on tech-stock universes. Pre-live tuning is part of the validation step.
3. **Reduced trade count slows sample accumulation.** Where v1 might hit the 30-trade sample gate in 4 weeks, v3 might take 6-7 weeks. Acceptable tradeoff if signal quality is meaningfully better.
4. **Tech-universe failure may not be ADX-fixable.** The OOS collapse was concentrated in the tech-heavy universe. If the issue is more about earnings season / specific event-driven moves than about chop, an ADX gate won't help. The validation steps will reveal this.
5. **Mean Reversion v1 is currently winning on the same universe.** That strategy's success is direct evidence the regime favors mean reversion. v3 is a hedge — it should improve on v1's failure but won't necessarily beat Mean Reversion v1. The point is having BOTH signals available for different regimes.

## 12. Sibling and Parent Status

- **Parent (Stocks Basket Breakout v1):** still active in registry, P1 collapsing per Claude Hermes Supervisor. v3 supersedes v1 if validation passes; v1 stays active until v3 is registered, then v1 is also archived.
- **Sibling (Aggressive v1):** P1 collapsing per supervisor. Will follow same archive path as Aggressive v2 if no recovery in next 2 weeks.
- **Archived sibling (Aggressive v2):** archived 2026-05-16. Not un-archived under any circumstances; v3 is a new entry.
- **Stocks Mean Reversion v1:** complementary strategy, currently stable_profitable. v3 and Mean Reversion v1 should coexist on the leaderboard — they're orthogonal signal types and the leaderboard is richer with both.

## 13. Out of Scope (queued for v3.1 / v3.2 / v4)

- **v3.1:** volatility-band filter — only trade breakouts when realized vol is in a specific band (filter both too-low and too-high)
- **v3.2:** mean-reversion fallback — when both regime gates are closed, route signals to a mean-reversion engine instead of sitting in cash
- **v4:** dual-universe (tech + diversified) with allocation weighting based on rolling 4-week PF per universe
- **NOT in scope:** leverage, shorts, earnings/corporate-actions, broker integration

---

**Spec author:** Claude  
**Drafted:** 2026-05-16  
**Awaiting:** backtest validation via `generate_logs.py` update + `scripts/basket_oos_audit.js` re-run on v3 output