# Trade Sentinel Design

Date: 2026-06-28
Status: approved for planning

## Goal

Create a Trade Sentinel application that turns the strategy leaderboard into one shared-equity paper trading system.

The sentinel will:

- Read the current Strategy Leaderboard evidence.
- Select and weight a core strategy group.
- Track promotion, demotion, cooldown, and retirement candidates.
- Generate trade tickets from approved strategies.
- Run every proposed trade through safety checks.
- Auto-submit approved tickets through Alpaca paper trading in the first version.
- Reconcile paper fills back into an auditable execution ledger.

The first implementation is paper-only. Live-money execution, account funding, margin, options, perps, and unattended live trading are out of scope.

## Product Shape

The sentinel is a separate application surface, not a replacement for the leaderboard.

The leaderboard remains the performance scoreboard. The sentinel becomes the command center that decides which strategies receive capital and whether any proposed order is allowed through.

The user-facing experience should feel like an execution desk:

- Clear account state at the top.
- Current strategy allocation visible at all times.
- Proposed trades queued briefly for audit, then auto-submitted when every risk check passes.
- Risk gate state shown in plain language.
- Promotion and demotion decisions explained with evidence.
- Every order and fill reconstructable from logs.

## Initial Strategy Pool

The first shared-equity pool uses the current recommended six-strategy mix:

| Weight | Strategy | Role |
| ---: | --- | --- |
| 22% | CODEX Regime Plus L/S v1 | Core return engine |
| 20% | Basket Breakout Aggressive v1 | Independent breakout sleeve |
| 18% | CODEX Aggro v0 | Proven sample, crypto momentum/short sleeve |
| 15% | CODEX Aggro Short Plus Quality v2 | Recent-strength quality sleeve |
| 15% | Stocks Mean Reversion v2 (RSI<15) | Equity mean-reversion stabilizer |
| 10% | FABLE Equities Fader v1 | Diversifier / defensive fade sleeve |

The sentinel stores these as target weights, not hard permanent commitments. Weights can change when the promotion engine sees enough evidence.

## Strategy Status Model

Every leaderboard strategy is assigned one status:

- `core`: receives normal allocation.
- `satellite`: receives small capped allocation.
- `watch`: promising but not enough evidence.
- `cooldown`: recently degraded or risk-limited.
- `blocked`: data, stale signal, parsing, or risk issue.
- `retired`: no longer eligible unless manually restored.

Status changes must include a reason string, timestamp, and evidence snapshot.

Examples:

- Promote to `core`: at least 20 forward trades, positive 30d and 90d return, PF above 1.25, drawdown under cap, and useful correlation profile.
- Promote to `satellite`: strong early evidence but limited sample, usually 8-19 trades.
- Move to `cooldown`: recent drawdown, PF deterioration, stale trade data, or repeated risk-gate rejections.
- Move to `blocked`: missing files, parser errors, stale data, broker mismatch, or duplicate-order risk.

## Application Views

### Command Center

Shows the current operating state:

- Paper/live mode indicator.
- Alpaca connection status.
- Paper account equity.
- Cash.
- Open exposure.
- Daily PnL.
- Current drawdown.
- Kill switch state.
- Last successful reconciliation time.
- Last leaderboard refresh time.

The first version must show `Paper` as the only executable mode.

### Strategy Allocation

Shows the current shared-equity weights:

- Target weight.
- Actual used exposure.
- Open positions by strategy.
- Recent return, PF, Sharpe, max drawdown, trade count.
- Correlation warning if two sleeves are too similar.
- Reason why the strategy is included.

The view should make it obvious when a strategy is in the pool because it is a return engine versus a diversifier.

### Trade Queue

Shows proposed orders before they are sent:

- Strategy name.
- Symbol.
- Side.
- Quantity or notional value.
- Intended order type.
- Stop or exit rule, when available.
- Reason tag from the source strategy.
- Risk checks passed and failed.
- Final action: `auto-submit paper order` or `block`.

V1 starts in Alpaca paper auto-submit mode. The UI records each ticket before submission, but there is no manual approval step in the first implementation. Risk checks, broker-health checks, duplicate-order checks, and reconciliation checks are the controls that decide whether a ticket is submitted or blocked.

