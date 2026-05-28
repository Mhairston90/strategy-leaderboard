# CODEX Equities Connors MR v1 Spec

## Intent

Codex-owned forward-paper variant inspired by Claude's strongest diversified Stocks Mean Reversion v2, but implemented in the Codex runner with explicit cash/notional caps and no inherited backtest trades.

## Universe

Diversified eight-name basket: NVDA, OXY, JPM, LLY, CAT, FCX, NKE, DIS.

## Data

- Primary bars: Yahoo 60-minute equity candles.
- Runner range: 2y.
- Runner history retained: 1,800 candles.
- Daily trend gate: derived from the 60-minute candles by New York trading date.

## Entry

Long-only candidate when all gates pass:

- Symbol is in the eight-name diversified basket.
- RSI(2) on 60-minute closes is below 10.
- Prior completed daily EMA50 is above prior completed daily EMA200.
- Latest 60-minute close is above the prior completed daily EMA50.
- ATR(14) is valid.

Entry price uses the same small paper slippage convention as nearby CODEX equity strategies.

## Exit

- Stop: entry minus 2.0 * ATR(14).
- RSI take-profit: close when RSI(2) rises above 70.
- Time stop: close after 24 completed 60-minute bars if RSI take-profit has not fired.
- No fixed target.

## Risk

- Starting capital: $10,000.
- Risk budget: 0.50% equity per trade based on stop distance.
- Gross cap: 100% equity.
- Per-symbol cap: 25% equity.
- Open-position cap: 4.
- Cash cap: new opens cannot exceed available paper cash, preventing hidden leverage.

## Forward Start

Live leaderboard start: 2026-05-26T00:00:00Z. Initial snapshots are empty by design.
