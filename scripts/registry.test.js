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

test('registry promotes CODEX equities intraday challenger rows', () => {
  const expected = [
    [
      'CODEX Equities Opening Range v1',
      'data/codex/equities_orb_portfolio.md',
      'data/codex/equities_orb_trade_log.md',
    ],
    [
      'CODEX Equities RS Pullback v1',
      'data/codex/equities_rs_portfolio.md',
      'data/codex/equities_rs_trade_log.md',
    ],
    [
      'CODEX Equities VWAP Reversal v1',
      'data/codex/equities_vwap_portfolio.md',
      'data/codex/equities_vwap_trade_log.md',
    ],
  ];

  for (const [name, portfolioPath, tradeLogPath] of expected) {
    const row = STRATEGIES.find(strategy => strategy.name === name);

    assert.ok(row, `${name} missing from registry`);
    assert.equal(row.source.type, 'codex-local');
    assert.equal(row.source.portfolio_path, portfolioPath);
    assert.equal(row.source.trade_log_path, tradeLogPath);
    assert.equal(row.starting_capital, 10000);
    assert.equal(row.killswitch_dd_pct, 20);
    assert.equal(row.live_start_iso, '2026-05-28T00:00:00Z');
  }
});

test('registry does not double count BULL scheduler replay overlay after upstream publish', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'BULL v0');
  const replayRow = STRATEGIES.find(strategy => strategy.name === 'BULL v0 Scheduler Replay');

  assert.ok(row);
  assert.equal(replayRow, undefined);
  assert.equal(row.status, undefined);
  assert.equal(row.source.type, 'bull-github');
  assert.equal(row.source.portfolio_path, 'memory/portfolio.md');
  assert.equal(row.source.trade_log_path, 'memory/trade_log.md');
  assert.equal(row.source.overlay_trade_log_path, undefined);
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

test('registry promotes CODEX Equities Mean Reversion v1 as a live local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Equities Mean Reversion v1');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/equities_mean_reversion_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/equities_mean_reversion_trade_log.md');
  assert.equal(row.starting_capital, 10000);
});

test('registry includes CODEX Equities Connors MR v1 with an honest live start', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Equities Connors MR v1');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/equities_connors_mr_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/equities_connors_mr_trade_log.md');
  assert.equal(row.starting_capital, 10000);
  assert.equal(row.killswitch_dd_pct, 15);
  assert.equal(row.live_start_iso, '2026-05-26T00:00:00Z');
});

test('registry includes CODEX Aggro Plus v1 local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Aggro Plus v1');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/aggro_plus_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/aggro_plus_trade_log.md');
  assert.equal(row.starting_capital, 10000);
  assert.equal(row.killswitch_dd_pct, 50);
});

test('registry includes CODEX Aggro Short Plus v1 local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Aggro Short Plus v1');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/aggro_short_plus_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/aggro_short_plus_trade_log.md');
  assert.equal(row.starting_capital, 10000);
  assert.equal(row.killswitch_dd_pct, 50);
});

test('registry includes CODEX Aggro Plus L/S v1 local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Aggro Plus L/S v1');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/aggro_plus_ls_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/aggro_plus_ls_trade_log.md');
  assert.equal(row.starting_capital, 10000);
  assert.equal(row.killswitch_dd_pct, 60);
});

test('registry includes CODEX Aggro Short Plus Quality v2 local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Aggro Short Plus Quality v2');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/aggro_short_plus_quality_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/aggro_short_plus_quality_trade_log.md');
  assert.equal(row.starting_capital, 10000);
  assert.equal(row.killswitch_dd_pct, 50);
});

test('registry includes CODEX Aggro Plus L/S Quality v2 local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Aggro Plus L/S Quality v2');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/aggro_plus_ls_quality_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/aggro_plus_ls_quality_trade_log.md');
  assert.equal(row.starting_capital, 10000);
  assert.equal(row.killswitch_dd_pct, 60);
});

test('registry includes CODEX Regime Plus v1 local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Regime Plus v1');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/regime_plus_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/regime_plus_trade_log.md');
  assert.equal(row.starting_capital, 10000);
  assert.equal(row.killswitch_dd_pct, 25);
});

test('registry includes CODEX Regime Short Plus v1 local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Regime Short Plus v1');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/regime_short_plus_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/regime_short_plus_trade_log.md');
  assert.equal(row.starting_capital, 10000);
  assert.equal(row.killswitch_dd_pct, 25);
});

test('registry includes CODEX Regime Plus L/S v1 local row', () => {
  const row = STRATEGIES.find(strategy => strategy.name === 'CODEX Regime Plus L/S v1');

  assert.ok(row);
  assert.equal(row.source.type, 'codex-local');
  assert.equal(row.source.portfolio_path, 'data/codex/regime_plus_ls_portfolio.md');
  assert.equal(row.source.trade_log_path, 'data/codex/regime_plus_ls_trade_log.md');
  assert.equal(row.starting_capital, 10000);
  assert.equal(row.killswitch_dd_pct, 30);
});

