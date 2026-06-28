import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateTicketRisk } from './risk_governor.js';

const config = {
  mode: 'paper',
  paper_auto_submit_enabled: true,
  live_trading_enabled: false,
  max_gross_exposure_pct: 100,
  max_strategy_weight_pct: 25,
  max_symbol_exposure_pct: 20,
  max_daily_loss_pct: 2,
  max_open_orders: 10,
  max_orders_per_symbol_per_hour: 2,
};

const ticket = {
  ticket_id: 'sentinel-1',
  created_at: '2026-06-28T18:00:00Z',
  strategy: 'CODEX Aggro v0',
  symbol: 'AAPL',
  asset_class: 'equity',
  side: 'buy',
  intent: 'open',
  notional_usd: 100,
  quantity: null,
  order_type: 'market',
  time_in_force: 'day',
  reason: 'test',
  source_signal_id: 'test-1',
  risk_status: 'pending',
  broker: 'alpaca-paper',
};

function baseContext(overrides = {}) {
  return {
    config,
    riskState: {},
    supportedSymbols: ['AAPL', 'MSFT'],
    account: {
      equity: 1000,
      positions: [],
      open_orders: [],
      daily_realized_pnl: 0,
    },
    recentTickets: [],
    ...overrides,
  };
}

test('evaluateTicketRisk approves valid paper autosubmit tickets', () => {
  const result = evaluateTicketRisk(ticket, baseContext());

  assert.deepEqual(result, {
    ok: true,
    action: 'auto-submit paper order',
    reasons: [],
  });
});

test('evaluateTicketRisk blocks frozen risk state and unsupported symbols with both reasons', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      riskState: { frozen: true, freeze_reason: 'reconciliation drift' },
      supportedSymbols: ['MSFT'],
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.action, 'block');
  assert.match(result.reasons.join(' | '), /risk state frozen: reconciliation drift/);
  assert.match(result.reasons.join(' | '), /unsupported symbol: AAPL/);
});

test('evaluateTicketRisk blocks oversized symbol exposure and duplicate source signals with both reasons', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      account: {
        equity: 1000,
        positions: [{ symbol: 'AAPL', market_value: -150 }],
        open_orders: [],
        daily_realized_pnl: 0,
      },
      recentTickets: [
        {
          ...ticket,
          ticket_id: 'sentinel-earlier',
        },
      ],
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.action, 'block');
  assert.match(result.reasons.join(' | '), /symbol exposure 250 exceeds cap 200/);
  assert.match(result.reasons.join(' | '), /duplicate source signal: test-1/);
});

test('evaluateTicketRisk blocks exposure from top-level context positions', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      positions: [{ symbol: 'AAPL', market_value: 150 }],
      account: {
        equity: 1000,
        positions: [],
        open_orders: [],
        daily_realized_pnl: 0,
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.action, 'block');
  assert.match(result.reasons.join(' | '), /symbol exposure 250 exceeds cap 200/);
});

test('evaluateTicketRisk blocks exposure from broker numeric string market values', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      positions: [{ symbol: 'AAPL', market_value: '150' }],
      account: {
        equity: 1000,
        positions: [],
        open_orders: [],
        daily_realized_pnl: 0,
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.action, 'block');
  assert.match(result.reasons.join(' | '), /symbol exposure 250 exceeds cap 200/);
});

test('evaluateTicketRisk blocks when supported symbols are missing', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      supportedSymbols: undefined,
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.action, 'block');
  assert.match(result.reasons.join(' | '), /unsupported symbol: AAPL/);
});

test('evaluateTicketRisk blocks malformed and live broker tickets through schema validation', () => {
  const result = evaluateTicketRisk(
    {
      ...ticket,
      broker: 'alpaca-live',
      quantity: undefined,
    },
    baseContext(),
  );

  assert.equal(result.ok, false);
  assert.equal(result.action, 'block');
  assert.match(result.reasons.join(' | '), /broker must be alpaca-paper/);
  assert.match(result.reasons.join(' | '), /quantity is required/);
});

