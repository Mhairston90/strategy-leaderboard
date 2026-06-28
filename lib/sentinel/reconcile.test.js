import { test } from 'node:test';
import assert from 'node:assert/strict';

import { replayLedgerEvents } from './ledger.js';
import { buildReconciliationUpdate, compareLedgerToBroker } from './reconcile.js';

test('compareLedgerToBroker reports clean state when positions match', () => {
  const result = compareLedgerToBroker({
    ledgerPositions: new Map([['AAPL', { symbol: 'AAPL', qty: 1, market_value: 100 }]]),
    brokerPositions: [{ symbol: 'AAPL', qty: '1', market_value: '100' }],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.differences.length, 0);
});

test('compareLedgerToBroker freezes when broker has unexpected position', () => {
  const result = compareLedgerToBroker({
    ledgerPositions: new Map(),
    brokerPositions: [{ symbol: 'AAPL', qty: '1', market_value: '100' }],
  });

  assert.equal(result.status, 'error');
  assert.match(result.freeze_reason, /position mismatch/);
  assert.equal(result.differences.length, 1);
});

test('compareLedgerToBroker freezes when ledger has unexpected position', () => {
  const result = compareLedgerToBroker({
    ledgerPositions: new Map([['AAPL', { symbol: 'AAPL', qty: 1, market_value: 100 }]]),
    brokerPositions: [],
  });

  assert.equal(result.status, 'error');
  assert.match(result.freeze_reason, /position mismatch/);
  assert.equal(result.differences.length, 1);
  assert.equal(result.differences[0].ledger.fill_value, 100);
});

test('compareLedgerToBroker allows small rounding differences within tolerance', () => {
  const result = compareLedgerToBroker({
    ledgerPositions: new Map([['AAPL', { symbol: 'AAPL', qty: 1, market_value: 100 }]]),
    brokerPositions: [{ symbol: 'AAPL', qty: '1.0000004', market_value: '100.004' }],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.differences.length, 0);
});

test('compareLedgerToBroker handles numeric strings and missing inputs without throwing', () => {
  assert.doesNotThrow(() => compareLedgerToBroker({}));
  assert.equal(compareLedgerToBroker({}).status, 'ok');

  const result = compareLedgerToBroker({
    brokerPositions: [{ symbol: 'AAPL', qty: 'bad', market_value: '100' }],
  });

  assert.equal(result.status, 'error');
  assert.match(result.freeze_reason, /position mismatch/);
  assert.equal(result.differences.length, 1);
});

test('compareLedgerToBroker reports provided malformed position containers', () => {
  const brokerResult = compareLedgerToBroker({
    brokerPositions: { symbol: 'AAPL', qty: '1', market_value: '100' },
  });

  assert.equal(brokerResult.status, 'error');
  assert.match(brokerResult.freeze_reason, /position mismatch/);
  assert.equal(brokerResult.differences.length, 1);
  assert.equal(brokerResult.differences[0].type, 'malformed_container');

  const ledgerResult = compareLedgerToBroker({
    ledgerPositions: [{ symbol: 'AAPL', qty: 1, market_value: 100 }],
  });

  assert.equal(ledgerResult.status, 'error');
  assert.match(ledgerResult.freeze_reason, /position mismatch/);
  assert.equal(ledgerResult.differences.length, 1);
  assert.equal(ledgerResult.differences[0].type, 'malformed_container');
});

test('compareLedgerToBroker ignores ledger-only flat zero positions', () => {
  const result = compareLedgerToBroker({
    ledgerPositions: new Map([['AAPL', { symbol: 'AAPL', qty: 0, market_value: 0, fill_value: 0 }]]),
    brokerPositions: [],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.differences.length, 0);
});

test('compareLedgerToBroker ignores broker-only flat zero positions', () => {
  const result = compareLedgerToBroker({
    ledgerPositions: new Map(),
    brokerPositions: [{ symbol: 'AAPL', qty: '0', market_value: '0' }],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.differences.length, 0);
});

test('compareLedgerToBroker ignores full buy then full sell ledger flat vs empty broker', () => {
  const { positions } = replayLedgerEvents([
    { type: 'order_filled', ticket_id: 't1', broker_order_id: 'o1', symbol: 'AAPL', side: 'buy', filled_qty: 1, filled_avg_price: 100 },
    { type: 'order_filled', ticket_id: 't2', broker_order_id: 'o2', symbol: 'AAPL', side: 'sell', filled_qty: 1, filled_avg_price: 100 },
  ]);

  const result = compareLedgerToBroker({
    ledgerPositions: positions,
    brokerPositions: [],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.differences.length, 0);
});

test('compareLedgerToBroker reports malformed broker positions instead of dropping them', () => {
  const result = compareLedgerToBroker({
    brokerPositions: [{ qty: '1', market_value: '100' }],
  });

  assert.equal(result.status, 'error');
  assert.match(result.freeze_reason, /position mismatch/);
  assert.equal(result.differences.length, 1);
});

test('buildReconciliationUpdate freezes returned riskState on mismatch and includes report metadata', () => {
  const result = buildReconciliationUpdate({
    ledgerEvents: [
      { type: 'order_filled', ticket_id: 't1', broker_order_id: 'o1', symbol: 'AAPL', side: 'buy', filled_qty: 1, filled_avg_price: 100 },
    ],
    brokerPositions: [],
    riskState: { daily_loss_usd: 12 },
    generatedAt: '2026-06-28T21:30:00.000Z',
  });

  assert.equal(result.report.generated_at, '2026-06-28T21:30:00.000Z');
  assert.equal(result.report.status, 'error');
  assert.match(result.report.freeze_reason, /position mismatch/);
  assert.equal(result.report.differences.length, 1);
  assert.equal(result.riskState.daily_loss_usd, 12);
  assert.equal(result.riskState.frozen, true);
  assert.equal(result.riskState.freeze_reason, result.report.freeze_reason);
});

test('buildReconciliationUpdate reports ledger anomalies and freezes fail closed', () => {
  const result = buildReconciliationUpdate({
    ledgerEvents: [
      { type: 'order_filled', ticket_id: 't1', broker_order_id: 'o1', symbol: 'AAPL', side: 'buy', filled_qty: 'bad', filled_avg_price: 100 },
    ],
    brokerPositions: [],
    generatedAt: '2026-06-28T21:35:00.000Z',
  });

  assert.equal(result.report.generated_at, '2026-06-28T21:35:00.000Z');
  assert.equal(result.report.status, 'error');
  assert.match(result.report.freeze_reason, /ledger anomal/);
  assert.equal(result.report.ledger_anomalies.length, 1);
  assert.equal(result.riskState.frozen, true);
});

test('buildReconciliationUpdate does not freeze broker position backed by submitted order awaiting fill event', () => {
  const result = buildReconciliationUpdate({
    ledgerEvents: [
      {
        type: 'order_submitted',
        ticket_id: 't1',
        broker_order_id: 'o1',
        symbol: 'AAPL',
        side: 'buy',
        notional_usd: 100,
        strategy: 'CODEX Aggro v0',
        source_signal_id: 'signal-1',
      },
    ],
    brokerPositions: [{ symbol: 'AAPL', qty: '1', market_value: '101.25' }],
    generatedAt: '2026-06-28T22:00:00.000Z',
  });

  assert.equal(result.report.status, 'ok');
  assert.equal(result.report.differences.length, 0);
  assert.notEqual(result.riskState.frozen, true);
});

test('buildReconciliationUpdate reconciles filled quantity despite broker market value drift', () => {
  const result = buildReconciliationUpdate({
    ledgerEvents: [
      {
        type: 'order_filled',
        ticket_id: 't1',
        broker_order_id: 'o1',
        symbol: 'AAPL',
        side: 'buy',
        filled_qty: 1,
        filled_avg_price: 100,
      },
    ],
    brokerPositions: [{ symbol: 'AAPL', qty: '1', market_value: '103.50' }],
    generatedAt: '2026-06-28T22:05:00.000Z',
  });

  assert.equal(result.report.status, 'ok');
  assert.equal(result.report.differences.length, 0);
  assert.notEqual(result.riskState.frozen, true);
});
