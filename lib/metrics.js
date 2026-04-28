/**
 * Profit factor = sum(positive PnLs) / |sum(negative PnLs)|.
 * Returns null for empty input. Returns Infinity if no losers. Returns 0 if no winners.
 */
export function profitFactor(pnls) {
  if (pnls.length === 0) return null;
  let wins = 0, losses = 0;
  for (const p of pnls) {
    if (p > 0) wins += p;
    else if (p < 0) losses += -p;
  }
  if (losses === 0) return wins > 0 ? Infinity : null;
  if (wins === 0) return 0;
  return wins / losses;
}

/**
 * Max drawdown as a negative percentage of peak equity.
 * Running-equity model: equity starts at 0, each pnl is added.
 * Returns 0 for empty input or monotonic-up series.
 */
export function maxDrawdown(pnls, startingCapital = 0) {
  if (pnls.length === 0) return 0;
  let equity = startingCapital;
  let peak = startingCapital;
  let maxDD = 0;
  for (const p of pnls) {
    equity += p;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }
  if (peak <= 0) return 0;
  const result = -(maxDD / peak * 100);
  return result === 0 ? 0 : result;
}

/**
 * Annualized Sharpe ratio.
 * Treats crypto as 24/7 (annualization factor sqrt(365)).
 * Returns null if insufficient data or zero variance.
 */
export function sharpe(dailyReturns) {
  if (dailyReturns.length < 2) return null;
  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  const stdev = Math.sqrt(variance);
  if (stdev === 0) return null;
  return (mean / stdev) * Math.sqrt(365);
}

export function winPct(pnls) {
  if (pnls.length === 0) return null;
  const wins = pnls.filter(p => p > 0).length;
  return Math.round((wins / pnls.length) * 100);
}

export function avgR(rMultiples) {
  const valid = rMultiples.filter(r => r != null && !Number.isNaN(r));
  if (valid.length === 0) return null;
  return valid.reduce((s, r) => s + r, 0) / valid.length;
}

export function pctReturn(pnls, startingCapital) {
  if (!startingCapital || startingCapital <= 0) return null;
  const total = pnls.reduce((s, p) => s + p, 0);
  return (total / startingCapital) * 100;
}

/**
 * Convert per-trade pnls (with exit_time) into a daily-returns series
 * for use in Sharpe. Returns are pct-of-prior-day-equity.
 */
export function dailyReturnsFromTrades(roundTrips, startingCapital) {
  if (roundTrips.length === 0) return [];
  const byDay = new Map();
  for (const rt of roundTrips) {
    const day = (rt.exit_time || '').slice(0, 10);
    if (!day) continue;
    byDay.set(day, (byDay.get(day) || 0) + (rt.pnl || 0));
  }
  const days = [...byDay.keys()].sort();
  let equity = startingCapital;
  const returns = [];
  for (const d of days) {
    const dayPnl = byDay.get(d);
    returns.push(dayPnl / equity);
    equity += dayPnl;
  }
  return returns;
}
