import { pairRoundTrips } from '../lib/pairing.js';
import { buildStrategyRow, makeErrorRow, latestTime, parseTimestamp } from '../lib/strategy_row.js';
import { normalizeSheetResponse } from '../lib/fetch.js';

/**
 * Adapter for Basket Breakout v1.
 * Schema: timestamp, version, action, symbol, price, atr, stop, heat_status, ...
 *
 * Unlike the v4/Analyst-HY-style tabs, Basket does NOT pre-compute pnl_dollar in
 * exit rows. We must pair entries with exits on price and infer per-trade PnL
 * using the strategy's published 0.5%-of-equity risk-per-trade sizing.
 *
 * Each round-trip's $ pnl is derived from its R-multiple:
 *   R = (exit_price - entry_price) / (entry_price - entry_stop)   (long)
 *   $ pnl = R × (startingCapital × 0.005)
 *
 * heat_status='ACCEPTED' means an entry actually fired. REJECTED_HEAT and other
 * non-ACCEPTED entries are dropped. EXIT rows are always real.
 */
const RISK_PER_TRADE_FRACTION = 0.005; // 0.5% per Basket Breakout v1 spec

export default function adaptBasketBreakout(rawOrResp, opts) {
  const resp = (rawOrResp && rawOrResp.ok !== undefined) ? rawOrResp : normalizeSheetResponse(rawOrResp);
  if (!resp.ok) {
    return makeErrorRow('Basket Breakout v1', resp.error || 'no data');
  }

  // Build event stream, capturing entry stop alongside entry price so we can
  // compute R-multiple at exit.
  const eventStream = []; // for pairing
  const entryStopBySymbolTime = new Map(); // key=`${symbol}|${entry_time}` -> stop
  const allTimes = [];

  for (const r of resp.rows) {
    const time = parseTimestamp(r.timestamp);
    if (time) allTimes.push(time);

    const action = String(r.action || '').toUpperCase();
    const heat = String(r.heat_status || '').toUpperCase();
    const symbol = r.symbol;
    const price = Number(r.price);
    if (Number.isNaN(price) || !symbol || !time) continue;

    if (action.includes('ENTRY') && heat === 'ACCEPTED') {
      const stop = Number(r.stop);
      if (!Number.isNaN(stop)) {
        entryStopBySymbolTime.set(`${symbol}|${time}`, stop);
      }
      eventStream.push({
        time, symbol, action: 'ENTRY', side: 'long', price, size: 1,
      });
    } else if (action === 'EXIT' || heat === 'EXIT') {
      eventStream.push({
        time, symbol, action: 'EXIT', side: 'long', price, size: 1,
      });
    }
    // ENTRY_REQUEST + REJECTED_HEAT/etc dropped
  }

  // Pair entries+exits FIFO per symbol. Then convert price-pnl to $ pnl via R-multiple.
  const rawTrips = pairRoundTrips(eventStream);
  const trips = [];
  const rMultiples = [];

  for (const t of rawTrips) {
    const stop = entryStopBySymbolTime.get(`${t.symbol}|${t.entry_time}`);
    if (stop == null) continue; // can't compute R without stop
    const stopDist = t.entry_price - stop; // positive for long
    if (stopDist <= 0) continue; // bad data
    const rMultiple = (t.exit_price - t.entry_price) / stopDist;
    const dollarPnl = rMultiple * (opts.startingCapital * RISK_PER_TRADE_FRACTION);
    trips.push({ exit_time: t.exit_time, pnl: dollarPnl });
    rMultiples.push(rMultiple);
  }

  return buildStrategyRow({
    name: 'Basket Breakout v1',
    status: 'live',
    trips,
    rMultiples,
    startingCapital: opts.startingCapital,
    last_signal_at: latestTime(allTimes),
    errors: [],
  });
}
