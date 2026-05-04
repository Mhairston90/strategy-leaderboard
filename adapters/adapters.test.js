import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import adaptAnalystHY    from './adapter_analyst_hy.js';
import adaptAggroDoge    from './adapter_aggro_doge.js';
import adaptHYv4         from './adapter_hy_v4.js';
import adaptV7BtcTG      from './adapter_v7_btc_tg.js';
import adaptBasket       from './adapter_basket_breakout.js';
import adaptBull         from './adapter_bull.js';
import adaptCodex        from './adapter_codex.js';

const loadJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const loadText = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const fxBasket    = loadJson('../fixtures/basket-breakout-signals.json');
const fxAnalyst   = loadJson('../fixtures/analyst-hy-v1.json');
const fxAggro     = loadJson('../fixtures/aggro-leader-cont.json');
const fxHYv4      = loadJson('../fixtures/hy-v4-signals.json');
const fxV7        = loadJson('../fixtures/v7-btc-tg.json');
const fxBullPort  = loadText('../fixtures/bull-portfolio.md');
const fxBullLog   = loadText('../fixtures/bull-trade-log.md');
const fxCodexPort = loadText('../fixtures/codex-portfolio.md');
const fxCodexLog  = loadText('../fixtures/codex-trade-log.md');
const fxCodexAggroPort = loadText('../fixtures/codex-aggro-portfolio.md');
const fxCodexAggroLog  = loadText('../fixtures/codex-aggro-trade-log.md');
const fxCodexRegimePort = loadText('../fixtures/codex-regime-portfolio.md');
const fxCodexRegimeLog  = loadText('../fixtures/codex-regime-trade-log.md');
const fxCodexApexPort = loadText('../fixtures/codex-apex-portfolio.md');
const fxCodexApexLog  = loadText('../fixtures/codex-apex-trade-log.md');
const fxCodexRegimeWfoPort = loadText('../fixtures/codex-regime-wfo-portfolio.md');
const fxCodexRegimeWfoLog  = loadText('../fixtures/codex-regime-wfo-trade-log.md');
const fxCodexApexWfoPort = loadText('../fixtures/codex-apex-wfo-portfolio.md');
const fxCodexApexWfoLog  = loadText('../fixtures/codex-apex-wfo-trade-log.md');
const fxCodexRoutineStatus = `# CODEX Routine Status

| Routine | Strategy | Timestamp UTC | Status | Data source | Message |
|---------|----------|---------------|--------|-------------|---------|
| live-paper | CODEX v0 | 2026-05-04T20:00:00Z | data-unavailable | none | market data unavailable |
| live-paper | CODEX Aggro v0 | 2026-05-04T20:00:00Z | ok | live | opened=0 closed=0 |
`;

// ---------- Shape contract every adapter must satisfy ----------
function assertStrategyRowShape(row, expectedName) {
  assert.equal(typeof row.name, 'string');
  assert.equal(row.name, expectedName);
  assert.ok(['live', 'canary', 'research', 'paused', 'error'].includes(row.status), `bad status: ${row.status}`);
  assert.ok(row.returns);
  assert.ok('7d' in row.returns);
  assert.ok('30d' in row.returns);
  assert.ok('90d' in row.returns);
  assert.ok('all' in row.returns);
  assert.equal(typeof row.trades_n, 'number');
  assert.deepEqual(row.confidence, { sharpe: 'best-effort', pf: 'best-effort', max_dd: 'best-effort' });
  assert.ok(Array.isArray(row.errors));
}

// ---------- Analyst HY ----------
test('analyst hy adapter returns normalized row from real fixture', () => {
  const row = adaptAnalystHY(fxAnalyst, { startingCapital: 2000 });
  assertStrategyRowShape(row, 'Analyst HY v1');
  assert.equal(row.status, 'live');
});

test('analyst hy adapter computes pnl on synthetic exit row', () => {
  const synth = { ok: true, rows: [
    { timestamp: '2026-01-01T15:00:00Z', signal: 'EXIT_LONG', asset: 'SOLUSD', pnl_dollar: 100, r_multiple: 1.5 },
  ]};
  const row = adaptAnalystHY(synth, { startingCapital: 1000 });
  assert.equal(row.trades_n, 1);
  assert.equal(row.returns.all, 10); // 100/1000 = 10%
  assert.equal(row.avg_r, 1.5);
});

test('analyst hy adapter handles error response', () => {
  const row = adaptAnalystHY({ status: 'error', message: 'tab not found' }, { startingCapital: 2000 });
  assert.equal(row.status, 'error');
  assert.ok(row.errors.length > 0);
});

// ---------- Aggro DOGE ----------
test('aggro adapter returns normalized row from real fixture', () => {
  const row = adaptAggroDoge(fxAggro, { startingCapital: 5000 });
  assertStrategyRowShape(row, 'Aggro Leader Continuation v1');
  assert.equal(row.status, 'canary');
});

test('aggro adapter ignores FILTER_BLOCK rows', () => {
  // Real fixture has 21 FILTER_BLOCK rows, no actual trades — so trades_n should be 0
  const row = adaptAggroDoge(fxAggro, { startingCapital: 5000 });
  assert.equal(row.trades_n, 0);
});

