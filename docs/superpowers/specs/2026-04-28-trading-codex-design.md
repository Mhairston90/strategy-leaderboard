# Trading Codex Design

Date: 2026-04-28
Status: approved for planning

## Goal

Create `trading-codex`, a separate paper-trading agent repo that competes with BULL in crypto. The scoring goal is ending account equity: who makes the most paper money.

`trading-codex` should appear on the existing Strategy Leaderboard as `CODEX v0`, with leaderboard metrics computed from local markdown state files that match the BULL-compatible portfolio and trade-log shape.

The system is paper-only. It may research crypto markets, simulate entries and exits, update local markdown state, and export sanitized snapshots to the leaderboard. It must not place real exchange orders, use real account credentials, execute financial transactions, or manage real money.

## Scope

In scope for v0:

- New repo at `C:\Users\Mhair\OneDrive\Desktop\trading-codex`.
- Local paper account starting at `$10,000`.
- Crypto-only trading universe.
- Tournament manager that allocates capital among multiple internal strategy sleeves.
- Markdown state files compatible with the leaderboard.
- Executable validation and rebuild scripts from day one.
- Strategy Leaderboard integration via a new `CODEX v0` row.

Out of scope for v0:

- Real exchange execution.
- Exchange credential storage.
- Leverage, margin, perps, options, or lending.
- Autonomous deletion or modification of BULL files.
- Telegram sending unless explicitly added later.
- A browser UI inside `trading-codex`; the existing Strategy Leaderboard is the visual surface.

## Repositories

### `trading-codex`

Owns the agent, strategy logic, and paper state.

Planned layout:

```text
trading-codex/
  README.md
  CODEX.md
  memory/
    guardrails.md
    portfolio.md
    trade_log.md
    research_log.md
    strategy.md
    sleeve_scores.md
  routines/
    01-market-scan.md
    02-risk-check.md
    03-eod.md
    04-tournament-review.md
  scripts/
    market_data.py
    rebuild_portfolio.py
    validate_state.py
    export_leaderboard.py
  strategies/
    trend.py
    breakout.py
    mean_revert.py
    relative_strength.py
    cash_defense.py
    common.py
  tests/
    test_rebuild_portfolio.py
    test_validate_state.py
    test_sleeves.py
    test_export_leaderboard.py
```

### `strategy-leaderboard`

Owns the scoreboard.

Planned additions:

```text
strategy-leaderboard/
  adapters/
    adapter_codex.js
  data/
    codex/
      portfolio.md
      trade_log.md
  fixtures/
    codex-portfolio.md
    codex-trade-log.md
```

The local export path is intentional for v0. The existing leaderboard is served by a local Python HTTP server, so it can reliably fetch files inside its own directory. `trading-codex/scripts/export_leaderboard.py` will copy sanitized markdown snapshots into `strategy-leaderboard/data/codex/`.

If `trading-codex` later gets a GitHub remote, the leaderboard can switch from local exported snapshots to GitHub raw URLs without changing the markdown schema.

## Account Model

`CODEX v0` starts with `$10,000` paper equity.

The account is one combined portfolio, internally allocated across strategy sleeves. The leaderboard sees only the combined account.

V0 account constraints:

- Crypto spot-style paper positions only.
- No simulated leverage.
- Max 100% gross exposure.
- Max 35% of equity in one asset.
- Max 60% of equity assigned to one sleeve.
- Daily hard stop: if equity drops 8% from the prior day close, close all paper positions and freeze new entries until the next UTC day.
- All fills use a conservative slippage and fee model recorded in `memory/strategy.md`.

These constraints are intentionally looser than BULL on strategy style but still prevent the contest from becoming a pure notional-sizing trick.

## Tournament Sleeves

Each sleeve proposes candidate trades. A shared allocator chooses which candidates receive capital.

### `trend`

Purpose: follow broad crypto momentum when market breadth is favorable.

Typical signals:

- Asset above medium and long moving averages.
- Positive multi-timeframe momentum.
- BTC and ETH not both in strong risk-off state.

### `breakout`

Purpose: capture volatility expansion and fresh highs.

Typical signals:

- New range breakout.
- Volume or volatility expansion.
- Stop placed below breakout base or volatility band.

### `mean_revert`

Purpose: buy sharp overreactions when downside appears exhausted.

Typical signals:

- Large short-window drop.
- Oversold oscillator or stretched distance from moving average.
- Reversal confirmation before entry.

### `relative_strength`

Purpose: rotate toward assets outperforming BTC and ETH.

Typical signals:

- Strong rank versus the universe over recent windows.
- Positive absolute momentum.
- Avoid assets with low liquidity or high spread risk.

### `cash_defense`

Purpose: protect capital when other sleeves are performing poorly.

Behavior:

- Produces no risk trades.
- Receives capital allocation when drawdown, hit rate, or breadth deteriorates.
- Lets the combined account remain partially or fully in cash.

## Allocator

The allocator scores each sleeve using recent evidence:

- Realized PnL.
- Average R.
- Hit rate.
- Current drawdown.
- Recency-weighted performance.
- Correlation with other open positions.

The allocator then assigns capital subject to account constraints. A sleeve that loses money or increases drawdown loses allocation. A sleeve that performs well earns more allocation, capped at 60% of equity.

V0 allocation rule:

- Start equal-weight across active risk sleeves, with at least 20% reserved for cash defense until 20 closed trades exist.
- After 20 closed trades, use score-weighted allocation.
- Recompute sleeve allocations after every rebuild.
- Never allocate to a sleeve with negative score if cash defense is available.

## Data Flow

