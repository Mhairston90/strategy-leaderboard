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