test('evaluateTicketRisk blocks unsafe autosubmit configuration', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      config: {
        ...config,
        mode: 'live',
        paper_auto_submit_enabled: false,
        live_trading_enabled: true,
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.action, 'block');
  assert.match(result.reasons.join(' | '), /mode must be paper/);
  assert.match(result.reasons.join(' | '), /live trading must be disabled/);
  assert.match(result.reasons.join(' | '), /paper auto-submit must be enabled/);
});

test('evaluateTicketRisk blocks daily loss cap and open order cap', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      account: {
        equity: 1000,
        positions: [],
        open_orders: Array.from({ length: config.max_open_orders }, (_, index) => ({ id: index })),
        daily_realized_pnl: -20,
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.action, 'block');
  assert.match(result.reasons.join(' | '), /daily realized loss 20 is at or beyond cap 20/);
  assert.match(result.reasons.join(' | '), /open orders 10 at or above cap 10/);
});

test('evaluateTicketRisk blocks configured gross exposure cap', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      config: { ...config, max_gross_exposure_pct: 30 },
      account: {
        equity: 1000,
        positions: [
          { symbol: 'AAPL', market_value: 150 },
          { symbol: 'MSFT', market_value: -100 },
        ],
        open_orders: [],
        daily_realized_pnl: 0,
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /gross exposure 350 exceeds cap 300/);
});

test('evaluateTicketRisk blocks configured strategy weight cap', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      config: { ...config, max_strategy_weight_pct: 20 },
      positions: [
        { symbol: 'MSFT', strategy: ticket.strategy, market_value: 150 },
        { symbol: 'AAPL', strategy: 'other strategy', market_value: 10 },
      ],
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /strategy weight 250 exceeds cap 200/);
});

test('evaluateTicketRisk blocks configured orders-per-symbol-per-hour cap', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      config: { ...config, max_orders_per_symbol_per_hour: 2 },
      recentTickets: [
        { ...ticket, ticket_id: 'older-1', source_signal_id: 'older-1', decision: 'submitted', processed_at: '2026-06-28T17:15:00Z' },
        { ...ticket, ticket_id: 'older-2', source_signal_id: 'older-2', decision: 'submitted', processed_at: '2026-06-28T17:45:00Z' },
      ],
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /orders for AAPL in the past hour 2 at or above cap 2/);
});

test('evaluateTicketRisk uses processing time for recent symbol orders and ignores future events', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      config: { ...config, max_orders_per_symbol_per_hour: 2 },
      now: '2026-06-28T18:01:00Z',
      recentTickets: [
        { ...ticket, ticket_id: 'same-run-1', source_signal_id: 'same-run-1', decision: 'submitted', processed_at: '2026-06-28T18:01:00Z' },
        { ...ticket, ticket_id: 'older-1', source_signal_id: 'older-1', decision: 'submitted', processed_at: '2026-06-28T17:30:00Z' },
        { ...ticket, ticket_id: 'future-1', source_signal_id: 'future-1', decision: 'submitted', processed_at: '2026-06-28T18:02:00Z' },
      ],
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /orders for AAPL in the past hour 2 at or above cap 2/);
});

test('evaluateTicketRisk fails closed for malformed configured caps', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      config: {
        ...config,
        max_gross_exposure_pct: 'bad',
        max_strategy_weight_pct: 'bad',
        max_orders_per_symbol_per_hour: 'bad',
        max_open_orders: 'bad',
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /max_gross_exposure_pct must be a finite number/);
  assert.match(result.reasons.join(' | '), /max_strategy_weight_pct must be a finite number/);
  assert.match(result.reasons.join(' | '), /max_orders_per_symbol_per_hour must be a finite number/);
  assert.match(result.reasons.join(' | '), /max_open_orders must be a finite number/);
});

