# Stocks Mean Reversion v1 — Design Spec

**Status:** PAPER (offline-simulated, nightly routine)
**Spec freeze:** 2026-05-06
**Paper backfill start:** 2026-04-16
**Live execution earliest:** 2026-06-08 (post-PDT-rule effective date)
**Author:** Claude
**Sister specs:** `stocks-basket-breakout-{v1,aggressive-v1,aggressive-v2}-spec.md`

---

## 1. Purpose

**Explicit anti-breakout test.** Same universe, same data, same regime gate, same risk-per-trade as the parent Stocks Basket Breakout v1 — but the entry signal is *inverted*. Buy oversold dips in confirmed uptrends instead of buying breakouts.

The leaderboard is currently 100% momentum/breakout strategies. Until this row exists, we cannot tell whether the equity universe has edge in only one direction (breakouts) or in both (breakouts and mean-reversion). Either outcome is informative:

- **If both work:** edges are regime-dependent. Different signals win in different conditions; a portfolio of both should outperform either alone.
- **If only breakouts work:** the breakout edge is the truth and mean-reversion is noise on this universe.
- **If only mean-reversion works:** the breakout edge was a survivorship illusion (would be a real surprise, given the parent strategy's PF).

## 2. Edge Thesis

In trending markets, sharp short-term oversold conditions on individual stocks are often pullbacks within a larger uptrend, not the start of a new downtrend. A 2-period RSI dropping below 10 on a 1H bar represents extreme short-term capitulation — historically followed by a quick mean-reversion bounce in 1-3 days when the underlying trend is intact.

The challenge: oversold ≠ end of selling. Without a regime filter, this signal fires constantly during downtrends and gets stopped out repeatedly. The daily EMA50/EMA200 gate plus the price-above-50d-EMA filter narrow the entries to dips *within trends* rather than dips toward continuation.

This is a Connors-style fast-RSI strategy adapted for the equity basket — same structural insight as Larry Connors's RSI(2) work from the early 2000s, applied to mega-cap tech in 2026.

## 3. Universe

**Identical to Stocks Basket Breakout v1**: NVDA, TSLA, AMD, PLTR, META, NFLX, AVGO, AAPL. Same 8-symbol basket, frozen at the same date, same quarterly review cadence.

The shared universe is *deliberate*: both strategies running on the same names lets us isolate the signal as the only variable. If breakouts win on these stocks but mean-reversion doesn't, the answer can't be "wrong universe" — it has to be the signal itself.

## 4. Timeframe & Direction

**1H bars during regular trading hours**, long-only. Daily EMA50/EMA200 regime gate.

## 5. Entry Rules

All four conditions must be true on a 1H RTH bar close:

1. **RSI(2, 1H) < 10** — extreme short-term oversold (Connors-style threshold)
2. **Daily EMA50 > Daily EMA200** — confirmed uptrend regime on the higher timeframe
3. **Close > Daily EMA50** — pulling back within the trend, not breaking down through it
4. **ATR(14, 1H) is non-null and > 0** — for sizing

Rules 2 and 3 together are the "trend filter." Without them this strategy would fire on every downtrend and bleed continuously.

## 6. Exit Rules

First-match exit hierarchy on each 1H bar:

1. **Hard stop:** entry − 2.0 × ATR(14, 1H). Wider than breakout's 1.5×ATR because mean-reversion entries have higher initial-drawdown risk (the "falling knife" problem). Defines 1R = 2.0×ATR.
2. **Take-profit signal:** RSI(2, 1H) > 70 — mean has reverted toward overbought. Close at the bar's close.
3. **Time stop:** 24 1H bars (~3.7 trading days). If neither stop nor RSI-flip has triggered, force-close. Mean-reversion has a half-life; positions held past 4 days are usually broken theses.

**Gap-aware stop fills** (equity-specific): if a bar's open is at or below the stop, fill at the open price (not at stop) to model overnight gap risk.

**No partial, no trail.** Mean-reversion is a one-shot trade — either the bounce happens within the window or it doesn't. The trail logic that fits trend-following is the wrong shape here.

## 7. Position Sizing

```
risk_per_trade = 0.005 × current_equity   # 0.5%, same as parent breakout v1
position_size  = risk_per_trade / (entry − stop)
```

Cash account, no leverage. Same as parent.

## 8. Risk Controls

- **Max concurrent positions: 4** (same as parent v1)
- **Daily loss circuit: −3%** of starting-of-day equity (same as parent v1)
- **No same-symbol pyramiding** (one position per symbol)
- **Weekly review gate (manual):** PAUSE/CONTINUE/KILL — no parameter changes during paper window

## 9. Expected Behavior

Mean-reversion has a fundamentally different metric profile than trend-following. Comparing apples to apples on win rate would give the wrong impression — mean-reversion *should* show higher win rate but lower avg-R per trade.

| Metric | Trend-following parent (Stocks v1) | Mean Reversion v1 |
|---|---|---|
| Trades/wk basket | 3-12 | **5-15** (faster turnover) |
| Win rate | 35-50% | **60-75%** (high — frequent small wins) |
| Avg winner / avg loser | 2.0-3.5 | **0.5-1.0** (small wins, occasional -1R losers) |
| Profit factor | 1.0-1.3 | **1.1-1.5** |
| Avg holding period | hours-days | **<24 hours** (RSI flips fast) |
| 6-week max DD | 6-12% | **5-10%** |

**Headline metric for fair comparison:** profit factor or all-time return at $10k bankroll. Direct PF comparison answers "which signal extracts more dollars per dollar risked on this universe."

**Kill switch:** 18% (same as parent v1). Tints amber at 16.2%.

## 10. First-Window Observation (2026-04-16 → 2026-05-06 backfill)

Initial 3-week back-simulation:
- **23 closed trades, 1 still open**
- **Win rate: 69.6%** (right in expected range)
- **Avg R-multiple: +0.236** (consistent with low-avg-R-high-WR profile)
- **Realized PnL: +$213.37 (+2.13%)** — beating parent Stocks v1 (+0.5%) over the same window

The trades cluster on AMD, AVGO, AAPL, NVDA — the four symbols whose daily regime is currently "up" out of the 8-name basket. The other 4 (TSLA, PLTR, META, NFLX) are below regime and thus blocked from entry.

Caveat: 23 trades is small-N. Mean-reversion's "high WR" character can mask a bad strategy that reverts to mean over longer windows once a few full -1R losers accumulate. Don't extrapolate from 3 weeks.

## 11. Pipeline

Lives in `Claude/Trading Strategy/stocks_mean_reversion/`:
- `config.py` — single-variant config dataclass
- `signals.py` — Connors-style RSI(2) signal generator
- `portfolio.py` — single-exit (TP/SL/time) simulator with gap-aware fills
- `generate_log.py` — nightly entry point + markdown writer

Reuses `basket_breakout_stocks/data/` cache (same yfinance OHLC, no separate fetch). Nightly Windows scheduled task runs after the breakout family so the data is already fresh.

## 12. Validation

This is v1; there is no separate IS/OOS/lockbox backtest. The strategy parameters were chosen from prior literature (Connors RSI(2) at <10/>70 thresholds, 2×ATR stops, 4-day time stop) without tuning on this universe. The first-window numbers in §10 are *confirmatory* sanity checks (signal fires, simulator behaves correctly, win-rate profile matches expected shape) — not statistical evidence of edge.

The actual validation gate is the live forward-time window starting 2026-06-08. The 2026-04-16 → 2026-06-07 backfill is exploratory.

## 13. Known Limitations

1. **High win rate is dangerous.** Mean-reversion strategies look great on small samples (5+ winners in a row easily) and reveal their tail risk over longer windows. P95 DD on Connors-style RSI strategies historically ranges 12-20%; the 18% kill switch is calibrated to that range but provides limited margin.
2. **Fast turnover means commission drag is more sensitive.** At ~5-15 trades/week and 0.10% rt fees, annualized commission drag is ~2.5-7.5%. The strategy needs to clear that to be net profitable.
3. **The 2-period RSI is extremely fast and can fire on noise.** A single sharp 1H bar can drop RSI(2) below 10 even in the absence of a meaningful pullback. The trend filter helps but doesn't eliminate noise entries.
4. **Mean-reversion struggles in choppy regimes WITHOUT a clean trend.** The regime gate filters out *bear* regimes, but it does not filter out *flat/ranging* regimes where RSI oscillates without a trend to mean-revert toward.
5. **Same selection bias caveat as the breakout family.** Universe was chosen for breakout-friendliness; whether it's *also* friendly to mean-reversion is an open question.
6. **No earnings filter.** Stocks gap on earnings; the gap-aware stop helps but a -10% earnings gap on a 2%-account-risk position still hits the strategy hard.
7. **Connors-style strategies are well-known.** Edge attenuation over 20 years is real; results in 2026 may be smaller than 2003-era backtests would suggest.

## 14. Out of Scope

- Multi-timeframe RSI (e.g. confirm with daily oversold)
- Adaptive RSI thresholds based on volatility regime
- Short side (bearish-side mean reversion)
- Other oscillators (Stochastic, Williams %R) — would be v2 ideas
- Pair trading / market-neutral construction
