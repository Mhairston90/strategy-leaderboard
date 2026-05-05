# Basket Breakout Aggressive v1 — Wider-Net Variant

**Status:** PAPER (offline-simulated, nightly routine)
**Spec freeze:** 2026-05-05
**Paper trading start:** 2026-04-16 (back-simulated)
**Author:** Claude, derivative of `basket-breakout-v1-spec.md`
**Sibling:** `basket-breakout-aggressive-v2-spec.md` (the "runner" sibling — concentrated positions, no partial)
**Parent:** `basket-breakout-v1-spec.md`

---

## 1. Purpose

Test the hypothesis that the v1 strategy under-trades. Drop the 4H regime gate, lower the strong-close threshold, raise per-trade risk, and uncap the basket — if the v1 edge generalizes, we'll see ~3–4× the trade count with at least the same expectancy.

This variant exists to answer: **"Is the 4H regime gate filtering profitable trades or losing trades?"** v1's lockbox window had only 14 trades because the gate was off most of the time. This variant trades through everything; the realized PF will tell us whether the gate helps or hurts.

## 2. Edge Thesis

A 1H breakout-with-strong-close is a momentum signal. Momentum signals work in trending regimes and lose money in choppy regimes. v1 uses the 4H EMA50/200 gate to filter out chop. **If the gate is well-calibrated**, dropping it should reduce PF (we'd be adding losing trades). **If the gate is too restrictive**, dropping it could leave PF roughly unchanged while multiplying volume — a strict improvement on per-time-period expectancy.

We don't know which is true. The wider-net variant exists to find out, in parallel with v1's own paper trade.

## 3. Universe & Direction

**Identical to v1**: 8 Kraken USD pairs, long-only, 1H bars.

## 4. Parameter Deltas vs v1

| Parameter | v1 | Aggressive v1 | Reasoning |
|---|---|---|---|
| Per-trade risk | 0.5% | **1.5%** | 3× more capital exposure per signal |
| Heat cap (max concurrent) | 4 | **8 (full basket)** | every symbol can be in a position simultaneously |
| 4H regime gate | EMA50 > EMA200 required | **DROPPED** | trade through any regime |
| Strong-close minimum | 0.85 | **0.70** | accepts top-30% closes instead of top-15%; doubles signal count alone |
| Breakout lookback | 120 | **120** (kept) | the lookback is the core signal definition; not a "dial" |
| Stop ATR mult | 1.5 | 1.5 (kept) | same R-distance |
| Partial R-multiple | 2.0 | **1.5** | take partial sooner; the wider-net thesis predicts more reversals before 2R |
| Partial close fraction | 50% | 50% (kept) | |
| Trail ATR mult | 2.0 | **1.5** | tighter trail; capture more of small wins, give back less on reversals |
| Daily loss circuit | −3% | **−5%** | wider — at 3× per-trade risk, a normal losing streak could trip −3% in a single day |

## 5. Position Sizing

```
risk_per_trade = 0.015 × current_equity
position_size = risk_per_trade / (entry − stop)
```

At 1.5% risk and the 8-position heat cap, max simultaneous open risk = **12% of equity**. A v1 position rolled 3× its size = the same dollar risk.

**No leverage. Spot only.** This variant tests the parameter expansion, not venue change.

## 6. Heat & Loss Controls

- **Max concurrent: 8** (every basket symbol can hold one position simultaneously)
- **No same-symbol pyramiding** (one position per symbol, like v1)
- **Daily loss circuit: −5%** of starting-of-day equity, hard halt until next 00:00 UTC
- **Weekly review gate:** PAUSE/CONTINUE/KILL after each Sunday close

## 7. Pipeline

Identical to the leveraged variant — see `basket-breakout-leveraged-v1-spec.md` §10. Nightly Python routine, full restated trade-log markdown, leaderboard adapter via `codex-local` source.

## 8. Expected Behavior

| Metric | v1 | Aggressive v1 | Notes |
|---|---|---|---|
| Trades per week (basket) | 5–15 | **20–50** | from gate drop + lower close threshold + 8 vs 4 heat cap |
| Win rate | 35–45% | **30–40%** | wider-net signals are noisier |
| Avg winner / avg loser | 2.0–3.0 | **1.5–2.5** | tighter trail caps the upside |
| PF | 1.0–1.3 | **0.9–1.3** | wider band; could underperform if gate was earning its keep |
| 6wk DD | 8–15% | **15–25%** | 3× risk → ~3× DD if PF unchanged |
| Tail (P99) DD | 23% | **40%+** | aggressive variant's defining risk |

**Kill switch DD threshold for leaderboard:** **25%**. Tints amber at 22.5%.

## 9. Validation

This variant is *not* validated by v1's backtest results. The parameter changes are large enough that we'd need a separate IS/OOS/lockbox cycle to claim historical evidence — and we're explicitly skipping that to use the variant as a parallel A/B against v1 in real time.

The only validation gate before launch is a **smoke backtest**: run the variant simulator over 2024-Q4 (out-of-sample for v1, in a known choppy regime) and confirm:
- The simulator emits trades (sanity that the dropped gate increases volume)
- The simulator does not emit ENTRY rows on bars that fail the strong-close ≥ 0.70 check (sanity that the parameter is wired)
- DD over the 90-day window is < 30% (sanity that risk-per-trade is wired correctly)

If the smoke test passes, the live paper trade IS the validation.

## 10. Known Risks

1. **Strong selection bias.** Every parameter that was relaxed was relaxed *because v1 had it set conservatively*. We're explicitly de-tuning a tuned strategy, which is anti-overfitting in spirit but still a directional bet.
2. **Heat-cap bypass.** With the gate dropped, all 8 symbols can fire breakout signals on the same regime shift (e.g., a basket-wide BTC-led pump). The simulator will allow up to 8 concurrent positions, which means a basket-wide reversal on the next bar can flash 8 stop-outs simultaneously = −12% of equity in one hour. This is by design.
3. **Strong-close at 0.70 is much weaker than 0.85.** The original v1 design notes show 0.85 was chosen because 0.70 produced "noticeably more fakeouts." This variant accepts that.
4. **Tighter trail (1.5×ATR vs 2.0×ATR) gives back less to runners but stops out sooner.** In strongly trending markets this caps profitable runs.
5. **Daily loss circuit at −5% is wide enough that an ugly day passes through it.** Reset at UTC midnight could allow back-to-back −5% days = compounding −9.75% in 48 hours.

## 11. Sibling Variant

For the **"trade fewer but let runners run"** flavor, see `basket-breakout-aggressive-v2-spec.md`. The two aggressive variants are explicitly testing **opposite** dimensions:
- **v1 (this file):** more trades, faster partials, tighter trail
- **v2 (sibling):** same trade count as parent v1, no partial, fatter risk, wider trail

If both beat parent v1 on the leaderboard, the answer is "be aggressive in any way." If only one beats it, that direction is the lever. If neither does, parent v1's parameter choices were good.

## 12. Out of Scope

- Leverage (covered by `leveraged-v1`)
- Short side
- Adaptive parameter tuning during the paper window
- Cross-strategy coordination with v1 (the two run independently)
