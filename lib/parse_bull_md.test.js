import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePortfolio, parseTradeLog } from './parse_bull_md.js';

const portfolioMd = readFileSync(new URL('../fixtures/bull-portfolio.md', import.meta.url), 'utf8');
const tradeLogMd  = readFileSync(new URL('../fixtures/bull-trade-log.md', import.meta.url), 'utf8');

test('parsePortfolio extracts cash, equity, peak, drawdown, realized', () => {
  const p = parsePortfolio(portfolioMd);
  assert.ok(p.cash > 0, `cash should parse to positive, got ${p.cash}`);
  assert.ok(p.equity > 0, `equity should parse to positive, got ${p.equity}`);
  assert.ok(p.peak >= p.equity, `peak (${p.peak}) should be >= current equity (${p.equity})`);
  assert.ok(p.drawdown_pct >= 0, `drawdown_pct should be non-negative, got ${p.drawdown_pct}`);
  assert.equal(typeof p.realized_pnl, 'number');
});

test('parsePortfolio handles negative realized PnL with em-dash', () => {
  const md = '- Realized PnL (all-time): **−$222.89**';
  const p = parsePortfolio(md);
  assert.equal(p.realized_pnl, -222.89);
});

test('parsePortfolio handles ASCII minus realized PnL', () => {
  const md = '- Realized PnL (all-time): **-$222.89**';
  const p = parsePortfolio(md);
  assert.equal(p.realized_pnl, -222.89);
});

test('parseTradeLog returns OPEN and CLOSE rows', () => {
  const rows = parseTradeLog(tradeLogMd);
  assert.ok(rows.length > 0, 'should parse at least one row');
  const opens = rows.filter(r => r.action === 'OPEN');
  const closes = rows.filter(r => r.action === 'CLOSE');
  assert.ok(opens.length > 0, 'should have at least one OPEN row');
  assert.ok(closes.length > 0, 'should have at least one CLOSE row');
});

test('parseTradeLog: CLOSE row has r and pnl populated', () => {
  const rows = parseTradeLog(tradeLogMd);
  const close = rows.find(r => r.action === 'CLOSE');
  assert.equal(typeof close.r, 'number');
  assert.equal(typeof close.pnl, 'number');
  assert.ok(close.symbol.includes('/'), `symbol should look like X/Y, got ${close.symbol}`);
});

test('parseTradeLog: OPEN row has stop populated, r/pnl null', () => {
  const rows = parseTradeLog(tradeLogMd);
  const open = rows.find(r => r.action === 'OPEN');
  assert.equal(open.r, null);
  assert.equal(open.pnl, null);
});

test('parseTradeLog skips header and separator lines', () => {
  const rows = parseTradeLog(tradeLogMd);
  for (const r of rows) {
    assert.ok(r.action === 'OPEN' || r.action === 'CLOSE',
      `unexpected action: ${r.action}`);
  }
});
