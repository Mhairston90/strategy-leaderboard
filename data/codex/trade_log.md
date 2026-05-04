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