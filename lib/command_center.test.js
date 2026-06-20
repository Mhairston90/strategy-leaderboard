import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCommandCenterModel,
  parseGoalStatusText,
  parsePortfolioOpenPositions,
  parseShadowReportText,
  renderCommandCenterHtml,
  renderStrategyDrawerHtml,
} from './command_center.js';
import { parseTradeForensicsText } from './forensics.js';
import { parseHermesQueueText } from './hermes.js';

const tradeLogA = `# Strategy A Trade Log

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|
| 2026-05-10T10:00:00Z | OPEN | BTC/USD | long | 1 | 100 | 95 | 110 | - | - | breakout | trend |
| 2026-05-11T10:00:00Z | CLOSE | BTC/USD | long | 1 | 110 | - | - | 2.00 | +100.00 | target-hit | trend |
| 2026-05-12T10:00:00Z | OPEN | ETH/USD | long | 2 | 50 | 47 | 58 | - | - | pulse | pulse |
`;

const portfolioA = `# Strategy A Portfolio

## Open positions

| Pair | Sleeve | Side | Size | Entry | Stop | MTM price | Unrealized PnL | Exposure |
|------|--------|------|------|-------|------|-----------|----------------|----------|
| ETH/USD | pulse | long | 2.000000 | 50.00 | 47.00 | 55.00 | $10.00 | $110.00 |
`;

const sheetResp = {
  ok: true,
  headers: ['timestamp', 'asset', 'signal', 'price', 'pnl_dollar', 'r_multiple', 'notes'],
  rows: [
    {
      timestamp: '2026-05-13T10:00:00Z',
      asset: 'SOLUSD',
      signal: 'EXIT_LONG',
      price: 90,
      pnl_dollar: -25,
      r_multiple: -1,
      notes: 'stop hit',
    },
  ],
};

const rows = [
  {
    name: 'Strategy A',
    status: 'live',
    returns: { '7d': 1, '30d': 1, '90d': 1, all: 1 },
    sharpe: 1.1,
    pf: 1.5,
    max_dd: -2,
    win_pct: 100,
    trades_n: 1,
    avg_r: 2,
    last_signal_at: '2026-05-12T10:00:00Z',
    errors: [],
  },
  {
    name: 'Sheet Strategy',
    status: 'live',
    returns: { '7d': -1, '30d': -1, '90d': -1, all: -1 },
    sharpe: null,
    pf: 0,
    max_dd: -1,
    win_pct: 0,
    trades_n: 1,
    avg_r: -1,
    last_signal_at: '2026-05-13T10:00:00Z',
    errors: [],
  },
  {
    name: 'Blocked Strategy',
    status: 'live',
    returns: { '7d': 2, '30d': 2, '90d': 2, all: 2 },
    sharpe: 2,
    pf: 2,
    max_dd: -1,
    win_pct: 60,
    trades_n: 30,
    avg_r: 0.4,
    last_signal_at: '2026-05-13T10:00:00Z',
    errors: [],
  },
];

const registry = [
  { name: 'Strategy A', starting_capital: 10000, killswitch_dd_pct: 10 },
  { name: 'Sheet Strategy', starting_capital: 5000, killswitch_dd_pct: 8 },
  { name: 'Blocked Strategy', starting_capital: 10000, killswitch_dd_pct: 8 },
];

const snapshots = [
  {
    strategy: registry[0],
    row: rows[0],
    portfolio: { ok: true, text: portfolioA },
    tradeLog: { ok: true, text: tradeLogA },
  },
  {
    strategy: registry[1],
    row: rows[1],
    sheet: sheetResp,
  },
  {
    strategy: registry[2],
    row: rows[2],
    portfolio: { ok: true, text: '' },
    tradeLog: { ok: true, text: '' },
  },
];

test('parseGoalStatusText reads the CODEX goal scoreboard', () => {
  const report = parseGoalStatusText(`# CODEX Goal Status

| Strategy | Status | Closed trades | Weeks observed | PF | Sharpe | Drawdown | DD limit | Notes |
|----------|--------|---------------|----------------|----|--------|----------|----------|-------|
| Strategy A | collecting | 35 | 6.5 | 1.50 | 1.10 | 2.00% | 10.00% | enough sample |
`);

  assert.equal(report.byStrategy.get('Strategy A').closedTrades, 35);
  assert.equal(report.byStrategy.get('Strategy A').weeksObserved, 6.5);
  assert.equal(report.byStrategy.get('Strategy A').pf, 1.5);
});

