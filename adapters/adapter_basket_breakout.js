import { buildStrategyRow, makeErrorRow, latestTime, parseTimestamp } from '../lib/strategy_row.js';
import { normalizeSheetResponse } from '../lib/fetch.js';

/**
 * Adapter for Basket Breakout v1.
 * Schema: timestamp, version, action, symbol, price, atr, stop, heat_status, ...
 *
 * Unlike v4/Analyst-HY-style tabs, Basket does NOT pre-compute pnl_dollar in
 * exit rows. We pair entries with exits/partials on price and infer per-trade
 * PnL using the strategy's published 0.5%-of-equity risk-per-trade sizing.
 *
 * Each round-trip's $ pnl is derived from its R-multiple:
 *   R = (exit_price - entry_price) / (entry_price - entry_stop)   (long)
 *   $ pnl = R × close_fraction × startingCapital × 0.005
 *
 * Event handling:
 *   - ENTRY (heat=ACCEPTED): opens a position with entry price + stop
 *   - PARTIAL: closes PARTIAL_CLOSE_FRACTION of the open position at PARTIAL price
 *   - EXIT: closes the remaining fraction at EXIT price
 *   - REJECTED_HEAT entries: dropped (no position opened)
 *   - Orphan EXIT/PARTIAL (no matching open entry): counted in warnings, dropped
 */
const RISK_PER_TRADE_FRACTION = 0.005; // 0.5% per Basket Breakout v1 spec
const PARTIAL_CLOSE_FRACTION = 0.5; // assumed: PARTIAL closes 50% of position

