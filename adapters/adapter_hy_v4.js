import { buildStrategyRow, makeErrorRow, latestTime, parseTimestamp } from '../lib/strategy_row.js';
import { normalizeSheetResponse } from '../lib/fetch.js';

/**
 * Adapter for HY v4 Tuned. Sourced from the legacy `Signals` tab (notes="v4" rows).
 * Long+short on BTC/SOL 4H. Same EXIT-row pre-computed schema as Analyst HY.
 *
 * The Signals tab is a catch-all so it may contain rows from other strategies. We
 * filter to rows whose `notes` mentions v4 OR whose `asset` is in the v4 universe
 * (BTCUSD, SOLUSD). This is best-effort — the Sheets logger doesn't tag v4 rows
 * with a unique version field.
 */
export default function adaptHYv4(rawOrResp, opts) {
  const resp = (rawOrResp && rawOrResp.ok !== undefined) ? rawOrResp : normalizeSheetResponse(rawOrResp);
  if (!resp.ok) {
    return makeErrorRow('HY v4 Tuned', resp.error || 'no data');
  }

  const trips = [];
  const rMultiples = [];
  const allTimes = [];

  for (const r of resp.rows) {
    // Filter to v4-relevant rows. Prefer explicit notes tag; fall back to asset.
    const notes = String(r.notes || '').toLowerCase();
    const asset = String(r.asset || r.symbol || '').toUpperCase();
    const isV4 = notes.includes('v4') || asset === 'BTCUSD' || asset === 'SOLUSD';
    if (!isV4) continue;

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
    name: 'HY v4 Tuned',
    status: 'live',
    trips,
    rMultiples,
    startingCapital: opts.startingCapital,
    last_signal_at: latestTime(allTimes),
    errors: [],
  });
}
