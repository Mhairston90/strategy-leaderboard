/**
 * Parse BULL portfolio.md to extract account state.
 * Returns { cash, realized_pnl, unrealized_pnl, equity, peak, drawdown_pct }.
 * Any field that fails to parse is set to null.
 */
export function parsePortfolio(md) {
  const numericFromMatch = (m) => {
    if (!m || !m[1]) return null;
    // Strip $, commas. Em-dash (−, U+2212) and ASCII minus (-) both indicate negative.
    let s = m[1].replace(/[\$,]/g, '').trim();
    let negative = false;
    if (s.startsWith('−') || s.startsWith('-')) {
      negative = true;
      s = s.slice(1);
    }
    const n = parseFloat(s);
    if (Number.isNaN(n)) return null;
    return negative ? -n : n;
  };

  return {
    cash:           numericFromMatch(md.match(/Cash:\s*\*\*([^*]+)\*\*/)),
    realized_pnl:   numericFromMatch(md.match(/Realized PnL[^*]*\*\*([^*]+)\*\*/)),
    unrealized_pnl: numericFromMatch(md.match(/Unrealized PnL:\s*\*\*([^*]+)\*\*/)),
    equity:         numericFromMatch(md.match(/Current equity[^*]*\*\*([^*]+)\*\*/)),
    peak:           numericFromMatch(md.match(/Equity peak:\s*\*\*([^*]+)\*\*/)),
    drawdown_pct:   numericFromMatch(md.match(/Drawdown from peak:\s*\*\*([^*]+)%\*\*/)),
  };
}

/**
 * Parse BULL trade_log.md table rows.
 * Returns array of {time, action, symbol, side, size, price, stop, r, pnl, reason, sleeve}.
 * Rows that don't match expected structure are skipped.
 *
 * Row format: | timestamp | OPEN/CLOSE | symbol | side | size | price | stop | _ | r | pnl | reason |
 */
export function parseTradeLog(md) {
  const out = [];
  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;
    if (line.includes('---')) continue;
    if (/timestamp\s*\|/i.test(line)) continue;

    const cells = line.split('|').map(c => c.trim());
    // Drop leading/trailing empty cells from leading/trailing pipes
    while (cells.length && cells[0] === '') cells.shift();
    while (cells.length && cells[cells.length - 1] === '') cells.pop();
    if (cells.length < 10) continue;

    const [time, action, symbol, side, size, price, stop, , r, pnl, reason = '', sleeve = ''] = cells;
    if (action !== 'OPEN' && action !== 'CLOSE') continue;

    const num = (v) => {
      if (v == null) return null;
      const t = v.trim();
      if (t === '' || t === '—' || t === '?' || t === '-') return null;
      // Handle leading + (e.g., "+0.10") and em-dash minus
      let cleaned = t.replace(/[+,$]/g, '').replace(/^−/, '-');
      const n = parseFloat(cleaned);
      return Number.isNaN(n) ? null : n;
    };

    out.push({
      time,
      action,
      symbol,
      side,
      size: num(size),
      price: num(price),
      stop: num(stop),
      r: num(r),
      pnl: num(pnl),
      reason,
      sleeve,
    });
  }
  return out;
}

/**
 * Pair OPEN rows with CLOSE rows by symbol and return trips that carry both
 * entry_time and exit_time. Handles partial exits (multiple CLOSE rows against
 * one OPEN) by keeping the OPEN active until a non-partial CLOSE arrives.
 *
 * Orphan CLOSE rows (no prior OPEN found) are dropped.
 *
 * Returns: Array<{ entry_time, exit_time, pnl, r, symbol, reason }>
 */
export function buildTripsWithEntryTime(rows) {
  const openIndex = new Map(); // symbol+sleeve -> open row
  const trips = [];
  for (const r of rows) {
    const key = `${r.symbol}||${r.sleeve || ''}`;
    if (r.action === 'OPEN') {
      openIndex.set(key, r);
    } else if (r.action === 'CLOSE') {
      const isCorrection = (r.reason || '').toLowerCase().includes('correction-previous-row');
      if (isCorrection) {
        const prior = trips.findLast(t => t.key === key);
        if (prior) {
          prior.exit_time = r.time;
          prior.pnl = r.pnl;
          prior.r = r.r;
          prior.reason = r.reason || '';
          continue;
        }
      }

      const open = openIndex.get(key);
      if (open) {
        trips.push({
          entry_time: open.time,
          exit_time: r.time,
          pnl: r.pnl,
          r: r.r,
          symbol: r.symbol,
          reason: r.reason || '',
          key,
        });
        // Partial-close: keep the OPEN active so subsequent legs still pair.
        // Full close / stop / target: retire the OPEN.
        const isPartial = (r.reason || '').toLowerCase().includes('partial');
        if (!isPartial) {
          openIndex.delete(key);
        }
      }
      // Orphan CLOSE (no prior OPEN found) is dropped — usually means the
      // strategy log starts mid-position, or the file was truncated.
    }
  }
  return trips.map(({ key, ...trip }) => trip);
}

/**
 * Filter trips to those whose ENTRY happened at or after a given ISO timestamp.
 * Used to exclude pre-spec-freeze backtest trades from leaderboard equity.
 *
 * Returns: { filtered: Array<trip>, dropped: number }
 */
export function filterTripsByLiveStart(trips, liveStartIso) {
  if (!liveStartIso) return { filtered: trips, dropped: 0 };
  const cutoffMs = new Date(liveStartIso).getTime();
  if (Number.isNaN(cutoffMs)) return { filtered: trips, dropped: 0 };
  const filtered = trips.filter(t => {
    const tMs = new Date(t.entry_time).getTime();
    return !Number.isNaN(tMs) && tMs >= cutoffMs;
  });
  return { filtered, dropped: trips.length - filtered.length };
}
