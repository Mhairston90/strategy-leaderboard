import { buildStrategyRow, makeErrorRow, latestTime, parseTimestamp } from '../lib/strategy_row.js';
import { normalizeSheetResponse } from '../lib/fetch.js';

/**
 * Adapter for Analyst HY v1 Sheets tab.
 * Long-only SOL 4H breakout. Each EXIT row has pre-computed pnl_dollar and r_multiple.
 * Schema: timestamp, asset, signal, price, position_size_pct, stop_loss, pnl_dollar, pnl_pct, r_multiple, ...
 */
export default function adaptAnalystHY(rawOrResp, opts) {
  const resp = (rawOrResp && rawOrResp.ok !== undefined) ? rawOrResp : normalizeSheetResponse(rawOrResp);
  if (!resp.ok) {
    return makeErrorRow('Analyst HY v1', resp.error || 'no data');
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
    name: 'Analyst HY v1',
    status: 'live',
    trips,
    rMultiples,
    startingCapital: opts.startingCapital,
    last_signal_at: latestTime(allTimes),
    errors: [],
  });
}
