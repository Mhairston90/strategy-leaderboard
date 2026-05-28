import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { STRATEGIES, effectiveCutoff } from '../registry.js';

function loadSnapshot(strategyName) {
  const strategy = STRATEGIES.find(s => s.name === strategyName);
  assert.ok(strategy, `${strategyName} missing from registry`);
  assert.equal(strategy.source.type, 'codex-local');

  const portfolio = readFileSync(new URL(`../${strategy.source.portfolio_path}`, import.meta.url), 'utf8');
  const tradeLog = readFileSync(new URL(`../${strategy.source.trade_log_path}`, import.meta.url), 'utf8');
  return strategy.adapter(
    {
      portfolio: { ok: true, text: portfolio },
      tradeLog: { ok: true, text: tradeLog },
    },
    {
      startingCapital: strategy.starting_capital,
      name: strategy.name,
      status: strategy.status,
      liveStartIso: effectiveCutoff(strategy.live_start_iso),
    }
  );
}

test('active CODEX snapshots keep their non-empty forward trade history', () => {
  const minimumTrades = new Map([
    ['CODEX v0', 4],
    ['CODEX Aggro v0', 8],
    ['CODEX Pulse v0', 15],
    ['CODEX Regime v0', 6],
    ['CODEX Apex v0', 4],
    ['CODEX Regime WFO v1', 6],
    ['CODEX Apex WFO v1', 4],
  ]);

  for (const [strategyName, minTrades] of minimumTrades) {
    const row = loadSnapshot(strategyName);
    assert.ok(
      row.trades_n >= minTrades,
      `${strategyName} was zeroed or truncated: expected >= ${minTrades} trades, got ${row.trades_n}`
    );
  }
});
