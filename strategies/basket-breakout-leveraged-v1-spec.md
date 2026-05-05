# Basket Breakout Leveraged v1 — Design Spec

**Status:** PAPER (offline-simulated, nightly routine)
**Spec freeze:** 2026-05-05
**Paper trading start:** 2026-04-16 (back-simulated from this date so leaderboard has full window from day one)
**Author:** Claude, derivative of `basket-breakout-v1-spec.md`
**Supersedes:** N/A
**Parent:** `basket-breakout-v1-spec.md`

---

## 1. Purpose

Run the validated Basket Breakout v1 logic on a **5x USDT-margined perpetuals venue** to test whether the same edge survives leveraged execution. Same setup, same exits, same heat cap — only the venue and notional sizing change.

This is a **paper / offline-simulated** strategy. Signals are generated nightly from CryptoCompare 1H/4H OHLC, run through the same simulator as v1 with leverage and perp-fee parameters swapped in, and trade events are appended to a markdown trade log that the leaderboard adapter consumes.

## 2. Edge Thesis

If Basket Breakout v1's edge is real, it scales linearly with leverage (in expectation) up to the point where execution costs and forced-liquidation risk become dominant. At 5x notional with maintenance margin requirements typically ~0.5% on USDT-margined perps, the original 1.5×ATR stop sits well above any liquidation price for the position sizes implied by 0.5% account risk per trade. So leverage here is **purely a notional multiplier on the same R-distribution**, not a fundamentally different strategy.

The thesis is that this multiplier delivers ~5x the v1 dollar-PnL distribution at:
- ~5x the variance (and 5x the path-DD risk)
- Lower roundtrip fees (perp ~0.10% rt vs spot ~0.20% rt)
- Funding-rate drift (positive for longs in bull regimes, negative in bear) that's largely orthogonal to the breakout edge

## 3. Universe

**Identical to v1**: BTC, ETH, SOL, XRP, DOGE, ADA, DOT, LINK on `*USDT` perpetuals (Binance default; switch to Bybit only if liquidity gaps appear). All eight are top-10 perp markets and have continuous USDT-margined contracts since at least 2022.

## 4. Timeframe & Direction

**1H entry/exit, 4H EMA50/EMA200 regime gate, long-only.** Identical to v1.

## 5. Entry Rules

**Identical to v1** (§6 of v1 spec):
1. Crossover above 120-bar high (event, not state)
2. Strong-close ≥ 0.85
3. 4H regime up
4. Heat cap not exceeded

## 6. Exit Rules

**Identical to v1** (§7 of v1 spec):
- Hard stop at entry − 1.5×ATR(14, 1H)
- Partial 50% at entry + 2R
- Trailing stop on runner: 2.0×ATR below highest close since entry; floor at break-even

## 7. Position Sizing — the only structural delta

```
account_risk_per_trade = 0.5% of equity
position_size = (account_risk × leverage) / (entry − stop)
notional = position_size × entry
required_margin = notional / leverage
```

With leverage = **5.0**:
- Effective per-trade notional risk = **2.5%** of account
- Concurrent heat cap (4 positions) → max effective heat = **10%** of account
- A 1R stop-out loses **2.5%** of account; a +2R partial returns **+2.5%** of account on the partial leg

**Why 5x and not higher?** 5x keeps liquidation distance comfortably above the 1.5×ATR stop on every symbol in the basket across the 2022-2025 backtest window. 10x would put the liquidation price inside the stop on at least DOGE and SOL during their highest-volatility quarters — a single gap-down would liquidate before the stop fills.

**Why 0.5% account risk and not less?** Halving account risk to compensate for the 5x leverage defeats the purpose of testing leverage. If the v1 edge survives at the v1 risk level on a leveraged venue, that's the answer to the research question. If it doesn't, it doesn't — we'd rather find out cleanly.

## 8. Heat & Loss Controls

- **Max concurrent positions: 4** (same as v1)
- **Daily loss circuit: −5% realized account-day** (vs −3% on v1; widened proportionally to leverage)
- **Funding-rate drift cap: not enforced in simulator** (paper assumes zero funding cost; this is a known optimistic assumption — see §13)
- **No leverage stacking.** A single perp position at 5x is fine; opening a second perp on the same symbol is forbidden.

## 9. Venue & Execution Assumptions