// ---------- HY v4 ----------
test('HY v4 adapter returns normalized row from real fixture', () => {
  const row = adaptHYv4(fxHYv4, { startingCapital: 2000 });
  assertStrategyRowShape(row, 'HY v4 Tuned');
  assert.equal(row.status, 'live');
});

test('HY v4 adapter has trades from real fixture (BTCUSD/SOLUSD)', () => {
  const row = adaptHYv4(fxHYv4, { startingCapital: 2000 });
  assert.ok(row.trades_n > 0, `expected real trades, got ${row.trades_n}`);
});

test('HY v4 adapter handles short trades on synthetic data', () => {
  const synth = { ok: true, rows: [
    { timestamp: '2026-01-01T15:00:00Z', signal: 'EXIT_SHORT', asset: 'SOLUSD', pnl_dollar: 25, r_multiple: 1.0 },
  ]};
  const row = adaptHYv4(synth, { startingCapital: 1000 });
  assert.equal(row.trades_n, 1);
});

// ---------- V7-BTC TG ----------
test('V7 adapter on missing tab returns research status, no error status', () => {
  // Real fixture is an error response (tab doesn't exist server-side)
  const row = adaptV7BtcTG(fxV7, { startingCapital: 2000 });
  assertStrategyRowShape(row, 'HY v7-Best BTC TG');
  assert.equal(row.status, 'research');
  assert.equal(row.trades_n, 0);
});

test('V7 adapter on synthetic data with rows works like other adapters', () => {
  const synth = { ok: true, rows: [
    { timestamp: '2026-01-01T15:00:00Z', signal: 'EXIT_LONG', asset: 'BTCUSD', pnl_dollar: 50, r_multiple: 1.0 },
  ]};
  const row = adaptV7BtcTG(synth, { startingCapital: 2000 });
  assert.equal(row.status, 'research');
  assert.equal(row.trades_n, 1);
});

// ---------- Basket Breakout ----------
test('basket adapter returns normalized row from real fixture', () => {
  const row = adaptBasket(fxBasket, { startingCapital: 10000 });
  assertStrategyRowShape(row, 'Basket Breakout v1');
  assert.equal(row.status, 'live');
});

test('basket adapter computes R-multiple from entry+stop+exit on synthetic data', () => {
  // Entry @ 100 with stop @ 95 = $5 risk. Exit @ 110 = +2R = $100 pnl on $10k cap × 0.005 = $1
  const synth = { ok: true, rows: [
    { timestamp: '2026-01-01T10:00:00Z', action: 'ENTRY_REQUEST', heat_status: 'ACCEPTED',
      symbol: 'BTCUSD', price: 100, stop: 95, atr: 2 },
    { timestamp: '2026-01-01T15:00:00Z', action: 'EXIT', heat_status: 'EXIT',
      symbol: 'BTCUSD', price: 110, stop: 95 },
  ]};
  const row = adaptBasket(synth, { startingCapital: 10000 });
  assert.equal(row.trades_n, 1);
  // R = (110-100)/(100-95) = 2.0; pnl = 2.0 × (10000 × 0.005) = $100; return = 100/10000 = 1%
  assert.ok(Math.abs(row.returns.all - 1.0) < 1e-9, `expected 1.0% return, got ${row.returns.all}`);
});

test('basket adapter ignores REJECTED_HEAT entries', () => {
  const synth = { ok: true, rows: [
    { timestamp: '2026-01-01T10:00:00Z', action: 'ENTRY_REQUEST', heat_status: 'REJECTED_HEAT',
      symbol: 'BTCUSD', price: 100, stop: 95 },
  ]};
  const row = adaptBasket(synth, { startingCapital: 10000 });
  assert.equal(row.trades_n, 0);
});

// ---------- BULL ----------
test('bull adapter returns normalized row from real fixtures', () => {
  const row = adaptBull(
    { portfolio: { ok: true, text: fxBullPort }, tradeLog: { ok: true, text: fxBullLog } },
    { startingCapital: 10000 }
  );
  assertStrategyRowShape(row, 'BULL v0');
  assert.equal(row.status, 'live');
  assert.ok(row.trades_n > 0);
});

test('bull adapter avg_r computed from trade log r-multiples', () => {
  const row = adaptBull(
    { portfolio: { ok: true, text: fxBullPort }, tradeLog: { ok: true, text: fxBullLog } },
    { startingCapital: 10000 }
  );
  assert.equal(typeof row.avg_r, 'number');
});

test('bull adapter handles missing trade log', () => {
  const row = adaptBull(
    { portfolio: { ok: true, text: fxBullPort }, tradeLog: { ok: false, error: 'fetch failed' } },
    { startingCapital: 10000 }
  );
  assert.equal(row.status, 'error');
  assert.ok(row.errors.some(e => e.includes('tradeLog')));
});

