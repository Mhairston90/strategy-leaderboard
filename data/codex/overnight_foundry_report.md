# CODEX Overnight Strategy Foundry Report

> Generated: 2026-05-28T11:14:00Z
> Review-only: no live routing or WFO config was changed.
> The variant bank may influence future research runs, not live allocation.

## Summary

| Strategy family | Decision | Best variant | OOS return | OOS max DD | OOS PF | OOS trades | Variants tested | Walk-forward windows | Data source |
|-----------------|----------|--------------|------------|------------|--------|------------|-----------------|----------------------|-------------|
| CODEX Regime WFO Foundry | REJECTED | regime_bank_vol_skip_threshold_0.90 | -2.13% | 4.98% | 0.08 | 16 | 33 | 3 | cache |
| CODEX Apex WFO Foundry | REJECTED | apex_bank_score_threshold_1.10 | -1.70% | 3.25% | 0.00 | 2 | 33 | 3 | cache |
| CODEX Donchian IQR Foundry | REJECTED | donchian_iqr_bank_r0.62_q1.13 | -0.53% | 1.77% | 0.00 | 6 | 58 | 3 | cache |
| CODEX Crypto Vol Breakout Foundry | REJECTED | crypto_vol_bank_min_breakout_pct_0.90 | 0.73% | 0.19% | 7.37 | 4 | 28 | 3 | cache |
| CODEX Pulse Foundry | REJECTED | pulse_t0.009_s0.028_p0.028 | -9.86% | 12.34% | 0.39 | 213 | 33 | 3 | cache |
| CODEX Pulse Session Foundry | REJECTED | pulse_session_t0.009_h20-24_p0.040 | -0.81% | 5.43% | 0.14 | 47 | 34 | 3 | cache |
| CODEX Aggro Foundry | REJECTED | aggro_bank_move_threshold_0.90 | -27.47% | 39.63% | 0.11 | 214 | 33 | 3 | cache |
| CODEX Equities Breakout Foundry | REJECTED | eq_break_l30_c0.75_s0.055 | 4.78% | 5.02% | 0.83 | 23 | 33 | 3 | cache |
| CODEX Equities Mean Reversion Foundry | REVIEW | eq_mr_refine_cryptoproxy_late_s0.030_t0.040 | 2.10% | 0.89% | 3.24 | 7 | 68 | 3 | cache |

## Details

### CODEX Regime WFO Foundry

- Baseline: regime_default, -5.41% return, 15.80% max DD, PF 0.22, 42 trades.
- Best candidate params: `{"confidence_base": 0.55, "entry_slippage": 1.0005, "risk_max": 0.09, "risk_min": 0.035, "risk_vol_multiplier": 2.88, "target_r": 2.1, "trend_threshold": 0.159441, "vol_skip_threshold": 0.016741}`.
- Decision notes: profit factor below gate (0.08 < 1.00); meets min trades; beats baseline return; drawdown inside limit; score improves.

### CODEX Apex WFO Foundry

- Baseline: apex_default, -27.97% return, 48.21% max DD, PF 0.09, 149 trades.
- Best candidate params: `{"btc_weak_threshold": -0.05, "confidence_base": 0.6, "long_entry_slippage": 1.0007, "ret18_weight": 0.558955, "ret6_weight": 0.441045, "risk_max": 0.075, "risk_min": 0.03, "risk_vol_multiplier": 1.6038, "score_threshold": 0.09646, "short_entry_slippage": 0.9993, "target_r": 2.0}`.
- Decision notes: below min trades (2 < 5); profit factor below gate (0.00 < 1.00); beats baseline return; drawdown inside limit; score improves.

### CODEX Donchian IQR Foundry

