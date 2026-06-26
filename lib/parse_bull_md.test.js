import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTripsWithEntryTime, parsePortfolio, parseTradeLog } from './parse_bull_md.js';

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

test('buildTripsWithEntryTime pairs same-symbol CODEX sleeves independently', () => {
  const md = `
| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|
| 2026-05-04T16:00:00Z | OPEN | ETH/USD | long | 0.2 | 2350 | 2200 | 2600 | - | - | trend-entry | trend |
| 2026-05-04T16:00:00Z | OPEN | ETH/USD | long | 1.2 | 2350 | 2240 | 2600 | - | - | rs-entry | relative_strength |
| 2026-05-17T08:00:00Z | CLOSE | ETH/USD | long | 0.2 | 2186 | - | - | -1.31 | -39.31 | stop-hit | trend |
| 2026-05-17T08:00:00Z | CLOSE | ETH/USD | long | 1.2 | 2186 | - | - | -1.57 | -235.88 | stop-hit | relative_strength |
`;
  const trips = buildTripsWithEntryTime(parseTradeLog(md));

  assert.equal(trips.length, 2);
  assert.deepEqual(trips.map(t => t.pnl), [-39.31, -235.88]);
  assert.deepEqual(trips.map(t => t.r), [-1.31, -1.57]);
});

test('buildTripsWithEntryTime replaces the previous same-symbol close with correction rows', () => {
  const md = `
| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|
| 2026-05-14T16:00:00Z | OPEN | XRP/USD | long | 6334 | 1.46806 | 1.44377 | - | - | - | entry-rule-v0-momentum |
| 2026-05-15T13:00:00Z | CLOSE | XRP/USD | long | 6334 | 1.44305 | - | - | -1.03 | -206.37 | exit-stop-hit |
| 2026-05-15T04:00:00Z | CLOSE | XRP/USD | long | 6334 | 1.47224 | - | - | -0.14 | -21.92 | correction-previous-row |
`;
  const trips = buildTripsWithEntryTime(parseTradeLog(md));

  assert.equal(trips.length, 1);
  assert.equal(trips[0].exit_time, '2026-05-15T04:00:00Z');
  assert.equal(trips[0].pnl, -21.92);
  assert.equal(trips[0].r, -0.14);
  assert.equal(trips[0].reason, 'correction-previous-row');
});

test('parseTradeLog extracts $ PnL from variant-schema rows (R | Reason | Variant, no $ column)', () => {
  // v0.14/v0.15 logs carry no dedicated $ PnL column — the dollar amount is in
  // the Reason prose. Regression for these showing "0 trades" on the board.
  const md = [
    '| Timestamp (UTC) | Action | Pair | Side | Size | Price | Stop | Target | R | Reason | Variant |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    '| 2026-06-20T04:00Z | OPEN | SOL/USD | LONG | 139.55 | 70.77 | 69.605 | 75.431 | — | entry-rule-v0.14 | v0.14-recovery-trend |',
    '| 2026-06-21T22:00Z | CLOSE | SOL/USD | LONG | 139.55 | 73.06 | — | — | +1.97 | exit-ema20-2bar (PnL: 139.55×($73.06−$70.77) = +$319.57/+1.97R) | v0.14-recovery-trend |',
    '| 2026-06-22T20:00Z | CLOSE | AVAX/USD | LONG | 1052.85 | 6.268 | — | — | -0.04 | exit-ema20-2bar (PnL: = −$7.37/−0.04R) | v0.14-recovery-trend |',
  ].join('\n');
  const rows = parseTradeLog(md);
  const closes = rows.filter(r => r.action === 'CLOSE');
  assert.equal(closes.length, 2);
  assert.equal(closes[0].pnl, 319.57);   // extracted from prose, NOT null
  assert.equal(closes[0].r, 1.97);
  assert.equal(closes[1].pnl, -7.37);    // em-dash negative from prose
});