test('evaluateTicketRisk fails closed for malformed symbol and daily loss caps on reducing close', () => {
  const closeTicket = {
    ...ticket,
    side: 'sell',
    intent: 'close',
    source_signal_id: 'close-malformed-caps',
  };

  const result = evaluateTicketRisk(
    closeTicket,
    baseContext({
      config: {
        ...config,
        max_symbol_exposure_pct: 'bad',
        max_daily_loss_pct: 'bad',
      },
      positions: [{ symbol: 'AAPL', strategy: ticket.strategy, market_value: 100 }],
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /max_symbol_exposure_pct must be a finite number/);
  assert.match(result.reasons.join(' | '), /max_daily_loss_pct must be a finite number/);
});

test('evaluateTicketRisk fails closed when daily loss telemetry is missing or malformed', () => {
  const missing = evaluateTicketRisk(
    ticket,
    baseContext({
      account: {
        equity: 1000,
        positions: [],
        open_orders: [],
      },
    }),
  );
  const malformed = evaluateTicketRisk(
    ticket,
    baseContext({
      account: {
        equity: 1000,
        positions: [],
        open_orders: [],
        daily_realized_pnl: 'not-a-number',
      },
    }),
  );

  assert.equal(missing.ok, false);
  assert.match(missing.reasons.join(' | '), /daily loss telemetry must be finite/);
  assert.equal(malformed.ok, false);
  assert.match(malformed.reasons.join(' | '), /daily loss telemetry must be finite/);
});

test('evaluateTicketRisk derives daily loss from equity and last equity when daily pnl is absent', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      account: {
        equity: '980',
        last_equity: '1000',
        positions: [],
        open_orders: [],
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /daily realized loss 20 is at or beyond cap 19.6/);
});

test('evaluateTicketRisk rejects negative configured caps', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      config: {
        ...config,
        max_gross_exposure_pct: -1,
        max_strategy_weight_pct: -1,
        max_symbol_exposure_pct: -1,
        max_daily_loss_pct: -1,
        max_open_orders: -1,
        max_orders_per_symbol_per_hour: -1,
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /max_gross_exposure_pct must be non-negative/);
  assert.match(result.reasons.join(' | '), /max_strategy_weight_pct must be non-negative/);
  assert.match(result.reasons.join(' | '), /max_symbol_exposure_pct must be non-negative/);
  assert.match(result.reasons.join(' | '), /max_daily_loss_pct must be non-negative/);
  assert.match(result.reasons.join(' | '), /max_open_orders must be non-negative/);
  assert.match(result.reasons.join(' | '), /max_orders_per_symbol_per_hour must be non-negative/);
});

test('evaluateTicketRisk ignores blocked decisions for orders-per-symbol cap', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      config: { ...config, max_orders_per_symbol_per_hour: 1 },
      recentTickets: [
        {
          ...ticket,
          ticket_id: 'blocked-1',
          source_signal_id: 'blocked-1',
          decision: 'blocked',
          processed_at: '2026-06-28T17:30:00Z',
        },
      ],
    }),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.reasons, []);
});

