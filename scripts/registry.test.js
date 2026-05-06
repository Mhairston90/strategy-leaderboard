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

test('registry includes CODEX Equities Gap Fade v0 local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Equities Gap Fade v0');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/equities_gap_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/equities_gap_trade_log.md');
  assert.equal(row.starting_capital, 10000);
});

test('registry excludes CODEX four-week backtest rows from the live leaderboard', () => {
  const backtestRows = STRATEGIES.filter(strategy => strategy.name.includes('4W Backtest'));

  assert.deepEqual(backtestRows, []);
});

test('registry promotes CODEX Equities Breakout Runner v1 as a live local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Equities Breakout Runner v1');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/equities_breakout_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/equities_breakout_trade_log.md');
  assert.equal(row.starting_capital, 10000);
});

test('registry promotes CODEX Equities Regime Hedge v1 as a live local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Equities Regime Hedge v1');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/equities_hedge_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/equities_hedge_trade_log.md');
  assert.equal(row.starting_capital, 10000);
});
