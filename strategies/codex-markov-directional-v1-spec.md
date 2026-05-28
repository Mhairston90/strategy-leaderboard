# CODEX Markov Directional v1 - Design Spec

**Status:** PAPER
**Spec freeze:** 2026-05-26
**Paper trading start:** 2026-05-26
**Author:** Codex
**Repo:** strategy-leaderboard
**Adapter:** `adapters/adapter_codex.js`

---

## 1. Edge thesis

Markets cluster into persistent regimes more often than a memoryless random walk would imply. This strategy converts trailing return regimes into a 3-state Markov transition matrix and trades only when the next-regime probability spread is large enough to justify risk. It is intentionally simple: the edge being tested is regime persistence, not indicator stacking.

## 2. Universe

Frozen crypto universe:

- BTC/USD
- ETH/USD
- SOL/USD
- AVAX/USD
- LINK/USD
- LTC/USD

No ad-hoc symbol substitutions in v1. A v2 may re-rank the universe by liquidity and realized spread.

## 3. Timeframe & Direction

- **Bars:** 1D decision bar from daily closes.
- **Direction:** long and cash in v1. A shorting variant requires a separate spec because the current local paper engine treats spot-style exposure as the default.

## 4. Entry Rules

Compute per-symbol regime labels:

```text
20d_return = close[t] / close[t-20] - 1
state = bull      if 20d_return >= +5%
state = bear      if 20d_return <= -5%
state = sideways  otherwise
```

For each symbol, fit a 3x3 transition matrix from historical state transitions using Laplace smoothing of `1`.

```text
forecast = one_step_probabilities(current_state)
signal = P(next=bull) - P(next=bear)
```

Open a long when:

- `signal >= +0.20`
- `P(next=bull) >= 0.45`
- current state is `bull` or `sideways`
- symbol is one of the top 3 signals in the frozen universe
- heat cap and per-asset cap are available

## 5. Exit Rules

- **Hard stop:** `entry - 1.5 * ATR(14)`.
- **Profit target:** `entry + 2.5R`.
- **Trailing stop:** after +1.5R, trail at `2 * ATR(14)` below highest daily close since entry.
- **Time stop:** close after 10 daily bars if signal falls below `+0.05`.
- **Regime stop:** close immediately when `signal <= -0.10`.

## 6. Position Sizing

```text
risk_per_trade = 0.75% * current_equity * clamp(abs(signal), 0.20, 0.60) / 0.60
position_size = risk_per_trade / (entry - stop)
```

Exposure is capped separately by the risk controls below.

## 7. Risk Controls

- Max concurrent positions: 3.
- Per-symbol pyramiding: no.
- Max one asset exposure: 30% of equity.
- Max gross exposure: 75% of equity.
- Daily loss circuit: pause new entries after -3% starting-day equity.
- Weekly review gate: pause if 10-trade rolling PF < 0.80 or drawdown > 20%.

## 8. Capital

- Starting virtual capital: **$10,000**
- Currency: USD

## 9. Kill Switch

- Max DD threshold: **30%**
- Rationale: the strategy is low-frequency and capped at three positions, but regime methods can fail hard during transition zones; 30% leaves room for forward sample while preventing unlimited drift.

## 10. Expected Behavior

| Metric | Expected range |
|---|---|
| Trades per week | 0-3 |
| Win rate | 38-55% |
| Avg winner / avg loser | 1.4-2.5 |
| Profit factor | 1.0-1.8 |
| 6-week max DD | 8-22% |

## 11. Validation

The implementation has unit coverage for the Markov regime engine in `lib/markov_regime.test.js`: labeling, transition fitting, n-step forecasts, stationary distribution, signed signal, and walk-forward no-lookahead behavior. No historical PnL is claimed at launch; the forward trade log starts empty on 2026-05-26.

## 12. Known Limitations

- The fixed +5%/-5% 20-day thresholds may be too blunt across assets with different volatility.
- Regime persistence can invert during macro shocks, producing late entries near exhaustion.
- The model ignores volume, funding, liquidity, and cross-asset contagion.
- Long-only v1 cannot directly monetize high-confidence bear forecasts.

## 13. Out Of Scope

- Hidden Markov Model inference.
- Short-side or perp-style execution.
- Adaptive threshold optimization.
- Rewriting existing CODEX strategies or their trade histories.
