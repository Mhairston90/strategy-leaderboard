# Backtest vs Paper Parity Audit

> Generated: 2026-05-16T13:36:30.710Z

| Strategy | BT ret | Paper ret | Delta | BT trades | Paper trades | BT DD | Paper DD | Explanation |
|---|---|---|---|---|---|---|---|---|
| CODEX v0 | +6.87% | -0.20% | -7.07pp | 6 | 1 | 0.00% | 0.20% | paper trade volume 1/6 (17% of backtest) — paper under-sampling signal; direction mismatch: BT +6.87% vs paper -0.20% |
| CODEX Aggro v0 | -11.45% | -0.43% | +11.02pp | 11 | 1 | 11.45% | 0.43% | paper trade volume 1/11 (9% of backtest) — paper under-sampling signal |
| CODEX Apex v0 | -12.19% | -1.23% | +10.96pp | 19 | 2 | 12.19% | 1.23% | paper trade volume 2/19 (11% of backtest) — paper under-sampling signal |
| CODEX Apex WFO v1 | -12.19% | -1.23% | +10.96pp | 19 | 2 | 12.19% | 1.23% | paper trade volume 2/19 (11% of backtest) — paper under-sampling signal |
| CODEX Pulse v0 | -15.69% | +0.02% | +15.70pp | 153 | 4 | 15.69% | 0.00% | paper trade volume 4/153 (3% of backtest) — paper under-sampling signal; direction mismatch: BT -15.69% vs paper +0.02% |
| CODEX Regime v0 | -8.10% | +3.00% | +11.10pp | 16 | 6 | 8.10% | 0.00% | direction mismatch: BT -8.10% vs paper +3.00% |
| CODEX Regime WFO v1 | -8.10% | +3.00% | +11.10pp | 16 | 6 | 8.10% | 0.00% | direction mismatch: BT -8.10% vs paper +3.00% |
| CODEX Equities Breakout Runner v1 | +11.77% | 0.00% | -11.77pp | 14 | 0 | 0.00% | 0.00% | paper has 0 closed trades vs backtest 14 — signal not firing in live data |
| CODEX Equities Gap Fade v0 | -1.61% | -3.70% | -2.09pp | 26 | 2 | 1.61% | 3.70% | paper trade volume 2/26 (8% of backtest) — paper under-sampling signal |
| CODEX Equities Regime Hedge v1 | n/a | +0.67% | n/a | n/a | 1 | n/a | 0.00% | incomplete data (backtest or paper file missing) |

## Notes

- **BT ret** = `(current_equity - starting_equity) / starting_equity` from `data/codex/backtests/*_4w_portfolio.md`
- **Paper ret** = same metric from `data/codex/*.md` (live paper rotation)
- **Delta** = paper - backtest (positive = paper outperformed BT)
- **Trades** = sum of `Closed trades` across non-cash sleeves
- Backtest period is the 4-week window per the BT file; paper period is whatever has accumulated since spec freeze (typically 1-2 weeks at this point)
- Heuristic flags only; not statistical significance tests

## Orphan backtests (no paper counterpart yet)

- `donchian_ensemble_4w_portfolio.md` -> -6.17% return, 21 trades, DD 6.17%
- `donchian_iqr_4w_portfolio.md` -> -2.91% return, 15 trades, DD 2.91%
- `equities_gap_v1_4w_portfolio.md` -> -0.73% return, 3 trades, DD 0.73%
- `equities_orb_4w_portfolio.md` -> -3.77% return, 44 trades, DD 3.77%
- `equities_rs_4w_portfolio.md` -> +0.18% return, 7 trades, DD 0.00%