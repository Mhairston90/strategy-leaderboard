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
 * Returns array of {time, action, symbol, side, size, price, stop, r, pnl, reason}.
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

    const [time, action, symbol, side, size, price, stop, , r, pnl, reason = ''] = cells;
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
    });
  }
  return out;
}
