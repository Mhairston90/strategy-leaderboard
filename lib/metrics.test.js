import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  profitFactor, maxDrawdown, sharpe, winPct, avgR, pctReturn,
  dailyReturnsFromTrades
} from './metrics.js';

test('profitFactor: simple wins and losses', () => {
  assert.equal(profitFactor([10, -5, 20, -10]), 30 / 15);
});

test('profitFactor: all wins returns Infinity', () => {
  assert.equal(profitFactor([10, 20]), Infinity);
});

test('profitFactor: empty array returns null', () => {
  assert.equal(profitFactor([]), null);
});

test('profitFactor: all losses returns 0', () => {
  assert.equal(profitFactor([-10, -5]), 0);
});

test('maxDrawdown: peak-to-trough on running equity', () => {
  // PnLs: +10, +20, -15, -10 -> equity 10, 30, 15, 5 -> peak 30, trough 5 -> DD 25/30 = 83.33%
  const dd = maxDrawdown([10, 20, -15, -10]);
  assert.ok(Math.abs(dd - (-83.33)) < 0.1, `expected ~-83.33, got ${dd}`);
});

test('maxDrawdown: monotonic up returns 0', () => {
  assert.equal(maxDrawdown([10, 20, 30]), 0);
});

test('maxDrawdown: empty array returns 0', () => {
  assert.equal(maxDrawdown([]), 0);
});

test('sharpe: stable positive returns produces positive sharpe', () => {
  const s = sharpe([0.01, 0.012, 0.008, 0.011, 0.009]);
  assert.ok(s > 0, `expected positive, got ${s}`);
});

test('sharpe: zero variance returns null', () => {
  assert.equal(sharpe([0.01, 0.01, 0.01]), null);
});

test('sharpe: < 2 returns produces null', () => {
  assert.equal(sharpe([0.01]), null);
  assert.equal(sharpe([]), null);
});

test('winPct: 50% winners', () => {
  assert.equal(winPct([10, -5, 20, -10]), 50);
});

test('winPct: empty returns null', () => {
  assert.equal(winPct([]), null);
});

test('avgR: mean of valid R-multiples, ignores nulls', () => {
  assert.equal(avgR([1, -1, 2, null, NaN]), (1 - 1 + 2) / 3);
});

test('avgR: all-null returns null', () => {
  assert.equal(avgR([null, NaN]), null);
});

test('pctReturn: total pnl divided by capital', () => {
  assert.equal(pctReturn([100, 200, -50], 1000), 25);
});

test('dailyReturnsFromTrades: groups by exit-date and normalizes', () => {
  const trips = [
    { exit_time: '2026-01-01T10:00:00Z', pnl: 100 },
    { exit_time: '2026-01-01T15:00:00Z', pnl: -50 },
    { exit_time: '2026-01-02T10:00:00Z', pnl: 75 },
  ];
  const returns = dailyReturnsFromTrades(trips, 1000);
  // Day 1: +50 on 1000 capital -> 0.05; Day 2 starts at 1050, +75 -> 0.0714
  assert.equal(returns.length, 2);
  assert.ok(Math.abs(returns[0] - 0.05) < 1e-9);
  assert.ok(Math.abs(returns[1] - 75 / 1050) < 1e-9);
});
