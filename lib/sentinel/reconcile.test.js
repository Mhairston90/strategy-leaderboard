import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compareLedgerToBroker } from './reconcile.js';

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

  const result = compareLedgerToBroker({
    brokerPositions: [{ symbol: 'AAPL', qty: 'bad', market_value: '100' }],
  });

  assert.equal(result.status, 'error');
  assert.match(result.freeze_reason, /position mismatch/);
  assert.equal(result.differences.length, 1);
});

test('compareLedgerToBroker reports malformed broker positions instead of dropping them', () => {
  const result = compareLedgerToBroker({
    brokerPositions: [{ qty: '1', market_value: '100' }],
  });

  assert.equal(result.status, 'error');
  assert.match(result.freeze_reason, /position mismatch/);
  assert.equal(result.differences.length, 1);
});
