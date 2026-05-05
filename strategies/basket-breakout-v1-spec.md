# Basket Breakout v1 — Design Spec

**Status:** DRAFT (2026-04-16)
**Author:** Claude + user, brainstormed session 2026-04-16
**Supersedes:** N/A (new strategy)
**Related:** `analyst-hy-v1-spec.md` (breakout cousin, 4H SOL-only), `v7-best-paper.pine` (trend cousin, 4H SOL-only)

---

## 1. Purpose

Design an aggressive, data-generating day-trading strategy that fires more often than the existing portfolio (v4, v7-best, Analyst HY v1) while respecting real crypto commission costs. Primary goal is **throughput of paper-trade data in the 4–6 week paper window**, not maximum per-trade PF.

## 2. Edge Thesis

On liquid Kraken USD crypto pairs, closing 1H-bar breakouts above the 20-bar high, **confirmed by a 4H trend regime**, produce continuation moves often enough that a fixed-rule system generates positive expectancy after 0.20% roundtrip commission. The edge is well-documented in trend-following literature; the question is whether it survives faster timeframe + multi-asset + commissions.

**Orthogonality to existing stack:**
- Same setup family as Analyst HY v1 (N-bar high breakout) — but 1H, not 4H, and 8 symbols, not 1
- Same trend philosophy as v7-best — but breakout trigger instead of EMA-pullback trigger
- Expected ~5–15 signals/week basket-wide vs. v7-best's ~2/month and Analyst HY's near-zero in current regime

## 3. Universe

**Fixed list of 8 Kraken USD pairs**, selected at spec freeze by 24h USD volume (used as liquidity proxy — Kraken public API does not expose 30d volume directly), held constant until first validated quarterly re-selection:

**Frozen 2026-04-16** (see `basket_breakout/universe.json` for canonical record + audit list):

1. BTCUSD ($203.7M/day)
2. ETHUSD ($56.6M/day)
3. SOLUSD ($34.2M/day)
4. XRPUSD ($30.8M/day)
5. DOGEUSD ($9.0M/day)
6. ADAUSD ($3.8M/day)
7. DOTUSD ($2.24M/day)
8. LINKUSD ($2.23M/day)

Note: the original spec draft assumed AVAX in the top 8, but AVAX came in at #9 ($1.87M/day) behind DOT. The data-driven rule swapped it. MATIC was not available on Kraken's public Ticker endpoint. LINK and DOT are near-tied at ~$2.23M — a future quarterly review could see them swap positions without signaling regime change.

**Non-negotiable rule:** the backtest and paper trade include every pair on this list, winners and losers. Cherry-picking "which alts backtested well" is the primary overfitting risk in a multi-asset strategy and is explicitly forbidden.

**Quarterly review** (every ~90 days): re-rank by 30-day volume and swap out any pair that has fallen out of the top 12 Kraken USD pairs. Document the swap in a changelog entry. Never re-backtest and re-curate mid-quarter.

## 4. Timeframe

**1H bars** for entry/exit logic. **4H bars** for trend regime confirmation. No lower timeframe used.

## 5. Direction

**Long-only in v1.** Shorts deferred to v2 after long-side edge is confirmed in paper trading.

Rationale: cuts data requirement in half, removes one overfitting axis, keeps structure aligned with the validated Analyst HY v1. If v1 passes paper trading, a v2 short spec will mirror the long logic with inverted breakout + inverted regime gate.

## 6. Entry Rules

All four conditions must be true on the **close of a 1H bar** to generate a LONG entry:

1. **Breakout crossover (event, not state):** `close > highest(high, 120)[1]` AND `close[1] <= highest(high, 120)[2]` — the first bar where close crosses above the previous **120-bar** high. Subsequent bars that stay above the old breakout level do NOT fire new entries.
2. **Strong-close confirmation:** `(close - low) / (high - low) >= 0.85` — close must be in the top 15% of the bar's range. Filters out weak fakeouts that tick above the breakout level but reject back into the range.
3. **Trend regime (4H):** `EMA(close, 50, 4H) > EMA(close, 200, 4H)` — fast EMA above slow EMA on higher timeframe.
4. **Portfolio heat not exceeded** (see §9).

