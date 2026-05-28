// scripts/smoke.js — end-to-end smoke against live endpoints.
// Mimics what the browser does on page load: fetch every strategy, run its adapter,
// print the resulting leaderboard table.
//
// Run with: node scripts/smoke.js

import { STRATEGIES, effectiveCutoff } from '../registry.js';
import { fetchSheetTab, fetchBullFile, fetchLocalText } from '../lib/fetch.js';

async function fetchOne(strategy) {
  if (strategy.source.type === 'sheets') {
    const resp = await fetchSheetTab(strategy.source.tab);
    return strategy.adapter(resp, {
      startingCapital: strategy.starting_capital,
      liveStartIso: effectiveCutoff(strategy.live_start_iso),
    });
  }
  if (strategy.source.type === 'bull-github') {
    const [portfolio, tradeLog, overlayTradeLog] = await Promise.all([
      fetchBullFile(strategy.source.portfolio_path),
      fetchBullFile(strategy.source.trade_log_path),
      strategy.source.overlay_trade_log_path
        ? fetchLocalText(strategy.source.overlay_trade_log_path)
        : Promise.resolve(null),
    ]);
    const effectiveTradeLog = overlayTradeLog?.ok
      ? { ...tradeLog, text: `${tradeLog.text}\n${overlayTradeLog.text}` }
      : tradeLog;
    const row = strategy.adapter(
      { portfolio, tradeLog: effectiveTradeLog },
      {
        startingCapital: strategy.starting_capital,
        name: strategy.name,
        status: strategy.status,
        liveStartIso: effectiveCutoff(strategy.live_start_iso),
      }
    );
    if (overlayTradeLog && !overlayTradeLog.ok) {
      row.errors.push(`overlayTradeLog: ${overlayTradeLog.error || 'missing'}`);
    }
    return row;
  }
  if (strategy.source.type === 'codex-local') {
    const [portfolio, tradeLog] = await Promise.all([
      fetchLocalText(strategy.source.portfolio_path),
      fetchLocalText(strategy.source.trade_log_path),
    ]);
    return strategy.adapter(
      { portfolio, tradeLog },
      {
        startingCapital: strategy.starting_capital,
        name: strategy.name,
        status: strategy.status,
        liveStartIso: effectiveCutoff(strategy.live_start_iso),
      }
    );
  }
  throw new Error('Unknown source type: ' + strategy.source.type);
}

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '   —  ';
  const sign = v > 0 ? '+' : '';
  return (sign + v.toFixed(1)).padStart(6);
}
function fmtNum(v) {
  if (v == null || Number.isNaN(v) || v === Infinity) return '  —  ';
  return v.toFixed(2).padStart(5);
}
function fmtInt(v) {
  if (v == null) return '  —';
  return String(v).padStart(3);
}

console.log(`Fetching live data for all ${STRATEGIES.length} strategies…\n`);
const results = await Promise.allSettled(STRATEGIES.map(fetchOne));

console.log(
  'Strategy                       | Status   | 90d %  | 30d %  | 7d %   | Sharpe| PF   | Max DD | Trades| Win % | Avg R | Errors'
);
console.log(
  '-------------------------------|----------|--------|--------|--------|-------|------|--------|-------|-------|-------|--------'
);

let exitCode = 0;
results.forEach((res, i) => {
  const strategy = STRATEGIES[i];
  if (res.status !== 'fulfilled') {
    console.log(`${strategy.name.padEnd(30)} | THREW    | reason: ${res.reason}`);
    exitCode = 1;
    return;
  }
  const r = res.value;
  console.log(
    [
      r.name.padEnd(30),
      r.status.padEnd(8),
      fmtPct(r.returns?.['90d']),
      fmtPct(r.returns?.['30d']),
      fmtPct(r.returns?.['7d']),
      fmtNum(r.sharpe),
      fmtNum(r.pf),
      fmtPct(r.max_dd),
      fmtInt(r.trades_n),
      fmtInt(r.win_pct),
      fmtNum(r.avg_r),
      r.errors.length ? `[${r.errors.length}] ${r.errors[0].slice(0, 30)}` : '',
    ].join(' | ')
  );
});

console.log('\nValidating StrategyRow shape on every result…');
let shapeFailures = 0;
results.forEach((res, i) => {
  if (res.status !== 'fulfilled') return;
  const r = res.value;
  const checks = [
    [typeof r.name === 'string', 'name is string'],
    [['live', 'canary', 'research', 'paused', 'error'].includes(r.status), 'valid status'],
    [r.returns && '7d' in r.returns && '30d' in r.returns && '90d' in r.returns && 'all' in r.returns, 'returns has 7d/30d/90d/all'],
    [typeof r.trades_n === 'number', 'trades_n is number'],
    [Array.isArray(r.errors), 'errors is array'],
    [r.confidence && 'sharpe' in r.confidence, 'has confidence object'],
  ];
  checks.forEach(([ok, label]) => {
    if (!ok) {
      console.log(`  ❌ ${r.name}: ${label}`);
      shapeFailures++;
    }
  });
});

if (shapeFailures === 0) {
  console.log(`  ✅ All ${STRATEGIES.length} rows have valid StrategyRow shape`);
} else {
  console.log(`  ${shapeFailures} shape failures`);
  exitCode = 1;
}

process.exit(exitCode);
