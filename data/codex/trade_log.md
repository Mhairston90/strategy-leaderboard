# CODEX v0 Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Conventions

- Event vocabulary is `OPEN` and `CLOSE`.
- Hard-stop exits are `CLOSE` rows with reason tag `hard-stop-daily-loss`.
- Corrections use a `CLOSE` or `OPEN` row only when they represent a real correction, with reason tag `correction-previous-row`.
- Pair format is `BASE/USD`.
- Size is base asset units.
- Price, stop, and target are USD.
- `Realized PnL` is net of the configured fee model and slippage.
- Never rewrite old rows. Append a correction row with an explicit reason.

## Entries

| 2026-05-04T16:00:00Z | OPEN | BTC/USD | long | 0.043738 | 80021.5908 | 75220.2954 | 89624.1817 | - | - | trend_sma20_positive_30bar | trend |
| 2026-05-04T16:00:00Z | OPEN | ETH/USD | long | 0.211866 | 2359.9794 | 2218.3806 | 2643.1769 | - | - | trend_sma20_positive_30bar | trend |
| 2026-05-04T16:00:00Z | OPEN | ETH/USD | long | 1.271198 | 2359.9794 | 2241.9804 | 2595.9773 | - | - | relative_strength_best_positive_return | relative_strength |
| 2026-05-05T16:00:00Z | OPEN | SOL/USD | long | 11.459154 | 85.7729 | 80.6265 | 96.0656 | - | - | trend_sma20_positive_30bar | trend |
| 2026-05-10T12:00:00Z | OPEN | SOL/USD | long | 0.001640 | 93.8269 | 89.1355 | 103.2096 | - | - | relative_strength_best_positive_return | relative_strength |
| 2026-05-12T04:00:00Z | CLOSE | SOL/USD | long | 11.459154 | 96.1000 | - | - | +1.91 | +112.92 | target-hit | trend |
| 2026-05-17T08:00:00Z | CLOSE | ETH/USD | long | 0.211866 | 2186.2400 | - | - | -1.31 | -39.31 | stop-hit | trend |
| 2026-05-17T08:00:00Z | CLOSE | ETH/USD | long | 1.271198 | 2186.2400 | - | - | -1.57 | -235.88 | stop-hit | relative_strength |
| 2026-05-17T08:00:00Z | CLOSE | SOL/USD | long | 0.001640 | 86.7900 | - | - | -1.60 | -0.01 | stop-hit | relative_strength |
| 2026-05-17T08:00:00Z | OPEN | SOL/USD | long | 39.315114 | 86.8334 | 82.4917 | 95.5167 | - | - | relative_strength_best_positive_return | relative_strength |
| 2026-05-25T12:00:00Z | OPEN | SOL/USD | long | 0.106170 | 86.2031 | 81.0309 | 96.5474 | - | - | trend_sma20_positive_30bar | trend |
| 2026-05-27T16:00:00Z | CLOSE | BTC/USD | long | 0.043738 | 74901.4000 | - | - | -1.15 | -241.56 | stop-hit | trend |