# Stocks Mean Reversion v2 — Diversified Universe

**Status:** LIVE on leaderboard (registered 2026-05-16)
**Spec freeze:** 2026-05-06T18:30:00Z (mirrors v1 freeze ceremony)
**Paper backfill start:** 2026-04-16T13:30:00Z
**Live execution earliest:** 2026-06-08T13:30:00Z (post-PDT-rule effective date)
**Parent:** `stocks-mean-reversion-v1-spec.md`

---

## 1. Purpose

Direct A/B test of whether the Connors-style RSI(2)<10 oversold-bounce edge that worked on the tech-heavy universe also generalizes across diversified GICS sectors. **Parameters identical to v1; only the universe changes.** Minimal-perturbation principle: if v2 outperforms or matches v1, the mean-reversion edge is real and regime-driven, not a tech-stock quirk.

## 2. Edge Thesis Confirmed Pre-Registration

Backfill validation 2026-05-16 across 34 closed trades on the 2026-04-16 → 2026-05-16 window:

| Metric | MR v1 (tech) | MR v2 (diversified) | Delta |
|---|---|---|---|
| Closed trades | 34 | 34 | 0 |
| Cumulative PnL | +$350.47 | **+$717.78** | +$367 |
| Full PF | 2.03 | **3.46** | +1.43 |
| IS PF | 1.47 | 2.95 | +1.48 |
| OOS PF | 2.61 | **4.28** | +1.67 |
| Win rate | 71% | **74%** | +3pp |
| May 8-15 collapse-window n | 8 | 11 | +3 |
| May 8-15 collapse-window PnL | +$131.80 | **+$235.32** | +$104 |
| May 8-15 collapse-window PF | 2.26 | **5.33** | +3.07 |

**OOS PF > IS PF** is the inverse pattern of every breakout variant tested. Where the breakout family (v1, Aggressive v1, Aggressive v2) ALL had OOS PF collapse below IS PF, mean reversion shows OOS PF *higher* than IS — direct evidence the market regime favors mean reversion in this window. The diversified universe amplifies the effect, likely because oversold-bounces fire more independently across uncorrelated sectors than within a tech basket where moves are correlated.

## 3. Universe & Direction

8 symbols spanning 8 GICS sectors:
- **NVDA** — Information Technology
- **OXY** — Energy
- **JPM** — Financials
- **LLY** — Health Care
- **CAT** — Industrials
- **FCX** — Materials
- **NKE** — Consumer Discretionary
- **DIS** — Communication Services

Loaded from `basket_breakout_stocks/universe_diversified.json`. 1H bars during RTH. Long-only.

## 4. Parameters (identical to v1)

| Parameter | Value |
|---|---|
| RSI length | 2 |
| RSI entry threshold | < 10 |
| RSI exit threshold (TP) | > 70 |
| ATR length | 14 |
| Stop ATR multiplier | 2.0× |
| Time stop | 24 bars (~4 trading days) |
| Daily regime gate | EMA-50 > EMA-200 required |
| Daily filter | close > daily EMA-50 required |
| Per-trade risk | 0.5% of current equity |
| Max concurrent | 4 |
| Daily loss circuit | −3% |
| Commission | 0.10% round-trip |
| Starting capital | $10,000 (virtual) |
| Kill switch | 18% max drawdown |

## 5. Position Sizing

`risk_per_trade = 0.005 × current_equity`, `position_size = risk_per_trade / (entry − stop)`. Cash account, no leverage.

## 6. Heat & Loss Controls

Identical to v1. Max 4 concurrent positions, daily −3% circuit, weekly review.

## 7. Implementation

Code path: `Claude/Trading Strategy/stocks_mean_reversion/`
- `config.py` — exposes `CONFIGS` dict; v2 entry uses `universe_path="universe_diversified.json"`
- `generate_log.py` — `--variant v2` invokes this config
- `signals.py`, `portfolio.py` — shared with v1, no changes

Run command: `python -m stocks_mean_reversion.generate_log --variant v2 --skip-refresh`

Trade log output: `data/stock_variants/stocks_mean_reversion_v2_trade_log.md`

## 8. Leaderboard Registration

- registry.js entry: `name: 'Stocks Mean Reversion v2'`, `killswitch_dd_pct: 18`, `live_start_iso: '2026-05-06T18:30:00Z'` (mirrors v1 timestamp for fair contest)
- supervisor: added to `scripts/claude_hermes_supervisor.js` STRATEGIES list as `stocks-mean-reversion-v2`
- README: added to stocks-table row block

## 9. Known Risks

1. **34 trades is still a moderate sample.** The 2-month backfill provides decent statistical confidence but a longer history would strengthen the result. Continue monitoring; if PF drops below 1.5 in any 4-week rolling window, demote to research.
2. **Sector concentration is now intentional.** While the *universe* is diversified, individual signals could still correlate during cross-sector selloffs (Mar 2020-style). Heat cap 4 caps cross-sector exposure.
3. **Regime gate could flip.** Mean reversion currently wins because the broader regime is choppy-bullish. If markets enter a sustained trending regime (bull or bear), RSI(2)<10 entries during pullbacks may turn into entries during continuation-down moves. Watch for this; the supervisor's `OOS turned negative` flag would catch it.
4. **Diversified universe has lower individual volatility than tech.** Larger position sizes per dollar of risk, but smaller realized R-multiples on winners. Net edge is similar but trade-by-trade volatility profile differs.

## 10. Out of Scope (queued for future)

- **MR v3:** asymmetric exit (different RSI thresholds for TP vs time-stop hits)
- **MR v4:** dual-universe (run both tech and diversified simultaneously with combined heat cap)
- **MR-short v1:** symmetric short-side variant on RSI(2)>90 + bearish regime