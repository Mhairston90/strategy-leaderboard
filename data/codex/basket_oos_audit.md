# Basket Family — In-Sample vs Out-of-Sample Audit

> Generated: 2026-05-16T13:41:32.259Z

Splits each strategy's realized exits (CLOSE + PARTIAL events) 50/50 by timestamp. First half = in-sample (IS), second half = out-of-sample (OOS). A meaningful IS->OOS degradation indicates regime drift, overfit parameters, or genuine edge decay — distinct from a healthy strategy in a drawdown.

| Strategy | Exits | First→Last | IS PnL | OOS PnL | IS PF | OOS PF | IS win | OOS win | Drift |
|---|---|---|---|---|---|---|---|---|---|
| Basket Breakout Aggressive v1 (crypto) | 52 | 2026-04-16→2026-05-14 | $-1420.59 | +$116.52 | 0.43 | 1.09 | 30.8% | 65.4% | stable |
| Basket Breakout Aggressive v2 (crypto) | 27 | 2026-04-16→2026-05-13 | $-1410.05 | $-917.59 | 0.35 | 0.41 | 7.7% | 28.6% | stable |
| Basket Breakout Leveraged v1 (crypto) | 32 | 2026-04-16→2026-05-13 | $-2086.57 | $-216.06 | 0.30 | 0.85 | 18.8% | 56.3% | stable |
| Stocks Basket Breakout v1 | 14 | 2026-04-20→2026-05-15 | +$101.42 | $-332.58 | 1.97 | 0.01 | 71.4% | 14.3% | PF collapse; OOS turned negative; win-rate drop >15pp |
| Stocks Basket Breakout Aggressive v1 | 20 | 2026-04-20→2026-05-15 | $-66.86 | $-625.55 | 0.89 | 0.36 | 60.0% | 40.0% | PF halved; win-rate drop >15pp; OOS losses accelerating |
| Stocks Basket Breakout Aggressive v2 | 11 | 2026-04-20→2026-05-15 | +$1038.97 | $-1198.21 | 3.51 | 0.02 | 60.0% | 16.7% | PF collapse; OOS turned negative; win-rate drop >15pp |
| Stocks Basket Breakout Diversified v1 | 11 | 2026-04-20→2026-05-14 | $-258.26 | $-148.31 | 0.00 | 0.26 | 0.0% | 33.3% | stable |
| Stocks Mean Reversion v1 | 34 | 2026-04-20→2026-05-15 | +$81.75 | +$268.72 | 1.47 | 2.61 | 70.6% | 70.6% | stable |

## Notes

- **Exits** = total CLOSE and PARTIAL events in the trade log (PARTIAL exits realize some PnL on the partial-take)
- **IS / OOS** are equal halves by exit count, split at the median exit timestamp. Coarse OOS proxy; a proper walk-forward with multiple folds gives cleaner signal.
- **PnL** is sum of `Realized PnL` over the half's exits
- **PF** = win-sum / |loss-sum| over the half; `inf` if there are no losses
- **win** = fraction of exits with PnL > 0
- **Drift flags**: `PF collapse` (IS > 1.2 and OOS < 0.8), `PF halved` (OOS < IS * 0.5), `OOS turned negative` (IS positive, OOS negative), `win-rate drop >15pp`, `OOS losses accelerating` (both halves negative and OOS more negative)
- `sample too small` = either half has fewer than 5 exits — treat any flag as unreliable