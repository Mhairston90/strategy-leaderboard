# Stocks Trend Momentum v1 + Aggressive — Spec (2026-05-28)

**Status:** LIVE (forward paper from 2026-05-28)
**Author:** Claude (Opus 4.8), paired with Mhair
**Code:** `Trading Strategy/stocks_momentum/{config,signals,generate_log}.py`
**Engine reused:** `basket_breakout_stocks.portfolio.simulate_variant` (trailing-stop simulator, unchanged)

---

## 1. Why this exists — the regime-diversifier

The contest scores **total profit of your top 3 strategies**. My current top
earners are crypto-momentum (BULL) and stock **mean-reversion** (the Connors
family). The structural risk: mean-reversion earns in chop and **bleeds in
strong trends** — so if the tape starts trending, *multiple* of my top-3 legs
weaken at once and the top-3 total collapses together.

This sleeve is the deliberate hedge: a **trend-follower** that earns precisely
when MR struggles, and is gated *out* of chop (so it doesn't bleed much while
waiting). Holding an earner for both regimes is what keeps the top-3 total from
caving when the regime flips. It is also a **magnitude** play — no partial, wide
trailing stop — so when a real trend lands it books a large absolute $ number,
which is what top-3-*profit* scoring rewards.

## 2. Why it's different from the (failing) breakout family

| | Stocks Breakout v1 (bleeding) | **Trend Momentum (this)** |
|---|---|---|
| Entry | fresh 120-bar HIGH + strong close + EMA gate | confirmed trend: daily EMA50>EMA200 **+ daily ADX>20** + 1h EMA20>EMA50 + 40-bar close-high |
| Chop filter | none (whipsaws on every range new-high) | **daily ADX>20** keeps it flat in chop |
| Take-profit | partial 50% at 2R | **none — let the whole position run** |
| Trail | 2×ATR | **3×ATR (3.5× aggressive), activated at +1R** |
| Profile | many small entries, winners cut early | few entries, winners ridden to the fat tail |

The breakout strat dies because a single-bar new high fires constantly in range
markets. The ADX gate + 1h-trend confluence is the discrimination it lacks.

## 3. Parameters

| Parameter | `trend_core` (v1) | `trend_agg` (Aggressive) |
|---|---|---|
| Universe | wide-15 | wide-15 |
| 1h trend filter | EMA20 > EMA50, close > EMA20 | same |
| Momentum trigger | close > 40-bar close-high | same |
| Daily regime gate | EMA50 > EMA200 | same |
| Daily ADX gate | ADX(14) > 20 | same |
| Initial stop | 3.0×ATR | 3.0×ATR |
| Partial | none | none |
| Trailing stop | 3.0×ATR | **3.5×ATR** |
| Trail activation | +1.0R | +1.0R |
| Time stop | none (trend-followers don't time-stop) | none |
| Per-trade risk | 1.0% | **2.5%** |
| Max concurrent | 4 | **3** |
| Daily circuit | −5% | **−8%** |
| Commission | 0.10% RT | same |
| Kill switch DD | 20% | 40% |
| Starting capital | $10,000 | $10,000 |

Long-only. Wide-15 universe chosen for breadth — more names = more chances to be
holding the one that trends hard (the source of the magnitude winner).

## 4. Full-backfill realized PnL (INFORMATIONAL — not contest equity)

Measured 2026-04-16 → 2026-05-28 at first regen. Contest counts only trades
entered on/after `live_start_iso` = 2026-05-28, so both start ~$0 forward.

| Variant | Closed legs | Win % | Avg R | Backfill realized |
|---|---|---|---|---|
| trend_core | 15 | 66.7% | +1.024 | +$1,509.52 |
| trend_agg | 13 | 69.2% | +1.055 | **+$3,447.40** |

The trend-follower signature is visible: few trades, high avg R, big winners.
`trend_agg`'s +$3,447 over a *choppy* backfill is the magnitude proof-of-concept;
in a genuinely trending forward window it should do considerably more.

## 5. Honest note on parameter sensitivity (no curve-fitting claim)

The first build used `trail_activation_r = 0.0` (the field default), which made
the engine snap every position to breakeven the instant price ticked above entry
— scratching most trades flat (8–11% win, +$0.4k). Setting activation to **+1.0R**
(so a position must establish a 1R gain before the trail/breakeven logic engages)
produced the §4 profile. This is **not** a fit to the backfill curve: +1.0R is
the canonical "let it reach 1R first" trend-following rule and is the exact value
the pre-existing `stocks_aggressive_v2` runner already uses. The backfill is
informational; forward paper is the judge.

## 6. Files touched

| File | Change |
|---|---|
| `Trading Strategy/stocks_momentum/` | NEW package: `__init__.py`, `config.py`, `signals.py`, `generate_log.py` |
| `Trading Strategy/run-stock-nightly.bat` | +step 2b: regenerate trend_core + trend_agg nightly |
| `strategy-leaderboard/registry.js` | +2 strategy entries |
| `strategy-leaderboard/scripts/registry.test.js` | +1 test block (2 rows) |
| `strategy-leaderboard/data/stock_variants/*` | +4 files (portfolio + trade_log per variant) |

No change to any existing strategy's code — `simulate_variant` and the indicator
helpers are imported and reused as-is (cfg is duck-typed).

## 7. Known risks / expectations

1. **Will look quiet in chop.** By design it sits flat / slightly negative until
   a trend appears. Do not judge it on a 2-week chop window — judge it across a
   trend cycle.
2. **Low win-rate is normal.** Trend-followers win <50% and rely on a few large
   winners. A run of stop-outs is expected, not a malfunction.
3. **Aggressive variant is choppy.** 2.5% risk + 3.5×ATR trail = large per-trade
   swings; the 8% daily circuit caps a bad day.
4. **ADX gate may keep it flat for long stretches** if no daily trend forms — a
   correct (if frustrating) behavior, not a bug.

## 8. Demote / kill triggers

- Kill `trend_core` if, after a window that *contained a real trend*, it failed
  to participate (avg R < 0 over 15+ trades) — that would mean the entry filter
  is mis-tuned, not just waiting.
- Aggressive: demote if DD breaches 40% killswitch.
