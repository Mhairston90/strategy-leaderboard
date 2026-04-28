import {
  profitFactor, maxDrawdown, sharpe, winPct, avgR, pctReturn, dailyReturnsFromTrades
} from './metrics.js';

/**
 * The normalized shape every adapter returns.
 *
 * @typedef {Object} StrategyRow
 * @property {string} name
 * @property {'live'|'canary'|'research'|'paused'|'error'} status
 * @property {{'7d': number|null, '30d': number|null, '90d': number|null, all: number|null}} returns
 * @property {number|null} sharpe
 * @property {number|null} pf
 * @property {number|null} max_dd
 * @property {number|null} win_pct
 * @property {number} trades_n
 * @property {number|null} avg_r
 * @property {string|null} last_signal_at
 * @property {{sharpe: string, pf: string, max_dd: string}} confidence
 * @property {Array<string>} errors
 */

/**
 * Build a row with all metric columns set to null/0 and a single error message.
 * Status defaults to 'error', but adapters can pass 'research' for tabs that
 * legitimately have no live data.
 */
export function makeErrorRow(name, err, status = 'error') {
  return {
    name,
    status,
    returns: { '7d': null, '30d': null, '90d': null, all: null },
    sharpe: null, pf: null, max_dd: null, win_pct: null, trades_n: 0,
    avg_r: null, last_signal_at: null,
    confidence: { sharpe: 'best-effort', pf: 'best-effort', max_dd: 'best-effort' },
    errors: err ? [err] : [],
  };
}

/**
 * Pick the chronologically-latest ISO timestamp from an array. Returns null on empty.
 */
export function latestTime(times) {
  const valid = (times || []).filter(t => t != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a > b ? a : b));
}

/**
 * Normalize a Sheets timestamp value. Accepts either:
 *  - epoch milliseconds (number)
 *  - ISO 8601 string
 * Returns ISO string or null.
 */
export function parseTimestamp(t) {
  if (t == null || t === '') return null;
  if (typeof t === 'number') return new Date(t).toISOString();
  if (typeof t === 'string') {
    // Some tabs store the epoch as a string; detect by all-digits
    if (/^\d+$/.test(t)) return new Date(Number(t)).toISOString();
    return t;
  }
  return null;
}

/**
 * Assemble a StrategyRow from completed round-trips and optional R-multiples.
 *
 * @param {Object} args
 * @param {string} args.name
 * @param {string} args.status
 * @param {Array<{exit_time: string, pnl: number}>} args.trips
 * @param {Array<number>} [args.rMultiples]
 * @param {number} args.startingCapital
 * @param {string|null} args.last_signal_at
 * @param {Array<string>} [args.errors]
 * @returns {StrategyRow}
 */
export function buildStrategyRow({ name, status, trips, rMultiples, startingCapital, last_signal_at, errors }) {
  const now = Date.now();
  const cutoffMs = (days) => now - days * 24 * 60 * 60 * 1000;
  const tripsInWindow = (days) => trips.filter(t => {
    const tMs = new Date(t.exit_time).getTime();
    return !Number.isNaN(tMs) && tMs >= cutoffMs(days);
  });

  const allPnls = trips.map(t => t.pnl);
  const pnls7  = tripsInWindow(7).map(t => t.pnl);
  const pnls30 = tripsInWindow(30).map(t => t.pnl);
  const pnls90 = tripsInWindow(90).map(t => t.pnl);

  return {
    name,
    status,
    returns: {
      '7d':  pctReturn(pnls7,  startingCapital),
      '30d': pctReturn(pnls30, startingCapital),
      '90d': pctReturn(pnls90, startingCapital),
      all:   pctReturn(allPnls,  startingCapital),
    },
    sharpe:   sharpe(dailyReturnsFromTrades(trips, startingCapital)),
    pf:       profitFactor(allPnls),
    max_dd:   maxDrawdown(allPnls, startingCapital),
    win_pct:  winPct(allPnls),
    trades_n: trips.length,
    avg_r:    rMultiples && rMultiples.length > 0 ? avgR(rMultiples) : null,
    last_signal_at,
    confidence: { sharpe: 'best-effort', pf: 'best-effort', max_dd: 'best-effort' },
    errors: errors || [],
  };
}
