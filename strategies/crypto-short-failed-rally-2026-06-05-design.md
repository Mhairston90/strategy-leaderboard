# Crypto Short Failed-Rally — Design (2026-06-05)

**Status:** ❌ SHELVED — NEGATIVE RESULT (built, tested, not registered). See §0.
**Author:** Claude (BULL side), paired with Mhair
**Motivation:** Plug the structural long-bias hole in the BULL book (see §1).

---

## 0. Outcome — NEGATIVE RESULT (2026-06-05)

The module was fully built (`crypto_short_mr/`: config, signals, short-aware
simulator, generator, unit tests — all passing) and backfilled against the live
crypto cache. **It was NOT registered on the leaderboard because it has no edge.**

Two exit designs were tried; both are net-negative after honest Kraken
margin-short costs (0.52% round-trip + funding), on the 8-coin majors universe,
backfilled 2026-04-16 → 2026-06-05:

| Exit design | Closed | Win % | Gross avg R | Net P&L (standard 0.5%) |
|---|---|---|---|---|
| RSI-cover (snap-back) | 125 | 53.6% | +0.087 | **−$1,936** |
| Chandelier trail (trend-hold) | 118 | 25.4% | −0.026 | **−$2,420** |

(Aggressive 3% variant: −$4,783 and −$4,516 respectively — same negative edge at 6× size.)

**Root cause:** the ENTRY is the problem, not the exit. Shorting overbought RSI>90
*rips* is shorting strength and betting on reversion — the hard side of the trade,
with no robust edge on crypto majors net of costs. The RSI-cover version had a
marginal gross edge that trading costs erased (same commission-drag that hurts the
long crypto MR). The chandelier version got shaken out on 1H noise (108/118 exits
were trail-stops), turning even the gross edge negative.

