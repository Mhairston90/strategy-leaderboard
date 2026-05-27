# Stocks Mean Reversion — Three-Variant Expansion (2026-05-27)

**Status:** DESIGN — not yet implemented
**Author:** Claude (paired with Mhair)
**Parents:**
- `stocks-mean-reversion-v1-spec.md`
- `stocks-mean-reversion-v2-spec.md`
- `stocks_mean_reversion/config.py` (existing `agg` template)

---

## 1. Purpose

Add three new variants to the `stocks_mean_reversion` family:

1. **`v2_agg`** — Stocks Mean Reversion v2 Aggressive (Diversified-8 + aggressive sizing)
2. **`v2_rsi15_agg`** — Stocks Mean Reversion v2 RSI<15 Aggressive (Diversified-8 + relaxed entry + aggressive sizing)
3. **`v3_rsi15`** — Stocks Mean Reversion v3 Wide RSI<15 (15-name wide universe + relaxed entry, standard sizing)

The two `*_agg` variants are user-requested: scale typical winners from ~$50 (0.5% risk) to ~$300 (3% risk, the same template used by the existing `agg` variant on wide-15). The third (`v3_rsi15`) fills the open cell in the universe × RSI-threshold grid — the natural breadth-meets-relaxed-entry experiment.

## 2. The Variant Grid After This Change

| Universe \ RSI entry | <3 | <5 | <10 | <15 |
|---|---|---|---|---|
| tech-8 (universe.json) | — | — | v1 | — |
| diversified-8 (universe_diversified.json) | — | v2_rsi5 | v2, **v2_agg ⊕** | v2_rsi15, **v2_rsi15_agg ⊕** |
| wide-15 (universe_wide.json) | deep | — | v3, agg | **v3_rsi15 ⊕** |

⊕ = new in this change.

## 3. Edge Thesis

### 3.1 Two aggressive variants
The `agg` template (3% risk, max_concurrent=2, RSI exit 85, 2.5×ATR stop, 10% daily circuit) is already proven viable on the wide-15 universe. v2 and v2_rsi15 are the *highest-PF* MR variants on the diversified-8 universe (v2_rsi15 backfilled to 73% win rate, +$608 realized on a single regen). The hypothesis: the same aggressive-sizing knob that converts a winning edge into a convex right-tail bet should also work on diversified-8, where the edge is already stronger.

If `v2_agg` produces a higher Sharpe than `agg` (same sizing, different universe), it's evidence that diversified-8 is the stronger universe regardless of sizing tier — strengthening the v1→v2 result.

### 3.2 v3_rsi15 research variant
v3 (wide-15 + RSI<10) shows breadth scales the v1→v2 edge; v2_rsi15 (diversified-8 + RSI<15) shows the relaxed entry has the best win rate of any variant tested. v3_rsi15 is the missing cell — does the breadth advantage stack with the relaxed-entry advantage, or do they cancel (more entries on weaker setups)?

Cost to test: 1 config entry, 1 registry entry, 1 batch loop entry, 1 regen run. Zero new code.

## 4. Universe & Direction

| Variant | Universe file | Symbol count | Direction |
|---|---|---|---|
| v2_agg | universe_diversified.json | 8 | long-only |
| v2_rsi15_agg | universe_diversified.json | 8 | long-only |
| v3_rsi15 | universe_wide.json | 15 | long-only |

## 5. Parameters

| Parameter | v2_agg | v2_rsi15_agg | v3_rsi15 |
|---|---|---|---|
| RSI length | 2 | 2 | 2 |
| RSI entry threshold | < 10 | **< 15** | **< 15** |
| RSI exit threshold (TP) | **> 85** | **> 85** | > 70 |
| ATR length | 14 | 14 | 14 |
| Stop ATR multiplier | **2.5×** | **2.5×** | 2.0× |
| Time stop | 24 bars | 24 bars | 24 bars |
| Daily regime gate | EMA-50 > EMA-200 | same | same |
| Daily filter | close > daily EMA-50 | same | same |
| Per-trade risk | **3.0%** | **3.0%** | 0.5% |
| Max concurrent | **2** | **2** | 4 |
| Daily loss circuit | **−10%** | **−10%** | −3% |
| Commission | 0.10% round-trip | same | same |
| Starting capital | $10,000 | $10,000 | $10,000 |
| Kill switch DD | **40%** | **40%** | 18% |