test('bull adapter still returns row when portfolio is missing but trade log present', () => {
  const row = adaptBull(
    { portfolio: { ok: false, error: 'fetch failed' }, tradeLog: { ok: true, text: fxBullLog } },
    { startingCapital: 10000 }
  );
  assert.equal(row.name, 'BULL v0');
  assert.equal(row.status, 'live');
  assert.ok(row.errors.some(e => e.includes('portfolio')));
});

// ---------- CODEX ----------
test('codex adapter returns live zero-trade row from exported markdown fixtures', () => {
  const row = adaptCodex(
    { portfolio: { ok: true, text: fxCodexPort }, tradeLog: { ok: true, text: fxCodexLog } },
    { startingCapital: 10000 }
  );
  assertStrategyRowShape(row, 'CODEX v0');
  assert.equal(row.status, 'live');
  assert.equal(row.trades_n, 0);
  assert.equal(row.returns['90d'], 0);
});

test('codex adapter handles missing trade log', () => {
  const row = adaptCodex(
    { portfolio: { ok: true, text: fxCodexPort }, tradeLog: { ok: false, error: 'fetch failed' } },
    { startingCapital: 10000 }
  );
  assert.equal(row.status, 'error');
  assert.ok(row.errors.some(e => e.includes('tradeLog')));
});

test('codex adapter surfaces routine status warnings', () => {
  const row = adaptCodex(
    {
      portfolio: { ok: true, text: fxCodexPort },
      tradeLog: { ok: true, text: fxCodexLog },
      status: { ok: true, text: fxCodexRoutineStatus },
    },
    { startingCapital: 10000, name: 'CODEX v0' }
  );

  assert.equal(row.status, 'live');
  assert.ok(row.errors.some(e => e.includes('routine: data-unavailable')));
});

test('codex adapter ignores ok routine status rows', () => {
  const row = adaptCodex(
    {
      portfolio: { ok: true, text: fxCodexAggroPort },
      tradeLog: { ok: true, text: fxCodexAggroLog },
      status: { ok: true, text: fxCodexRoutineStatus },
    },
    { startingCapital: 10000, name: 'CODEX Aggro v0' }
  );

  assert.equal(row.status, 'live');
  assert.equal(row.errors.length, 0);
});

test('codex adapter still returns row when portfolio is missing but trade log present', () => {
  const row = adaptCodex(
    { portfolio: { ok: false, error: 'fetch failed' }, tradeLog: { ok: true, text: fxCodexLog } },
    { startingCapital: 10000 }
  );
  assert.equal(row.name, 'CODEX v0');
  assert.equal(row.status, 'live');
  assert.ok(row.errors.some(e => e.includes('portfolio')));
});

test('codex adapter can label aggro row from exported markdown fixtures', () => {
  const row = adaptCodex(
    { portfolio: { ok: true, text: fxCodexAggroPort }, tradeLog: { ok: true, text: fxCodexAggroLog } },
    { startingCapital: 10000, name: 'CODEX Aggro v0' }
  );
  assertStrategyRowShape(row, 'CODEX Aggro v0');
  assert.equal(row.status, 'live');
  assert.equal(row.trades_n, 0);
  assert.equal(row.returns['90d'], 0);
});

test('codex adapter can label regime row from exported markdown fixtures', () => {
  const row = adaptCodex(
    { portfolio: { ok: true, text: fxCodexRegimePort }, tradeLog: { ok: true, text: fxCodexRegimeLog } },
    { startingCapital: 10000, name: 'CODEX Regime v0' }
  );
  assertStrategyRowShape(row, 'CODEX Regime v0');
  assert.equal(row.status, 'live');
  assert.equal(row.trades_n, 0);
});

test('codex adapter can label apex row from exported markdown fixtures', () => {
  const row = adaptCodex(
    { portfolio: { ok: true, text: fxCodexApexPort }, tradeLog: { ok: true, text: fxCodexApexLog } },
    { startingCapital: 10000, name: 'CODEX Apex v0' }
  );
  assertStrategyRowShape(row, 'CODEX Apex v0');
  assert.equal(row.status, 'live');
  assert.equal(row.trades_n, 0);
});

test('codex adapter can label regime WFO row from exported markdown fixtures', () => {
  const row = adaptCodex(
    { portfolio: { ok: true, text: fxCodexRegimeWfoPort }, tradeLog: { ok: true, text: fxCodexRegimeWfoLog } },
    { startingCapital: 10000, name: 'CODEX Regime WFO v1' }
  );
  assertStrategyRowShape(row, 'CODEX Regime WFO v1');
  assert.equal(row.status, 'live');
  assert.equal(row.trades_n, 0);
});

test('codex adapter can label apex WFO row from exported markdown fixtures', () => {
  const row = adaptCodex(
    { portfolio: { ok: true, text: fxCodexApexWfoPort }, tradeLog: { ok: true, text: fxCodexApexWfoLog } },
    { startingCapital: 10000, name: 'CODEX Apex WFO v1' }
  );
  assertStrategyRowShape(row, 'CODEX Apex WFO v1');
  assert.equal(row.status, 'live');
  assert.equal(row.trades_n, 0);
});