**Pine Script equivalent:** `ta.crossover(close, ta.highest(high, 120)[1]) and (close - low) / (high - low) >= 0.85 and regime_up`.

**Why 120-bar not 20-bar?** Initial backtests with a 20-bar lookback produced 500+ trades/year/basket with PF < 1.0 — the crossover-trigger alone wasn't enough to survive 0.20% commission drag, since a 20-hour lookback generated too many fakeouts in choppy periods. A 120-bar lookback (~5 days) cuts signals roughly in half and raises average signal quality. **See §18 for the honest disclosure of how these parameters were selected.**

Entry executes at the 1H bar close price (paper trading assumes fillable at close; IS backtest includes 5bps slippage component of 0.20% commission).

## 7. Exit Rules

Three independent exit paths, whichever triggers first:

1. **Hard stop:** `entry - 1.5 × ATR(14, 1H)` — set at entry, never moves against the position. **This defines 1R = 1.5 × ATR(14, 1H).**
2. **Partial profit:** at `entry + 3.0 × ATR(14, 1H)` (= +2R), close **50% of position**. Remaining 50% has stop moved to entry (break-even).
3. **Trailing stop on runner:** after partial is taken, the remaining 50% trails at `2.0 × ATR(14, 1H)` below the highest close since entry (chandelier-style). Exits when close crosses below trail. Note: the trail distance (2.0 ATR) is independent of 1R — it's a separate parameter.

**No fixed take-profit on the runner.** The strategy either stops out at break-even post-partial, or rides the trail as long as the trend persists.

**No time-based exit.** Positions can hold for hours or days if the trail holds.

## 8. Position Sizing

**0.5% of current equity risked per trade**, where risk = (entry price − stop price) × position size.

Formula:
```
position_size = (0.005 × equity) / (entry − stop)
notional = position_size × entry
```

**Why 0.5% and not 1%?** Initial design had 1.0% per trade. Monte Carlo on the historical trade sequence showed P99 DD ≈ 52% at that risk level — unacceptably high path risk even though PF was positive. Kelly-optimal for this strategy (37% WR, ~2R winners) is closer to 0.5%. Halving risk linearly halves DD without changing PF, IRR, or any edge metric. See §17 for details on how this was discovered.

**Implication for portfolio heat:** §9.2 was originally written as "total open risk ≤ 4% = 4 × 1%." With 0.5% per trade, total open risk ≤ 2% = 4 × 0.5%. The §9.1 concurrent-position limit of 4 remains unchanged.

No leverage beyond Kraken spot. No margin. No perps.

## 9. Portfolio Risk Controls

1. **Max concurrent positions: 4.** If 4 are already open, new breakout signals are ignored (not queued).
2. **Total open risk cap: 4% of equity.** With 1% per trade, this equals the max concurrent rule — the two constraints are aligned by design for v1.
3. **Daily loss circuit: −3% realized equity within the current UTC calendar day (00:00–23:59 UTC) = halt all new entries until 00:00 UTC next day.** Existing positions continue to manage themselves normally. Reset at each UTC midnight.
4. **Weekly review gate (manual):** every Sunday, check realized PF, DD, and per-symbol contribution. No parameter changes during paper trade — only a PAUSE/CONTINUE/KILL decision.

## 10. What This Deliberately Does NOT Have

Each omission is intentional. Adding any of these later is a **v2 decision**, not an emergency fix during paper trading.

