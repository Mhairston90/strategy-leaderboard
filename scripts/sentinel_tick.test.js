import { test } from 'node:test';
import assert from 'node:assert/strict';

import { processTickets } from './sentinel_tick.js';

const ticket = {
  ticket_id: 'sentinel-test-1',
  created_at: '2026-06-28T18:00:00Z',
  strategy: 'CODEX Aggro v0',
  symbol: 'AAPL',
  asset_class: 'equity',
  side: 'buy',
  intent: 'open',
  notional_usd: 25,
  quantity: null,
  order_type: 'market',
  time_in_force: 'day',
  reason: 'paper smoke test',
  source_signal_id: 'paper-smoke-1',
  risk_status: 'pending',
  broker: 'alpaca-paper',
};

const baseContext = {
  config: {
    mode: 'paper',
    paper_auto_submit_enabled: true,
    live_trading_enabled: false,
    max_symbol_exposure_pct: 20,
    max_daily_loss_pct: 2,
    max_open_orders: 10,
  },
  riskState: { frozen: false },
  account: { equity: 10000, daily_realized_pnl: 0, open_orders: [] },
  positions: [],
  recentTickets: [],
  supportedSymbols: new Set(['AAPL']),
  now: '2026-06-28T18:01:00Z',
};

function context(overrides = {}) {
  return {
    ...baseContext,
    ...overrides,
    config: { ...baseContext.config, ...(overrides.config ?? {}) },
    riskState: { ...baseContext.riskState, ...(overrides.riskState ?? {}) },
    account: { ...baseContext.account, ...(overrides.account ?? {}) },
  };
}

test('processTickets auto-submits approved paper tickets and records an order_submitted ledger event', async () => {
  const submittedTickets = [];
  const broker = {
    async submitOrder(submittedTicket) {
      submittedTickets.push(submittedTicket);
      return { ok: true, order: { id: 'paper-order-1' } };
    },
  };

  const result = await processTickets({ tickets: [ticket], broker, ...context() });

  assert.deepEqual(submittedTickets, [ticket]);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, 'submitted');
  assert.equal(result.decisions[0].ticket_id, ticket.ticket_id);
  assert.equal(result.decisions[0].broker_order_id, 'paper-order-1');
  assert.deepEqual(result.decisions[0].reasons, []);
  assert.deepEqual(result.ledgerEvents, [
    {
      type: 'order_submitted',
      at: baseContext.now,
      ticket_id: ticket.ticket_id,
      broker_order_id: 'paper-order-1',
      symbol: ticket.symbol,
      side: ticket.side,
      notional_usd: ticket.notional_usd,
      strategy: ticket.strategy,
    },
  ]);
});

test('processTickets records blocked decisions without submitting', async () => {
  let submitCount = 0;
  const broker = {
    async submitOrder() {
      submitCount += 1;
      return { ok: true, order: { id: 'paper-order-1' } };
    },
  };

  const result = await processTickets({
    tickets: [ticket],
    broker,
    ...context({ riskState: { frozen: true, freeze_reason: 'manual pause' } }),
  });

  assert.equal(submitCount, 0);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(result.decisions[0].reasons.join(' | '), /risk state frozen: manual pause/);
  assert.deepEqual(result.ledgerEvents, []);
});

test('processTickets records broker rejected decisions and order_rejected ledger events', async () => {
  const broker = {
    async submitOrder() {
      return { ok: false, status: 422, error: { message: 'paper broker rejected order' } };
    },
  };

  const result = await processTickets({ tickets: [ticket], broker, ...context() });

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, 'broker_rejected');
  assert.equal(result.decisions[0].ticket_id, ticket.ticket_id);
  assert.match(result.decisions[0].reasons.join(' | '), /paper broker rejected order/);
  assert.deepEqual(result.ledgerEvents, [
    {
      type: 'order_rejected',
      at: baseContext.now,
      ticket_id: ticket.ticket_id,
      symbol: ticket.symbol,
      side: ticket.side,
      notional_usd: ticket.notional_usd,
      strategy: ticket.strategy,
      reason: 'paper broker rejected order',
    },
  ]);
});

test('processTickets records schema-invalid tickets as blocked decisions and does not submit', async () => {
  let submitCount = 0;
  const broker = {
    async submitOrder() {
      submitCount += 1;
      return { ok: true, order: { id: 'paper-order-1' } };
    },
  };
  const invalidTicket = { ...ticket };
  delete invalidTicket.quantity;

  const result = await processTickets({ tickets: [invalidTicket], broker, ...context() });

  assert.equal(submitCount, 0);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(result.decisions[0].reasons.join(' | '), /quantity is required/);
  assert.deepEqual(result.ledgerEvents, []);
});
