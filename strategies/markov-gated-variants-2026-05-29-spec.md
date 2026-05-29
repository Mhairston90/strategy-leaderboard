# Markov-Gated Variants — Codex Cross-Pollination (2026-05-29)

**Status:** LIVE (forward paper from 2026-05-29)
**Author:** Claude (Opus 4.8), paired with Mhair
**Borrowed from:** Codex — `lib/markov_regime.js` + `strategies/codex-markov-gate-v1-spec.md`
**Code:** `Trading Strategy/markov_regime.py` (Python port) + `stocks_momentum` / `stocks_mean_reversion` (flag-gated)

---

## 1. Purpose

Codex looked at Claude's strategies and built its own mean-reversion variants. This is the mirror move: take Codex's genuinely novel idea — the **Markov regime classifier** — and apply it as a regime gate over Claude's two proven equity edges.

The Markov engine (Codex's tested `lib/markov_regime.js`, ported faithfully to Python) labels each day **bull / bear / sideways** by its trailing 20-day return (±5%), fits a Laplace-smoothed transition matrix on the history available *so far* (walk-forward, no lookahead), and forecasts the next state. The headline number is:

```
signal = P(next = bull) − P(next = bear)     ∈ [−1, +1]
```

Two variants, each a clean A/B against an existing Claude row:

1. **Stocks Trend Momentum (Markov-Gated)** — `trend_markov`
2. **Stocks Mean Reversion v2 (Markov-Gated)** — `v2_markov`

Both `live_start = 2026-05-29` (honest); pre-today trades are backtest and excluded from contest equity by the adapter.

## 2. Variant 1 — Trend Momentum (Markov-Gated)

Same confirmed-trend entry as `Stocks Trend Momentum v1` (1h EMA20>EMA50 + 40-bar close-momentum high + daily EMA50>EMA200), but the **daily chop filter is the Markov signal instead of ADX**:

| | Trend Momentum v1 (parent) | Trend Momentum (Markov-Gated) |
|---|---|---|
| Chop filter | daily ADX(14) > 20 | **daily Markov signal ≥ +0.10** |
| Everything else | identical | identical |

**Thesis:** is "next-state odds favour bull" a better "is there a real trend?" gate than ADX for a momentum runner? **Backfill (informational):** 12 trades, **66.7% win, avg R +1.363, +$1,618.68** — vs the ADX-gated parent's 15 trades / +1.024 R / +$1,509.52. The Markov gate was *more selective* (3 fewer trades) and booked a higher avg R and net on this window. Promising, but a small sample on a benign tape — the forward A/B is the real test.

## 3. Variant 2 — Mean Reversion v2 (Markov-Gated)

The proven diversified-8 Connors MR (`v2`), with Codex's gate used exactly as Codex designed it for mean-reversion — a **falling-knife filter**. Block the oversold dip-buy when next-state odds are deteriorating:

```
allow entry only when  signal ≥ 0  AND  P(next = bear) ≤ 0.40
```

**Thesis:** MR's worst trades are buying oversold dips in genuine downtrends. Skipping entries when the regime model says "bear is likely" should raise quality. **Backfill (informational):** 37 trades (vs v2's 45 — gate skipped 8), **win rate 70.3% (up from 67%), avg R +0.400 (up from +0.358)**, +$658.94 (vs +$710.62). Exactly the expected signature: slightly lower raw PnL on a calm window, but higher per-trade quality — the gate's real payoff is drawdown reduction in *bad* regimes, which this 6-week backfill didn't contain.

## 4. The ported engine (faithfulness)

`Trading Strategy/markov_regime.py` is a line-for-line port of the JS: `label_regimes`, `fit_transition_matrix` (smoothing=1), `forecast_regime` (matrix power), `signal = bull − bear`, and `walk_forward_daily` (per-bar fit on prefix only — no lookahead, matching `walkForwardSignals`). Sanity-checked: synthetic uptrend → signal +0.97, downtrend → −0.97, chop → ~0. The daily signal is aligned to 1h bars the same way the existing ADX/EMA daily gates are (previous-closed-daily-bar, +24h shift).

## 5. Implementation (flag-gated — existing variants untouched)

| File | Change |
|---|---|
| `Trading Strategy/markov_regime.py` | NEW — Python port of Codex's engine |
| `stocks_momentum/config.py` | + `use_markov_gate` fields + `trend_markov` config |
| `stocks_momentum/signals.py` | + Markov gate branch (only when `use_markov_gate`) |
| `stocks_mean_reversion/config.py` | + `use_markov_gate`/`markov_pbear_max` fields + `v2_markov` config |
| `stocks_mean_reversion/signals.py` | + Markov falling-knife gate branch (flag-gated) |
| `run-stock-nightly.bat` | + `trend_markov` and `v2_markov` to the nightly loops |
| `registry.js` / `registry.test.js` | +2 rows / +1 test block |

**Regression-verified:** `trend_core` (+1,509.52) and `v2` (+710.62) regenerate byte-identical with the Markov flag off — the existing 18 stock variants are unaffected.

## 6. Verification

- `npm test` green (adds 1 registry test block).
- `npm run smoke` — both rows valid `StrategyRow` shape, flat at launch with pre-2026-05-29 backtest correctly excluded.

## 6b. Aggressive (3% risk) siblings — added 2026-05-29

Magnitude versions for the top-3-*profit* metric, pairing the Markov gate with the proven aggressive-sizing template. Thesis: the regime gate should keep the bigger 3% sizing out of the worst regimes, so the large-size losers are fewer than an ungated aggressive variant.

| Variant | Key params | Backfill (informational) |
|---|---|---|
| **Stocks Trend Momentum (Markov-Gated) Aggressive** (`trend_markov_agg`) | 3% risk, 3.0×ATR stop, 3.5×ATR trail, max 3, Markov ≥+0.10 | 10 trades, **80% win, avg R +1.48, +$4,649** |
| **Stocks Mean Reversion v2 (Markov-Gated) Aggressive** (`v2_markov_agg`) | 3% risk, RSI exit 85, 2.5×ATR stop, max 2, 10% circuit, Markov falling-knife gate | 26 trades, 69% win, avg R +0.35, **+$2,513** |

Both `killswitch_dd_pct: 40`, `live_start 2026-05-29`. Same caveats as §7 — bigger sizing means a deeper drawdown profile, and the backfill is a small, benign-window sample.

## 7. Known risks / honesty notes

1. **No forward history at launch** — flat until trades accrue; the backfill numbers are informational only.
2. **The Markov gate can over-filter** — Codex's own spec flags it can miss the best rebound trades right after a panic (exactly when MR wants to buy). The `signal ≥ 0` allowance (not requiring bull) is meant to soften that, but it's a real risk for the MR variant.
3. **Small backfill sample** — 12 and 37 trades over ~6 weeks; the improvements (avg R, win rate) are suggestive, not conclusive.
4. **Credit:** the regime engine is Codex's work; this is an application of it to Claude's edges, not original regime research.
