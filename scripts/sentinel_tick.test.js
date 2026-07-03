import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SENTINEL_SUPPORTED_SYMBOLS,
  buildLeaderboardGenerationWindow,
  buildNinjaFeedbackLedgerEvents,
  buildTickTickets,
  applyPositionSyncHealthRiskState,
  processPositionSyncOrders,
  processTickets,
} from './sentinel_tick.js';

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

test('buildLeaderboardGenerationWindow defaults to a one-day leaderboard lookback ending at tick time', () => {
  const window = buildLeaderboardGenerationWindow({
    generatedAt: '2026-06-29T17:00:00Z',
    config: {},
  });

  assert.deepEqual(window, {
    since: '2026-06-28T17:00:00Z',
    until: '2026-06-29T17:00:00Z',
  });
});

test('buildTickTickets processes manual inbox tickets before generated leaderboard tickets', () => {
  const manual = ticketWith({ ticket_id: 'manual-ticket' });
  const generated = ticketWith({ ticket_id: 'generated-ticket' });

  assert.deepEqual(
    buildTickTickets({ inboxTickets: [manual], leaderboardTickets: [generated] }),
    [manual, generated],
  );
});

test('SENTINEL_SUPPORTED_SYMBOLS includes Alpaca crypto USD pairs used by allocated leaderboard strategies', () => {
  for (const symbol of ['ADA/USD', 'AVAX/USD', 'DOGE/USD', 'DOT/USD', 'ETH/USD', 'LTC/USD', 'SOL/USD', 'XRP/USD']) {
    assert.equal(SENTINEL_SUPPORTED_SYMBOLS.has(symbol), true, `${symbol} should be supported`);
  }
});

test('SENTINEL_SUPPORTED_SYMBOLS includes equity symbols used by allocated Sentinel strategies', () => {
  for (const symbol of ['AMD', 'AVGO', 'CAT', 'DIS', 'FCX', 'JPM', 'LLY', 'META', 'NFLX', 'NKE', 'NVDA', 'OXY', 'PLTR', 'TSLA']) {
    assert.equal(SENTINEL_SUPPORTED_SYMBOLS.has(symbol), true, `${symbol} should be supported`);
  }
});

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

test('processTickets counts recent ledger-only submissions toward symbol order cap', async () => {
  const { broker, submittedTickets } = submittingBroker();

  const result = await processTickets({
    tickets: [ticketWith({ source_signal_id: 'paper-smoke-new' })],
    broker,
    ...context({
      config: { max_orders_per_symbol_per_hour: 1 },
      recentTickets: [],
      ledgerEvents: [
        {
          type: 'order_submitted',
          at: '2026-06-28T18:00:30Z',
          ticket_id: 'sentinel-ledger-only',
          broker_order_id: 'paper-order-ledger-only',
          symbol: ticket.symbol,
          side: ticket.side,
          notional_usd: ticket.notional_usd,
          strategy: ticket.strategy,
          source_signal_id: 'paper-smoke-ledger-only',
        },
      ],
      now: '2026-06-28T18:01:00Z',
    }),
  });

  assert.deepEqual(submittedTickets, []);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(
    result.decisions[0].reasons.join(' | '),
    /orders for AAPL in the past hour 1 at or above cap 1/,
  );
  assert.deepEqual(result.ledgerEvents, []);
});

test('processTickets ignores blocked recent decisions for same-run orders-per-symbol projection', async () => {
  const { broker, submittedTickets } = submittingBroker();
  const newTicket = ticketWith({ source_signal_id: 'paper-smoke-new' });

  const result = await processTickets({
    tickets: [newTicket],
    broker,
    ...context({
      config: { max_orders_per_symbol_per_hour: 1 },
      recentTickets: [
        {
          ...ticket,
          ticket_id: 'blocked-earlier',
          source_signal_id: 'blocked-earlier',
          decision: 'blocked',
          processed_at: '2026-06-28T18:00:30Z',
        },
      ],
    }),
  });

  assert.deepEqual(submittedTickets, [newTicket]);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, 'submitted');
  assert.equal(result.ledgerEvents.length, 1);
});

