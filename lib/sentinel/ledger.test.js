import { test } from 'node:test';
import assert from 'node:assert/strict';

import { replayLedgerEvents } from './ledger.js';

test('replayLedgerEvents builds submitted order and position state', () => {
  const state = replayLedgerEvents([
    { type: 'order_submitted', ticket_id: 't1', broker_order_id: 'o1', symbol: 'AAPL', side: 'buy', notional_usd: 100 },
    { type: 'order_filled', ticket_id: 't1', broker_order_id: 'o1', symbol: 'AAPL', side: 'buy', filled_qty: 1, filled_avg_price: 100 },
  ]);

  assert.equal(state.orders.get('o1').status, 'filled');
  assert.equal(state.positions.get('AAPL').qty, 1);
  assert.equal(state.positions.get('AAPL').market_value, 100);
  assert.equal(state.positions.get('AAPL').fill_value, 100);
});

test('replayLedgerEvents records rejected orders without opening positions', () => {
  const state = replayLedgerEvents([
    { type: 'order_rejected', ticket_id: 't1', broker_order_id: null, symbol: 'AAPL', reason: 'bad symbol' },
  ]);

  assert.equal(state.positions.size, 0);
  assert.equal(state.rejections.length, 1);
});

test('replayLedgerEvents sell fills reduce position qty and value', () => {
  const state = replayLedgerEvents([
    { type: 'order_filled', ticket_id: 't1', broker_order_id: 'o1', symbol: 'AAPL', side: 'buy', filled_qty: 2, filled_avg_price: 100 },
    { type: 'order_filled', ticket_id: 't2', broker_order_id: 'o2', symbol: 'AAPL', side: 'sell', filled_qty: 0.5, filled_avg_price: 120 },
  ]);

  assert.equal(state.positions.get('AAPL').qty, 1.5);
  assert.equal(state.positions.get('AAPL').market_value, 140);
});

test('replayLedgerEvents handles numeric string fill values', () => {
  const state = replayLedgerEvents([
    { type: 'order_filled', ticket_id: 't1', broker_order_id: 'o1', symbol: 'AAPL', side: 'buy', filled_qty: '1.25', filled_avg_price: '80' },
  ]);

  assert.equal(state.positions.get('AAPL').qty, 1.25);
  assert.equal(state.positions.get('AAPL').market_value, 100);
});

test('replayLedgerEvents ignores unknown or malformed events without throwing', () => {
  const state = replayLedgerEvents([
    { type: 'unknown_event', symbol: 'AAPL' },
    null,
    undefined,
    { type: 'order_filled', symbol: 'AAPL', side: 'buy', filled_qty: 'bad', filled_avg_price: 100 },
  ]);

  assert.equal(state.orders.size, 0);
  assert.equal(state.positions.size, 0);
  assert.deepEqual(state.rejections, []);
});

test('replayLedgerEvents records malformed fill anomalies without throwing', () => {
  const state = replayLedgerEvents([
    { type: 'order_filled', broker_order_id: 'o1', symbol: 'AAPL', side: 'buy', filled_qty: 'bad', filled_avg_price: 100 },
  ]);

  assert.equal(state.positions.size, 0);
  assert.equal(state.anomalies.length, 1);
  assert.equal(state.anomalies[0].type, 'malformed_event');
  assert.equal(state.anomalies[0].event_type, 'order_filled');
});