export default function adaptBasketBreakout(rawOrResp, opts) {
  const resp = (rawOrResp && rawOrResp.ok !== undefined) ? rawOrResp : normalizeSheetResponse(rawOrResp);
  if (!resp.ok) {
    return makeErrorRow('Basket Breakout v1', resp.error || 'no data');
  }

  // Build event stream including PARTIAL events
  const allTimes = [];
  const eventStream = [];

  for (const r of resp.rows) {
    const time = parseTimestamp(r.timestamp);
    if (time) allTimes.push(time);

    const action = String(r.action || '').toUpperCase();
    const heat = String(r.heat_status || '').toUpperCase();
    const symbol = r.symbol;
    const price = Number(r.price);
    if (Number.isNaN(price) || !symbol || !time) continue;

    const stopRaw = Number(r.stop);
    const openCountAtReceipt = Number(r.open_count_at_receipt);

    if (action.includes('ENTRY') && heat === 'ACCEPTED') {
      eventStream.push({
        kind: 'ENTRY',
        time, symbol, price,
        stop: Number.isNaN(stopRaw) ? null : stopRaw,
        open_count_at_receipt: Number.isNaN(openCountAtReceipt) ? null : openCountAtReceipt,
      });
    } else if (action === 'PARTIAL' || heat === 'PARTIAL') {
      eventStream.push({
        kind: 'PARTIAL', time, symbol, price,
        stop: Number.isNaN(stopRaw) ? null : stopRaw,
        open_count_at_receipt: Number.isNaN(openCountAtReceipt) ? null : openCountAtReceipt,
      });
    } else if (action === 'EXIT' || heat === 'EXIT') {
      eventStream.push({
        kind: 'EXIT', time, symbol, price,
        open_count_at_receipt: Number.isNaN(openCountAtReceipt) ? null : openCountAtReceipt,
      });
    }
    // ENTRY_REQUEST + REJECTED_HEAT/etc dropped silently
  }

  // Defensive sort by time (sheet should already be ordered)
  eventStream.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  // Walk events, maintaining per-symbol open position state.
  // Basket Breakout has no pyramiding (one open position per symbol max),
  // so a Map keyed by symbol is sufficient.
  const openPositions = new Map();
  const trips = [];
  const rMultiples = [];
  let orphanExits = 0;
  let orphanPartials = 0;
  let badStopCount = 0;

  // Contest-window provenance: a trip counts as FORWARD only if its position
  // was ENTERED on/after the cutoff. Pre-cutoff round-trips are backtest.
  const cutoff = opts.liveStartIso || null;
  const inWindow = (entryTime) => !cutoff || (entryTime && entryTime >= cutoff);
  let provTotal = 0, provFwd = 0, provFwdPnl = 0, provAllPnl = 0;

  for (const ev of eventStream) {
    if (ev.kind === 'ENTRY') {
      // Open new position. If one already exists (shouldn't per spec), overwrite.
      openPositions.set(ev.symbol, {
        entry_price: ev.price,
        stop: ev.stop,
        remaining_fraction: 1.0,
        entry_time: ev.time,
      });
      continue;
    }

    if (ev.kind === 'PARTIAL') {
      let pos = openPositions.get(ev.symbol);
      if (!pos) {
        // Recover from orphan: per pine semantics, on the PARTIAL bar the script
        // executes `stopPrice := entryPrice` (BE move) BEFORE the alert fires, so
        // the stop logged on a PARTIAL row equals the entry price (assuming trail
        // hasn't already overridden BE — the strict `>` in pine's trail check
        // means trail==BE leaves stopPrice at entry). Partial fires at limit
        // price = entry + 2 * stopAtrMult * atrAtEntry, which equals entry + 2R
        // by definition of R = stopAtrMult * atrAtEntry. So:
        //   entry = ev.stop, R = (ev.price - entry) / 2
        // Reconstruct the position so this PARTIAL pairs as a +2.0R close and
        // any subsequent EXIT for the same symbol can pair as the runner.
        if (ev.stop != null && ev.stop > 0 && ev.price > ev.stop) {
          const reconstructedEntry = ev.stop;
          const r = (ev.price - reconstructedEntry) / 2;
          const reconstructedStop = reconstructedEntry - r;
          pos = {
            entry_price: reconstructedEntry,
            stop: reconstructedStop,
            remaining_fraction: 1.0,
            entry_time: ev.time,
            reconstructed: true,
          };
          openPositions.set(ev.symbol, pos);
        } else {
          orphanPartials++;
          continue;
        }
      }
      if (pos.stop == null) { badStopCount++; continue; }
      const stopDist = pos.entry_price - pos.stop;
      if (stopDist <= 0) { badStopCount++; continue; }

      const closeFrac = Math.min(PARTIAL_CLOSE_FRACTION, pos.remaining_fraction);
      const r = (ev.price - pos.entry_price) / stopDist;
      const dollarPnl = r * closeFrac * (opts.startingCapital * RISK_PER_TRADE_FRACTION);
      provTotal += 1; provAllPnl += dollarPnl;
      if (inWindow(pos.entry_time)) {
        provFwd += 1; provFwdPnl += dollarPnl;
        trips.push({ exit_time: ev.time, pnl: dollarPnl });
        rMultiples.push(r);
      }
      pos.remaining_fraction -= closeFrac;
      if (pos.remaining_fraction <= 0.001) openPositions.delete(ev.symbol);
      continue;
    }

    if (ev.kind === 'EXIT') {
      const pos = openPositions.get(ev.symbol);
      if (!pos) {
        if (ev.open_count_at_receipt != null && ev.open_count_at_receipt > 0) {
          // Warm-start artifact: Sheets began after TradingView already had an
          // open paper position. Dropping the close avoids inventing entry/PnL.
        } else {
          orphanExits++;
        }
        continue;
      }
      if (pos.stop == null) { badStopCount++; continue; }
      const stopDist = pos.entry_price - pos.stop;
      if (stopDist <= 0) { badStopCount++; continue; }

      const r = (ev.price - pos.entry_price) / stopDist;
      const dollarPnl = r * pos.remaining_fraction * (opts.startingCapital * RISK_PER_TRADE_FRACTION);
      provTotal += 1; provAllPnl += dollarPnl;
      if (inWindow(pos.entry_time)) {
        provFwd += 1; provFwdPnl += dollarPnl;
        trips.push({ exit_time: ev.time, pnl: dollarPnl });
        rMultiples.push(r);
      }
      openPositions.delete(ev.symbol);
    }
  }

  // Surface diagnostic warnings via errors[] (UI shows these per row).
  // These aren't fatal; the row still renders with whatever trips were paired.
  const warnings = [];
  if (orphanExits > 0) {
    warnings.push(`warning: ${orphanExits} orphan exit(s) dropped (entries before log window)`);
  }
  if (orphanPartials > 0) {
    warnings.push(`warning: ${orphanPartials} orphan partial(s) dropped (entries before log window)`);
  }
  if (badStopCount > 0) {
    warnings.push(`warning: ${badStopCount} event(s) had missing/invalid stop`);
  }
  if (provTotal - provFwd > 0) {
    warnings.push(`${provTotal - provFwd} pre-cutoff round-trip(s) excluded (entry-time filtered)`);
  }

  const row = buildStrategyRow({
    name: 'Basket Breakout v1',
    status: 'live',
    trips,
    rMultiples,
    startingCapital: opts.startingCapital,
    last_signal_at: latestTime(allTimes),
    errors: warnings,
  });
  row.provenance = {
    source: 'sheet-entry-time',
    total: provTotal,
    forward: provFwd,
    backtest: provTotal - provFwd,
    fwdPnl: provFwdPnl,
    btPnl: provAllPnl - provFwdPnl,
    legitimacy: provTotal ? provFwd / provTotal : null,
  };
  return row;
}
