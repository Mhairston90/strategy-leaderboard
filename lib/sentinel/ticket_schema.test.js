import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSymbolForAlpaca, validateTicket } from './ticket_schema.js';

const baseTicket = {
  ticket_id: 'sentinel-20260628-000001',
  created_at: '2026-06-28T18:00:00Z',
  strategy: 'CODEX Regime Plus L/S v1',
  symbol: 'BTC/USD',
  asset_class: 'crypto',
  side: 'buy',
  intent: 'open',
  notional_usd: 5,
  quantity: null,
  order_type: 'market',
  time_in_force: 'gtc',
  reason: 'paper smoke test',
  source_signal_id: 'smoke-1',
  risk_status: 'pending',
  broker: 'alpaca-paper',
};

test('validateTicket accepts a complete Alpaca paper ticket', () => {
  assert.deepEqual(validateTicket(baseTicket), { ok: true, errors: [] });
});

test('validateTicket rejects live broker and invalid notional', () => {
  const result = validateTicket({ ...baseTicket, broker: 'alpaca-live', notional_usd: 0 });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /broker must be alpaca-paper/);
  assert.match(result.errors.join(' | '), /notional_usd must be positive/);
});

test('validateTicket rejects blank required string fields', () => {
  for (const [field, value] of [
    ['ticket_id', ''],
    ['strategy', '   '],
    ['source_signal_id', ''],
  ]) {
    const result = validateTicket({ ...baseTicket, [field]: value });
    assert.equal(result.ok, false, `${field} should be rejected`);
    assert.match(result.errors.join(' | '), new RegExp(`${field} is required`));
  }
});

test('validateTicket rejects non-string required string fields', () => {
  assert.deepEqual(validateTicket(baseTicket), { ok: true, errors: [] });

  for (const [field, value] of [
    ['ticket_id', 123],
    ['strategy', 42],
    ['source_signal_id', []],
  ]) {
    const result = validateTicket({ ...baseTicket, [field]: value });
    assert.equal(result.ok, false, `${field} should be rejected`);
    assert.match(result.errors.join(' | '), new RegExp(`${field} is required`));
  }
});

test('validateTicket accepts null quantity and rejects malformed quantities', () => {
  assert.deepEqual(validateTicket({ ...baseTicket, quantity: null }), { ok: true, errors: [] });

  for (const quantity of ['oops', {}, 0, -1]) {
    const result = validateTicket({ ...baseTicket, quantity });
    assert.equal(result.ok, false, `quantity ${JSON.stringify(quantity)} should be rejected`);
    assert.match(result.errors.join(' | '), /quantity must be null or a positive finite number/);
  }
});

test('validateTicket rejects invalid time_in_force', () => {
  const result = validateTicket({ ...baseTicket, time_in_force: 'ioc' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /time_in_force must be day or gtc/);
});

test('validateTicket rejects calendar-invalid ISO timestamps', () => {
  const result = validateTicket({ ...baseTicket, created_at: '2026-02-30T00:00:00Z' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /created_at must be an ISO timestamp/);
});

test('normalizeSymbolForAlpaca maps slash crypto and stock symbols', () => {
  assert.equal(normalizeSymbolForAlpaca('BTC/USD'), 'BTC/USD');
  assert.equal(normalizeSymbolForAlpaca('AAPL'), 'AAPL');
  assert.equal(normalizeSymbolForAlpaca(' aapl '), 'AAPL');
});
