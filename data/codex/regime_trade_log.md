# CODEX Regime v0 Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries

| 2026-05-05T16:00:00Z | OPEN | LINK/USD | long | 257.224216 | 9.7191 | 9.3790 | 10.4335 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-05-05T16:00:00Z | OPEN | AVAX/USD | long | 265.824535 | 9.4047 | 9.0755 | 10.0959 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-05-06T16:00:00Z | OPEN | SOL/USD | long | 28.411995 | 89.2046 | 86.0824 | 95.7611 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-05-10T12:00:00Z | CLOSE | LINK/USD | long | 257.224216 | 10.5921 | - | - | +2.41 | +210.97 | target-hit | regime_trend |
| 2026-05-10T12:00:00Z | CLOSE | AVAX/USD | long | 265.824535 | 10.0600 | - | - | +1.84 | +160.74 | time-stop | regime_trend |
| 2026-05-10T12:00:00Z | CLOSE | SOL/USD | long | 28.411995 | 93.8400 | - | - | +1.33 | +118.18 | time-stop | regime_trend |
| 2026-05-10T12:00:00Z | OPEN | SOL/USD | long | 27.968424 | 93.8869 | 90.6009 | 100.7876 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-05-10T12:00:00Z | OPEN | AVAX/USD | long | 260.890349 | 10.0650 | 9.7128 | 10.8048 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-05-10T12:00:00Z | OPEN | LTC/USD | long | 42.928803 | 58.8694 | 56.8090 | 63.1963 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-05-12T16:00:00Z | CLOSE | SOL/USD | long | 27.968424 | 94.0800 | - | - | -0.09 | -8.27 | time-stop | regime_trend |
| 2026-05-12T16:00:00Z | CLOSE | AVAX/USD | long | 260.890349 | 9.7300 | - | - | -1.10 | -100.83 | time-stop | regime_trend |
| 2026-05-12T16:00:00Z | CLOSE | LTC/USD | long | 42.928803 | 57.2800 | - | - | -0.92 | -81.20 | time-stop | regime_trend |
| 2026-05-26T12:00:00Z | OPEN | AVAX/USD | long | 272.917359 | 9.4347 | 9.1045 | 10.1282 | - | - | regime_vol_scaled_trend | regime_trend |
| 2026-05-28T14:14:43Z | CLOSE | AVAX/USD | long | 272.917359 | 9.1700 | - | - | -0.95 | -85.44 | time-stop | regime_trend |