**What this rules out / points to:** crypto mean-reversion *shorting* is not the way
to plug the long-bias hole. What demonstrably works (Codex's profitable shorts) is a
different class — TREND-following shorts of *weakness* (breakdowns / failed-rally
continuation in a confirmed downtrend, multi-day holds), not 1H mean-reversion. A
trend-short deserves its own design pass; it can reuse this module's short-aware
simulator (`crypto_short_mr/portfolio.py`, chandelier trail) unchanged.

Stopped after two principled attempts rather than tuning a third — further parameter
search would be curve-fitting a tiny sample (the exact overfitting flagged in the
Codex audit). The code + tests remain on disk as reusable scaffolding.

---

_The original design below is retained for the record._

---

## 1. Why this exists

Audit of the BULL-vs-Codex contest (2026-06-04) found Codex's lead is built almost
entirely on **net-short** strategies riding the crypto downtrend: its top two earners
(`Regime Plus L/S v1` +$1,607, `Regime Short Plus v1` +$816 = 71% of Codex's top-5)
are 100% short altcoins, reason-tagged `failed_rally` / `short_trend`, live only since
~2026-05-28.

The BULL book has **zero net-short directional exposure**. Every BULL top-5 slot is a
*long* mean-reversion variant. When the market falls, BULL can only abstain (Crypto MR
correctly flat, regime-gated) or bleed (long Stocks Trend Momentum variants −5% to −21%).
Market-neutral sleeves already exist (`xsec_momentum`, `pairs_trading`) but **dollar-neutral
P&L comes from dispersion, not direction** — they do not profit when the market falls and
therefore do not plug this hole.

**The gap is a positioning gap, not a skill gap.** This sleeve closes it with a net-short
directional strategy that is the clean mirror of BULL's *proven* long Connors MR edge.

## 2. The edge

Mirror of the proven long Connors MR, inverted to the short side and gated to downtrends:

| Component | Long MR (proven) | This sleeve (short) |
|---|---|---|
| Regime gate | 4H EMA50 **>** EMA200 (uptrend) | 4H EMA50 **<** EMA200 (downtrend) |
| Entry trigger | RSI(2) **<** 10 (oversold dip) | RSI(2) **>** 90 (overbought rip) |
| Structure filter | close **>** 4H EMA50 | close **<** 4H EMA50 (rip failing below trend) |
| Take-profit | RSI **>** 70 | RSI **<** 30 (cover as it falls back) |
| Stop | entry − N×ATR (below) | entry **+** N×ATR (above) |
| Time stop | 24 bars | 24 bars |

**Thesis:** in a confirmed downtrend, short-term overbought bounces are *failed rallies* —
sellers re-assert below the trend MA. Shorting RSI(2)>90 rips that occur while price is
below the 4H EMA50 captures the snap-back down. The regime gate is essential: shorting
overbought in an *uptrend* is fighting momentum and loses, which is exactly why the gate
restricts entries to `EMA50 < EMA200`.

## 3. Universe & venue

- **Universe:** existing crypto basket — BTC, ETH, SOL, XRP, DOGE, ADA, DOT, LINK
  (`basket_breakout/universe.json`), the same cache `crypto_mean_reversion` already reads
  (fresh through today; 1H + 4H CSVs in `basket_breakout/data/`).
- **Venue:** Kraken USD pairs. Long-only crypto MR trades spot; **shorting requires margin.**
  See §6 for honest cost modeling.
- **Direction:** short-only (net-short by construction).

## 4. Parameters

| Parameter | Standard | Aggressive |
|---|---|---|
| RSI length | 2 | 2 |
| RSI entry threshold (short) | **> 90** | **> 90** |
| RSI exit threshold (TP/cover) | **< 30** | **< 20** |
| ATR length | 14 | 14 |
| Stop ATR multiplier | 2.0× | 2.5× |
| Time stop | 24 bars | 24 bars |
| 4H regime gate | EMA50 < EMA200 (down) | same |
| Structure filter | close < 4H EMA50 | same |
| Per-trade risk | **0.5%** | **3.0%** (6×) |
| Max concurrent | 4 | 2 |
| Daily loss circuit | −3% | −12% |
| Commission (margin short) | 0.52% round-trip + funding (see §6) | same |
| Starting capital | $10,000 | $10,000 |
| Kill switch DD | 18% | 40% |

The two variants differ **only in sizing tier + exit tightness** (same entry trigger) — a
clean A/B of "does aggressive sizing convert the short edge into a convex contest bet?",
mirroring the v2 / v2-agg pattern from the long MR family.

## 5. Architecture

**Isolation is the central constraint.** `stocks_mean_reversion/portfolio.py` is the
long-only simulator shared by ~17 live strategies (all stocks + crypto MR variants). A bug
there corrupts the entire MR book. **This design does NOT modify it.**

New self-contained module `crypto_short_mr/`, mirroring `crypto_mean_reversion/`:

| File | Responsibility |
|---|---|
| `config.py` | `CONFIGS` dict: `standard`, `aggressive`. Reuses the `MeanReversionConfig` dataclass where fields map; adds a short-specific RSI overbought threshold. |
| `signals.py` | Computes RSI(2), ATR(14), 4H regime (EMA50/200), and the **short_entry** boolean (RSI>OB AND regime-down AND close<EMA50 AND ATR>0). |
| `portfolio.py` | **Short-aware simulator.** Mirrors the long simulator's structure but: entry opens a short, P&L = (entry − exit) × size, stop is *above* entry, gap-aware stop fills on the up-side, TP on RSI<exit. Self-contained — no shared mutable state with the long engine. |
| `generate_log.py` | Reads `basket_breakout/data/{SYM}_{1h,4h}.csv`, runs signals + sim per variant, writes `data/crypto_variants/{key}_{trade_log,portfolio}.md` in the exact format the existing `adaptCodex` leaderboard adapter consumes. |

**Why a new simulator and not a `side` parameter on the shared one:** the shared engine is
load-bearing for 17 live strategies; the isolation/blast-radius cost of editing it dwarfs the
~120 lines of a focused short simulator. The short sim can be unit-tested independently
against hand-computed expected fills.

**Data flow:** `basket_breakout/data` CSVs → `signals.compute_signals` → `portfolio.simulate`
→ markdown → `data/crypto_variants/` → `adaptCodex` → leaderboard row. Identical pipeline
shape to crypto MR, so the leaderboard adapter needs **no changes**.

## 6. Honest cost modeling (margin shorts)

Spot-long crypto MR pays Kraken taker ~0.26%/side = 0.52% round-trip. **Shorting is not
free** — it requires a margin position with:
1. **Opening/rollover fee:** Kraken margin ~0.02%/4h on the position notional (funding drag).
2. **Same taker fees** on entry and exit (0.52% round-trip).

The simulator will charge the 0.52% round-trip **plus** a funding drag of 0.02% per 4h held
(≈0.12%/day) on notional. This is deliberately conservative — it makes the short edge clear
the *real* cost hurdle, not a fantasy frictionless one. Documented in the trade-log header so
the leaderboard shows the assumption.

## 7. Leaderboard integration

- **registry.js:** 2 new entries (`Crypto Short Failed-Rally`, `Crypto Short Failed-Rally
  Aggressive`), `type: 'codex-local'`, `adapter: adaptCodex`, `live_start_iso:
  '2026-06-05T00:00:00Z'` (HONEST creation date — pre-today is backtest, excluded from
  contest equity by the adapter). killswitch 18 / 40 respectively.
- **data/crypto_variants/:** 2 new file pairs from first regen.
- **Nightly:** add both variants to whatever job regenerates crypto MR (the crypto data files
  refresh nightly; the short module reuses that same fresh cache — must run *after* the crypto
  fetch, same cache-ordering lesson as the stocks fix).

## 8. Testing

- **Unit test the short simulator** (`crypto_short_mr/portfolio.py`): hand-construct a tiny
  signal frame with a known overbought rip → verify the short opens, the stop sits *above*
  entry, a down-move books positive P&L, an up-move to stop books −1R, and funding drag
  accrues with bars held. This is the one genuinely new mechanic (short P&L sign + stop
  side) and must be verified, not assumed.
- **Smoke:** after registry edits, `node scripts/smoke.js` → expect 72 rows (was 70), all
  valid shape, the two new rows present.
- **Sanity:** confirm the regime gate actually fires — in the current down regime the
  standard variant should produce forward shorts (unlike crypto MR which is correctly flat).

## 9. Known risks

1. **Short MR ≠ symmetric to long MR.** Shorting rips is a genuinely different edge than
   buying dips; the regime gate is what makes it viable, but the short side may have a
   different hit-rate/payoff. The standard 0.5% variant is the honest read before trusting
   the aggressive twin.
2. **Regime-bet timing.** Like Codex's winners, this profits from down moves. On a sustained
   crypto rally the regime gate flips off and the sleeve goes flat (by design) — it will not
   bleed into uptrends, but it also contributes $0 then. That's acceptable: it's insurance
   against down-legs, not an all-weather strategy.
3. **Margin short realism.** Even with funding modeled, paper margin shorting omits
   liquidation/borrow-availability risk. Acceptable for a paper contest; flagged for honesty.
4. **Late to the move.** Deploying mid-downtrend means some of the easy down-move is already
   gone. `live_start` is today and honest — no backdating to claim the run-up.

## 10. Out of scope (YAGNI)

- No changes to the shared long-only simulator or any existing strategy.
- No stocks short variant (deferred — could reuse this engine later if the crypto short works).
- No pairs/market-neutral work (`xsec_momentum` / `pairs_trading` already cover that axis).
- No new universe — reuse the existing crypto basket.
- No live-execution wiring — paper/leaderboard only, same as every other sleeve.

## 11. Success criteria

- Standard variant produces forward short trades in the current down regime (proves the gate
  + entry fire correctly).
- Over a 2-4 week forward window: PF > 1.3 and positive realized P&L on the standard variant
  ⇒ the short edge is real; promote attention to the aggressive twin.
- Demote-to-research trigger: PF < 1.0 over a 4-week window, or DD breaches killswitch.
