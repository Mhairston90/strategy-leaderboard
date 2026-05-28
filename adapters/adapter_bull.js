import { parsePortfolio, parseTradeLog, buildTripsWithEntryTime, filterTripsByLiveStart } from '../lib/parse_bull_md.js';
import { buildStrategyRow, makeErrorRow } from '../lib/strategy_row.js';
import { avgR } from '../lib/metrics.js';

/**
 * BULL adapter. Receives both portfolio and trade-log fetch results.
 *
 *   adaptBull({ portfolio: {ok, text}, tradeLog: {ok, text} }, { startingCapital })
 *
 * Per-trade pnl + R-multiples come from trade_log.md (the source of truth).
 * portfolio.md is parsed but currently used only for surfacing errors if missing.
 */
export default function adaptBull({ portfolio, tradeLog }, opts) {
  const name = opts?.name || 'BULL v0';
  const errors = [];
  if (!portfolio || !portfolio.ok) {
    errors.push('portfolio: ' + (portfolio?.error || 'missing'));
  }
  if (!tradeLog || !tradeLog.ok) {
    errors.push('tradeLog: ' + (tradeLog?.error || 'missing'));
    // Still return a row so user sees something
    return makeErrorRow(name, errors.join(' | '));
  }

  const rows = parseTradeLog(tradeLog.text);

  // Pair OPEN/CLOSE and filter by entry time so the contest window
  // (opts.liveStartIso) excludes BULL's pre-contest head-start trades.
  const allTrips = buildTripsWithEntryTime(rows);
  const { filtered: liveTrips, dropped } = filterTripsByLiveStart(allTrips, opts.liveStartIso);
  if (dropped > 0) {
    errors.push(`${dropped} pre-contest-window trades excluded (cutoff=${opts.liveStartIso})`);
  }
  const paired = _dedupeTrips(liveTrips);

  const trips = paired
    .filter(t => t.pnl != null)
    .map(t => ({ exit_time: t.exit_time, pnl: t.pnl }));

  const rMultiples = paired
    .map(t => t.r)
    .filter(r => r != null && !Number.isNaN(r));

  const lastSig = rows.length ? rows[rows.length - 1].time : null;

  const row = buildStrategyRow({
    name,
    status: opts?.status || 'live',
    trips,
    rMultiples,
    startingCapital: opts.startingCapital,
    last_signal_at: lastSig,
    errors,
  });

  // BULL has explicit per-trade R-multiples in the trade log — prefer these.
  row.avg_r = avgR(rMultiples);

  return row;
}

function _dedupeTrips(trips) {
  const seen = new Set();
  const deduped = [];
  for (const trip of trips) {
    const key = [
      trip.entry_time,
      trip.exit_time,
      trip.symbol,
      trip.pnl,
      trip.r,
    ].join('|');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(trip);
  }
  return deduped;
}