V0 market data comes from public Kraken spot endpoints through `scripts/market_data.py`, with no credentials. If Kraken public data is unavailable, routines freeze new entries, manage existing paper exits from the latest known prices only when safe, and log the degraded state in `memory/research_log.md`.

Each routine run follows this sequence:

1. Rebuild account state from `memory/trade_log.md` using `scripts/rebuild_portfolio.py`.
2. Validate state with `scripts/validate_state.py`.
3. Read public Kraken market data through `scripts/market_data.py`.
4. Let each sleeve produce candidate entries and exits.
5. Run candidates through the shared allocator and guardrails.
6. Append paper trade events to `memory/trade_log.md`.
7. Rebuild `memory/portfolio.md` from the trade log.
8. Validate state again.
9. Export sanitized snapshots to `strategy-leaderboard/data/codex/`.

`memory/portfolio.md` is derived state. `memory/trade_log.md` is the source of truth.

## Trade Log Schema

Use the same table shape as BULL so the leaderboard can parse it with a near-identical adapter.

Columns:

1. Timestamp UTC ISO 8601.
2. Event: `OPEN` or `CLOSE`.
3. Pair, such as `BTC/USD`.
4. Side: `long` in v0.
5. Size in base asset units.
6. Price in USD.
7. Stop, only on `OPEN`.
8. Target, if known.
9. R at exit, only on `CLOSE`.
10. Realized PnL USD, only on `CLOSE`.
11. Reason tag.
12. Sleeve.

The extra `Sleeve` column is allowed in `trading-codex` state. The leaderboard adapter must parse the first 11 BULL-compatible columns and may use the sleeve column for future display or diagnostics.

## Portfolio Schema

`memory/portfolio.md` includes:

- Starting equity.
- Cash.
- Realized PnL.
- Unrealized PnL.
- Position values.
- Current equity.
- Equity peak.
- Drawdown from peak.
- Open positions table.
- Sleeve allocation table.
- Active guardrail state.

The file must identify that it is rebuilt from `trade_log.md` and include the rebuild timestamp.

## Validation

`scripts/validate_state.py` is mandatory before and after routine actions.

It checks:

- Trade log rows are chronological.
- Schema columns are present.
- No duplicate open positions in the same pair and sleeve unless explicitly allowed by strategy.
- Every close has a matching open.
- Realized PnL and R are mathematically consistent within rounding tolerance.
- Cash, equity, and open positions reconcile.
- Exposure limits are respected.
- Daily hard stop state is respected.
- Export files match current local state.

Validation failure blocks new entries and records the reason in `memory/research_log.md`.

## Leaderboard Integration

Add `CODEX v0` to the Strategy Leaderboard.

Implementation shape:

- Add `adapter_codex.js`, modeled after `adapter_bull.js`.
- Add a `codex-local` source type that fetches `data/codex/portfolio.md` and `data/codex/trade_log.md`.
- Add fixtures for tests.
- Add a registry entry:
  - name: `CODEX v0`
  - starting capital: `10000`
  - status: `live`
  - source: local exported markdown snapshots
- Extend adapter tests to include the Codex row.
- Extend smoke tests so missing Codex export files produce a visible error row instead of breaking the whole dashboard.

The row must use the same leaderboard metrics as BULL:

- 7d, 30d, 90d return.
- Sharpe.
- Profit factor.
- Max drawdown.
- Trades.
- Win percentage.
- Average R.
- Last signal time.

## Safety Boundary

`trading-codex` is a paper agent.

Allowed:

- Read local repo files.
- Read public crypto market data.
- Simulate paper trades.
- Update local markdown state.
- Export local leaderboard snapshots.
- Commit local changes when asked or when a routine requires it.

Not allowed:

- Place real trades.
- Use real exchange credentials.
- Move money.
- Create or manage exchange accounts.
- Execute transactions involving financial instruments.
- Store secrets in repo files.
- Modify BULL files as part of normal operation.

If real execution is ever requested, it is a separate project with a separate safety review. The agent will not execute financial transactions.

## Testing Plan

Unit tests:

- `rebuild_portfolio.py` replays open and close rows correctly.
- `validate_state.py` catches chronology errors, orphan closes, duplicate opens, bad PnL, and exposure violations.
- Each sleeve produces deterministic candidate decisions from synthetic candle data.
- Allocator respects sleeve, asset, and gross exposure caps.
- Export script copies sanitized markdown snapshots to the leaderboard data folder.

Integration tests:

- Replay a mini Codex trade log into a portfolio.
- Export snapshots.
- Run the Strategy Leaderboard adapter against the exported snapshots.
- Confirm `CODEX v0` appears with expected metrics.

Manual verification:

- Start the leaderboard local server.
- Confirm `CODEX v0` is visible.
- Confirm BULL remains visible and unchanged.
- Confirm dashboard sorting works with the added row.

## V0 Acceptance Criteria

V0 is ready when:

- `trading-codex` exists as a separate local repo.
- `validate_state.py` and `rebuild_portfolio.py` pass tests.
- At least one initial paper state exists with `$10,000` starting equity.
- `export_leaderboard.py` writes Codex snapshots into the leaderboard repo.
- Strategy Leaderboard shows `CODEX v0` next to BULL.
- Existing leaderboard tests pass.
- Codex adapter tests pass.
- No BULL files are modified.
- No real trading or credential integration exists.

## Implementation Order

1. Create `trading-codex` repo skeleton and state schema.
2. Implement rebuild and validation scripts with tests.
3. Implement initial sleeves and allocator with synthetic-data tests.
4. Implement export script.
5. Add Strategy Leaderboard adapter, registry entry, data path, fixtures, and tests.
6. Verify the local dashboard in browser.
7. Commit the completed implementation in logical commits.