test('parsePortfolioOpenPositions extracts exposure rows', () => {
  const positions = parsePortfolioOpenPositions(portfolioA, 'Strategy A');

  assert.equal(positions.length, 1);
  assert.equal(positions[0].pair, 'ETH/USD');
  assert.equal(positions[0].side, 'long');
  assert.equal(positions[0].exposure, 110);
});

test('parsePortfolioOpenPositions reads BULL 11-column layout (entry-ts year does not leak into P&L)', () => {
  // Regression for the 2026-06-20 display bug: the positional parser put BULL's
  // "Entry ts (UTC)" into the P&L column, rendering "2026" as "$2026.00".
  const portfolioBull = `# BULL Portfolio State

## Open positions

| Pair | Side | Size | Entry | Stop (initial 2×ATR) | Active stop | Target (4R) | Entry ts (UTC) | Last (MTM) | Unrealized R | Unrealized $ |
|---|---|---|---|---|---|---|---|---|---|---|
| SOL/USD | long | 121.5347 | 71.17 | 69.9072 | 69.9072 | 76.2212 | 2026-06-20T13:00:00Z | 71.96 | +0.626 | +96.01 |

Portfolio risk-at-moment: **1.49%**.

## Active kill-switch state
- all clear
`;
  const positions = parsePortfolioOpenPositions(portfolioBull, 'BULL v0');
  assert.equal(positions.length, 1);
  const p = positions[0];
  assert.equal(p.pair, 'SOL/USD');
  assert.equal(p.side, 'long');
  assert.equal(p.size, 121.5347);
  assert.equal(p.entry, 71.17);
  assert.equal(p.mark, 71.96);
  assert.equal(p.unrealizedPnl, 96.01);          // the real P&L — NOT 2026
  assert.ok(Math.abs(p.exposure - 121.5347 * 71.96) < 0.01); // computed: no Exposure column
});

test('buildCommandCenterModel enriches open trades for the trade desk', () => {
  const forensicsReport = parseTradeForensicsText(`# Trade Forensics

| Recorded (UTC) | Strategy | Cycle time | Data source | Quality | Symbols checked | Warnings | Blockers | Opened | Closed | Open reason tags | Close reason tags | Candidates |
|----------------|----------|------------|-------------|---------|-----------------|----------|----------|--------|--------|------------------|-------------------|------------|
| 2026-05-13T11:00:00Z | Strategy A | 2026-05-13T10:00:00Z | live | ok | BTC/USD | - | - | 0 | 0 | - | - | 0 |
`);
  const model = buildCommandCenterModel({
    rows,
    registry,
    snapshots,
    forensicsReport,
    selectedNames: ['Strategy A'],
  });

  assert.equal(model.openTrades.length, 1);
  assert.equal(model.openTrades[0].strategy, 'Strategy A');
  assert.equal(model.openTrades[0].pair, 'ETH/USD');
  assert.equal(model.openTrades[0].unrealizedPnl, 10);
  assert.equal(model.openTrades[0].pnlPct, 10);
  assert.equal(Math.round(model.openTrades[0].distanceToStopPct * 10) / 10, 14.5);
  assert.equal(model.openTrades[0].ageHours, 24);
  assert.equal(model.openTrades[0].status, 'Clean');
});

test('buildCommandCenterModel builds closed trade analyst scores', () => {
  const model = buildCommandCenterModel({
    rows,
    registry,
    snapshots,
    selectedNames: ['Strategy A'],
  });

  const closed = model.closedTrades.find(trade => trade.strategy === 'Strategy A');
  assert.equal(closed.symbol, 'BTC/USD');
  assert.equal(closed.side, 'long');
  assert.equal(closed.pnl, 100);
  assert.equal(closed.r, 2);
  assert.equal(closed.holdHours, 24);
  assert.equal(closed.analystScore >= 80, true);
  assert.equal(closed.scoreLabel, 'Strong');
});

