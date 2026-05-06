# Stocks Basket Breakout Diversified v1 — Cross-Sector Universe Test

**Status:** PAPER (offline-simulated, nightly routine)
**Spec freeze:** 2026-05-06
**Paper backfill start:** 2026-04-16
**Live execution earliest:** 2026-06-08
**Parent:** `stocks-basket-breakout-v1-spec.md`
**Sister specs:** `stocks-basket-breakout-{aggressive-v1,aggressive-v2}-spec.md`, `stocks-mean-reversion-v1-spec.md`

---

## 1. Purpose

**Direct counter-test to the tech-heavy `stocks-basket-breakout-v1`.** Same strategy logic, same parameters, same risk-per-trade, same regime gate — only the universe changes. Eight names spanning eight distinct GICS sectors instead of eight names from one sector.

Tests one specific question: **does the basket-breakout edge generalize across sectors, or is it tech-specific?**

The parent Stocks v1 spec selected NVDA + TSLA + AMD + PLTR + META + NFLX + AVGO + AAPL — all tech, all AI-rally beneficiaries, all moving together when tech moves. That basket cannot answer the cross-sector question because every name in it has the same factor exposure. This variant exists to fix that.

## 2. Universe

**Eight names, eight different GICS sectors, frozen 2026-05-06.** Each name is the highest-vol, highest-liquidity representative of its sector that still trades >$1B/day. NVDA is intentionally retained as the one tech anchor for cross-strategy comparability.

| Symbol | GICS Sector | Why this name |
|---|---|---|
| **NVDA** | Information Technology | Tech anchor for cross-comparison with the parent universe |
| **OXY** | Energy | Oil & gas pure-play, ~3% daily ATR, news-reactive (Buffett favorite) |
| **JPM** | Financials | Megacap bank, fed-policy reactive, decoupled from AI cycle |
| **LLY** | Health Care | GLP-1 leader, strong individual-name momentum |
| **CAT** | Industrials | Industrial cyclical, China/global-trade reactive |
| **FCX** | Materials | Copper miner, dollar/China/electrification reactive |
| **NKE** | Consumer Discretionary | Apparel, earnings-reactive, ~2% ATR |
| **DIS** | Communication Services | Media, news-reactive, ~1.5-2% ATR |

**Diversification thesis:** when tech crashes, OXY/JPM/LLY/CAT/FCX should NOT crash with it the way META/NFLX/AVGO/AAPL would. The heat-cap of 4 means something here — different sectors at different points in their cycles.

**Quarterly review:** re-rank each sector by 30-day average dollar volume; swap any name that has fallen out of the top 5 by daily dollar volume in its sector. **Always keep one name per sector** — never load up multiple Energy or multiple Healthcare names. That rule is what makes this a diversified basket and not a sector-rotation strategy.

## 3. Strategy Parameters

**Identical to `stocks-basket-breakout-v1-spec.md`.** Only the universe changes. This is deliberate — keeps the test cleanly isolated to "does universe matter?"

- 1H bars during regular trading hours
- Daily EMA50/EMA200 regime gate
- Long-only
- Entry: 120-bar high crossover + strong-close ≥ 0.85 + regime up
- Exit: 1.5×ATR(14, 1H) hard stop, +2R partial 50%, 2.0×ATR trail on runner
- 0.5% risk per trade, max 4 concurrent positions, -3% daily loss circuit
- Same gap-aware stop fills (equity-specific)

See parent spec for entry-rule, exit-rule, and position-sizing details.

## 4. Why This Test Matters

The leaderboard has accumulated three weeks of evidence on the tech basket. Without this variant, we cannot tell whether the wins/losses on that basket reflect:

- (a) **A real cross-sector edge** in basket-breakout-with-strong-close, OR
- (b) **A tech-specific edge** that happened to ride the AI rally, OR
- (c) **No edge at all** — just "anything bullish during a tech rally makes money"

The diversified variant rules out (b) by removing tech concentration. If both baskets perform similarly, the edge is real and cross-sector. If diversified meaningfully underperforms tech, the edge is regime-dependent and tech-concentrated.

