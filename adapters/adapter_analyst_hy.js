import { buildStrategyRow, makeErrorRow, latestTime, parseTimestamp } from '../lib/strategy_row.js';
import { normalizeSheetResponse } from '../lib/fetch.js';
import { collectExitRowTrips } from '../lib/sheet_trades.js';

/**
 * Adapter for Analyst HY v1 Sheets tab.
 * Long-only SOL 4H breakout. ENTRY_LONG / EXIT_LONG rows; EXIT carries
 * pre-computed pnl_dollar + r_multiple. Contest cutoff (opts.liveStartIso)
 * is applied by ENTRY time via the shared collector.
 */
export default function adaptAnalystHY(rawOrResp, opts) {
  const resp = (rawOrResp && rawOrResp.ok !== undefined) ? rawOrResp : normalizeSheetResponse(rawOrResp);
  if (!resp.ok) {
    return makeErrorRow('Analyst HY v1', resp.error || 'no data');
  }

  const { trips, rMultiples, allTimes, provenance } = collectExitRowTrips(resp.rows, {
    liveStartIso: opts.liveStartIso || null,
    parseTimestamp,
  });

  const row = buildStrategyRow({
    name: 'Analyst HY v1',
    status: 'live',
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
