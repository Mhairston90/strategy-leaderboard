# CODEX Champion/Challenger Report

> Generated: 2026-05-28T11:15:00Z
> Research-only: no live routing, trade logs, or optimizer configs were changed.
> Promotion candidates require human approval before any paper routing change.

## Summary

- Families reviewed: 9
- Promotion candidates: 0
- Watch: 0
- Refine: 5
- Reject: 4

## Champion Board

| Family key | Family | Decision | Latest challenger | Research champion | Score delta | OOS return | OOS max DD | OOS PF | OOS trades | Blockers |
|------------|--------|----------|-------------------|-------------------|-------------|------------|------------|--------|------------|----------|
| aggro | CODEX Aggro Foundry | refine | aggro_bank_move_threshold_0.90 | aggro_bank_move_threshold_0.90 | +1.00 | -27.47% | 39.63% | 0.11 | 214 | OOS PF below gate (0.11 < 1.20); OOS drawdown above gate (39.63% > 12.00%); OOS return is not positive (-27.47%) |
| apex_wfo | CODEX Apex WFO Foundry | reject | apex_bank_score_threshold_1.10 | apex_bank_ret6_weight_1.10 | -2.44 | -1.70% | 3.25% | 0.00 | 2 | OOS trades below gate (2 < 30); OOS PF below gate (0.00 < 1.20); OOS return is not positive (-1.70%); score delta -2.44 below 0.50 |
| crypto_vol_breakout | Crypto Vol Breakout | refine | crypto_vol_bank_min_breakout_pct_0.90 | crypto_vol_bank_max_compression_pct_0.90 | -0.06 | 0.73% | 0.19% | 7.37 | 4 | OOS trades below gate (4 < 30); score delta -0.06 below 0.50 |
| donchian_iqr | CODEX Donchian IQR Foundry | reject | donchian_iqr_bank_r0.62_q1.13 | donchian_iqr_bank_r1.17_q0.95 | -0.17 | -0.53% | 1.77% | 0.00 | 6 | OOS trades below gate (6 < 30); OOS PF below gate (0.00 < 1.20); OOS return is not positive (-0.53%); score delta -0.17 below 0.50 |
| equities_breakout | CODEX Equities Breakout Foundry | refine | eq_break_l30_c0.75_s0.055 | eq_break_l20_c0.55_s0.040 | -2.34 | 4.78% | 5.02% | 0.83 | 23 | OOS trades below gate (23 < 30); OOS PF below gate (0.83 < 1.20); score delta -2.34 below 0.50 |
| equities_mean_reversion | CODEX Equities Mean Reversion Foundry | refine | eq_mr_refine_cryptoproxy_late_s0.030_t0.040 | eq_mr_bank_deviation_threshold_1.10 | -1.58 | 2.10% | 0.89% | 3.24 | 7 | OOS trades below gate (7 < 30); score delta -1.58 below 0.50 |
| pulse | CODEX Pulse Foundry | reject | pulse_t0.009_s0.028_p0.028 | pulse_bank_momentum_threshold_1.10 | -4.56 | -9.86% | 12.34% | 0.39 | 213 | OOS PF below gate (0.39 < 1.20); OOS return is not positive (-9.86%); score delta -4.56 below 0.50 |
| pulse_session | Pulse Session | reject | pulse_session_t0.009_h20-24_p0.040 | pulse_session_bank_momentum_threshold_1.10 | -2.47 | -0.81% | 5.43% | 0.14 | 47 | OOS PF below gate (0.14 < 1.20); OOS return is not positive (-0.81%); score delta -2.47 below 0.50 |
| regime_wfo | CODEX Regime WFO Foundry | refine | regime_bank_vol_skip_threshold_0.90 | regime_bank_vol_skip_threshold_0.90 | +1.46 | -2.13% | 4.98% | 0.08 | 16 | OOS trades below gate (16 < 30); OOS PF below gate (0.08 < 1.20); OOS return is not positive (-2.13%) |

## Guardrails

- Research-only: no live routing, trade logs, or optimizer configs were changed.
- This loop only reads research, goal, Hermes, and forensic memory.
- It does not write optimized strategy configs, trade logs, portfolios, or live routing.
- A `promotion-candidate` means review next; it is not an automatic deployment.
