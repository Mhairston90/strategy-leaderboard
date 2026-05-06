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

test('registry includes CODEX four-week backtest rows', () => {
  const expected = {
    'CODEX v0 4W Backtest': 'codex_4w',
    'CODEX Aggro v0 4W Backtest': 'aggro_4w',
    'CODEX Pulse v0 4W Backtest': 'pulse_4w',
    'CODEX Regime v0 4W Backtest': 'regime_4w',
    'CODEX Apex v0 4W Backtest': 'apex_4w',
    'CODEX Regime WFO v1 4W Backtest': 'regime_wfo_4w',
    'CODEX Apex WFO v1 4W Backtest': 'apex_wfo_4w',
    'CODEX Equities Gap Fade v0 4W Backtest': 'equities_gap_4w',
    'CODEX Equities Gap Fade v1 4W Backtest': 'equities_gap_v1_4w',
    'CODEX Equities Opening Range v1 4W Backtest': 'equities_orb_4w',
    'CODEX Equities RS Pullback v1 4W Backtest': 'equities_rs_4w',
    'CODEX Equities Breakout Runner v1 4W Backtest': 'equities_breakout_4w',
  };

  for (const [name, fileStem] of Object.entries(expected)) {
    const row = STRATEGIES.find(strategy => strategy.name === name);
    assert.ok(row, name);
    assert.equal(row.source.type, 'codex-local');
    assert.equal(row.source.portfolio_path, `data/codex/backtests/${fileStem}_portfolio.md`);
    assert.equal(row.source.trade_log_path, `data/codex/backtests/${fileStem}_trade_log.md`);
    assert.equal(row.starting_capital, 10000);
  }
});

test('registry promotes CODEX Equities Breakout Runner v1 as a live local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Equities Breakout Runner v1');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/equities_breakout_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/equities_breakout_trade_log.md');
  assert.equal(row.starting_capital, 10000);
});
