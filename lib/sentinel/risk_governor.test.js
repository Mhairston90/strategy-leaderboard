import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateTicketRisk } from './risk_governor.js';

const config = {
  mode: 'paper',
  paper_auto_submit_enabled: true,
  live_trading_enabled: false,
  max_symbol_exposure_pct: 20,
  max_daily_loss_pct: 2,
  max_open_orders: 10,
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