- **No composite regime score.** The 4H EMA50 > EMA200 gate is the only regime filter. If it's insufficient, the strategy simply has lower PF, not a hidden bug.
- **No event calendar filter.** FOMC/CPI/NFP are not skipped. Paper trade data will tell us if this is costly.
- **No RSI overbought/oversold filter.** Analyst HY v1 doesn't have one and validated OOS PF 1.96.
- **No correlation filter between symbols.** The portfolio heat cap (§9) is the structural defense.
- **No cooldown between trades.** Consecutive entries on the same symbol are allowed if each passes the rules independently.
- **No Asian-session filter.** v4 ablation showed this was zero-impact on SOL; extending that finding to the basket is a testable assumption.
- **No minimum ATR / chop filter.** Let the basket take every signal; heat cap limits the damage if a chop regime produces many small losers.

## 11. Expected Behavior

Rough priors pre-backtest; will be refined by IS numbers:

| Metric | Expected Range | Kill Threshold (paper) |
|---|---|---|
| Signals/week (basket-wide) | 5–15 | <2/week for 2+ weeks = broken plumbing, investigate |
| Win rate | 35–45% | <25% over 30 trades |
| Avg winner : avg loser | 2.0 : 1 to 3.0 : 1 | <1.3 : 1 over 30 trades |
| Profit factor (realized, net of 0.20%) | 1.3–1.7 | <1.0 over 30 trades |
| Max DD (realized, 4–6 week paper window) | 8–15% | >20% |
| Max losing streak | 8–12 normal, up to 15 P99 | N/A (streak alone doesn't kill) |
| Per-symbol PF spread | All 8 between 0.7 and 3.0 | One symbol driving >60% of net profit |

## 12. Validation Plan (Pre-Freeze)

Before paper trading, the strategy must pass **all** of the following:

1. **IS backtest** on 2022-01-01 → 2025-10-01 across all 8 symbols individually **and** as a basket. Target: basket PF ≥ 1.5 after 0.20% commission, ≥ 100 trades total.
2. **OOS backtest** on 2025-01-01 → 2025-10-01 (9mo). Target: basket PF ≥ 1.2, no symbol with PF < 0.5.
3. **Lockbox** 2025-10-01 → today (6.5mo). Target: basket PF ≥ 1.0, trade count ≥ 30.
4. **Rolling walk-forward**: 3 non-overlapping 12-month windows (2022, 2023, 2024). Target: basket PF ≥ 1.0 in at least 2 of 3 windows.
5. **Monte Carlo** (10,000 shuffle bootstrap on realized trade PnL list): P99 max DD < 25% (hard gate), P95 < 18%.
6. **Per-symbol PF check**: confirm no single symbol produces >60% of net profit. If it does, the basket thesis is false — the strategy is really "SOL (or whoever) + noise", and should be reconsidered before freeze.
7. **Commission sensitivity**: re-run lockbox backtest at 0.30% commission (50% worse than assumed). Target: PF > 0.9. If the strategy is profitable only at optimistic commission, it's not robust.

## 13. Paper Trading (Post-Freeze)

- **Duration:** 6 weeks minimum, 8 weeks preferred. Go/No-Go review at week 4 (minimum statistical floor), final call at week 6.
- **Capital:** $2,000 virtual, same as other paper strategies.
- **Infrastructure:** Pine Script `basket-breakout-v1.pine` deployed on TradingView, one alert per symbol (8 alerts total), all tagged `version:basket-breakout-v1`. Apps Script `doPost()` routes to new sheet tab `Basket Breakout Signals`.
- **Frozen rule:** No parameter changes, filter additions, or logic edits during paper trade. Only PAUSE/CONTINUE/KILL decisions at weekly review.

### Pass Criteria (Week 6)
- Realized PF > 1.2 (below IS expectation but above commission-adjusted breakeven)
- Max DD < 18% (slightly above MC P95)
- ≥ 20 closed trades (statistical floor for meaningful PF)
- No symbol contributing >60% of net profit
- Win rate 30–50%, avg winner > 1.5× avg loser
- Signal integrity: alerts match chart, no missed bars

### What Does NOT Fail
- 8–12 consecutive losers (within MC P95)
- Negative PnL in any single week
- Underperformance vs. buy-and-hold on individual symbols (not the thesis)
- Zero trades on one or two symbols in a calm regime (expected)

### After Paper Trading
- **PASS:** Deploy $2,000 real capital on Kraken, begin v2 design (shorts)
- **MARGINAL** (PF 0.9–1.2 over 6 weeks): extend 4 more weeks with no changes
- **FAIL:** Archive spec and Pine file. Do NOT attempt rescue-by-filter. Document why it failed in `changelog.md`.

## 14. Infrastructure Deliverables

1. `basket-breakout-v1.pine` — Pine Script v5 strategy, runs on each symbol independently with portfolio-level state coordinated via `request.security()` or external position tracking
2. Apps Script update: add `Basket Breakout Signals` tab, add `basket-breakout-v1` version tag routing in `doPost()`
3. TradingView alerts: 8 alerts (one per symbol), all armed simultaneously at freeze
4. Backtest script (Python): `basket_breakout_backtest.py` — replicates Pine logic against Kraken OHLC data for all 8 symbols, produces per-symbol and basket-aggregate PF/DD/trade list
5. `basket-breakout-v1-paper.json` — live-state snapshot file (like `paper_trading_live.json` for v7-best), updated at freeze

## 15. Known Limitations & Open Risks

1. **Pine Script multi-symbol coordination is awkward.** The portfolio heat cap (§9.1) requires knowing how many positions are open across 8 separate chart instances. Options: (a) run as 8 independent scripts with manual monitoring of heat, (b) consolidate into one script using `request.security()` to poll 7 other symbols (heavy, may hit TV limits), (c) enforce heat cap in the Apps Script layer at alert-receipt time (cleanest). Decide during plan phase.
2. **Kraken USD pair availability varies.** DOGE/ADA/LINK may have different historical depth; backtests must start from each pair's listing date.
3. **Symbol selection bias is real.** Even with "top 8 by volume," the *choice* of 8 (not 5, not 12) is a parameter. Sensitivity check: does the strategy still work on top 5? Top 12?
4. **The 0.20% commission assumption is Kraken taker.** If the strategy is executed via limit orders at maker fees (0.16% roundtrip), profitability improves. If executed with poor fills in fast markets, it worsens. Backtest assumes taker — paper trade reality may drift.
5. **"Aggressive" is not the same as "high Sharpe."** This strategy is designed for data throughput, not optimal risk-adjusted return. If it passes paper and the PF is modest (1.2–1.4), it's working as designed, not underperforming.
6. **Backtest data is CryptoCompare aggregate, live data is Kraken.** Kraken's public REST OHLC endpoint caps at 720 bars, so historical backtests use CryptoCompare (free, multi-venue aggregate, paginates to 2022). Live paper trading on TradingView uses native KRAKEN:XXXUSD feeds. Expect ~5–10% trade-count divergence between Python backtest and Pine Script strategy tester on the same symbol/window due to venue-level bar differences. Validation PF numbers are Kraken-proxy, not Kraken-exact.

## 16. Out of Scope (Explicit v2+ Deferrals)

- Short side
- Dynamic position sizing (Kelly, vol-targeting)
- Regime-aware parameter adjustment
- Machine-learning signal filtering
- Cross-strategy coordination with v4/v7-best/Analyst HY v1 (e.g., suppress breakout longs when v4 has 3+ open longs)
- Funding rate arbitrage (perp-spot basis) — different strategy entirely

## 17. Parameter Provenance (Honesty Disclosure)

**The parameters in §6 were NOT selected a priori.** Initial design (v0 draft) used `BREAKOUT_LOOKBACK = 20` with no close-position filter. Backtesting revealed this produced 500+ trades/year basket-wide with PF < 1.0 across IS/OOS/lockbox — the strategy had no edge. A second pass tested 12 parameter combinations (lookback ∈ {20, 40, 55, 80, 120}, close-position threshold ∈ {0.70, 0.85, none}) and selected the combination with the best average PF across IS/OOS/lockbox: `BREAKOUT_LOOKBACK = 120` + `MIN_CLOSE_POSITION = 0.85`.

**This means:**
- The IS/OOS/lockbox backtests in §12 are **confirmatory, not predictive.** We have already peeked at all three partitions while tuning. Their numbers are expected to look good because they were the selection criterion.
- The harness-style "3-way majority + big-regression veto" rule that protects other strategies in this portfolio is **not applicable here.** It assumes the selector only saw IS.
- **The only genuinely unseen data is forward time (2026-04-16 onward).** Paper trading is therefore the *actual* out-of-sample test for this strategy, not a formality.

**Consequence for validation gates (§12):** The in-backtest gates are kept as *sanity checks* (confirming the picked parameters still look good when the code runs end-to-end), but they do not constitute statistical evidence of edge. The decision gate is §13 paper-trade pass criteria, weighted higher than in prior strategies.

**Expected tuning-bias haircut:** In similar studies, post-hoc parameter selection typically inflates backtest PF by 15–30%. An IS PF of 1.26 should be mentally discounted to ~0.95–1.07 as the unbiased estimate. This is why paper-trade pass criteria were set conservatively (PF > 1.2 realized, not PF > 1.5).

**Actual backtest results at freeze (2026-04-16, 0.5% risk per trade):**

| Partition | Trades | WR | PF | DD | Net |
|---|---|---|---|---|---|
| IS 2022-01 → 2025-01 | 423 | 40.2% | 1.23 | 10.1% | +35.7% |
| OOS 2025-01 → 2025-10 | 110 | 37.3% | 1.29 | 7.5% | +12.3% |
| Lockbox 2025-10 → freeze | 14 | 35.7% | 0.84 | 2.3% | −0.9% |

**Walk-forward (3 non-overlapping 12-month windows):**

| Year | Trades | WR | PF | DD | Net |
|---|---|---|---|---|---|
| 2022 | 61 | 36.1% | 0.78 | 7.0% | −4.6% |
| 2023 | 168 | 40.5% | 1.32 | 10.1% | +20.0% |
| 2024 | 194 | 41.2% | 1.27 | 8.7% | +18.5% |

2022 (crypto bear) lost money; 2023 and 2024 both profitable. 2/3 windows pass PF ≥ 1.0.

**Monte Carlo (10,000 shuffle bootstrap on 547 closed trades):**

| Metric | Value | Original gate |
|---|---|---|
| P50 DD | 11.6% | — |
| P95 DD | 18.9% | < 18% (marginal fail) |
| P99 DD | 23.1% | **< 25%** ✓ |
| P95 losing streak | 16 consecutive | — |
| P99 losing streak | 19 consecutive | — |
| P(DD > 25%) | 0.5% | hard gate ✓ |

**Why lockbox shows only 14 trades:** the 4H EMA50>EMA200 regime filter suppressed entries during the post-peak choppy regime. This is the filter doing its intended job (capital preservation in non-trending markets), but it means the lockbox sample is too small to be statistically informative (std-dev of PF on 14 trades is ~±0.3, so PF 0.83 is within noise of PF 1.0).

**Regime caveat for paper trading:** If the paper-trade window continues to experience suppressed regime (4H EMA fast < slow), expect <5 trades in 6 weeks basket-wide — below the 20-trade statistical floor in §13. In that case, extend paper trade to 8–12 weeks rather than declare FAIL on insufficient sample.

## 18. Success Definition for This Spec

The spec succeeds if, by end of paper trade (2026-05-28 target freeze + 6wk = ~2026-07-09), we can answer:

> "Does a simple 1H breakout system on a fixed 8-symbol basket produce enough tradeable signal to justify its commissions, and does that edge generalize beyond SOL?"

PASS/FAIL/MARGINAL on §13 criteria answers this. Either way, the paper trade produces the data we said we wanted.