### Risk Governor

Shows account-level and strategy-level limits:

- Max gross exposure.
- Max single-symbol exposure.
- Max strategy allocation.
- Max daily loss.
- Max open orders.
- Max orders per symbol per time window.
- Stale-data threshold.
- Duplicate-order detection.
- Broker connection health.
- Reconciliation drift tolerance.

Any failed risk check blocks order submission.

### Promotion Lab

Tracks every leaderboard strategy and explains why it is core, satellite, watch, cooldown, blocked, or retired.

The promotion engine uses:

- 7d, 30d, and 90d return.
- Trade count.
- Profit factor.
- Sharpe.
- Max drawdown.
- Win rate.
- Average R.
- Last signal time.
- Data freshness.
- Correlation with current core pool.
- Existing family overlap.

Promotion decisions are recommendations until the user approves automatic promotion rules.

### Execution Ledger

The ledger is the source of truth for sentinel execution.

It records:

- Trade ticket created.
- Risk checks applied.
- Broker order submitted.
- Broker order accepted or rejected.
- Fill received.
- Position reconciled.
- Exit recorded.
- Any mismatch or manual intervention.

The ledger must be append-only except for explicit correction records. Derived account state is rebuilt from the ledger.

### Replay and Audit

Rebuilds the sentinel account from the execution ledger and compares it to Alpaca paper account state.

It must show:

- Rebuilt cash.
- Rebuilt positions.
- Alpaca cash.
- Alpaca positions.
- Difference by symbol.
- Difference by order id.
- Whether the system is safe to trade.

If replay and broker state disagree beyond tolerance, the sentinel freezes new orders.

## Data Flow

1. Refresh leaderboard rows.
2. Validate strategy data freshness and row integrity.
3. Compute current promotion statuses.
4. Load active target allocation.
5. Read strategy signals or trade-intent files.
6. Convert strategy intent into normalized trade tickets.
7. Apply account, strategy, symbol, and broker risk checks.
8. Auto-submit allowed orders to Alpaca paper trading.
9. Poll order status and fills.
10. Append execution ledger events.
11. Rebuild sentinel account state from the ledger.
12. Reconcile rebuilt state against Alpaca.
13. Export sentinel status back to the dashboard.

## Broker Platform

### First Broker: Alpaca Paper Trading

Alpaca is the first adapter because it provides a clean broker API, a paper-trading environment, and support for U.S. equities plus crypto from one integration.

The sentinel will use:

- Paper endpoint only.
- Auto-submit paper orders after all required checks pass.
- Local environment variables for keys.
- No keys committed to Git.
- No keys pasted into chat.
- Paper account reconciliation before every trading cycle.

Expected local environment variables:

```text
ALPACA_ENV=paper
APCA_API_KEY_ID=<local only>
APCA_API_SECRET_KEY=<local only>
```

The implementation should add `.env`, `.env.local`, and any local secret files to `.gitignore` before any credentials are stored.

### Later Broker Adapters

Kraken can be added later for crypto-specific execution. Interactive Brokers can be considered later for a broader professional multi-asset system, but it is operationally heavier and should not be the first implementation.

## Safety Boundary

The first sentinel version is paper-only.

Allowed:

- Read leaderboard data.
- Read local paper trade logs.
- Read local strategy status files.
- Read Alpaca paper account state.
- Submit Alpaca paper orders.
- Reconcile paper fills.
- Write local sentinel ledger and status files.
- Render a local UI.

Not allowed:

- Live-money order submission.
- Account funding.
- Margin trading.
- Options trading.
- Perpetuals or futures.
- Storing credentials in Git.
- Autonomous live execution.
- Modifying existing strategy trade logs as part of execution.
- Removing, pruning, hiding, or zeroing leaderboard strategies.

Live execution requires a separate design, explicit user approval, and an additional safety review.

## Risk Rules for V1

Initial defaults:

- Paper-only mode.
- Paper auto-submit enabled.
- Max gross exposure: 100% of paper equity.
- Max single strategy target weight: 25%.
- Max single symbol exposure: 20%.
- Max daily realized loss: 2% of paper equity.
- Max open orders: 10.
- Max orders per symbol per hour: 2.
- Stale leaderboard threshold: 15 minutes.
- Stale signal threshold: strategy-specific, default 2x the strategy cycle.
- Freeze on reconciliation mismatch.
- Freeze on broker API failure.
- Freeze on missing or malformed sentinel ledger.
- Freeze if the current leaderboard has mostly error rows.

