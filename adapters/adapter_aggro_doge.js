import { buildStrategyRow, makeErrorRow, latestTime, parseTimestamp } from '../lib/strategy_row.js';
import { normalizeSheetResponse } from '../lib/fetch.js';

/**
 * Adapter for Aggro Leader Continuation v1 Sheets tab.
 * DOGE 1H continuation, canary status. Same schema as Analyst HY.
 * FILTER_BLOCK rows are skipped (these document trades that didn't fire).
 */
export default function adaptAggroDoge(rawOrResp, opts) {
  const resp = (rawOrResp && rawOrResp.ok !== undefined) ? rawOrResp : normalizeSheetResponse(rawOrResp);
  if (!resp.ok) {
    return makeErrorRow('Aggro Leader Continuation v1', resp.error || 'no data');
  }

  const trips = [];
  const rMultiples = [];
  const allTimes = [];

  for (const r of resp.rows) {
    const time = parseTimestamp(r.timestamp);
    if (time) allTimes.push(time);

    const sig = String(r.signal || r.action || '').toUpperCase();
    if (sig.startsWith('EXIT_') || sig === 'EXIT') {
      const pnl = Number(r.pnl_dollar);
      if (!Number.isNaN(pnl) && r.pnl_dollar !== '' && r.pnl_dollar != null) {
        trips.push({ exit_time: time, pnl });
      }
      const rMult = Number(r.r_multiple);
      if (!Number.isNaN(rMult) && r.r_multiple !== '' && r.r_multiple != null) {
        rMultiples.push(rMult);
      }
    }
  }

  return buildStrategyRow({
    name: 'Aggro Leader Continuation v1',
    status: 'canary',
    trips,
    rMultiples,
    startingCapital: opts.startingCapital,
    last_signal_at: latestTime(allTimes),
    errors: [],
  });
}
