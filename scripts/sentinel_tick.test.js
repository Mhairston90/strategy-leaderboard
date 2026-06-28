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
    max_gross_exposure_pct: 100,
    max_strategy_weight_pct: 25,
    max_symbol_exposure_pct: 20,
    max_daily_loss_pct: 2,
    max_open_orders: 10,
    max_orders_per_symbol_per_hour: 2,
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

function ticketWith(overrides = {}) {
  return { ...ticket, ...overrides };
}

function submittingBroker() {
  const submittedTickets = [];

  return {
    submittedTickets,
    broker: {
      async submitOrder(submittedTicket) {
        submittedTickets.push(submittedTicket);
        return { ok: true, order: { id: `paper-order-${submittedTickets.length}` } };
      },
    },
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
      source_signal_id: ticket.source_signal_id,
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
      source_signal_id: ticket.source_signal_id,
      reason: 'paper broker rejected order',
    },
  ]);
});

test('processTickets records submitted and rejected ledger events immediately after each broker response', async () => {
  const callbackEvents = [];
  const firstTicket = ticketWith({ ticket_id: 'sentinel-test-1', source_signal_id: 'paper-smoke-1' });
  const secondTicket = ticketWith({ ticket_id: 'sentinel-test-2', source_signal_id: 'paper-smoke-2' });
  const broker = {
    async submitOrder(submittedTicket) {
      assert.equal(
        callbackEvents.length,
        submittedTicket.ticket_id === firstTicket.ticket_id ? 0 : 1,
        'previous broker response should be recorded before next submit',
      );
      if (submittedTicket.ticket_id === secondTicket.ticket_id) {
        return { ok: false, status: 422, error: { message: 'paper broker rejected order' } };
      }

      return { ok: true, order: { id: 'paper-order-1' } };
    },
  };

  const result = await processTickets({
    tickets: [firstTicket, secondTicket],
    broker,
    ...context(),
    onLedgerEvent: async (event) => {
      callbackEvents.push(event);
    },
  });

  assert.deepEqual(callbackEvents, result.ledgerEvents);
  assert.deepEqual(callbackEvents.map((event) => event.type), ['order_submitted', 'order_rejected']);
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

test('processTickets blocks same-run duplicate source_signal_id after the first submission', async () => {
  const { broker, submittedTickets } = submittingBroker();
  const duplicate = ticketWith({ ticket_id: 'sentinel-test-2' });

  const result = await processTickets({ tickets: [ticket, duplicate], broker, ...context() });

  assert.deepEqual(submittedTickets, [ticket]);
  assert.equal(result.decisions.length, 2);
  assert.equal(result.decisions[0].decision, 'submitted');
  assert.equal(result.decisions[1].decision, 'blocked');
  assert.match(result.decisions[1].reasons.join(' | '), /duplicate source signal: paper-smoke-1/);
  assert.equal(result.ledgerEvents.length, 1);
  assert.equal(result.ledgerEvents[0].source_signal_id, ticket.source_signal_id);
});

test('processTickets applies same-run max_open_orders projection', async () => {
  const { broker, submittedTickets } = submittingBroker();
  const secondTicket = ticketWith({
    ticket_id: 'sentinel-test-2',
    source_signal_id: 'paper-smoke-2',
  });

  const result = await processTickets({
    tickets: [ticket, secondTicket],
    broker,
    ...context({ config: { max_open_orders: 1 } }),
  });

  assert.deepEqual(submittedTickets, [ticket]);
  assert.equal(result.decisions.map((decision) => decision.decision).join(','), 'submitted,blocked');
  assert.match(result.decisions[1].reasons.join(' | '), /open orders 1 at or above cap 1/);
  assert.equal(result.ledgerEvents.length, 1);
});

test('processTickets applies same-run orders-per-symbol-per-hour projection', async () => {
  const { broker, submittedTickets } = submittingBroker();
  const secondTicket = ticketWith({
    ticket_id: 'sentinel-test-2',
    source_signal_id: 'paper-smoke-2',
  });

  const result = await processTickets({
    tickets: [ticket, secondTicket],
    broker,
    ...context({ config: { max_orders_per_symbol_per_hour: 1 } }),
  });

  assert.deepEqual(submittedTickets, [ticket]);
  assert.equal(result.decisions.map((decision) => decision.decision).join(','), 'submitted,blocked');
  assert.match(
    result.decisions[1].reasons.join(' | '),
    /orders for AAPL in the past hour 1 at or above cap 1/,
  );
  assert.equal(result.ledgerEvents.length, 1);
});

test('processTickets applies same-run symbol exposure projection', async () => {
  const { broker, submittedTickets } = submittingBroker();
  const firstTicket = ticketWith({
    ticket_id: 'sentinel-test-1',
    notional_usd: 1200,
    source_signal_id: 'paper-smoke-1',
  });
  const secondTicket = ticketWith({
    ticket_id: 'sentinel-test-2',
    notional_usd: 1200,
    source_signal_id: 'paper-smoke-2',
  });

  const result = await processTickets({
    tickets: [firstTicket, secondTicket],
    broker,
    ...context(),
  });

  assert.deepEqual(submittedTickets, [firstTicket]);
  assert.equal(result.decisions.map((decision) => decision.decision).join(','), 'submitted,blocked');
  assert.match(result.decisions[1].reasons.join(' | '), /symbol exposure 2400 exceeds cap 2000/);
  assert.equal(result.ledgerEvents.length, 1);
});

test('processTickets reduces projected exposure for same-run close tickets', async () => {
  const { broker, submittedTickets } = submittingBroker();
  const closeTicket = ticketWith({
    ticket_id: 'sentinel-test-close',
    side: 'sell',
    intent: 'close',
    notional_usd: 1900,
    source_signal_id: 'paper-smoke-close',
  });
  const reopenTicket = ticketWith({
    ticket_id: 'sentinel-test-reopen',
    notional_usd: 1200,
    source_signal_id: 'paper-smoke-reopen',
  });

  const result = await processTickets({
    tickets: [closeTicket, reopenTicket],
    broker,
    ...context({
      positions: [{ symbol: 'AAPL', strategy: ticket.strategy, market_value: 2000 }],
    }),
  });

  assert.deepEqual(submittedTickets, [closeTicket, reopenTicket]);
  assert.equal(result.decisions.map((decision) => decision.decision).join(','), 'submitted,submitted');
});

test('processTickets submits partial close that remains over cap then blocks new exposure', async () => {
  const { broker, submittedTickets } = submittingBroker();
  const closeTicket = ticketWith({
    ticket_id: 'sentinel-test-partial-close',
    side: 'sell',
    intent: 'close',
    notional_usd: 25,
    source_signal_id: 'paper-smoke-partial-close',
  });
  const reopenTicket = ticketWith({
    ticket_id: 'sentinel-test-reopen-over-cap',
    notional_usd: 25,
    source_signal_id: 'paper-smoke-reopen-over-cap',
  });

  const result = await processTickets({
    tickets: [closeTicket, reopenTicket],
    broker,
    ...context({
      config: {
        max_symbol_exposure_pct: 5,
        max_gross_exposure_pct: 5,
        max_strategy_weight_pct: 5,
      },
      account: { equity: 1000 },
      positions: [{ symbol: 'AAPL', strategy: ticket.strategy, market_value: 200 }],
    }),
  });

  assert.deepEqual(submittedTickets, [closeTicket]);
  assert.equal(result.decisions.map((decision) => decision.decision).join(','), 'submitted,blocked');
  assert.match(result.decisions[1].reasons.join(' | '), /symbol exposure 200 exceeds cap 50/);
});

test('processTickets blocks resubmission from existing ledger source_signal_id when recentTickets is empty', async () => {
  const { broker, submittedTickets } = submittingBroker();

  const result = await processTickets({
    tickets: [ticket],
    broker,
    ...context({
      recentTickets: [],
      ledgerEvents: [
        {
          type: 'order_submitted',
          at: '2026-06-28T18:00:30Z',
          ticket_id: 'sentinel-earlier',
          broker_order_id: 'paper-order-earlier',
          symbol: ticket.symbol,
          side: ticket.side,
          notional_usd: ticket.notional_usd,
          strategy: ticket.strategy,
          source_signal_id: ticket.source_signal_id,
        },
      ],
    }),
  });

  assert.deepEqual(submittedTickets, []);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(result.decisions[0].reasons.join(' | '), /duplicate source signal: paper-smoke-1/);
  assert.deepEqual(result.ledgerEvents, []);
});