test('buildCommandCenterModel computes heat, readiness, recent trades, and ensemble', () => {
  const forensicsReport = parseTradeForensicsText(`# Trade Forensics

| Recorded (UTC) | Strategy | Cycle time | Data source | Quality | Symbols checked | Warnings | Blockers | Opened | Closed | Open reason tags | Close reason tags | Candidates |
|----------------|----------|------------|-------------|---------|-----------------|----------|----------|--------|--------|------------------|-------------------|------------|
| 2026-05-13T11:00:00Z | Strategy A | 2026-05-13T10:00:00Z | live | ok | BTC/USD | - | - | 0 | 0 | - | - | 0 |
| 2026-05-13T11:05:00Z | Strategy A | 2026-05-13T10:00:00Z | cache | skipped | BTC/USD | using cached market data | cycle already recorded | 0 | 0 | - | - | 0 |
| 2026-05-13T11:01:00Z | Blocked Strategy | 2026-05-13T10:00:00Z | live | blocked | BTC/USD | - | missing candles | 0 | 0 | - | - | 0 |
`);
  const goals = parseGoalStatusText(`# CODEX Goal Status

| Strategy | Status | Closed trades | Weeks observed | PF | Sharpe | Drawdown | DD limit | Notes |
|----------|--------|---------------|----------------|----|--------|----------|----------|-------|
| Strategy A | collecting | 35 | 6.5 | 1.50 | 1.10 | 2.00% | 10.00% | enough sample |
`);
  const hermes = parseHermesQueueText(JSON.stringify({
    generated_at: '2026-05-13T12:00:00Z',
    items: [
      {
        id: 'a',
        type: 'sample_collection',
        priority: 3,
        title: 'Keep collecting sample for Strategy A',
        requested_action: 'Keep in rotation.',
      },
    ],
  }));
  const shadow = parseShadowReportText(`# Regime Session Shadow Report

| Cycle time | Strategy | Pair | Session | Regime | Shadow decision | Actual opened | Reason |
|------------|----------|------|---------|--------|-----------------|---------------|--------|
| 2026-05-12T10:00:00Z | Strategy A | ETH/USD | weekend | compression | block | yes | throttle |
`);

  const model = buildCommandCenterModel({
    rows,
    registry,
    snapshots,
    forensicsReport,
    goalReport: goals,
    hermesQueue: hermes,
    shadowReport: shadow,
    selectedNames: ['Strategy A', 'Sheet Strategy'],
  });

  assert.equal(model.heat.totalExposure, 110);
  assert.equal(model.heat.bySymbol[0].symbol, 'ETH/USD');
  assert.equal(model.readiness.byName.get('Strategy A').status, 'Eligible');
  assert.equal(model.readiness.byName.get('Blocked Strategy').status, 'Pause');
  assert.equal(model.recentTrades[0].strategy, 'Sheet Strategy');
  assert.equal(model.ensemble.trades, 2);
  assert.equal(model.ensemble.returnPct, 0.5);
  assert.equal(model.details.byName.get('Strategy A').shadowRows.length, 1);
  assert.equal(model.details.byName.get('Strategy A').hermesItems.length, 1);
  assert.equal(model.details.byName.get('Strategy A').quality.quality, 'ok');
});

test('renderers escape strategy content and expose dashboard sections', () => {
  const model = buildCommandCenterModel({
    rows: [{ ...rows[0], name: 'Strategy <A>' }],
    registry: [{ name: 'Strategy <A>', starting_capital: 10000, killswitch_dd_pct: 10 }],
    snapshots: [{
      strategy: { name: 'Strategy <A>', starting_capital: 10000 },
      row: { ...rows[0], name: 'Strategy <A>' },
      portfolio: { ok: true, text: portfolioA },
      tradeLog: { ok: true, text: tradeLogA },
    }],
    selectedNames: ['Strategy <A>'],
  });

  const commandHtml = renderCommandCenterHtml(model);
  const drawerHtml = renderStrategyDrawerHtml(model, 'Strategy <A>');

  assert.match(commandHtml, /Open Trade Monitor/);
  assert.match(commandHtml, /Closed Trade Review/);
  assert.match(commandHtml, /Trade Analyst Score/);
  assert.match(commandHtml, /Recent Trades/);
  assert.doesNotMatch(commandHtml, /Portfolio Heat/);
  assert.doesNotMatch(commandHtml, /Promotion Readiness/);
  assert.doesNotMatch(commandHtml, /Ensemble View/);
  assert.match(commandHtml, /Strategy &lt;A&gt;/);
  assert.doesNotMatch(commandHtml, /Strategy <A>/);
  assert.match(drawerHtml, /Strategy Detail/);
  assert.match(drawerHtml, /ETH\/USD/);
});
