import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildOrphanReconciliationEvents } from './sentinel_ledger_reconcile.js';

function submittedEvent(overrides = {}) {
  return {
    type: 'order_submitted',
    at: '2026-07-02T12:59:49.459Z',
    ticket_id: 'sentinel-sync-ninjatrader-sim-btc-usd-buy-position-sync-ninjatrader-sim-mbt-07-2',
    broker_order_id: 'NT-orphan-1',
    broker: 'ninjatrader-sim',
    venue: 'ninjatrader-sim',
    symbol: 'BTC/USD',
    instrument: 'MBT 07-26',
    side: 'buy',
    quantity: 1,
    strategy: 'Sentinel Position Sync',
    source_signal_id: 'position-sync:ninjatrader-sim:MBT 07-26:1',
    ...overrides,
  };
}

test('buildOrphanReconciliationEvents terminalizes NinjaTrader submissions with no feedback after the TTL', () => {
  const events = buildOrphanReconciliationEvents({
    ledgerEvents: [submittedEvent()],
    feedbackOrderIds: [],
    ttlMinutes: 15,
    now: '2026-07-02T16:41:00Z',
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'order_rejected');
  assert.equal(events[0].broker_order_id, 'NT-orphan-1');
  assert.equal(events[0].venue, 'ninjatrader-sim');
  assert.equal(events[0].symbol, 'BTC/USD');
  assert.equal(events[0].reason, 'reconciled:orphaned_no_feedback');
});

test('buildOrphanReconciliationEvents skips orders that have feedback files or terminal ledger events', () => {
  const withFeedback = submittedEvent({ broker_order_id: 'NT-has-feedback' });
  const alreadyTerminal = submittedEvent({ broker_order_id: 'NT-terminal' });

  const events = buildOrphanReconciliationEvents({
    ledgerEvents: [
      withFeedback,
      alreadyTerminal,
      {
        type: 'order_rejected',
        at: '2026-07-02T13:05:00Z',
        broker_order_id: 'NT-terminal',
        venue: 'ninjatrader-sim',
        symbol: 'BTC/USD',
        reason: 'ninjatrader feedback: rejected',
      },
    ],
    feedbackOrderIds: ['NT-has-feedback'],
    ttlMinutes: 15,
    now: '2026-07-02T16:41:00Z',
  });

  assert.deepEqual(events, []);
});

test('buildOrphanReconciliationEvents leaves recent submissions alone and deduplicates by broker order id', () => {
  const recent = submittedEvent({ broker_order_id: 'NT-recent', at: '2026-07-02T16:35:00Z' });
  const duplicateA = submittedEvent({ broker_order_id: 'NT-dup', at: '2026-07-02T12:00:00Z' });
  const duplicateB = submittedEvent({ broker_order_id: 'NT-dup', at: '2026-07-02T12:01:00Z' });

  const events = buildOrphanReconciliationEvents({
    ledgerEvents: [recent, duplicateA, duplicateB],
    feedbackOrderIds: [],
    ttlMinutes: 15,
    now: '2026-07-02T16:41:00Z',
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].broker_order_id, 'NT-dup');
});

test('buildOrphanReconciliationEvents ignores non-NinjaTrader submissions', () => {
  const events = buildOrphanReconciliationEvents({
    ledgerEvents: [
      submittedEvent({ venue: 'alpaca-paper', broker: 'alpaca-paper', broker_order_id: 'alpaca-1' }),
      submittedEvent({ broker_order_id: '', venue: 'ninjatrader-sim' }),
    ],
    feedbackOrderIds: [],
    ttlMinutes: 15,
    now: '2026-07-02T16:41:00Z',
  });

  assert.deepEqual(events, []);
});
