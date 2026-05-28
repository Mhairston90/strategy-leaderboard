# CODEX Markov Gate v1 - Design Spec

**Status:** PAPER
**Spec freeze:** 2026-05-26
**Paper trading start:** 2026-05-26
**Author:** Codex
**Repo:** strategy-leaderboard
**Adapter:** `adapters/adapter_codex.js`

---

## 1. Edge Thesis

The video's Markov method is most robust as a risk gate rather than a standalone predictor. Existing CODEX systems already express concrete edges; this strategy tests whether a probability-based regime filter improves realized quality by allowing risk only when the market's next-state odds support the parent setup.

## 2. Universe

Gate applies only to crypto CODEX candidates in v1:

- BTC/USD
- ETH/USD
- SOL/USD
- AVAX/USD
- LINK/USD
- LTC/USD
- DOGE/USD
- XRP/USD

It does not gate equities rows in v1.

## 3. Timeframe & Direction

- **Bars:** 1D Markov regime decision overlaid on parent strategy signals.
- **Direction:** follows the parent strategy direction, but v1 only records accepted spot-style long trades.

## 4. Entry Rules

Parent candidates are evaluated by the same Markov regime model used in `CODEX Markov Directional v1`:

```text
20d_return = close[t] / close[t-20] - 1
state = bull if 20d_return >= +5%
state = bear if 20d_return <= -5%
state = sideways otherwise
signal = P(next=bull) - P(next=bear)
```

Allow a parent long candidate when:

- `signal >= +0.10`
- `P(next=bear) <= 0.40`
- current state is not `bear`, unless the parent strategy is explicitly mean-reversion and `signal > 0`
- stationary bull probability is not below 20%

Block or reduce a parent long candidate when:

- `signal < -0.05`
- `P(next=bear) > P(next=bull)`
- 5-step forecast has already collapsed within 0.05 of the stationary distribution, indicating low directional information

## 5. Exit Rules

The parent strategy owns stops and targets. The Markov gate can force an early de-risk exit when:

- current position signal falls below `-0.10`
- `P(next=bear) >= 0.50`
- current state changes from `bull` to `bear`

Forced exits are logged with reason tag `markov-regime-de-risk`.

## 6. Position Sizing

```text
parent_size = size proposed by parent strategy
gate_multiplier =
  1.00 when signal >= +0.25
  0.50 when +0.10 <= signal < +0.25
  0.00 when signal < +0.10
final_size = parent_size * gate_multiplier
```

## 7. Risk Controls

- Max concurrent gate-approved positions: 4.
- Max one asset exposure: 25% of equity.
- Max gross exposure: 60% of equity.
- No pyramiding.
- Daily loss circuit: pause new entries after -2% starting-day equity.
- Weekly review gate: kill if the gate-approved paper row has lower PF than the ungated parent cohort after 20 closed trades.

## 8. Capital

- Starting virtual capital: **$10,000**
- Currency: USD

## 9. Kill Switch

- Max DD threshold: **20%**
- Rationale: this row is a filter/allocator overlay, so it should reduce risk; if it draws down more than 20%, it has failed its purpose.

## 10. Expected Behavior

| Metric | Expected range |
|---|---|
| Trades per week | 0-5 |
| Win rate | 42-60% |
| Avg winner / avg loser | 1.2-2.2 |
| Profit factor | 1.1-2.0 |
| 6-week max DD | 5-16% |

## 11. Validation

The Markov engine is covered by deterministic unit tests and walk-forward no-lookahead checks. This strategy launches with an empty forward log; it will not import historical parent trades or retroactively relabel them as gate-approved.

## 12. Known Limitations

- It can over-filter the best rebound trades after panic regimes.
- It depends on clean daily close data; stale candles can produce stale gate decisions.
- It may duplicate exposure logic already present in `CODEX Regime` and `CODEX Regime WFO`.
- Parent strategy comparison is required before claiming it improves edge.

## 13. Out Of Scope

- Gating equities strategies.
- HMM consensus gating.
- Changing or deleting existing parent strategy logs.
- Backfilling old CODEX trades as if this gate existed before 2026-05-26.