**Bold cells** are deltas from the standard MR baseline (v1/v2). v2_agg and v2_rsi15_agg mirror the existing `agg` template exactly (same sizing, exit, stop, circuit, killswitch) — they differ only in universe and entry threshold. v3_rsi15 mirrors v3 exactly — only the entry threshold changes.

## 6. Position Sizing

`position_size = (risk_per_trade × current_equity) / (entry − stop)`. Cash account, no actual leverage. The 3% risk + 2.5×ATR stop combination produces a *larger* dollar position than 0.5% × 2.0×ATR but with proportionally wider stop — the "leverage" is internal capital allocation, not margin.

Expected typical-winner dollar magnitude at 1R: $300 (vs ~$50 at 0.5%). At the 1.5R+ scale that's been common in deep's recent OXY/FCX/AVGO winners, that's $450–$600. Matches the user's $250–$350 target with upside.

## 7. Implementation

### 7.1 New code (none required)
All three variants are pure config additions — no signal logic or simulator changes. They reuse `signals.py` and `portfolio.py` as-is.

### 7.2 Files touched

| File | Change |
|---|---|
| `Trading Strategy/stocks_mean_reversion/config.py` | +3 dataclass entries in `CONFIGS` dict |
| `Trading Strategy/run-stock-nightly.bat` | +3 tokens to the for-loop variant list |
| `strategy-leaderboard/registry.js` | +3 strategy entries (after the existing MR block) |
| `strategy-leaderboard/data/stock_variants/*` | +6 new files (portfolio + trade_log per variant) from first regen |

### 7.3 Run commands
```bat
python -m stocks_mean_reversion.generate_log --variant v2_agg --skip-refresh
python -m stocks_mean_reversion.generate_log --variant v2_rsi15_agg --skip-refresh
python -m stocks_mean_reversion.generate_log --variant v3_rsi15 --skip-refresh
```

### 7.4 Verification
Run `scripts/smoke.js` after registry edits — expect 49 rows total (was 46 after today's `agg` add), all valid shape.

## 8. Leaderboard Registration

All three: `starting_capital: 10000`, `live_start_iso: '2026-05-27T00:00:00Z'` (honest creation date — pre-today data is backtest and excluded from contest equity). killswitch_dd_pct: 40 for the aggressive twins (matches `agg`/`deep`), 18 for v3_rsi15 (matches v3).

Display names:
- `Stocks Mean Reversion v2 Aggressive`
- `Stocks Mean Reversion v2 (RSI<15) Aggressive`
- `Stocks Mean Reversion v3 (Wide RSI<15)`

## 9. Known Risks

1. **No forward-paper history at launch.** All three start with `live_start_iso = today`. Any pre-today simulation is backtest and contributes ~$0 to the contest until trades accrue. Expect ~1–2 weeks before the variants have statistically interpretable forward performance.
2. **Aggressive sizing amplifies losers too.** A 1R loss on 3% risk = $300. A 2-loss day on max_concurrent=2 = ~$600 = 6% account hit. The 10% daily circuit caps the bleed at $1k/day, but the equity curve will be visibly choppier than v2/v2_rsi15 standard.
3. **RSI<15 is less selective than RSI<10.** Entering at RSI 12–14 is shallower oversold — winners may be smaller and the false-positive rate higher. v2_rsi15's strong backfill win-rate (73%) is suggestive but the sample is small.
4. **v3_rsi15 may just be noise.** If the breadth and relaxed-entry advantages don't stack, v3_rsi15 will show middling performance and serve only as a useful negative result.

## 10. Success Criteria & Demote-to-Research Triggers

Per-variant, evaluated weekly:
- **Promote to live (already live by default):** PF > 1.5, win rate > 55%, 4-week DD inside killswitch
- **Demote to research:** any of — PF < 1.0 over 4-week window, win rate < 40% over 10+ trades, DD breach killswitch threshold

Specific to `v3_rsi15`: if it underperforms BOTH parents (v3 and v2_rsi15) on Sharpe over 4 weeks, retire it — it would be a confirmed null result on the breadth-stacks-with-relaxed-entry hypothesis.

## 11. Out of Scope

- **Short side.** No short-MR variant in this change (symmetric inverse is a separate research direction queued in v2's spec section 10).
- **Per-symbol parameter tuning.** All variants use universe-uniform parameters.
- **Time-stop sensitivity sweep.** Initially considered but cut to keep scope tight — could be a future single-variant experiment.
- **Backtest-then-promote workflow.** All three start live; pre-today backtest is informational only, not gated.