## 5. First-Window Observation (2026-04-16 → 2026-05-06 backfill)

3-week back-simulation:
- **8 closed trades** (vs 9 on the tech basket — similar trade count, the regime gate filters similarly)
- **25% win rate** (vs 67% on tech)
- **Average R-multiple: −0.476** (vs +0.63 on tech)
- **Realized PnL: −$272.27 (−2.72%)** (vs +$53.78 / +0.54% on tech)

**The diversified basket meaningfully underperformed the tech basket over this window.** Of the 8 closed trades:

- 7 were stop-outs at exactly −1R (CAT × 3, FCX, JPM, NVDA × 1, ...)
- 1 was the NVDA partial (+2.0R) and tail (+0.19R via gap-aware exit)

CAT in particular kept firing breakouts and stopping out — a classic chop pattern. The breakouts on energy/financials/healthcare/industrials largely failed to follow through the way tech breakouts did.

**Interpretation (caveat: 8 trades is small-N):** the breakout edge in 2026-Q2 appears to be concentrated in the tech sector, not generalized across sectors. The "diversification" was correctly *executed* but the *edge wasn't there to diversify*. NVDA was the only winner because NVDA was the only name actually trending.

This is a meaningful negative result — exactly the kind of evidence the leaderboard exists to surface. We now know the parent strategy's PF is partly a concentrated-bet on the AI rally, not a generalizable cross-sector edge.

## 6. Pipeline

Lives in the existing `basket_breakout_stocks/` package, no new code. The variant just points at `universe_diversified.json` instead of `universe.json` via the new `universe_path` field on `StockVariantConfig`.

Nightly Windows scheduled task runs this variant alongside the other 3 stock variants — same generator, two universes (deduplicated symbols across both).

## 7. Validation

This is v1; no separate IS/OOS/lockbox. Universe selected without parameter tuning (one name per GICS sector by daily-dollar-volume rank). The 3-week backfill is the first evidence; live forward-time after 2026-06-08 is the real validation.

## 8. Known Limitations

1. **8 trades is statistically thin.** Sector breakout patterns vary widely across regimes — 3 weeks captures one regime, not the distribution.
2. **Same selection bias caveat as parent v1.** Strategy parameters were inherited from the crypto v1 backtest. Universe selection here is fresh but the entry/exit logic is not.
3. **No sector-rotation logic.** This is a diversified breakout basket, not a "long the strongest sector" rotation. Different question.
4. **One name per sector limits how aggressively any individual sector can dominate trade flow.** If energy is the only sector breaking out, max heat from energy is 1 position. Tech basket could fill all 4 heat slots with semis breakouts; diversified cannot.
5. **CAT-style chop pattern.** Industrials and materials names tend to chop more than tech in the current regime; the strategy's stop-and-re-enter behavior on CAT (3 sequential stop-outs in 3 weeks) suggests this universe may produce more "false breakouts" than tech.
6. **Earnings clustering.** Q2 earnings fall in the paper window — JPM, LLY, CAT, NKE, DIS all report in this period. Breakouts immediately before earnings often reverse on the print.
7. **No corporate-action handling** (same as parent).

## 9. What Would Make This Variant "Win"

Forward-time: positive PF over 30+ trades AND 6+ weeks AND outperforming the tech basket. If diversified ends up matching or beating tech over a longer window, that suggests the current 3-week tech outperformance was a regime artifact and the edge is more general than the first-window data suggests.

If diversified continues to underperform tech meaningfully over 60+ trades, that's strong evidence the basket-breakout edge is genuinely tech-concentrated in the current macro environment.

## 10. Out of Scope

- Sector-rotation overlay (long-only-strongest-sector)
- Sector-specific parameter tuning (each sector might want a different ATR or lookback)
- International or emerging-market diversification
- Commodity-ETF, bond-ETF, or volatility-ETF inclusion
- Equal-weighted vs sector-weighted basket sizing
