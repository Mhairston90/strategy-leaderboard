# Crypto Mean Reversion v1 + Aggressive — Spec

**Status:** LIVE (forward paper from 2026-05-28) — **transparent commission-challenged experiment**
**Author:** Claude, paired with Mhair. Built 2026-05-17; wired into the contest 2026-05-28 (Opus 4.8 session).
**Parent recipe:** `stocks-mean-reversion-v2-spec.md` (cross-market port of the frozen Connors RSI(2) recipe)
**Code:** `Trading Strategy/crypto_mean_reversion/{config,signals,generate_log}.py`

---

## 1. Purpose

Port the leaderboard's strongest equity edge — the Connors RSI(2) oversold-bounce
— to a **new, uncorrelated asset class**: Kraken USD spot pairs (BTC, ETH, SOL,
XRP, DOGE, ADA, DOT, LINK). Crypto trades 24/7, so the daily session regime gate
is replaced by a **4H EMA50>EMA200 regime gate + close>4H EMA50 dip filter**;
everything else mirrors the frozen stocks recipe.

This family was fully built on 2026-05-17 but never wired into the registry or
the nightly job. This session wires it in and adds it to `run-stock-nightly.bat`
(step 4) so it regenerates forward off the crypto OHLC cache that the basket
crypto job already refreshes.

## 2. Honest framing — read this before trusting the row

**The full backfill LOST money.** This is disclosed up front per the
competition's anti-cherry-picking rule:

| Variant | Closed legs (backfill) | Backfill realized | Diagnosis |
|---|---|---|---|
| `v1` | 127 | **−$2,668.70** | 127 round-trips × 0.52% Kraken taker = commission bled the edge out |
| `agg` | 31 | **−$2,927.71** | the "fewer/bigger trades" fix did not clear the hurdle on this window either |

The structural problem is real and regime-light: Kraken spot taker is ~0.26%/side
= **0.52% round-trip**, vs ~0.10% for equities. Mean reversion's many small
winners are exactly the trade profile most exposed to per-trade cost. The equity
MR family clears 0.10%; crypto at 0.52% does not, on the 2026-04-16 → 2026-05-17
window.

So why wire it in at all?

1. **It costs nothing under independent per-row ranking.** A losing row sorts to
   the bottom and never touches BULL v0 or the stock MR rows.
2. **It is a genuinely new asset class** — uncorrelated with every equity row,
   so it has option value if a forward crypto regime (sustained uptrend with
   sharp shakeout dips, which the regime gate is built for) finally lets the
   bounce magnitude clear the fee hurdle.
3. **Transparency over curation.** Logging a known-negative experiment honestly
   is exactly what `COMPETITION.md` §61 rewards; hiding it would be the violation.

`live_start_iso = 2026-05-28` (honest). The crypto cache currently ends ~2026-05-17,
so both rows show **0 forward trades / flat 0%** until the nightly Kraken fetcher
advances the data — they contribute ~$0 to the contest, not the backfill loss.

## 3. Parameters

| Parameter | `v1` | `agg` |
|---|---|---|
| Venue | Kraken USD spot, 24/7 | Kraken USD spot, 24/7 |
| Universe | basket_breakout/universe.json (8 pairs) | same |
| RSI length | 2 | 2 |
| RSI entry | < 10 | **< 3** (only the deepest dips → far fewer trades → less fee bleed) |
| RSI exit (TP) | > 70 | **> 80** |
| Regime gate | 4H EMA50 > EMA200 | same |
| Dip filter | close > 4H EMA50 | same |
| Stop ATR mult | 2.0× | **3.0×** (give the bounce room) |
| Time stop | 24 bars | **36 bars** |
| Per-trade risk | 0.5% | **3.0%** (6× — concentrate conviction) |
| Max concurrent | 4 | **2** |
| Daily circuit | −3% | **−12%** |
| Commission (RT) | **0.52%** (honest Kraken taker) | 0.52% |
| Kill switch DD | 18% | 40% |
| Starting capital | $10,000 | $10,000 |

## 4. Edge thesis & the `agg` hypothesis

The base thesis is identical to the stocks family: in an uptrend (regime gate
true), a sharp RSI(2) flush is a high-probability snap-back. `agg` is a
*principled* response to v1's diagnosed failure — not a curve-fit: if commission
drag is the killer, fire only on the rarest/deepest dips (RSI<3), hold them via a
wider stop, and size them up so the winners that do land are large enough to
clear the 0.52% hurdle and the loser tail is acceptable under convex scoring. The
backfill says even this was not enough on the May window; forward paper tests
whether a different regime changes that.

## 5. Files touched (this session)

| File | Change |
|---|---|
| `strategy-leaderboard/registry.js` | +2 strategy entries (Crypto MR v1, Aggressive) |
| `strategy-leaderboard/scripts/registry.test.js` | +1 test block (2 rows) |
| `Trading Strategy/run-stock-nightly.bat` | +step 4: regenerate crypto MR v1 + agg nightly |
| `strategy-leaderboard/data/crypto_variants/*` | refreshed 4 files (already existed) |

No code change to the crypto generator — it was already correct.

## 6. Known issues / honesty notes

- **Backfill is net-negative** (disclosed in §2). This is not a hidden flaw.
- **Stale data at launch.** The crypto cache ends ~2026-05-17; until the nightly
  Kraken fetcher advances it, these rows are flat, not losing.
- **Commission is modelled honestly at 0.52% RT**, not the equity 0.10%. If
  anything the row understates real slippage, not overstates the edge.

## 7. Demote / kill triggers

- Kill (move spec to `strategies/archived/`) if, after the cache advances and
  20+ forward trades accrue, PF stays < 1.0 — that confirms the commission hurdle
  is fatal forward as well as on backfill, and the experiment has returned its
  answer (a clean negative result on cross-market portability under spot fees).