test('registry includes CODEX counter-Bull canary rows', () => {
  const expected = [
    [
      'CODEX Convex Crypto Scout v1',
      'data/codex/convex_crypto_scout_portfolio.md',
      'data/codex/convex_crypto_scout_trade_log.md',
      35,
    ],
    [
      'CODEX Aggro Quality v3',
      'data/codex/aggro_quality_portfolio.md',
      'data/codex/aggro_quality_trade_log.md',
      35,
    ],
    [
      'CODEX Equities MR Quality v2',
      'data/codex/equities_mean_reversion_quality_portfolio.md',
      'data/codex/equities_mean_reversion_quality_trade_log.md',
      15,
    ],
    [
      'CODEX Equities Near-Breakout Pullback v1',
      'data/codex/equities_near_breakout_pullback_portfolio.md',
      'data/codex/equities_near_breakout_pullback_trade_log.md',
      20,
    ],
  ];

  for (const [name, portfolioPath, tradeLogPath, dd] of expected) {
    const row = STRATEGIES.find(strategy => strategy.name === name);

    assert.ok(row, `${name} missing from registry`);
    assert.equal(row.source.type, 'codex-local');
    assert.equal(row.source.portfolio_path, portfolioPath);
    assert.equal(row.source.trade_log_path, tradeLogPath);
    assert.equal(row.starting_capital, 10000);
    assert.equal(row.killswitch_dd_pct, dd);
    assert.equal(row.live_start_iso, '2026-05-25T00:00:00Z');
  }
});

test('registry includes the Opus 4.8 diversified-8 Mean Reversion expansion rows', () => {
  const expected = [
    [
      'Stocks Mean Reversion v2 Fast-Exit',
      'data/stock_variants/stocks_mean_reversion_v2_fast_portfolio.md',
      'data/stock_variants/stocks_mean_reversion_v2_fast_trade_log.md',
      18,
    ],
    [
      'Stocks Mean Reversion v2 Broad-Heat',
      'data/stock_variants/stocks_mean_reversion_v2_heat8_portfolio.md',
      'data/stock_variants/stocks_mean_reversion_v2_heat8_trade_log.md',
      18,
    ],
    [
      'Stocks Mean Reversion v2 Balanced (1.5%)',
      'data/stock_variants/stocks_mean_reversion_v2_bal_portfolio.md',
      'data/stock_variants/stocks_mean_reversion_v2_bal_trade_log.md',
      25,
    ],
    [
      'Stocks Mean Reversion v2 (RSI<5) Aggressive',
      'data/stock_variants/stocks_mean_reversion_v2_rsi5_agg_portfolio.md',
      'data/stock_variants/stocks_mean_reversion_v2_rsi5_agg_trade_log.md',
      40,
    ],
    [
      'Stocks Mean Reversion Deep Diversified (RSI<3)',
      'data/stock_variants/stocks_mean_reversion_deep_div_portfolio.md',
      'data/stock_variants/stocks_mean_reversion_deep_div_trade_log.md',
      40,
    ],
  ];

  for (const [name, portfolioPath, tradeLogPath, dd] of expected) {
    const row = STRATEGIES.find(strategy => strategy.name === name);

    assert.ok(row, `${name} missing from registry`);
    assert.equal(row.source.type, 'codex-local');
    assert.equal(row.source.portfolio_path, portfolioPath);
    assert.equal(row.source.trade_log_path, tradeLogPath);
    assert.equal(row.starting_capital, 10000);
    assert.equal(row.killswitch_dd_pct, dd);
    assert.equal(row.live_start_iso, '2026-05-28T00:00:00Z');
  }
});

test('registry wires in the Crypto Mean Reversion family with an honest forward start', () => {
  const expected = [
    [
      'Crypto Mean Reversion v1',
      'data/crypto_variants/crypto_mean_reversion_v1_portfolio.md',
      'data/crypto_variants/crypto_mean_reversion_v1_trade_log.md',
      18,
    ],
    [
      'Crypto Mean Reversion Aggressive',
      'data/crypto_variants/crypto_mean_reversion_agg_portfolio.md',
      'data/crypto_variants/crypto_mean_reversion_agg_trade_log.md',
      40,
    ],
  ];

  for (const [name, portfolioPath, tradeLogPath, dd] of expected) {
    const row = STRATEGIES.find(strategy => strategy.name === name);

    assert.ok(row, `${name} missing from registry`);
    assert.equal(row.source.type, 'codex-local');
    assert.equal(row.source.portfolio_path, portfolioPath);
    assert.equal(row.source.trade_log_path, tradeLogPath);
    assert.equal(row.starting_capital, 10000);
    assert.equal(row.killswitch_dd_pct, dd);
    assert.equal(row.live_start_iso, '2026-05-28T00:00:00Z');
  }
});

test('registry includes CODEX Markov regime strategy rows', () => {
  const expected = [
    [
      'CODEX Markov Directional v1',
      'data/codex/markov_directional_portfolio.md',
      'data/codex/markov_directional_trade_log.md',
      30,
    ],
    [
      'CODEX Markov Gate v1',
      'data/codex/markov_gate_portfolio.md',
      'data/codex/markov_gate_trade_log.md',
      20,
    ],
  ];

  for (const [name, portfolioPath, tradeLogPath, dd] of expected) {
    const row = STRATEGIES.find(strategy => strategy.name === name);

    assert.ok(row, `${name} missing from registry`);
    assert.equal(row.source.type, 'codex-local');
    assert.equal(row.source.portfolio_path, portfolioPath);
    assert.equal(row.source.trade_log_path, tradeLogPath);
    assert.equal(row.starting_capital, 10000);
    assert.equal(row.killswitch_dd_pct, dd);
    assert.equal(row.live_start_iso, '2026-05-26T00:00:00Z');
  }
});