The UI must show a specific reason when the sentinel is frozen.

## Trade Ticket Schema

Each proposed trade ticket should include:

```json
{
  "ticket_id": "sentinel-20260628-000001",
  "created_at": "2026-06-28T00:00:00Z",
  "strategy": "CODEX Regime Plus L/S v1",
  "symbol": "BTC/USD",
  "asset_class": "crypto",
  "side": "buy",
  "intent": "open",
  "notional_usd": 500,
  "quantity": null,
  "order_type": "market",
  "time_in_force": "gtc",
  "reason": "strategy signal reason",
  "source_signal_id": "strategy-specific id",
  "risk_status": "pending",
  "broker": "alpaca-paper"
}
```

The schema should support equities and crypto, but the first implementation may limit the actual routable universe to symbols Alpaca paper supports.

## Storage

Proposed files:

```text
data/sentinel/
  config.json
  allocation.json
  promotion_status.json
  risk_state.json
  trade_tickets.jsonl
  execution_ledger.jsonl
  reconciliation_report.json
  sentinel_status.md

sentinel/
  app.js
  index.html
  README.md
  adapters/
    alpaca_paper.js
    paper_sim.js
  lib/
    allocator.js
    promotion_engine.js
    risk_governor.js
    ticket_schema.js
    reconcile.js
```

The exact folder layout can change during implementation planning, but the separation between UI, allocator, risk, broker adapter, and ledger should remain.

## UI Integration

The sentinel can start as an additional local page in this repo:

- `sentinel.html`
- `sentinel_app.js`
- `lib/sentinel/*`

This keeps the first version close to the existing leaderboard data and local server.

If the sentinel grows into a larger broker-control application, it can later move into a separate repo while keeping the same data contracts.

## Testing Plan

Unit tests:

- Promotion engine classifies strategies correctly.
- Allocator respects target weights and caps.
- Risk governor blocks stale data, oversized orders, duplicate orders, and daily loss breaches.
- Trade ticket schema validates required fields.
- Ledger replay rebuilds state correctly.
- Alpaca adapter maps normalized tickets into Alpaca paper order requests without leaking secrets.

Integration tests:

- Load current leaderboard rows and produce the initial six-strategy allocation.
- Create synthetic trade tickets and run them through the risk gate.
- Submit test tickets to a mocked Alpaca adapter.
- Rebuild state from execution ledger.
- Confirm reconciliation freezes trading when broker state differs from rebuilt state.

Manual verification:

- Open sentinel UI.
- Confirm paper mode is visible.
- Confirm no live mode can submit orders.
- Confirm Alpaca paper connection works using local keys.
- Confirm a dry-run trade ticket is either blocked with a visible reason or auto-submitted to Alpaca paper.
- Confirm execution ledger records every step.

## Acceptance Criteria

The first version is ready when:

- The sentinel UI opens locally.
- The current six-strategy allocation is visible.
- Promotion Lab classifies all leaderboard strategies.
- Trade Queue can show normalized paper trade tickets.
- Risk Governor blocks invalid or unsafe tickets.
- Alpaca paper credentials are read only from local ignored environment files.
- Alpaca paper account state can be fetched.
- Paper orders auto-submit after every risk check passes.
- Execution Ledger records order lifecycle events.
- Replay/Audit can rebuild account state.
- Reconciliation can freeze trading on mismatch.
- Existing leaderboard rows and CODEX snapshots remain intact.
- Existing leaderboard tests still pass.

## Implementation Defaults

The first implementation uses these defaults:

- Paper orders auto-submit after all risk checks pass.
- A local `paper_auto_submit_enabled` flag exists and defaults to `true` for paper mode.
- Sentinel UI starts inside this repo as a sibling page to the leaderboard.
- Alpaca paper is the first broker adapter.
- Symbols unsupported by Alpaca paper are blocked with a visible reason instead of simulated as if they were routed.
- Live trading remains disabled.
