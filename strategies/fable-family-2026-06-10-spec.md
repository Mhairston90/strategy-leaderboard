# FABLE Strategy Family — Spec (frozen 2026-06-10)

**Owner:** FABLE (Claude Fable 5) — independent competitor, separate from the
Claude/Opus-owned families and from CODEX. Entered the leaderboard 2026-06-10
at Marcus's direction ("you're on your own team now").

**Engine:** `C:\trading\Fable\fable_engine\` (indicators / engine / strategies
/ generate). Own simulator, own signal code; shares only the repo's common
OHLC caches (equities yfinance cache, Kraken crypto cache) — same convention
as every other local-markdown family.

**Capital:** $10,000 virtual per strategy (leaderboard default).
**live_start_iso:** `2026-06-10T00:00:00Z` for all seven — the honest
creation date. Every trade before today in the logs is BACKTEST, excluded
from contest equity by the adapter. All backfill numbers below are
informational only and claim nothing.

**Design thesis (top-5-profit scoring):** only the best 5 of 7 rows count,
so the book is built as uncorrelated legs — two-way equity mean reversion
(base + magnitude sizing), an ADX-gated trend leg, a dedicated short leg, an
overnight gap-fade leg, and two crypto legs (fee-aware band reversion +
two-way trend rider). In any regime ~5 legs should have an earning
environment; losers cost nothing under this scoring.

## Pre-freeze iteration disclosure (honesty convention)

Two design iterations were run on the 2026-04-16 backfill BEFORE this freeze:

1. **Crypto Pulse** moved 1H -> 4H bars (backfill -2,659 -> +365): the 1H
   version's Kraken 0.52% round-trip fee ate the band-reversion edge; 4H
   amortizes fees over larger moves. Stop 2.0 -> 2.5×ATR, time stop 36×1H ->
   18×4H bars.
2. **Fader** was tried with a stricter triple-AND entry (backfill -238 ->
   -506, worse) and REVERTED to the original OR entry. It is kept as the
   book's regime-insurance leg: expected to bleed slightly in bull tapes and
   pay in selloffs. Under top-5 scoring this optionality is free.

No further parameter changes without a vN+1 spec.

## Common engine semantics

- Entries fill at signal-bar close; one position per symbol per strategy.
- Size = (risk_per_trade × $10k) / |entry − stop|.
- Gap-aware intrabar stop fills (fill at open if gapped through).
- Heat cap and UTC-daily realized-loss circuit apply across the whole book.
- Commission charged on entry notional at close: 0.10% RT equities,
  0.52% RT crypto (Kraken spot taker, matching repo convention).
- Simulator does not mark open positions to market (repo convention).
- Higher-timeframe regime columns are shifted one completed bar (no
  look-ahead). Universe: equities wide-15 (frozen 2026-05-17 universe);
  crypto Kraken-8 (BTC ETH SOL XRP ADA DOGE DOT LINK).

## The seven strategies

| Key | Name | Edge | Risk | Heat | Stop | Exit | KS DD |
|---|---|---|---|---|---|---|---|
| fable_snapback_ls | FABLE Equities Snapback L/S v1 | two-way z(20) reversion, regime-aligned (long dips in uptrends, short rips in downtrends) | 1% | 5 | 2.0×ATR | z mean-touch, 24-bar time | 20% |
| fable_snapback_turbo | FABLE Equities Snapback Turbo | same signals, magnitude sizing, extended exit z>+0.5 | 2.5% | 6 | 2.5×ATR | z>+0.5, 30-bar time | 40% |
| fable_afterburner | FABLE Equities Afterburner v1 | daily EMA50>200 + ADX>18 + 1h EMA20>50 + 40-bar closing high | 1.5% | 4 | 2.5×ATR | 3×ATR trail from +1R, 60-bar time | 25% |
| fable_fader | FABLE Equities Fader v1 | short-only extension fade ((>6% over dEMA20 or z>+2.5) + RSI(2)>95); regime insurance | 1% | 3 | 2.0×ATR | RSI(2)<30 or z<=0, 16-bar time | 20% |
| fable_gap_snap | FABLE Equities Gap Snap v1 | fade >1.25% overnight gaps against daily trend, target gap fill | 1.25% | 4 | 1.5×ATR | gap-fill target, 6-bar (EOD) time | 20% |
| fable_crypto_pulse | FABLE Crypto Pulse L/S v1 | 4H Bollinger reversion both ways, only when band width >3× round-trip fee | 1.5% | 4 | 2.5×ATR | mid-band TP, 18-bar time | 25% |
| fable_crypto_drift | FABLE Crypto Drift v1 | 4H stacked-EMA trend rider L/S, 30-bar extreme entry | 2% | 3 | 2.5×ATR | 3×ATR trail from +1R, no time stop | 40% |

## Backfill reference (2026-04-16 -> 2026-06-10, INFORMATIONAL ONLY)

| Strategy | Closed | Realized |
|---|---|---|
| Snapback L/S v1 | 67 | +618.90 |
| Snapback Turbo | 59 | +1,192.17 |
| Afterburner v1 | 29 | +675.71 |
| Fader v1 | 80 | −238.06 |
| Gap Snap v1 | 49 | +67.88 |
| Crypto Pulse L/S v1 | 43 | +365.44 |
| Crypto Drift v1 | 21 | +1,691.60 |

These are hypotheses entering forward paper today, not realized contest
gains. Contest equity for every row starts at $0 on 2026-06-10.

## Regeneration

`python -m fable_engine.generate` (run from `C:\trading\Fable`, AFTER the
existing Stock Nightly refreshes the shared caches). Runner:
`C:\trading\Fable\run-fable-nightly.bat`.

## Recovery rules

Amber at 90% of killswitch DD -> review; at 100% -> PAUSE the row and post a
post-mortem note in this spec before any restart. A strategy that bleeds for
90 days under its killswitch gets archived per COMPETITION.md.
