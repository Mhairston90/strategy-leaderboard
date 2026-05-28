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
  assert.deepEqual(row.errors, []);
});

test('V7 adapter on synthetic data with rows works like other adapters', () => {
  const synth = { ok: true, rows: [
    { timestamp: '2026-01-01T15:00:00Z', signal: 'EXIT_LONG', asset: 'BTCUSD', pnl_dollar: 50, r_multiple: 1.0 },
  ]};
  const row = adaptV7BtcTG(synth, { startingCapital: 2000 });
  assert.equal(row.status, 'research');
  assert.equal(row.trades_n, 1);
});

// ---------- BULL ----------
test('BULL adapter can mark counterfactual replay rows as research', () => {
  const row = adaptBull(
    { portfolio: { ok: true, text: fxBullPort }, tradeLog: { ok: true, text: fxBullLog } },
    { startingCapital: 10000, name: 'BULL v0 Replay', status: 'research' }
  );

  assertStrategyRowShape(row, 'BULL v0 Replay');
  assert.equal(row.status, 'research');
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

test('basket adapter treats warm-start pre-window exits as non-actionable', () => {
  const synth = { ok: true, rows: [
    { timestamp: '2026-01-01T10:00:00Z', action: 'ENTRY_REQUEST', heat_status: 'REJECTED_HEAT',
      symbol: 'ETHUSD', price: 100, stop: 95, open_count_at_receipt: 4, notes: 'open=4 >= cap=4' },
    { timestamp: '2026-01-01T10:00:04Z', action: 'EXIT', heat_status: 'EXIT',
      symbol: 'ETHUSD', price: 100, stop: 95, open_count_at_receipt: 4 },
    { timestamp: '2026-01-02T10:00:00Z', action: 'ENTRY_REQUEST', heat_status: 'ACCEPTED',
      symbol: 'LINKUSD', price: 10, stop: 9 },
    { timestamp: '2026-01-02T12:00:00Z', action: 'EXIT', heat_status: 'EXIT',
      symbol: 'LINKUSD', price: 11 },
  ]};

  const row = adaptBasket(synth, { startingCapital: 10000 });

  assert.equal(row.trades_n, 1);
  assert.equal(row.errors.length, 0);
});

test('basket adapter handles PARTIAL: half close at partial price + half at exit', () => {
  // Entry @ 100, stop @ 95 (risk distance 5).
  // PARTIAL @ 110: r=2.0, frac=0.5 → pnl = 2.0×0.5×$50 = $50
  // EXIT    @ 115: r=3.0, frac=0.5 → pnl = 3.0×0.5×$50 = $75
  // Total = $125 → 1.25% return on $10k
  const synth = { ok: true, rows: [
    { timestamp: '2026-01-01T10:00:00Z', action: 'ENTRY_REQUEST', heat_status: 'ACCEPTED',
      symbol: 'BTCUSD', price: 100, stop: 95 },
    { timestamp: '2026-01-01T12:00:00Z', action: 'PARTIAL', heat_status: 'PARTIAL',
      symbol: 'BTCUSD', price: 110 },
    { timestamp: '2026-01-01T15:00:00Z', action: 'EXIT', heat_status: 'EXIT',
      symbol: 'BTCUSD', price: 115 },
  ]};
  const row = adaptBasket(synth, { startingCapital: 10000 });
  assert.equal(row.trades_n, 2, 'expected 2 closing events (PARTIAL + EXIT)');
  assert.ok(Math.abs(row.returns.all - 1.25) < 1e-9,
    `expected 1.25% return, got ${row.returns.all}`);
});

test('basket adapter flags orphan exits and partials in errors[]', () => {
  // No matching entries — exit dropped (ETH-style: no stop info usable),
  // partial without stop info also dropped.
  const synth = { ok: true, rows: [
    { timestamp: '2026-01-01T10:00:00Z', action: 'EXIT', heat_status: 'EXIT',
      symbol: 'ETHUSD', price: 2000 },
    { timestamp: '2026-01-01T11:00:00Z', action: 'PARTIAL', heat_status: 'PARTIAL',
      symbol: 'LINKUSD', price: 10 /* no stop */ },
  ]};
  const row = adaptBasket(synth, { startingCapital: 10000 });
  assert.equal(row.trades_n, 0);
  assert.ok(row.errors.some(e => /orphan exit/.test(e)),
    `expected orphan exit warning, got ${JSON.stringify(row.errors)}`);
  assert.ok(row.errors.some(e => /orphan partial/.test(e)),
    `expected orphan partial warning, got ${JSON.stringify(row.errors)}`);
});

test('basket adapter recovers orphan PARTIAL via BE-move semantics, then pairs subsequent EXIT', () => {
  // Pine's PARTIAL alert fires AFTER `stopPrice := entryPrice` (BE move), so the
  // PARTIAL row's stop equals the entry price. Partial fires at limit = entry+2R.
  // Reconstructed: entry=100, partial=110 → R=5 (since 110-100=10=2R), stop=95.
  // PARTIAL trip: +2.0R × 0.5 × $50 = $50.
  // EXIT @ 105: r = (105-100)/5 = +1.0; trip: +1.0R × 0.5 × $50 = $25.
  // Total $75 → 0.75% return on $10k.
  const synth = { ok: true, rows: [
    { timestamp: '2026-01-01T11:00:00Z', action: 'PARTIAL', heat_status: 'PARTIAL',
      symbol: 'LINKUSD', price: 110, stop: 100 },
    { timestamp: '2026-01-01T15:00:00Z', action: 'EXIT', heat_status: 'EXIT',
      symbol: 'LINKUSD', price: 105 },
  ]};
  const row = adaptBasket(synth, { startingCapital: 10000 });
  assert.equal(row.trades_n, 2, 'expected partial + tail exit pair');
  assert.ok(Math.abs(row.returns.all - 0.75) < 1e-9,
    `expected 0.75% return, got ${row.returns.all}`);
  assert.equal(row.errors.length, 0);
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

test('bull adapter counts duplicated replay rows only once', () => {
  const duplicatedReplayLog = `
| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|
| 2026-05-20T13:00:00Z | OPEN | HYPE/USD | long | 10 | 50.00 | 48.00 | 58.00 | - | - | replay-entry | missed_scheduler_replay |
| 2026-05-21T08:00:00Z | CLOSE | HYPE/USD | long | 10 | 58.00 | - | - | +4.00 | +100.00 | exit-4R-target | missed_scheduler_replay |
| 2026-05-20T13:00:00Z | OPEN | HYPE/USD | long | 10 | 50.00 | 48.00 | 58.00 | - | - | replay-entry | missed_scheduler_replay |
| 2026-05-21T08:00:00Z | CLOSE | HYPE/USD | long | 10 | 58.00 | - | - | +4.00 | +100.00 | exit-4R-target | missed_scheduler_replay |
`;

  const row = adaptBull(
    { portfolio: { ok: true, text: fxBullPort }, tradeLog: { ok: true, text: duplicatedReplayLog } },
    { startingCapital: 10000, liveStartIso: '2026-05-04T00:00:00Z' }
  );

  assert.equal(row.trades_n, 1);
  assert.equal(row.returns.all, 1);
  assert.equal(row.avg_r, 4);
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

test('codex adapter can label markov directional row from exported markdown snapshots', () => {
  const row = adaptCodex(
    {
      portfolio: { ok: true, text: loadText('../data/codex/markov_directional_portfolio.md') },
      tradeLog: { ok: true, text: loadText('../data/codex/markov_directional_trade_log.md') },
    },
    { startingCapital: 10000, name: 'CODEX Markov Directional v1' }
  );

  assertStrategyRowShape(row, 'CODEX Markov Directional v1');
  assert.equal(row.status, 'live');
  assert.equal(row.trades_n, 0);
  assert.equal(row.returns['90d'], 0);
});

test('codex adapter can label markov gate row from exported markdown snapshots', () => {
  const row = adaptCodex(
    {
      portfolio: { ok: true, text: loadText('../data/codex/markov_gate_portfolio.md') },
      tradeLog: { ok: true, text: loadText('../data/codex/markov_gate_trade_log.md') },
    },
    { startingCapital: 10000, name: 'CODEX Markov Gate v1' }
  );

  assertStrategyRowShape(row, 'CODEX Markov Gate v1');
  assert.equal(row.status, 'live');
  assert.equal(row.trades_n, 0);
  assert.equal(row.returns['90d'], 0);
});
