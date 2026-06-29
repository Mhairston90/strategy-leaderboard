import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyStrategy, buildPromotionStatus } from './promotion_engine.js';

test('classifyStrategy promotes proven positive strategies to core', () => {
  const row = {
    name: 'CODEX Aggro v0',
    status: 'live',
    trades_n: 47,
    returns: { '90d': 12.6, '30d': 6.6, '7d': 5.8 },
    pf: 2.23,
    sharpe: 6.12,
    max_dd: -3.0,
    errors: [],
  };
  const result = classifyStrategy(row, { coreNames: new Set(['CODEX Aggro v0']) });
  assert.equal(result.status, 'core');
  assert.match(result.reason, /configured core/);
});

test('classifyStrategy promotes usable zero-trade core names to core', () => {
  const result = classifyStrategy({
    name: 'New Core',
    status: 'live',
    trades_n: 0,
    returns: {},
    errors: [],
  }, { coreNames: new Set(['New Core']) });

  assert.equal(result.status, 'core');
  assert.match(result.reason, /configured core/);
});

test('classifyStrategy blocks error rows even when configured as core', () => {
  const result = classifyStrategy({
    name: 'Broken Core',
    status: 'error',
    trades_n: 0,
    returns: {},
    errors: ['missing'],
  }, { coreNames: new Set(['Broken Core']) });

  assert.equal(result.status, 'blocked');
});

test('classifyStrategy promotes live warning core rows to core', () => {
  const result = classifyStrategy({
    name: 'Warning Core',
    status: 'live',
    trades_n: 18,
    returns: { '90d': 4, '30d': 1 },
    pf: 1.6,
    max_dd: -2,
    errors: ['routine warning'],
  }, { coreNames: new Set(['Warning Core']) });

  assert.equal(result.status, 'core');
  assert.match(result.reason, /configured core/);
});

test('classifyStrategy blocks error rows and watches thin winners', () => {
  assert.equal(classifyStrategy({ name: 'Broken', status: 'error', trades_n: 0, returns: {}, errors: ['missing'] }).status, 'blocked');
  assert.equal(classifyStrategy({ name: 'Thin', status: 'live', trades_n: 9, returns: { '90d': 11 }, pf: 3, max_dd: -1, errors: [] }).status, 'satellite');
});

test('classifyStrategy watches proven non-core rows with infinite profit factor', () => {
  const result = classifyStrategy({
    name: 'Strong Non Core',
    status: 'live',
    trades_n: 24,
    returns: { '90d': 8, '30d': 1 },
    pf: Infinity,
    max_dd: -4,
    errors: [],
  });

  assert.equal(result.status, 'watch');
});

test('classifyStrategy cools down rows with negative 90d returns', () => {
  const result = classifyStrategy({
    name: 'Weak Non Core',
    status: 'live',
    trades_n: 24,
    returns: { '90d': -2, '30d': 4 },
    pf: 2,
    max_dd: -2,
    errors: [],
  });

  assert.equal(result.status, 'cooldown');
});

test('classifyStrategy cools down thin rows with negative 30d returns', () => {
  const result = classifyStrategy({
    name: 'Thin Weak Short Term',
    status: 'live',
    trades_n: 9,
    returns: { '90d': 8, '30d': -1 },
    pf: 1.5,
    max_dd: -2,
    errors: [],
  });

  assert.notEqual(result.status, 'satellite');
  assert.equal(result.status, 'cooldown');
});

test('buildPromotionStatus returns every strategy with generated timestamp', () => {
  const report = buildPromotionStatus([
    { name: 'A', status: 'live', trades_n: 22, returns: { '90d': 3, '30d': 2 }, pf: 1.4, max_dd: -1, errors: [] },
    { name: 'B', status: 'error', trades_n: 0, returns: {}, errors: ['missing'] },
  ], { generatedAt: '2026-06-28T18:00:00Z', coreNames: new Set(['A']) });

  assert.equal(report.generated_at, '2026-06-28T18:00:00Z');
  assert.equal(report.strategies.length, 2);
  assert.equal(report.strategies[0].status, 'core');
  assert.equal(report.strategies[1].status, 'blocked');
});

test('buildPromotionStatus coerces non-array rows to empty strategies', () => {
  const report = buildPromotionStatus(null, { generatedAt: '2026-06-28T18:00:00Z' });

  assert.deepEqual(report, {
    generated_at: '2026-06-28T18:00:00Z',
    strategies: [],
  });
});
