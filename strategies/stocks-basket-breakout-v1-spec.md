# Stocks Basket Breakout v1 — Design Spec

**Status:** PAPER (offline-simulated, nightly routine)
**Spec freeze:** 2026-05-06
**Paper backfill start:** 2026-04-16
**Live execution earliest:** 2026-06-08 (Monday after PDT-rule effective date)
**Author:** Claude, equity adaptation of `basket-breakout-v1-spec.md`
**Sister specs:** `stocks-basket-breakout-aggressive-v1-spec.md`, `stocks-basket-breakout-aggressive-v2-spec.md`

---

## 1. Purpose

Port the validated Basket Breakout v1 logic from crypto to US equities. Same edge thesis, same setup family, same exit logic — only the asset class, regime gate timeframe, and a few execution details change.

**Why now:** the SEC's elimination of the Pattern Day Trading rule (effective 2026-06-06) removes the single biggest structural barrier to running this strategy on stocks at small account sizes. Pre-2026-06-06, an account under $25k was capped at 3 day-trades per 5-business-day rolling window — which on an 8-symbol breakout basket would be triggered out of compliance within a single trending week. Post-effective-date, intraday breakouts on stocks are cleanly tradeable at any account size.

## 2. Edge Thesis

If 1H-breakout-with-strong-close has edge on liquid 24/7 crypto, the same setup ought to have edge on liquid US equities — both are momentum-trending markets where the breakout level is widely watched. Equity breakouts are arguably *cleaner* than crypto because:
- Equity markets are RTH-only (no 24/7 chop on overnight low-volume bars)
- Equities respect the daily EMA50/EMA200 regime gate cleanly (canonical equity momentum filter, decades of literature)
- US equity exchanges have tighter spreads and deeper books than most crypto venues

The trade-off: equities gap. A position held overnight can open well below its stop. The simulator handles this by filling at the open price when the bar gaps through the stop (vs filling at stop on continuous-tape crypto).

## 3. Universe

