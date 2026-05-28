# Stocks Mean Reversion — Opus 4.8 Diversified-8 Expansion (2026-05-28)

**Status:** LIVE (forward paper from 2026-05-28)
**Author:** Claude (Opus 4.8), paired with Mhair
**Parents:**
- `stocks-mean-reversion-v1-spec.md`
- `stocks-mean-reversion-v2-spec.md`
- `stocks-mean-reversion-2026-05-27-three-variants-design.md`
- `stocks_mean_reversion/config.py` (existing `v2`, `agg`, `deep` templates)

---

## 1. Purpose

The Connors RSI(2) oversold-bounce family is the leaderboard's strongest
*validated systematic* edge. On the contest window, **Stocks Mean Reversion v2
(diversified-8)** carries PF ≈ 22, Sharpe ≈ 16, 71% win — the best risk-adjusted
row of any non-BULL strategy, while the entire breakout family bleeds. So rather
than invent unproven new signal types, this expansion **deepens the proven
diversified-8 universe** along five axes that no existing variant occupies. All
five are pure parameter variants of the frozen signal engine — **no `signals.py`
or `portfolio.py` change** — so they inherit the exact recipe that is already
working.

Five new variants:

1. **`v2_fast`** — Stocks Mean Reversion v2 Fast-Exit (RSI>50 exit)
2. **`v2_heat8`** — Stocks Mean Reversion v2 Broad-Heat (max_concurrent 8)
3. **`v2_bal`** — Stocks Mean Reversion v2 Balanced (1.5% risk — the missing mid-tier)
4. **`v2_rsi5_agg`** — Stocks Mean Reversion v2 (RSI<5) Aggressive (extreme entry × aggressive sizing)
5. **`deep_div`** — Stocks Mean Reversion Deep Diversified (RSI<3 on diversified-8; A/B vs wide-15 `deep`)

## 2. Why this is +EV regardless of any single outcome

The leaderboard ranks every row **independently** on rolling 90d return; there is
no cross-strategy portfolio. A variant that blows up simply sorts to the bottom —
it does not subtract from BULL v0 or from v2. So the rational meta-move is to
maximize the number of **differentiated, low-correlation shots** built on a real
edge: only the top row matters, and the downside of a loser is structurally free.
These five are deliberately spread across distinct axes (exit-speed, heat,
mid-risk, extreme-entry×size, universe-of-the-extreme-bet) so they are not
redundant with each other or with the existing grid.

## 3. The Variant Grid After This Change

### 3.1 Universe × RSI-entry (sizing-agnostic)

| Universe \ RSI entry | <3 | <5 | <10 | <15 |
|---|---|---|---|---|
| tech-8 | — | — | v1 | — |
| diversified-8 | **deep_div ⊕** | v2_rsi5, **v2_rsi5_agg ⊕** | v2, v2_agg, **v2_fast ⊕**, **v2_heat8 ⊕**, **v2_bal ⊕** | v2_rsi15, v2_rsi15_agg |
| wide-15 | deep | — | v3, agg | v3_rsi15 |

### 3.2 Risk tier on diversified-8 (previously a gap at 1.5%)

| Risk/trade | 0.5% | **1.5%** | 3.0% | 4.0% |
|---|---|---|---|---|
| diversified-8 | v2, v2_rsi5, v2_rsi15, v2_fast, v2_heat8 | **v2_bal ⊕** | v2_agg, v2_rsi15_agg, **v2_rsi5_agg ⊕** | **deep_div ⊕** |

⊕ = new in this change.

## 4. Parameters

| Parameter | v2_fast | v2_heat8 | v2_bal | v2_rsi5_agg | deep_div |
|---|---|---|---|---|---|
| Universe | diversified-8 | diversified-8 | diversified-8 | diversified-8 | diversified-8 |
| RSI length | 2 | 2 | 2 | 2 | 2 |
| RSI entry | < 10 | < 10 | < 10 | **< 5** | **< 3** |
| RSI exit (TP) | **> 50** | > 70 | **> 75** | **> 85** | **> 80** |
| Stop ATR mult | 2.0× | 2.0× | **2.25×** | **2.5×** | **2.5×** |
| Time stop | 24 bars | 24 bars | 24 bars | 24 bars | 24 bars |
| Regime gate | EMA50>EMA200 | same | same | same | same |
| Dip filter | close>EMA50 | same | same | same | same |
| Per-trade risk | 0.5% | 0.5% | **1.5%** | **3.0%** | **4.0%** |
| Max concurrent | 4 | **8** | **3** | **2** | **3** |
| Daily circuit | −3% | −3% | **−6%** | **−10%** | **−10%** |
| Commission | 0.10% RT | same | same | same | same |
| Kill switch DD | 18% | 18% | 25% | 40% | 40% |

