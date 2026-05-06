# Stocks Basket Breakout Aggressive v1 — Wider-Net Variant

**Status:** PAPER (offline-simulated)
**Spec freeze:** 2026-05-06
**Paper backfill start:** 2026-04-16
**Live execution earliest:** 2026-06-08
**Parent:** `stocks-basket-breakout-v1-spec.md`
**Sibling:** `stocks-basket-breakout-aggressive-v2-spec.md` (runner)

---

## 1. Purpose

Equity port of the crypto wider-net variant. Drop the daily regime gate, lower the strong-close threshold to 0.70, raise per-trade risk to 1.5%, uncap the basket to 8 concurrent positions. Tests whether the daily EMA regime gate is filtering profitable trades or losing trades on the equity basket.

## 2. Parameter Deltas vs Stocks v1

| Parameter | Stocks v1 | Aggressive v1 | Reasoning |
|---|---|---|---|
| Per-trade risk | 0.5% | **1.5%** | 3× exposure per signal |
| Heat cap | 4 | **8 (full basket)** | every symbol can hold a position |
| Daily regime gate | required | **DROPPED** | trade through any regime |
| Strong-close minimum | 0.85 | **0.70** | accepts top-30% closes; doubles signal count |
| Breakout lookback | 120 | 120 (kept) | core signal definition |
| Stop ATR mult | 1.5 | 1.5 (kept) | same R-distance |
| Partial R-multiple | 2.0 | **1.5** | take partial sooner |
| Trail ATR mult | 2.0 | **1.5** | tighter trail |
| Daily loss circuit | −3% | **−5%** | wider — needed at 3× risk |

## 3. Universe & Direction

Identical to Stocks v1: 8-symbol equity basket, 1H bars during RTH, long-only.

## 4. Edge Thesis

The daily regime gate filters out chop. v1 uses it because the parent crypto v1 used it — but on equities, chop is structurally different (overnight gaps, earnings, macro events). The wider-net variant tests whether the gate is correctly calibrated for equities or whether it's leaving profitable signal on the table.

## 5. Position Sizing & Risk

```
risk_per_trade = 0.015 × current_equity   # 1.5% of equity (3× v1)
position_size  = risk_per_trade / (entry − stop)
```

Heat cap 8 × 1.5% = **12% of equity** at maximum simultaneous open risk. Cash account, no leverage.

## 6. Expected Behavior

| Metric | Stocks v1 | Aggressive v1 |
|---|---|---|
| Trades/wk basket | 3-12 | **10-30** |
| Win rate | 35-50% | **30-45%** (wider net is noisier) |
| PF (net) | 1.0-1.3 | **0.8-1.3** (wider band; could underperform) |
| 6-week DD | 6-12% | **15-22%** |
| Tail (P99) DD | ~20% | **30-40%** |

**Kill switch:** 25% (vs v1's 18%). Tints amber at 22.5%.

## 7. Validation

No standalone validation. The variant is an A/B against parent Stocks v1 in real time. Smoke test was the simulator's first run on the 2026-04-16 backfill — confirming the dropped gate increases trade count, the lower close threshold doesn't break the simulator, and DD over the 3-week window is < 25%.

## 8. Known Risks Specific to This Variant

1. **Heat-cap bypass.** With the gate dropped, all 8 symbols can fire breakout signals on the same intraday move (e.g. Fed-day pump). Up to 8 simultaneous positions = a basket-wide reversal at next bar can flash 8 stop-outs = −12% in one bar.
2. **Strong-close at 0.70 admits more fakeouts.** v1's 0.85 was the spec author's selection; relaxing it is intentional but historically increases false-signal rate.
3. **Tighter trail (1.5×ATR) caps profitable runs.** The runner sibling tests the opposite end of the trail-distance dial.
4. **Daily loss circuit at −5% is wide enough that a bad day can pass through it.** Back-to-back bad days = compounding −9.75% in 48 hours.
5. **Without regime gate, this variant trades into bear regimes.** Equity bear markets can produce string after string of failed breakouts.

## 9. Out of Scope

- Leverage, shorts, earnings filter, corporate-action awareness — same as parent
- Cross-strategy with the crypto wider-net variant — they run independently