- **Venue:** Binance USDT-Margined Perpetuals (`BTCUSDT`, `ETHUSDT`, etc.)
- **Maker/taker fees:** taker 0.04% per side = **0.10% roundtrip** (with VIP-0 + 5bps slippage budget)
- **Slippage on stops:** 5bps included in the 0.10% rt assumption
- **Funding:** assumed neutral in simulation; real-world drift is a known unhedged exposure
- **Liquidation buffer:** a 5x position with 1.5×ATR stop at typical basket volatility lives ~3-5R above the liquidation price — far enough that a flash gap wouldn't liquidate before the stop fires. A volatility shock that doubles ATR overnight could close that gap; this is the leverage-version-specific tail risk.

## 10. Pipeline (Paper-Trade)

**No TradingView wiring.** The strategy lives entirely in:
- `Claude/Trading Strategy/basket_breakout/variants.py` — config
- `Claude/Trading Strategy/basket_breakout/variant_signals.py` — signal generator
- `Claude/Trading Strategy/basket_breakout/variant_portfolio.py` — portfolio simulator
- `Claude/Trading Strategy/basket_breakout/generate_variant_logs.py` — nightly entry point

**Nightly routine (Windows Task Scheduler, ~03:30 UTC daily):**
1. Refresh CryptoCompare 1H + 4H bars for the 8 symbols (last ~30 days, merged with existing cache)
2. Re-simulate from `2026-04-16 00:00 UTC` → now for each variant
3. Rewrite `strategy-leaderboard/data/basket_variants/leveraged_v1_trade_log.md` (full restated history — log is regenerated, not appended, so simulator changes are reflected)
4. `git add … && git commit && git push` from inside the leaderboard repo so the live leaderboard pulls fresh data within its 5-minute refresh cycle

**Determinism:** the simulator is fully deterministic given OHLC data and parameters. Re-running the same window against the same data yields byte-identical trade logs.

## 11. Expected Behavior (vs v1)

| Metric | v1 (spot, 0.5% risk) | Leveraged 5x (perp, 0.5% × 5) | Multiplier |
|---|---|---|---|
| Expected PF | 1.0–1.3 | 1.0–1.3 (same) | 1.0× |
| Expected DD (6wk window) | 8–15% | **20–35%** | ~2.5× |
| Per-trade win | +2R partial = +2.5% account | +2R partial = **+12.5% account** on partial leg* | 5× |
| Per-trade loss | −1R = −0.5% account | −1R = **−2.5% account** | 5× |
| Trade frequency | 5–15/wk basket | identical | 1.0× |
| Tail risk | manageable | **liquidation if ATR doubles overnight** | qualitative |

\* On the partial leg only (50% of position). The runner's PnL depends on the trail.

**Kill switch DD threshold for leaderboard:** **30%** (vs 18% on v1). Leaderboard tints amber at 90% × 30% = 27%.

## 12. Validation

The leveraged variant inherits all of v1's validation results — same parameters, same trade list. The only domain shift is fee structure (favorable: 0.10% rt vs 0.20% rt) and notional scale.

A smoke test re-runs the v1 backtest with `leverage=5, commission=0.001` and confirms PF, win rate, and trade count are within 5% of the v1 figures (small drift from the lower fee). If this test fails, the variant simulator is broken — do not trust live numbers.

## 13. Known Risks Specific to This Variant

1. **Funding rate is not modeled.** In paper / simulator land, funding is zero. Real-world long perp positions in a contango bull regime pay ~5–15% annualized funding. Over a 6-week paper window this could be a 0.6–1.7% drag.
2. **Liquidation tail.** A 5x position with a 1.5×ATR stop is *probably* safe under 2x intraday vol shock; not safe under 3-4x shock (March 2020, May 2021, FTX week). Simulator assumes the stop always fires before the liquidation price — this is approximately but not perfectly true.
3. **Borrow/maintenance margin not modeled.** USDT-M perps have ~0.5% maintenance margin requirement; tight stops keep us far from this in normal regimes.
4. **Spread on entries/exits.** Perps have tighter spreads than spot for major pairs but DOGE/ADA/DOT/LINK perps can show 5-10bps spread in fast moves. Simulator assumes mid-fill, which is optimistic.
5. **Same selection bias as v1.** Parameters were chosen post-hoc on the spot backtest; the leveraged version inherits this. The leveraged paper-trade window is the only genuinely-unseen data.

## 14. Out of Scope

- Higher leverage (10x, 20x, 50x) — explicit "no" until 5x is validated
- Cross-margin / portfolio margin
- Funding-rate alpha (e.g., suppress entries when funding is extreme)
- Real-money execution
- Short side (deferred to all variants' v2)
