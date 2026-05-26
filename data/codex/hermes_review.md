# Hermes review

- generated_at: 2026-05-26T13:32:37Z
- mode: review_only
- hypotheses_seen: 9
- new_hypotheses: 9
- safety: No strategy state was changed.

## New hypotheses

### CODEX Aggro Foundry - target_pct

- source: memory/overnight_foundry_report.md
- current_signal: aggro_bank_stop_pct_1.10: return -34.04%, max DD 41.57%, PF 0.11, trades 257, windows 3
- proposed_change: Reduce target_pct by one notch and re-run the same paper window.
- expected_effect: Lower drawdown while measuring whether profit factor recovers.
- status: proposed

### CODEX Apex WFO Foundry - risk_per_trade

- source: memory/overnight_foundry_report.md
- current_signal: apex_bank_risk_vol_multiplier_0.90: return -2.37%, max DD 3.39%, PF 0.00, trades 3, windows 3
- proposed_change: Reduce risk_per_trade by one notch and re-run the same paper window.
- expected_effect: Lower volatility while preserving enough trades for evaluation.
- status: proposed

### CODEX Crypto Vol Breakout Foundry - entry_filter

- source: memory/overnight_foundry_report.md
- current_signal: crypto_vol_bank_max_compression_pct_0.90: return 0.78%, max DD 0.10%, PF 20.50, trades 3, windows 3
- proposed_change: Add one stricter entry_filter condition and re-run the same paper window.
- expected_effect: Improve profit factor while monitoring sample-size reduction.
- status: proposed

### CODEX Donchian IQR Foundry - entry_filter

- source: memory/overnight_foundry_report.md
- current_signal: donchian_iqr_bank_r0.77_q0.93: return -1.79%, max DD 2.33%, PF 0.00, trades 6, windows 3
- proposed_change: Add one stricter entry_filter condition and re-run the same paper window.
- expected_effect: Improve profit factor while monitoring sample-size reduction.
- status: proposed

### CODEX Equities Breakout Foundry - entry_filter

- source: memory/overnight_foundry_report.md
- current_signal: eq_break_l40_c0.75_s0.040: return 0.03%, max DD 3.04%, PF 0.04, trades 12, windows 3
- proposed_change: Add one stricter entry_filter condition and re-run the same paper window.
- expected_effect: Improve profit factor while monitoring sample-size reduction.
- status: proposed

### CODEX Equities Mean Reversion Foundry - entry_filter

- source: memory/overnight_foundry_report.md
- current_signal: eq_mr_bank_deviation_threshold_1.10: return 4.37%, max DD 2.46%, PF 2.57, trades 20, windows 3
- proposed_change: Add one stricter entry_filter condition and re-run the same paper window.
- expected_effect: Improve profit factor while monitoring sample-size reduction.
- status: proposed

### CODEX Pulse Foundry - entry_filter

- source: memory/overnight_foundry_report.md
- current_signal: pulse_t0.009_s0.022_p0.028: return -6.96%, max DD 10.26%, PF 0.53, trades 216, windows 3
- proposed_change: Add one stricter entry_filter condition and re-run the same paper window.
- expected_effect: Improve profit factor while monitoring sample-size reduction.
- status: proposed

### CODEX Pulse Session Foundry - entry_filter

- source: memory/overnight_foundry_report.md
- current_signal: pulse_session_bank_momentum_threshold_1.10: return -0.70%, max DD 3.14%, PF 0.17, trades 38, windows 3
- proposed_change: Add one stricter entry_filter condition and re-run the same paper window.
- expected_effect: Improve profit factor while monitoring sample-size reduction.
- status: proposed

### CODEX Regime WFO Foundry - entry_filter

- source: memory/overnight_foundry_report.md
- current_signal: regime_bank_vol_skip_threshold_0.90: return -3.42%, max DD 5.32%, PF 0.00, trades 17, windows 3
- proposed_change: Add one stricter entry_filter condition and re-run the same paper window.
- expected_effect: Improve profit factor while monitoring sample-size reduction.
- status: proposed
