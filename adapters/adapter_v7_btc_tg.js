import { buildStrategyRow, makeErrorRow, latestTime, parseTimestamp } from '../lib/strategy_row.js';
import { normalizeSheetResponse } from '../lib/fetch.js';

/**
 * Adapter for HY v7-Best BTC Trend Gated. Research-only per spec — the Sheets tab
 * may not exist (tab name is documented but no rows ever logged). When the source
 * is missing we return a 'research' row with empty data, NOT an error.
 *
 * If a tab does exist with rows, treat it like the other Sheets adapters.
 */
export default function adaptV7BtcTG(rawOrResp, opts) {
  const resp = (rawOrResp && rawOrResp.ok !== undefined) ? rawOrResp : normalizeSheetResponse(rawOrResp);

  if (!resp.ok) {
    // Research-only tabs may legitimately not exist — return research row with no data
    return {
      ...makeErrorRow('HY v7-Best BTC TG', null, 'research'),
      errors: resp.error ? [`source unavailable: ${resp.error}`] : [],
    };
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
    name: 'HY v7-Best BTC TG',
    status: 'research',
    trips,
    rMultiples,
    startingCapital: opts.startingCapital,
    last_signal_at: latestTime(allTimes),
    errors: [],
  });
}
