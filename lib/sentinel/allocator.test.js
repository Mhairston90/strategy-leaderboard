import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildAllocationModel, validateAllocationConfig } from './allocator.js';

const allocationConfig = {
  strategies: [
    { name: 'CODEX Regime Plus L/S v1', target_weight: 0.22, role: 'core_return_engine' },
    { name: 'Basket Breakout Aggressive v1', target_weight: 0.20, role: 'independent_breakout' },
    { name: 'CODEX Aggro v0', target_weight: 0.18, role: 'proven_crypto_momentum' },
    { name: 'CODEX Aggro Short Plus Quality v2', target_weight: 0.15, role: 'quality_short_momentum' },
    { name: 'Stocks Mean Reversion v2 (RSI<15)', target_weight: 0.15, role: 'equity_mean_reversion_stabilizer' },
    { name: 'FABLE Equities Fader v1', target_weight: 0.10, role: 'diversifier' },
  ],
};

test('validateAllocationConfig accepts the six-sleeve allocation', () => {
  assert.deepEqual(validateAllocationConfig(allocationConfig), { ok: true, errors: [] });
});

test('buildAllocationModel joins rows and marks missing rows blocked', () => {
  const rows = [
    { name: 'CODEX Regime Plus L/S v1', status: 'live', trades_n: 57, returns: { '90d': 21.7 }, max_dd: -5.4 },
    { name: 'Basket Breakout Aggressive v1', status: 'live', trades_n: 58, returns: { '90d': 18.3 }, max_dd: -7.4 },
  ];
  const model = buildAllocationModel(allocationConfig, rows);

  assert.equal(model.totalTargetWeight, 1);
  assert.equal(model.items[0].status, 'active');
  assert.equal(model.items[2].status, 'blocked');
  assert.match(model.items[2].reason, /missing leaderboard row/);
});

test('buildAllocationModel keeps live warning rows active', () => {
  const rows = [
    {
      name: 'CODEX Regime Plus L/S v1',
      status: 'live',
      trades_n: 57,
      returns: { '90d': 21.7 },
      max_dd: -5.4,
      errors: ['routine warning'],
    },
  ];
  const model = buildAllocationModel(allocationConfig, rows);

  assert.equal(model.items[0].status, 'active');
});

test('buildAllocationModel coerces non-array leaderboard rows to empty rows', () => {
  const model = buildAllocationModel(allocationConfig, null);

  assert.equal(model.items.length, allocationConfig.strategies.length);
  assert.equal(model.items[0].status, 'blocked');
  assert.match(model.items[0].reason, /missing leaderboard row/);
});
