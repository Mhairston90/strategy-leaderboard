import { parseTradeLog } from '../lib/parse_bull_md.js';
import { buildStrategyRow, makeErrorRow } from '../lib/strategy_row.js';
import { avgR } from '../lib/metrics.js';

/**
 * CODEX adapter. Receives local markdown fetch results.
 *
 *   adaptCodex({ portfolio: {ok, text}, tradeLog: {ok, text} }, { startingCapital })
 *
 * Per-trade pnl + R-multiples come from trade_log.md (the source of truth).
 * portfolio.md is currently used only for surfacing errors if missing.
 */
export default function adaptCodex({ portfolio, tradeLog, status }, opts) {
  const name = opts.name || 'CODEX v0';
  const errors = [];
  if (!portfolio || !portfolio.ok) {
    errors.push('portfolio: ' + (portfolio?.error || 'missing'));
  }
  if (!tradeLog || !tradeLog.ok) {
    errors.push('tradeLog: ' + (tradeLog?.error || 'missing'));
    return makeErrorRow(name, errors.join(' | '));
  }
  const routineWarning = routineStatusWarning(status, name);
  if (routineWarning) {
    errors.push(routineWarning);
  }

  const rows = parseTradeLog(tradeLog.text);
  const closes = rows.filter(r => r.action === 'CLOSE');

  const trips = closes
    .filter(r => r.pnl != null)
    .map(r => ({ exit_time: r.time, pnl: r.pnl }));

  const rMultiples = closes
    .map(r => r.r)
    .filter(r => r != null && !Number.isNaN(r));

  const lastSig = rows.length ? rows[rows.length - 1].time : null;

  const row = buildStrategyRow({
    name,
    status: 'live',
    trips,
    rMultiples,
    startingCapital: opts.startingCapital,
    last_signal_at: lastSig,
    errors,
  });

  row.avg_r = avgR(rMultiples);

  return row;
}


function routineStatusWarning(status, strategyName) {
  if (!status || !status.ok || !status.text) {
    return null;
  }
  for (const line of status.text.split(/\r?\n/)) {
    if (!line.startsWith('| ')) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
    if (cells.length !== 6 || cells[0] === 'Routine' || cells[0].startsWith('-')) {
      continue;
    }
    const [, strategy, timestamp, routineStatus, dataSource, message] = cells;
    if (strategy !== strategyName) {
      continue;
    }
    if (routineStatus === 'ok' || routineStatus === 'skipped') {
      return null;
    }
    return `routine: ${routineStatus} for ${strategyName} at ${timestamp} (${dataSource}; ${message})`;
  }
  return null;
}