**Eight US large-cap equities, frozen 2026-05-06.** Selection criteria: top-100 by market cap AND >$1B daily dollar volume AND historically clean breakouts AND distinct demand drivers (so they don't all crash together).

| Symbol | Sector | ATR profile (1H) |
|---|---|---|
| NVDA | Semis (AI infra) | ~1.2% per bar |
| TSLA | Auto / EV | ~1.4% |
| AMD | Semis | ~1.3% |
| PLTR | Software / defense | ~1.6% (highest) |
| META | Internet / social | ~0.9% |
| NFLX | Media | ~0.85% |
| AVGO | Semis | ~1.1% |
| AAPL | Consumer tech | ~0.7% (lowest — liquidity floor) |

**Quarterly review:** every ~90 days, re-rank by 30-day average dollar volume; swap any symbol that has fallen out of the top 100 by market cap or top 30 by daily dollar volume. Document swaps in `Claude/Trading Strategy/basket_breakout_stocks/changelog.md`.

**Two intentional omissions:**
- **MSTR / COIN** — too crypto-correlated; would defeat the diversification goal of the equity basket vs the existing crypto basket
- **SPY / QQQ / IWM** — too low intraday volatility for 1H breakouts; better suited as regime indicators than basket members

## 4. Timeframe

**1H bars during regular trading hours** (9:30-16:00 ET, 6.5 bars/day, ~32 bars/week per symbol). yfinance returns intraday bars in UTC, so 1H bar timestamps are 13:30 / 14:30 / 15:30 / 16:30 / ... / 19:30 UTC during EDT.

**Daily EMA50/EMA200 regime gate** (vs the crypto basket's 4H gate). Daily EMAs are the canonical equity momentum filter; switching from 4H avoids the noise problem of running EMAs on a series with only 1.5 4H bars per RTH session.

## 5. Direction

**Long-only in v1.** Shorts deferred to v2 after long-side edge is confirmed in forward time.

## 6. Entry Rules

All four conditions must be true on the **close of a 1H RTH bar** to generate a LONG entry:

1. **Breakout crossover (event):** `close > highest(high, 120)[1]` AND `close[1] <= highest(high, 120)[2]` — first bar where close crosses above the previous 120-bar high. Subsequent bars staying above the breakout level do NOT fire new entries.
2. **Strong-close confirmation:** `(close - low) / (high - low) >= 0.85` — close in the top 15% of the bar's range.
3. **Daily regime up:** `EMA(close, 50, 1d) > EMA(close, 200, 1d)` — measured on the most recent CLOSED daily bar (yesterday or earlier).
4. **Heat cap not exceeded** (see §9).

## 7. Exit Rules

Three independent exit paths, whichever triggers first:

1. **Hard stop:** `entry − 1.5 × ATR(14, 1H)` — set at entry. Defines 1R = 1.5 × ATR(14, 1H).
2. **Partial profit:** at `entry + 3.0 × ATR(14, 1H)` (= +2R), close 50% of position. Remaining 50% has stop moved to break-even.
3. **Trailing stop on runner:** after partial fires, the runner trails at `2.0 × ATR(14, 1H)` below highest close since entry.

**Gap-aware stop fills** (equity-specific): if the next bar's open is at or below the stop, the simulator fills the stop at the OPEN price (not at the stop level) to model overnight-gap risk realistically. Crypto pipeline doesn't need this because crypto trades continuously through the stop level.

**No fixed take-profit.** No time-based exit.

## 8. Position Sizing

```
risk_per_trade = 0.005 × current_equity   # 0.5% of equity, same as crypto v1
position_size = risk_per_trade / (entry − stop)
notional = position_size × entry
```

**Cash account, no leverage.** Margin is not used in v1 — partly because the post-PDT-removal regulatory regime is still settling, partly because the crypto-leveraged-variant comparison already exists. A leveraged equity variant (`stocks_leveraged_v1`) could be added later using Reg T 2x intraday margin.

## 9. Portfolio Risk Controls

1. **Max concurrent positions: 4.** Same as crypto v1.
2. **Daily loss circuit: −3%** of starting-of-day equity. UTC midnight reset.
3. **Weekly review gate (manual):** every Sunday, check realized PF, DD, per-symbol contribution. PAUSE/CONTINUE/KILL — no parameter changes during the paper window.

## 10. What This Deliberately Does NOT Have

- No earnings-date filter. v1 trades into earnings if a breakout fires; the daily-regime gate provides one layer of filter.
- No options. No futures. No leveraged ETFs. Cash equities only.
- No cross-strategy coordination with the crypto Basket Breakout family. The two run independently.
- No corporate-action awareness. Splits, dividends, M&A: the simulator uses non-adjusted prices. Position-sizing on a stock that splits 4:1 mid-trade will be wrong. Mitigation: yfinance `auto_adjust=False` keeps historic prices stable, and the simulator's paper-trade window is short enough that mid-window splits are unlikely.

## 11. Expected Behavior

| Metric | Expected range |
|---|---|
| Trades per week (basket) | 3-12 (lower than crypto's 5-15 — fewer bars per week, regime gate tighter on equities) |
| Win rate | 35-50% |
| Avg winner / avg loser | 2.0-3.5 |
| Profit factor (net of ~0.10% rt fees) | 1.0-1.3 |
| 6-week max DD | 6-12% |
| Per-symbol PF spread | All 8 between 0.7 and 3.5 |

## 12. Validation

The stock variant inherits zero validation from the crypto v1 — different asset class, different regime gate, different fee structure. The spec is a **direct port**, but historical crypto results don't transfer.

**Pre-merge sanity check (already run, 2026-04-16 → 2026-05-06 backfill):**
- Simulator emits trades on the expected cadence (~3 trades/wk basket-wide)
- Win rate 50-67% on the small initial sample (above expected range, likely small-N noise)
- No symbol contributing >70% of net profit (would invalidate basket thesis)
- Realistic gap-fill behavior visible in the trade log (`exit-stop-gap` events fire when bars open below trail)

The actual validation gate is the live-execution paper window starting 2026-06-08. The 2026-04-16 → 2026-06-07 window is post-hoc backfill and should be treated as exploratory rather than evidentiary.

## 13. Pipeline

Identical structure to the crypto Basket Breakout family — see [basket-breakout-leveraged-v1-spec.md §10](basket-breakout-leveraged-v1-spec.md) for the standard pattern. The stock pipeline lives in:

- `Claude/Trading Strategy/basket_breakout_stocks/variants.py` — config
- `Claude/Trading Strategy/basket_breakout_stocks/signals.py` — daily-regime-gate signals
- `Claude/Trading Strategy/basket_breakout_stocks/portfolio.py` — gap-aware simulator
- `Claude/Trading Strategy/basket_breakout_stocks/fetch_yfinance.py` — yfinance data refresh
- `Claude/Trading Strategy/basket_breakout_stocks/generate_logs.py` — nightly entry point

Nightly Windows scheduled task regenerates trade logs and pushes to GitHub.

## 14. Known Limitations

1. **yfinance is a Yahoo Finance public-API scrape.** It can break without notice if Yahoo changes their internal endpoint. Fallback: switch to Polygon free tier (5 calls/min) or Alpha Vantage (25 calls/day). Either fallback would require rate-limit handling.
2. **No corporate-action handling.** A symbol that splits during the paper window will produce incorrect position sizing. Document and re-baseline if it happens.
3. **Backfilled paper trades pre-spec-freeze are post-hoc.** The 2026-04-16 → 2026-05-06 trade log entries existed before the spec was frozen; treat them as warmup, not evidence.
4. **Same selection bias as the parent strategy.** Parameters were inherited from the crypto v1, which were post-hoc tuned. Expected tuning-bias haircut: 15-30% of backtest PF.
5. **No spread/slippage model.** Simulator fills at bar close on entries and at stop level on exits (or open, on gaps). Real fills would include 1-3 bps spread on these mega-cap names — small but nonzero. Trade-log PnL is therefore optimistic by ~0.05% per round-trip.
6. **PDT rule context.** This strategy is designed assuming PDT removal goes into effect on schedule. If 2026-06-06 is delayed, the live-execution start date moves with it; the paper backfill keeps running regardless.

## 15. Out of Scope (v2+ deferrals)

- Short side
- Leverage (Reg T 2x intraday)
- Options or leveraged-ETF execution
- Earnings-date filter
- Corporate-action awareness
- Cross-strategy coordination with crypto
