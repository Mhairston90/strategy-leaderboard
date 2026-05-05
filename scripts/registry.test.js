import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STRATEGIES } from '../registry.js';


test('registry includes CODEX Pulse v0 local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Pulse v0');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/pulse_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/pulse_trade_log.md');
  assert.equal(row.starting_capital, 10000);
});