**Bold** = delta from the v2 baseline.

## 5. Edge thesis, per variant

- **v2_fast** — Connors' canonical short-side exit is "first close with RSI back
  above ~50," not 70. Exiting earlier banks the bounce before mean-reversion
  decays, raising win rate and turnover at the cost of right-tail magnitude. No
  prior variant uses an exit threshold below 70, so this is a clean exit-speed
  probe on the strongest universe.
- **v2_heat8** — In a broad selloff, more than four diversified names go oversold
  at once; the heat-4 cap leaves qualified setups unfilled. MR booked its best
  window during the May 8–15 collapse, so capturing *more* simultaneous dips in
  panics is the highest-leverage place to relax the cap. Pure breadth-of-capture
  test (identical 0.5% sizing as v2).
- **v2_bal** — Every diversified variant is either timid (0.5%) or convex
  (3–4%). 1.5% with a 2.25×ATR stop and a 6% circuit is the missing Goldilocks
  tier — meaningful per-trade magnitude without agg's blow-up profile.
- **v2_rsi5_agg** — Deepest-conviction entry (RSI<5) paired with aggressive 3%
  sizing on the best universe. `v2_rsi5` exists only at timid sizing (+0.0% on
  the contest window — too small to matter); `agg` exists only at RSI<10. This
  is the open RSI5×aggressive cell and the most convex single bet here.
- **deep_div** — Direct A/B for `deep` (RSI<3, 4% risk, wide-15). Same extreme
  recipe on diversified-8, the universe with the stronger base edge. Tests
  whether the deepest-dip convex bet prefers the focused pool or breadth.

## 6. Full-backfill realized PnL (INFORMATIONAL — not contest equity)

Measured on the 2026-04-16 → 2026-05-28 backfill at first regen. These are
**backtest** figures used only to sanity-check that each config behaves as
designed; the contest counts only trades entered on/after `live_start_iso`
(2026-05-28), so each variant starts at ~$0 forward.

| Variant | Closed legs | Backfill realized | Read |
|---|---|---|---|
| v2_bal | 42 | **+$1,844.85** | mid-tier sizing was the sweet spot on this window |
| v2_heat8 | 45 | +$710.62 | identical to v2 — heat-4 rarely bound on diversified-8 |
| v2_fast | 49 | +$338.47 | more, smaller winners (faster exit) as designed |
| deep_div | 10 | +$72.95 | very few RSI<3 signals; tiny but positive sample |
| v2_rsi5_agg | 18 | −$475.92 | high-variance convex bet; lost on this backfill |

`v2_heat8` matching `v2` exactly on backfill is expected and not a bug — it only
diverges when ≥5 names are simultaneously oversold, which the contest's forward
selloffs will eventually trigger.

## 7. Files touched

| File | Change |
|---|---|
| `Trading Strategy/stocks_mean_reversion/config.py` | +5 `MeanReversionConfig` entries |
| `Trading Strategy/run-stock-nightly.bat` | +5 tokens to the MR for-loop |
| `strategy-leaderboard/registry.js` | +5 strategy entries (after the breakout MR block) |
| `strategy-leaderboard/data/stock_variants/*` | +10 files (portfolio + trade_log per variant) |
| `strategy-leaderboard/scripts/registry.test.js` | +1 test block (5 rows) |

## 8. Verification

- `npm test` — 151/151 pass (adds 1 registry test block).
- Adapter dry-run confirms all five parse, produce valid `StrategyRow` shape,
  and correctly exclude all pre-2026-05-28 backtest trades (`trades_n: 0` at
  launch, with the excluded count surfaced as an info note).

## 9. Known risks

1. **No forward history at launch.** All start `live_start_iso = today`; expect
   ~1–2 weeks before forward performance is interpretable.
2. **Aggressive sizing amplifies losers.** `v2_rsi5_agg` (3%) and `deep_div`
   (4%) will have visibly choppy curves; the 10% daily circuit caps a bad day.
3. **RSI<5 / RSI<3 are signal-quiet.** Few entries → wide confidence intervals;
   small samples for a long time.
4. **v2_heat8 may never diverge from v2** in a calm forward tape — that is itself
   a useful (null) result on whether the heat cap binds.

## 10. Demote-to-research triggers (evaluated weekly, per variant)

- Demote if any of: PF < 1.0 over a 4-week forward window; win rate < 40% over
  10+ forward trades; drawdown breaches the killswitch.
- `deep_div`: if it underperforms `deep` on Sharpe over 4 weeks, the
  extreme-bet-prefers-diversified hypothesis is falsified — retire it.

## 11. Out of scope

- No short-side MR, no per-symbol tuning, no `signals.py` changes.
- Crypto MR is wired in the same session but specced separately
  (`crypto-mean-reversion-v1-spec.md`).
