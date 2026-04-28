import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairRoundTrips } from './pairing.js';

test('pairs single entry with single exit, computes long pnl', () => {
  const events = [
    { time: '2026-01-01T10:00Z', symbol: 'BTC', action: 'ENTRY', side: 'long', price: 100, size: 1 },
    { time: '2026-01-01T15:00Z', symbol: 'BTC', action: 'EXIT', side: 'long', price: 110, size: 1 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 1);
  assert.equal(trips[0].pnl, 10);
  assert.equal(trips[0].symbol, 'BTC');
  assert.equal(trips[0].entry_price, 100);
  assert.equal(trips[0].exit_price, 110);
});

test('short trade: profit when price drops', () => {
  const events = [
    { time: '2026-01-01T10:00Z', symbol: 'SOL', action: 'ENTRY', side: 'short', price: 100, size: 2 },
    { time: '2026-01-01T15:00Z', symbol: 'SOL', action: 'EXIT', side: 'short', price: 90, size: 2 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 1);
  assert.equal(trips[0].pnl, 20);
});

test('partial exit closes a fraction', () => {
  const events = [
    { time: '2026-01-01T10:00Z', symbol: 'BTC', action: 'ENTRY', side: 'long', price: 100, size: 4 },
    { time: '2026-01-01T12:00Z', symbol: 'BTC', action: 'PARTIAL_EXIT', side: 'long', price: 110, size: 2 },
    { time: '2026-01-01T15:00Z', symbol: 'BTC', action: 'EXIT', side: 'long', price: 120, size: 2 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 2);
  assert.equal(trips[0].pnl, 20);
  assert.equal(trips[1].pnl, 40);
});

test('multiple symbols tracked independently (FIFO per symbol)', () => {
  const events = [
    { time: '2026-01-01T10:00Z', symbol: 'BTC', action: 'ENTRY', side: 'long', price: 100, size: 1 },
    { time: '2026-01-01T11:00Z', symbol: 'ETH', action: 'ENTRY', side: 'long', price: 50, size: 2 },
    { time: '2026-01-01T15:00Z', symbol: 'BTC', action: 'EXIT', side: 'long', price: 110, size: 1 },
    { time: '2026-01-01T16:00Z', symbol: 'ETH', action: 'EXIT', side: 'long', price: 55, size: 2 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 2);
  assert.equal(trips.find(t => t.symbol === 'BTC').pnl, 10);
  assert.equal(trips.find(t => t.symbol === 'ETH').pnl, 10);
});

test('orphan exit (exit without prior entry) is skipped, no throw', () => {
  const events = [
    { time: '2026-01-01T10:00Z', symbol: 'BTC', action: 'EXIT', side: 'long', price: 110, size: 1 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 0);
});

test('pyramid entry: two entries then one big exit closes both FIFO', () => {
  const events = [
    { time: '2026-01-01T10:00Z', symbol: 'BTC', action: 'ENTRY', side: 'long', price: 100, size: 1 },
    { time: '2026-01-01T11:00Z', symbol: 'BTC', action: 'ENTRY', side: 'long', price: 105, size: 1 },
    { time: '2026-01-01T15:00Z', symbol: 'BTC', action: 'EXIT', side: 'long', price: 120, size: 2 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 2);
  assert.equal(trips[0].pnl, 20);
  assert.equal(trips[1].pnl, 15);
});

test('events processed in chronological order regardless of input order', () => {
  const events = [
    { time: '2026-01-01T15:00Z', symbol: 'BTC', action: 'EXIT', side: 'long', price: 110, size: 1 },
    { time: '2026-01-01T10:00Z', symbol: 'BTC', action: 'ENTRY', side: 'long', price: 100, size: 1 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 1);
  assert.equal(trips[0].pnl, 10);
});
