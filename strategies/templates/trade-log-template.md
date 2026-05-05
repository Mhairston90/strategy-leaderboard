# <Your Strategy> — Trade Log

> **Append-only. Source of truth.** `<your-strategy>_portfolio.md` is rebuilt from this file.
> Each row = one trade event (OPEN or CLOSE). Partial closes are CLOSE rows with smaller `Size`.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|

## Entries

| 2026-05-01T14:00:00Z | OPEN  | BTC/USD | long | 0.012 | 78400.5 | 77900.0 | — | — | — | breakout-strong-close |
| 2026-05-02T09:00:00Z | CLOSE | BTC/USD | long | 0.012 | 79220.3 | — | — | +1.64 | +9.84 | exit-trail |

<!--
Field notes:
- Timestamp: ISO-8601 UTC, T separator, Z suffix
- Event: OPEN or CLOSE only
- Pair: format consistently (BTC/USD or BTCUSD; the adapter doesn't care, but be consistent)
- Side: long or short
- Size: position size in base-asset units (e.g., 0.012 BTC), positive number
- Price: fill price; for OPEN this is entry, for CLOSE this is exit
- Stop: initial stop on OPEN, blank on CLOSE
- Target: leave as — unless you use a fixed take-profit
- R at exit: signed R-multiple = (exit − entry) / (entry − stop). Required on CLOSE.
- Realized PnL: signed dollars (or virtual currency). Required on CLOSE.
- Reason tag: terse, stable across trades. Examples:
    breakout-strong-close, exit-stop-hit, exit-partial, exit-trail, exit-time, exit-manual
-->
