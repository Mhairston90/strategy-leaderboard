import { buildStrategyRow, makeErrorRow, latestTime, parseTimestamp } from '../lib/strategy_row.js';
import { normalizeSheetResponse } from '../lib/fetch.js';
import { collectExitRowTrips } from '../lib/sheet_trades.js';

/**
 * Adapter for HY v4 Tuned. Sourced from the legacy `Signals` tab (notes="v4" rows).
 * Long+short on BTC/SOL 4H. ENTRY/EXIT pre-computed-pnl schema.
 *
 * The Signals tab is a catch-all, so we first filter to v4-relevant rows
 * (notes mention v4 OR asset in {BTCUSD, SOLUSD}), then apply the shared
 * collector which pairs ENTRY->EXIT by asset and filters by ENTRY time
 * against the contest cutoff (opts.liveStartIso).
 */
export default function adaptHYv4(rawOrResp, opts) {
  const resp = (rawOrResp && rawOrResp.ok !== undefined) ? rawOrResp : normalizeSheetResponse(rawOrResp);
  if (!resp.ok) {
    return makeErrorRow('HY v4 Tuned', resp.error || 'no data');
  }

  const v4Rows = resp.rows.filter(r => {
    const notes = String(r.notes || '').toLowerCase();
    const asset = String(r.asset || r.symbol || '').toUpperCase();
    return notes.includes('v4') || asset === 'BTCUSD' || asset === 'SOLUSD';
  });

  const { trips, rMultiples, allTimes, provenance } = collectExitRowTrips(v4Rows, {
    liveStartIso: opts.liveStartIso || null,
    parseTimestamp,
  });

  const row = buildStrategyRow({
    name: 'HY v4 Tuned',
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
