import { parseTradeLog, buildTripsWithEntryTime, filterTripsByLiveStart } from '../lib/parse_bull_md.js';
import { buildStrategyRow, makeErrorRow } from '../lib/strategy_row.js';
import { avgR } from '../lib/metrics.js';

/**
 * CODEX adapter. Receives local markdown fetch results.
 *
 *   adaptCodex({ portfolio, tradeLog }, { startingCapital, name, liveStartIso })
 *
 * Per-trade pnl + R-multiples come from trade_log.md (the source of truth).
 * portfolio.md is currently used only for surfacing errors if missing.
 *
 * If opts.liveStartIso is provided, OPEN-CLOSE pairs are built first and trips
 * whose ENTRY (OPEN row time) is before liveStartIso are excluded. This drops
 * paper-warmup / pre-spec-freeze backtest trades from leaderboard equity so the
 * contest only counts trades the strategy actually generated under frozen
 * rules. The number of dropped trades is surfaced in `errors` as an info note.
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

  // Pair OPEN/CLOSE rows so we have entry_time for each trip — needed so we
  // can filter by spec-freeze date (filtering by exit time would let pre-live
  // trades that closed late slip into the count).
  const allTrips = buildTripsWithEntryTime(rows);
  const { filtered: paired, dropped } = filterTripsByLiveStart(allTrips, opts.liveStartIso);
  if (dropped > 0) {
    errors.push(`${dropped} pre-live-start trades excluded (live_start_iso=${opts.liveStartIso})`);
  }

  const trips = paired
    .filter(t => t.pnl != null)
    .map(t => ({ exit_time: t.exit_time, pnl: t.pnl }));

  const rMultiples = paired
    .map(t => t.r)
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