test('processTickets ignores filled ledger events for orders-per-symbol cap', async () => {
  const { broker, submittedTickets } = submittingBroker();
  const newTicket = ticketWith({ source_signal_id: 'paper-smoke-new' });

  const result = await processTickets({
    tickets: [newTicket],
    broker,
    ...context({
      config: { max_orders_per_symbol_per_hour: 1 },
      ledgerEvents: [
        {
          type: 'order_filled',
          at: '2026-06-28T18:00:30Z',
          ticket_id: 'sentinel-filled',
          broker_order_id: 'paper-order-filled',
          symbol: ticket.symbol,
          side: ticket.side,
          filled_qty: 1,
          filled_avg_price: 25,
          strategy: ticket.strategy,
          source_signal_id: 'paper-smoke-filled',
        },
      ],
    }),
  });

  assert.deepEqual(submittedTickets, [newTicket]);
  assert.equal(result.decisions[0].decision, 'submitted');
});

test('processTickets enforces strategy cap from ledger-attributed broker positions', async () => {
  const { broker, submittedTickets } = submittingBroker();

  const result = await processTickets({
    tickets: [ticketWith({ symbol: 'AAPL', source_signal_id: 'paper-smoke-new' })],
    broker,
    ...context({
      config: { max_strategy_weight_pct: 2 },
      account: { equity: 10000 },
      positions: [{ symbol: 'MSFT', qty: '2', market_value: '200' }],
      supportedSymbols: new Set(['AAPL', 'MSFT']),
      ledgerEvents: [
        {
          type: 'order_submitted',
          at: '2026-06-28T17:00:00Z',
          ticket_id: 'sentinel-msft',
          broker_order_id: 'paper-order-msft',
          symbol: 'MSFT',
          side: 'buy',
          notional_usd: 200,
          strategy: ticket.strategy,
          source_signal_id: 'paper-smoke-msft',
        },
        {
          type: 'order_filled',
          at: '2026-06-28T17:01:00Z',
          ticket_id: 'sentinel-msft',
          broker_order_id: 'paper-order-msft',
          symbol: 'MSFT',
          side: 'buy',
          filled_qty: 2,
          filled_avg_price: 100,
        },
      ],
    }),
  });

  assert.deepEqual(submittedTickets, []);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(result.decisions[0].reasons.join(' | '), /strategy weight 225 exceeds cap 200/);
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

test('processTickets blocks oversized close before projection can flip exposure', async () => {
  const { broker, submittedTickets } = submittingBroker();
  const closeTicket = ticketWith({
    ticket_id: 'sentinel-test-over-close',
    side: 'sell',
    intent: 'close',
    notional_usd: 1000,
    source_signal_id: 'paper-smoke-over-close',
  });

  const result = await processTickets({
    tickets: [closeTicket],
    broker,
    ...context({
      config: {
        max_symbol_exposure_pct: 100,
        max_gross_exposure_pct: 100,
        max_strategy_weight_pct: 100,
      },
      positions: [{ symbol: 'AAPL', strategy: ticket.strategy, market_value: 100 }],
    }),
  });

  assert.deepEqual(submittedTickets, []);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(result.decisions[0].reasons.join(' | '), /close notional 1000 exceeds existing exposure 100/);
  assert.deepEqual(result.ledgerEvents, []);
});

test('processTickets blocks non-reducing close tickets before broker submission', async () => {
  const { broker, submittedTickets } = submittingBroker();
  const closeTicket = ticketWith({
    ticket_id: 'sentinel-test-non-reducing-close',
    side: 'sell',
    intent: 'close',
    notional_usd: 100,
    source_signal_id: 'paper-smoke-non-reducing-close',
  });

  const result = await processTickets({
    tickets: [closeTicket],
    broker,
    ...context({
      config: {
        max_symbol_exposure_pct: 100,
        max_gross_exposure_pct: 100,
        max_strategy_weight_pct: 100,
      },
      positions: [],
    }),
  });

  assert.deepEqual(submittedTickets, []);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(result.decisions[0].reasons.join(' | '), /close ticket does not reduce existing exposure/);
  assert.deepEqual(result.ledgerEvents, []);
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

test('processPositionSyncOrders submits orders to their venue brokers and records ledger events', async () => {
  const submitted = [];
  const brokers = {
    'alpaca-paper': {
      async submitOrder(order) {
        submitted.push({ venue: 'alpaca-paper', order });
        return { ok: true, order: { id: 'alpaca-order-1' } };
      },
    },
    'ninjatrader-sim': {
      async submitOrder(order) {
        submitted.push({ venue: 'ninjatrader-sim', order });
        return { ok: true, order: { id: 'ninja-order-1' } };
      },
    },
  };
  const orders = [
    ticketWith({
      ticket_id: 'sync-amd',
      source_signal_id: 'position-sync:alpaca-paper:AMD:-900',
      broker: 'alpaca-paper',
      venue: 'alpaca-paper',
      intent: 'rebalance',
      side: 'sell',
      notional_usd: 900,
    }),
    ticketWith({
      ticket_id: 'sync-sol',
      source_signal_id: 'position-sync:ninjatrader-sim:MSL-07-26:2',
      broker: 'ninjatrader-sim',
      venue: 'ninjatrader-sim',
      symbol: 'SOL/USD',
      asset_class: 'crypto',
      intent: 'rebalance',
      side: 'buy',
      notional_usd: 3900,
      quantity: 2,
      instrument: 'MSL 07-26',
    }),
  ];

  const result = await processPositionSyncOrders({
    orders,
    brokers,
    config: {
      mode: 'paper',
      paper_auto_submit_enabled: true,
      position_sync_auto_submit_enabled: true,
      live_trading_enabled: false,
      total_capital_usd: 100000,
      max_gross_exposure_pct: 100,
      max_symbol_exposure_pct: 20,
      max_daily_loss_pct: 2,
    },
    riskState: { frozen: false },
    account: { equity: 100000, daily_realized_pnl: 0 },
    targetGrossExposureUsd: 10000,
    now: '2026-07-01T20:00:00Z',
  });

  assert.equal(submitted.length, 2);
  assert.deepEqual(result.decisions.map((decision) => decision.decision), ['submitted', 'submitted']);
  assert.deepEqual(result.ledgerEvents.map((event) => ({
    type: event.type,
    broker_order_id: event.broker_order_id,
    broker: event.broker,
    venue: event.venue,
    symbol: event.symbol,
    side: event.side,
  })), [
    {
      type: 'order_submitted',
      broker_order_id: 'alpaca-order-1',
      broker: 'alpaca-paper',
      venue: 'alpaca-paper',
      symbol: 'AAPL',
      side: 'sell',
    },
    {
      type: 'order_submitted',
      broker_order_id: 'ninja-order-1',
      broker: 'ninjatrader-sim',
      venue: 'ninjatrader-sim',
      symbol: 'SOL/USD',
      side: 'buy',
    },
  ]);
});

test('processPositionSyncOrders blocks sync orders when position sync auto-submit is disabled', async () => {
  let submitCount = 0;
  const result = await processPositionSyncOrders({
    orders: [
      ticketWith({
        ticket_id: 'sync-amd',
        source_signal_id: 'position-sync:alpaca-paper:AMD:-900',
        broker: 'alpaca-paper',
        venue: 'alpaca-paper',
        intent: 'rebalance',
        side: 'sell',
        notional_usd: 900,
      }),
    ],
    brokers: {
      'alpaca-paper': {
        async submitOrder() {
          submitCount += 1;
          return { ok: true, order: { id: 'alpaca-order-1' } };
        },
      },
    },
    config: {
      mode: 'paper',
      paper_auto_submit_enabled: true,
      position_sync_auto_submit_enabled: false,
      live_trading_enabled: false,
      total_capital_usd: 100000,
      max_gross_exposure_pct: 100,
      max_symbol_exposure_pct: 20,
      max_daily_loss_pct: 2,
    },
    riskState: { frozen: false },
    account: { equity: 100000, daily_realized_pnl: 0 },
    targetGrossExposureUsd: 10000,
    now: '2026-07-01T20:00:00Z',
  });

  assert.equal(submitCount, 0);
  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(result.decisions[0].reasons.join(' | '), /position-sync auto-submit must be enabled/);
  assert.deepEqual(result.ledgerEvents, []);
});

function syncOrder(overrides = {}) {
  return ticketWith({
    ticket_id: 'sync-btc',
    source_signal_id: 'position-sync:ninjatrader-sim:MBT 07-26:1',
    broker: 'ninjatrader-sim',
    venue: 'ninjatrader-sim',
    symbol: 'BTC/USD',
    asset_class: 'crypto',
    intent: 'rebalance',
    side: 'buy',
    notional_usd: 6000,
    quantity: 1,
    instrument: 'MBT 07-26',
    ...overrides,
  });
}

const syncConfig = {
  mode: 'paper',
  paper_auto_submit_enabled: true,
  position_sync_auto_submit_enabled: true,
  live_trading_enabled: false,
  total_capital_usd: 100000,
  max_gross_exposure_pct: 100,
  max_symbol_exposure_pct: 20,
  max_daily_loss_pct: 2,
};

function countingNinjaBroker() {
  let submitCount = 0;
  return {
    get submitCount() {
      return submitCount;
    },
    brokers: {
      'ninjatrader-sim': {
        async submitOrder() {
          submitCount += 1;
          return { ok: true, order: { id: `ninja-order-${submitCount}` } };
        },
      },
    },
  };
}

test('processPositionSyncOrders blocks NinjaTrader orders when the data connection is not connected', async () => {
  const counting = countingNinjaBroker();

  const result = await processPositionSyncOrders({
    orders: [syncOrder()],
    brokers: counting.brokers,
    config: syncConfig,
    riskState: { frozen: false },
    account: {
      equity: 100000,
      daily_realized_pnl: 0,
      venues: { ninjatrader_sim: { connection: 'disconnected' } },
    },
    targetGrossExposureUsd: 10000,
    now: '2026-07-02T10:06:00Z',
  });

  assert.equal(counting.submitCount, 0);
  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(result.decisions[0].reasons.join(' | '), /NinjaTrader connection is not connected/);
  assert.deepEqual(result.ledgerEvents, []);
});

test('processPositionSyncOrders blocks NinjaTrader orders when the connection status is unknown', async () => {
  const counting = countingNinjaBroker();

  const result = await processPositionSyncOrders({
    orders: [syncOrder()],
    brokers: counting.brokers,
    config: syncConfig,
    riskState: { frozen: false },
    account: {
      equity: 100000,
      daily_realized_pnl: 0,
      venues: { ninjatrader_sim: { connection: 'unknown' } },
    },
    targetGrossExposureUsd: 10000,
    now: '2026-07-02T10:06:00Z',
  });

  assert.equal(counting.submitCount, 0);
  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(result.decisions[0].reasons.join(' | '), /NinjaTrader connection is not connected/);
});

test('processPositionSyncOrders enforces a cooldown after a recent broker rejection for the same symbol and venue', async () => {
  const counting = countingNinjaBroker();

  const result = await processPositionSyncOrders({
    orders: [syncOrder()],
    brokers: counting.brokers,
    config: { ...syncConfig, position_sync_reject_cooldown_minutes: 10 },
    riskState: { frozen: false },
    account: {
      equity: 100000,
      daily_realized_pnl: 0,
      venues: { ninjatrader_sim: { connection: 'connected' } },
    },
    targetGrossExposureUsd: 10000,
    ledgerEvents: [
      {
        type: 'order_rejected',
        at: '2026-07-02T10:04:00Z',
        broker_order_id: 'NT-rejected',
        venue: 'ninjatrader-sim',
        symbol: 'BTC/USD',
        side: 'buy',
        reason: 'ninjatrader feedback: rejected',
      },
    ],
    now: '2026-07-02T10:06:00Z',
  });

  assert.equal(counting.submitCount, 0);
  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(result.decisions[0].reasons.join(' | '), /cooling down/);
});

test('processPositionSyncOrders allows submission after the rejection cooldown has elapsed', async () => {
  const counting = countingNinjaBroker();

  const result = await processPositionSyncOrders({
    orders: [syncOrder()],
    brokers: counting.brokers,
    config: { ...syncConfig, position_sync_reject_cooldown_minutes: 10 },
    riskState: { frozen: false },
    account: {
      equity: 100000,
      daily_realized_pnl: 0,
      venues: { ninjatrader_sim: { connection: 'connected' } },
    },
    targetGrossExposureUsd: 10000,
    ledgerEvents: [
      {
        type: 'order_rejected',
        at: '2026-07-02T09:50:00Z',
        broker_order_id: 'NT-rejected',
        venue: 'ninjatrader-sim',
        symbol: 'BTC/USD',
        side: 'buy',
        reason: 'ninjatrader feedback: rejected',
      },
    ],
    now: '2026-07-02T10:06:00Z',
  });

  assert.equal(counting.submitCount, 1);
  assert.equal(result.decisions[0].decision, 'submitted');
});

test('processPositionSyncOrders enforces the per-symbol hourly order cap from ledger history', async () => {
  const counting = countingNinjaBroker();
  const submittedEvent = (id, at) => ({
    type: 'order_submitted',
    at,
    broker_order_id: id,
    venue: 'ninjatrader-sim',
    symbol: 'BTC/USD',
    side: 'buy',
    quantity: 1,
    source_signal_id: 'position-sync:ninjatrader-sim:MBT 07-26:1',
  });

  const result = await processPositionSyncOrders({
    orders: [syncOrder()],
    brokers: counting.brokers,
    config: { ...syncConfig, max_orders_per_symbol_per_hour: 2 },
    riskState: { frozen: false },
    account: {
      equity: 100000,
      daily_realized_pnl: 0,
      venues: { ninjatrader_sim: { connection: 'connected' } },
    },
    targetGrossExposureUsd: 10000,
    ledgerEvents: [
      submittedEvent('NT-a', '2026-07-02T09:30:00Z'),
      submittedEvent('NT-b', '2026-07-02T09:45:00Z'),
    ],
    now: '2026-07-02T10:06:00Z',
  });

  assert.equal(counting.submitCount, 0);
  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(result.decisions[0].reasons.join(' | '), /past hour 2 at or above cap 2/);
});

test('buildNinjaFeedbackLedgerEvents converts terminal feedback into fill and rejection ledger events once', () => {
  const ledgerEvents = [
    {
      type: 'order_submitted',
      at: '2026-07-02T10:00:00Z',
      ticket_id: 'sync-btc',
      broker_order_id: 'NT-fill',
      broker: 'ninjatrader-sim',
      venue: 'ninjatrader-sim',
      symbol: 'BTC/USD',
      instrument: 'MBT 07-26',
      side: 'buy',
      quantity: 1,
      strategy: 'Sentinel Position Sync',
      source_signal_id: 'position-sync:ninjatrader-sim:MBT 07-26:1',
    },
    {
      type: 'order_submitted',
      at: '2026-07-02T10:00:00Z',
      ticket_id: 'sync-sol',
      broker_order_id: 'NT-reject',
      broker: 'ninjatrader-sim',
      venue: 'ninjatrader-sim',
      symbol: 'SOL/USD',
      instrument: 'MSL 07-26',
      side: 'sell',
      quantity: 4,
      strategy: 'Sentinel Position Sync',
      source_signal_id: 'position-sync:ninjatrader-sim:MSL 07-26:8',
    },
  ];
  const ninjaOrders = [
    { id: 'NT-fill', status: 'filled', filled_qty: 1, fill_price: 60050 },
    { id: 'NT-reject', status: 'rejected', filled_qty: 0, fill_price: 0 },
    { id: 'NT-unrelated', status: 'filled', filled_qty: 2, fill_price: 100 },
  ];

  const events = buildNinjaFeedbackLedgerEvents({
    ledgerEvents,
    ninjaOrders,
    now: '2026-07-02T10:07:00Z',
  });

  assert.deepEqual(events.map((event) => ({ type: event.type, broker_order_id: event.broker_order_id })), [
    { type: 'order_filled', broker_order_id: 'NT-fill' },
    { type: 'order_rejected', broker_order_id: 'NT-reject' },
  ]);
  assert.equal(events[0].symbol, 'BTC/USD');
  assert.equal(events[0].filled_qty, 1);
  assert.equal(events[0].fill_price, 60050);
  assert.equal(events[1].symbol, 'SOL/USD');
  assert.match(events[1].reason, /rejected/);

  const secondPass = buildNinjaFeedbackLedgerEvents({
    ledgerEvents: [...ledgerEvents, ...events],
    ninjaOrders,
    now: '2026-07-02T10:08:00Z',
  });
  assert.deepEqual(secondPass, [], 'feedback already ledgered should not emit duplicates');
});

test('applyPositionSyncHealthRiskState freezes on stale Ninja feedback and clears on clean reports', () => {
  const frozen = applyPositionSyncHealthRiskState({
    riskState: { frozen: false },
    report: {
      divergences: [
        {
          symbol: 'ETH/USD',
          instrument: 'MET 07-26',
          reason: 'stale_ninjatrader_feedback',
          broker_order_id: 'NT-stale-eth',
        },
      ],
    },
    generatedAt: '2026-07-01T20:30:00Z',
  });

  assert.equal(frozen.frozen, true);
  assert.equal(frozen.freeze_source, 'ninjatrader_feedback');
  assert.match(frozen.freeze_reason, /ETH\/USD/);

  const cleared = applyPositionSyncHealthRiskState({
    riskState: frozen,
    report: { divergences: [] },
    generatedAt: '2026-07-01T20:31:00Z',
  });

  assert.equal(cleared.frozen, false);
  assert.equal(cleared.freeze_source, '');
  assert.equal(cleared.freeze_reason, '');
});