- Baseline: donchian_iqr_default, -1.25% return, 4.96% max DD, PF 0.00, 22 trades.
- Best candidate params: `{"confidence_base": 0.55, "entry_slippage": 1.0005, "iqr_history": 60, "iqr_lookback": 20, "iqr_multiplier": 1.1298, "lookbacks": [20, 40, 80], "max_candidates": 4, "min_breakouts": 3, "risk_max": 0.09, "risk_min": 0.035, "risk_vol_multiplier": 0.6215, "target_r": 2.0, "use_iqr_brake": true}`.
- Decision notes: profit factor below gate (0.00 < 1.00); meets min trades; beats baseline return; drawdown inside limit; score improves.

### CODEX Crypto Vol Breakout Foundry

- Baseline: crypto_vol_breakout_default, -6.64% return, 8.87% max DD, PF 0.06, 68 trades.
- Best candidate params: `{"channel_lookback": 22, "compression_lookback": 12, "confidence_base": 0.57, "long_entry_slippage": 1.0005, "max_compression_pct": 0.014616, "min_breakout_pct": 0.0054, "short_entry_slippage": 0.9995, "stop_pct": 0.0315, "target_r": 1.7}`.
- Decision notes: below min trades (4 < 6); beats baseline return; drawdown inside limit; profit factor passes; score improves.

### CODEX Pulse Foundry

- Baseline: pulse_default, -13.98% return, 22.20% max DD, PF 0.26, 244 trades.
- Best candidate params: `{"average_period": 8, "long_entry_slippage": 1.0004, "momentum_lookback": 4, "momentum_threshold": 0.009, "short_entry_slippage": 0.9996, "stop_pct": 0.028, "target_pct": 0.028}`.
- Decision notes: profit factor below gate (0.39 < 1.00); meets min trades; beats baseline return; drawdown inside limit; score improves.

### CODEX Pulse Session Foundry

- Baseline: pulse_session_default, -4.57% return, 7.47% max DD, PF 0.31, 112 trades.
- Best candidate params: `{"allowed_end_hour": 24, "allowed_start_hour": 20, "average_period": 8, "long_entry_slippage": 1.0004, "max_range_pct": 0.055, "min_range_pct": 0.002, "momentum_lookback": 4, "momentum_threshold": 0.009, "range_lookback": 8, "short_entry_slippage": 0.9996, "stop_pct": 0.02, "target_pct": 0.04}`.
- Decision notes: profit factor below gate (0.14 < 1.00); meets min trades; beats baseline return; drawdown inside limit; score improves.

### CODEX Aggro Foundry

- Baseline: aggro_default, -46.72% return, 69.98% max DD, PF 0.06, 326 trades.
- Best candidate params: `{"channel_lookback": 12, "long_entry_slippage": 1.0005, "move_lookback": 7, "move_threshold": 0.085945, "short_entry_slippage": 0.9995, "stop_pct": 0.040095, "target_pct": 0.0495}`.
- Decision notes: drawdown above limit (39.63% > 12.00%); profit factor below gate (0.11 < 1.00); meets min trades; beats baseline return; score improves.

### CODEX Equities Breakout Foundry

- Baseline: equities_breakout_default, 2.31% return, 4.62% max DD, PF 1.03, 26 trades.
- Best candidate params: `{"entry_slippage": 1.0004, "lookback": 30, "stop_pct": 0.055, "strong_close_min": 0.75}`.
- Decision notes: profit factor below gate (0.83 < 1.03); meets min trades; beats baseline return; drawdown inside limit; score improves.

### CODEX Equities Mean Reversion Foundry

- Baseline: equities_mean_reversion_default, 1.91% return, 2.72% max DD, PF 1.20, 15 trades.
- Best candidate params: `{"allowed_end_hour": 21, "allowed_start_hour": 18, "allowed_symbols": ["COIN", "MSTR", "HOOD"], "confidence_base": 0.56, "deviation_threshold": 0.02, "entry_slippage": 1.0004, "max_entry_range_pct": 0.045, "mean_lookback": 30, "min_close_quality": 0.62, "rebound_threshold": 0.003, "stop_pct": 0.03, "target_pct": 0.04}`.
- Decision notes: meets min trades; beats baseline return; drawdown inside limit; profit factor passes; score improves.