test('evaluateTicketRisk fails closed when existing exposure lacks strategy attribution', () => {
  const result = evaluateTicketRisk(
    ticket,
    baseContext({
      positions: [{ symbol: 'MSFT', market_value: 200 }],
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /existing exposure lacks strategy attribution/);
});

test('evaluateTicketRisk does not block valid reducing sell on exposure caps', () => {
  const closeTicket = {
    ...ticket,
    side: 'sell',
    intent: 'close',
    notional_usd: 100,
    source_signal_id: 'close-1',
  };

  const result = evaluateTicketRisk(
    closeTicket,
    baseContext({
      config: {
        ...config,
        max_symbol_exposure_pct: 5,
        max_gross_exposure_pct: 5,
        max_strategy_weight_pct: 5,
      },
      positions: [{ symbol: 'AAPL', strategy: ticket.strategy, market_value: 100 }],
    }),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.reasons, []);
});

test('evaluateTicketRisk allows partial reducing sell even when exposure remains above caps', () => {
  const closeTicket = {
    ...ticket,
    side: 'sell',
    intent: 'close',
    notional_usd: 25,
    source_signal_id: 'partial-close-1',
  };

  const result = evaluateTicketRisk(
    closeTicket,
    baseContext({
      config: {
        ...config,
        max_symbol_exposure_pct: 5,
        max_gross_exposure_pct: 5,
        max_strategy_weight_pct: 5,
      },
      positions: [{ symbol: 'AAPL', strategy: ticket.strategy, market_value: 200 }],
    }),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.reasons, []);
});

test('evaluateTicketRisk blocks sell close notional above existing long exposure', () => {
  const closeTicket = {
    ...ticket,
    side: 'sell',
    intent: 'close',
    notional_usd: 1000,
    source_signal_id: 'oversized-close-1',
  };

  const result = evaluateTicketRisk(
    closeTicket,
    baseContext({
      config: {
        ...config,
        max_symbol_exposure_pct: 100,
        max_gross_exposure_pct: 100,
        max_strategy_weight_pct: 100,
      },
      positions: [{ symbol: 'AAPL', strategy: ticket.strategy, market_value: 100 }],
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /close notional 1000 exceeds existing exposure 100/);
});

test('evaluateTicketRisk blocks close tickets with no existing exposure', () => {
  const closeTicket = {
    ...ticket,
    side: 'sell',
    intent: 'close',
    notional_usd: 100,
    source_signal_id: 'empty-close-1',
  };

  const result = evaluateTicketRisk(
    closeTicket,
    baseContext({
      config: {
        ...config,
        max_symbol_exposure_pct: 100,
        max_gross_exposure_pct: 100,
        max_strategy_weight_pct: 100,
      },
      positions: [],
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /close ticket does not reduce existing exposure/);
});

test('evaluateTicketRisk blocks sell close against an existing short exposure', () => {
  const closeTicket = {
    ...ticket,
    side: 'sell',
    intent: 'close',
    notional_usd: 50,
    source_signal_id: 'wrong-way-close-1',
  };

  const result = evaluateTicketRisk(
    closeTicket,
    baseContext({
      config: {
        ...config,
        max_symbol_exposure_pct: 100,
        max_gross_exposure_pct: 100,
        max_strategy_weight_pct: 100,
      },
      positions: [{ symbol: 'AAPL', strategy: ticket.strategy, market_value: -100 }],
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /close ticket does not reduce existing exposure/);
});

test('evaluateTicketRisk blocks buy close against an existing long exposure', () => {
  const closeTicket = {
    ...ticket,
    side: 'buy',
    intent: 'close',
    notional_usd: 50,
    source_signal_id: 'wrong-way-close-2',
  };

  const result = evaluateTicketRisk(
    closeTicket,
    baseContext({
      config: {
        ...config,
        max_symbol_exposure_pct: 100,
        max_gross_exposure_pct: 100,
        max_strategy_weight_pct: 100,
      },
      positions: [{ symbol: 'AAPL', strategy: ticket.strategy, market_value: 100 }],
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /close ticket does not reduce existing exposure/);
});

test('evaluateTicketRisk blocks buy close notional above existing short exposure', () => {
  const closeTicket = {
    ...ticket,
    side: 'buy',
    intent: 'close',
    notional_usd: 500,
    source_signal_id: 'oversized-close-2',
  };

  const result = evaluateTicketRisk(
    closeTicket,
    baseContext({
      config: {
        ...config,
        max_symbol_exposure_pct: 100,
        max_gross_exposure_pct: 100,
        max_strategy_weight_pct: 100,
      },
      positions: [{ symbol: 'AAPL', strategy: ticket.strategy, market_value: -100 }],
    }),
  );

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /close notional 500 exceeds existing exposure 100/);
});
