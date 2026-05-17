import { buildStrategyRow, makeErrorRow, latestTime, parseTimestamp } from '../lib/strategy_row.js';
import { normalizeSheetResponse } from '../lib/fetch.js';
import { collectExitRowTrips } from '../lib/sheet_trades.js';

/**
 * Adapter for Aggro Leader Continuation v1 Sheets tab.
 * DOGE 1H continuation, canary status. ENTRY/EXIT schema; FILTER_BLOCK
 * rows are ignored by the shared collector. Contest cutoff applied by
 * ENTRY time (currently a no-op — tab has only FILTER_BLOCK rows / 0 trades).
 */
export default function adaptAggroDoge(rawOrResp, opts) {
  const resp = (rawOrResp && rawOrResp.ok !== undefined) ? rawOrResp : normalizeSheetResponse(rawOrResp);
  if (!resp.ok) {
    return makeErrorRow('Aggro Leader Continuation v1', resp.error || 'no data');
  }

  const { trips, rMultiples, allTimes, provenance } = collectExitRowTrips(resp.rows, {
    liveStartIso: opts.liveStartIso || null,
    parseTimestamp,
  });

  const row = buildStrategyRow({
    name: 'Aggro Leader Continuation v1',
    status: 'canary',
    trips,
    rMultiples,
    startingCapital: opts.startingCapital,
    last_signal_at: latestTime(allTimes),
    errors: provenance.backtest > 0
      ? [`${provenance.backtest} pre-cutoff trade(s) excluded (entry-time filtered)`]
      : [],
  });
  row.provenance = provenance;
  return row;
}
