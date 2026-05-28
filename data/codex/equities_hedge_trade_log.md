# CODEX Equities Regime Hedge v1 Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries

| 2026-05-06T18:58:51Z | OPEN | QQQ | long | 4.321844 | 694.1482 | 676.1003 | 723.3024 | - | - | equities_regime_hedge_long_qqq | equities_regime_hedge |
| 2026-05-11T20:00:00Z | CLOSE | QQQ | long | 4.321844 | 713.2900 | - | - | +0.86 | +66.91 | time-stop | equities_regime_hedge |
| 2026-05-27T18:30:00Z | OPEN | QQQ | long | 4.139940 | 729.4968 | 710.5299 | 760.1357 | - | - | equities_regime_hedge_long_qqq | equities_regime_hedge |