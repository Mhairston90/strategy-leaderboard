import { maxDrawdown, pctReturn, profitFactor } from './metrics.js';
import { buildTripsWithEntryTime, parseTradeLog, filterTripsByLiveStart } from './parse_bull_md.js';
import { effectiveCutoff } from '../registry.js';

export function parseGoalStatusText(text, options = {}) {
  if (!text) {
    return { rows: [], byStrategy: new Map(), error: options.error || '' };
  }
  const rows = [];
  for (const cells of markdownRows(text)) {
    if (cells.length < 9 || cells[0] === 'Strategy') continue;
    const row = {
      strategy: cells[0],
      status: cells[1],
      closedTrades: numberOrNull(cells[2]) ?? 0,
      weeksObserved: numberOrNull(cells[3]) ?? 0,
      pf: metricOrNull(cells[4]),
      sharpe: metricOrNull(cells[5]),
      drawdown: percentOrNull(cells[6]),
      ddLimit: percentOrNull(cells[7]),
      notes: cells[8],
    };
    rows.push(row);
  }
  return {
    rows,
    byStrategy: new Map(rows.map(row => [row.strategy, row])),
    error: '',
  };
}

export function parseShadowReportText(text, options = {}) {
  if (!text) {
    return { rows: [], byStrategy: new Map(), error: options.error || '' };
  }
  const rows = [];
  for (const cells of markdownRows(text)) {
    if (cells.length < 8 || cells[0] === 'Cycle time') continue;
    rows.push({
      cycleTime: cells[0],
      strategy: cells[1],
      pair: cells[2],
      session: cells[3],
      regime: cells[4],
      decision: cells[5],
      actualOpened: cells[6],
      reason: cells[7],
    });
  }
  const byStrategy = new Map();
  for (const row of rows) {
    if (!byStrategy.has(row.strategy)) byStrategy.set(row.strategy, []);
    byStrategy.get(row.strategy).push(row);
  }
  return { rows, byStrategy, error: '' };
}

// Normalize a column header for name-based matching: drop parenthetical
// qualifiers ("(initial 2×ATR)", "(4R)", "(UTC)"), keep alnum + '$', collapse
// spaces. So "Stop (initial 2×ATR)" -> "stop", "Unrealized $" -> "unrealized $",
// "Entry ts (UTC)" -> "entry ts" (distinct from "Entry" -> "entry").
function normalizeHeader(h) {
  return String(h)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9$ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse the "Open positions" table. HEADER-AWARE: columns are matched by name,
// not by fixed position, so this reads BOTH the CODEX 9-column layout
// (Pair|Sleeve|Side|Size|Entry|Stop|MTM price|Unrealized PnL|Exposure) AND the
// BULL 11-column layout (Pair|Side|Size|Entry|Stop (initial)|Active stop|
// Target|Entry ts|Last (MTM)|Unrealized R|Unrealized $). The old positional
// destructuring mis-read BULL rows — the entry timestamp landed in the P&L
// column, rendering the year ("2026") as "$2026.00" with a bogus % (the
// 2026-06-20 SOL display bug).
export function parsePortfolioOpenPositions(text, strategyName = '') {
  if (!text) return [];
  // Scope to the Open positions section so sibling tables (universe refresh,
  // rolling performance) in the same portfolio.md can't be mis-parsed.
  const section = String(text).match(/##\s*Open positions[\s\S]*?(?=\n#{1,2}\s|$)/i);
  const rows = markdownRows(section ? section[0] : text);
  // The header row has both a Pair and a Size column (distinguishes the
  // positions table from e.g. a "Rank | Pair | Change" universe table).
  let headerIdx = -1;
  const headerMap = new Map();
  for (let i = 0; i < rows.length; i++) {
    const norm = rows[i].map(normalizeHeader);
    if (norm.includes('pair') && norm.includes('size')) {
      norm.forEach((h, idx) => { if (h && !headerMap.has(h)) headerMap.set(h, idx); });
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];
  const col = (...names) => {
    for (const n of names) if (headerMap.has(n)) return headerMap.get(n);
    return -1;
  };
  const iPair = col('pair');
  const iSleeve = col('sleeve');
  const iSide = col('side');
  const iSize = col('size');
  const iEntry = col('entry');
  const iStop = col('active stop', 'stop');
  const iMark = col('mtm price', 'last', 'mark');
  const iPnl = col('unrealized pnl', 'unrealized $', 'unrealized', 'pnl');
  const iExp = col('exposure');
  const at = (cells, idx) => (idx >= 0 && idx < cells.length ? cells[idx] : '');

  const positions = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = rows[i];
    const pair = at(cells, iPair);
    if (!pair || /^no open positions/i.test(pair)) continue;
    const size = numberOrNull(at(cells, iSize));
    const mark = numberOrNull(at(cells, iMark));
    // BULL has no Exposure column → fall back to notional (size × mark).
    let exposure = Math.abs(moneyOrNull(at(cells, iExp)) ?? 0);
    if (exposure <= 0 && size != null && mark != null) exposure = Math.abs(size * mark);
    if (exposure <= 0) continue;
    positions.push({
      strategy: strategyName,
      pair,
      sleeve: at(cells, iSleeve),
      side: at(cells, iSide).toLowerCase(),
      size,
      entry: numberOrNull(at(cells, iEntry)),
      stop: numberOrNull(at(cells, iStop)),
      mark,
      unrealizedPnl: moneyOrNull(at(cells, iPnl)),
      exposure,
    });
  }
  return positions;
}

export function buildCommandCenterModel({
  rows = [],
  registry = [],
  snapshots = [],
  forensicsReport = null,
  goalReport = null,
  hermesQueue = null,
  shadowReport = null,
  selectedNames = [],
} = {}) {
  const registryByName = new Map(registry.map(item => [item.name, item]));
  const snapshotByName = new Map(snapshots.map(item => [item.row?.name || item.strategy?.name, item]));
  const latestQuality = latestForensicsByStrategy(forensicsReport?.rows || []);
  const hermesByStrategy = hermesItemsByStrategy(hermesQueue?.items || [], rows.map(row => row.name));
  const selectedSet = new Set(
    selectedNames.length ? selectedNames : defaultSelectedNames(rows)
  );

  const strategies = rows.map(row => {
    const strategy = registryByName.get(row.name) || snapshotByName.get(row.name)?.strategy || {};
    const snapshot = snapshotByName.get(row.name) || { row, strategy };
    const tradeData = extractTradeData(snapshot, row.name);
    const positions = parsePortfolioOpenPositions(snapshot.portfolio?.text || '', row.name);
    const goal = goalReport?.byStrategy?.get(row.name) || null;
    const quality = latestQuality.get(row.name) || null;
    const hermesItems = hermesByStrategy.get(row.name) || [];
    const shadowRows = shadowReport?.byStrategy?.get(row.name) || [];

    return {
      name: row.name,
      row,
      strategy,
      startingCapital: strategy.starting_capital || 0,
      killswitchDdPct: strategy.killswitch_dd_pct || null,
      events: tradeData.events,
      // Apply the SAME contest cutoff the leaderboard rows use, so the
      // Closed Trade Review box shows only trades that actually count
      // (pre-live-start backtest trades are excluded, matching the row).
      trips: filterTripsByLiveStart(tradeData.trips, effectiveCutoff(strategy.live_start_iso)).filtered,
      positions,
      goal,
      quality,
      hermesItems,
      shadowRows,
      readiness: readinessFor({ row, strategy, goal, quality }),
      detailed: tradeData.detailed,
    };
  });

  const details = {
    byName: new Map(strategies.map(item => [item.name, item])),
  };
  const heat = buildHeat(strategies);
  const recentTrades = strategies
    .flatMap(item => item.events)
    .filter(event => event.action === 'OPEN' || event.action === 'CLOSE')
    .sort((a, b) => compareTimeDesc(a.time, b.time))
    .slice(0, 10);
  const openTrades = buildOpenTradeRows(strategies);
  const closedTrades = buildClosedTradeRows(strategies);
  const ensemble = buildEnsemble(strategies, selectedSet);

  return {
    strategies,
    heat,
    readiness: {
      items: strategies.map(item => ({ name: item.name, ...item.readiness })),
      byName: new Map(strategies.map(item => [item.name, item.readiness])),
    },
    recentTrades,
    openTrades,
    closedTrades,
    ensemble,
    details,
  };
}

export function renderCommandCenterHtml(model) {
  if (!model) {
    return '<div class="loading">Loading command center...</div>';
  }

  return `
    <div class="command-head">
      <div>
        <div class="section-kicker">Recent Trades</div>
        <h2>Command Center</h2>
      </div>
      <div class="command-meta">
        <span class="badge badge-live">${escapeHtml(model.openTrades.length)} Open</span>
        <span class="dim">${escapeHtml(model.closedTrades.length)} closed reviewed</span>
      </div>
    </div>
    <div class="trade-desk">
      ${openTradeMonitorHtml(model.openTrades)}
      ${closedTradeReviewHtml(model.closedTrades)}
    </div>
  `;
}

export function renderStrategyDrawerHtml(model, selectedName) {
  const detail = selectedName ? model?.details?.byName?.get(selectedName) : null;
  if (!detail) {
    return `
      <div class="drawer-shell drawer-empty">
        <div class="section-kicker">Detail</div>
        <h2>Strategy Detail</h2>
        <p class="dim">Select a strategy row.</p>
      </div>
    `;
  }

  const recent = detail.events
    .filter(event => event.action === 'OPEN' || event.action === 'CLOSE')
    .sort((a, b) => compareTimeDesc(a.time, b.time))
    .slice(0, 6);

  return `
    <div class="drawer-shell">
      <div class="drawer-head">
        <div>
          <div class="section-kicker">Strategy Detail</div>
          <h2>${escapeHtml(detail.name)}</h2>
        </div>
        <button class="drawer-close" type="button" data-drawer-close>Close</button>
      </div>
      <div class="drawer-stats">
        ${miniStatHtml('90d', fmtPct(detail.row.returns?.['90d']))}
        ${miniStatHtml('PF', fmtNum(detail.row.pf))}
        ${miniStatHtml('Trades', String(detail.row.trades_n ?? 0))}
        ${miniStatHtml('Ready', detail.readiness.status)}
      </div>
      <section class="drawer-section">
        <h3>Open Positions</h3>
        ${positionsListHtml(detail.positions)}
      </section>
      <section class="drawer-section">
        <h3>Recent Trades</h3>
        ${eventsListHtml(recent)}
      </section>
      <section class="drawer-section">
        <h3>Goal Status</h3>
        ${goalHtml(detail.goal)}
      </section>
      <section class="drawer-section">
        <h3>Quality</h3>
        ${qualityHtml(detail.quality)}
      </section>
      <section class="drawer-section">
        <h3>Hermes</h3>
        ${hermesListHtml(detail.hermesItems)}
      </section>
      <section class="drawer-section">
        <h3>Regime Shadow</h3>
        ${shadowListHtml(detail.shadowRows)}
      </section>
    </div>
  `;
}

function heatCardHtml(heat) {
  const symbols = heat.bySymbol.slice(0, 5).map(item => `
    <div class="mini-row">
      <span>${escapeHtml(item.symbol)}</span>
      <strong>${escapeHtml(fmtMoney(item.exposure))}</strong>
    </div>
  `).join('') || '<div class="dim">No open exposure</div>';
  const strategies = heat.byStrategy.slice(0, 4).map(item => `
    <div class="mini-row">
      <span>${escapeHtml(item.strategy)}</span>
      <strong>${escapeHtml(fmtMoney(item.exposure))}</strong>
    </div>
  `).join('');

  return `
    <article class="command-card">
      <div class="command-card-head">
        <h3>Portfolio Heat</h3>
        <strong>${escapeHtml(fmtMoney(heat.totalExposure))}</strong>
      </div>
      <div class="heat-bars">
        <span class="heat-long" style="width:${escapeHtml(String(heat.longPct))}%"></span>
        <span class="heat-short" style="width:${escapeHtml(String(heat.shortPct))}%"></span>
      </div>
      <div class="mini-grid">
        ${miniStatHtml('Long', fmtMoney(heat.longExposure))}
        ${miniStatHtml('Short', fmtMoney(heat.shortExposure))}
      </div>
      <div class="mini-list">${symbols}${strategies}</div>
    </article>
  `;
}

function readinessCardHtml(items) {
  const visible = [...items]
    .sort((a, b) => readinessRank(a.status) - readinessRank(b.status) || a.name.localeCompare(b.name))
    .slice(0, 8);
  const rows = visible.map(item => `
    <div class="mini-row">
      <span>${escapeHtml(item.name)}</span>
      <strong class="${escapeHtml(readinessClass(item.status))}">${escapeHtml(item.status)}</strong>
    </div>
  `).join('') || '<div class="dim">No readiness data</div>';
  return `
    <article class="command-card">
      <div class="command-card-head">
        <h3>Promotion Readiness</h3>
        <strong>${escapeHtml(String(items.length))}</strong>
      </div>
      <div class="mini-list">${rows}</div>
    </article>
  `;
}

function recentTradesCardHtml(events) {
  const rows = events.slice(0, 10).map(event => `
    <div class="trade-feed-row">
      <span class="trade-action ${escapeHtml(event.action.toLowerCase())}">${escapeHtml(event.action)}</span>
      <span>${escapeHtml(event.strategy)}</span>
      <strong>${escapeHtml(event.symbol || '-')}</strong>
      <span class="${escapeHtml((event.pnl ?? 0) >= 0 ? 'pos' : 'neg')}">${event.pnl == null ? '' : escapeHtml(fmtMoney(event.pnl))}</span>
    </div>
  `).join('') || '<div class="dim">No recent trades</div>';
  return `
    <article class="command-card">
      <div class="command-card-head">
        <h3>Recent Trades</h3>
        <strong>${escapeHtml(String(events.length))}</strong>
      </div>
      <div class="trade-feed">${rows}</div>
    </article>
  `;
}

function openTradeMonitorHtml(openTrades) {
  const rows = openTrades.map(trade => `
    <div class="trade-table-row open-trade-row">
      <span class="trade-main" data-label="Trade">
        <strong>${escapeHtml(shortName(trade.strategy))} ${escapeHtml(trade.pair)}</strong>
        <small>${escapeHtml(trade.side || '-')} ${escapeHtml(trade.sleeve || '')}</small>
      </span>
      <span class="${escapeHtml((trade.unrealizedPnl ?? 0) >= 0 ? 'pos' : 'neg')}" data-label="Live P/L">
        ${escapeHtml(fmtMoneyFine(trade.unrealizedPnl))}
        <small>${escapeHtml(fmtPct(trade.pnlPct))}</small>
      </span>
      <span data-label="Entry -> Mark">
        ${escapeHtml(fmtPrice(trade.entry))}
        <small>${escapeHtml(fmtPrice(trade.mark))}</small>
      </span>
      <span data-label="Stop Distance">
        ${escapeHtml(fmtPrice(trade.stop))}
        <small>${escapeHtml(trade.distanceToStopPct == null ? '-' : `${fmtNum(trade.distanceToStopPct, 1)}%`)}</small>
      </span>
      <span data-label="Exposure">${escapeHtml(fmtMoney(trade.exposure))}</span>
      <span data-label="Age">
        ${escapeHtml(fmtAge(trade.ageHours))}
        <small class="trade-pill ${escapeHtml(statusClass(trade.status))}">${escapeHtml(trade.status)}</small>
      </span>
    </div>
  `).join('') || '<div class="dim">No open trades</div>';

  return `
    <article class="trade-desk-card">
      <div class="command-card-head">
        <h3>Open Trade Monitor</h3>
        <strong>${escapeHtml(String(openTrades.length))}</strong>
      </div>
      <div class="trade-table">
        <div class="trade-table-row trade-table-head open-trade-row">
          <span>Trade</span>
          <span>Live P/L</span>
          <span>Entry -> Mark</span>
          <span>Stop Distance</span>
          <span>Exposure</span>
          <span>Age</span>
        </div>
        ${rows}
      </div>
    </article>
  `;
}

function closedTradeReviewHtml(closedTrades) {
  const rows = closedTrades.slice(0, 25).map(trade => `
    <div class="trade-table-row closed-trade-row">
      <span class="trade-main" data-label="Trade">
        <strong>${escapeHtml(shortName(trade.strategy))} ${escapeHtml(trade.symbol || '-')}</strong>
        <small>${escapeHtml(trade.side || '-')} ${escapeHtml(trade.sleeve || '')}</small>
      </span>
      <span data-label="Exit">${escapeHtml(shortTime(trade.exit_time))}</span>
      <span class="${escapeHtml((trade.pnl ?? 0) >= 0 ? 'pos' : 'neg')}" data-label="P/L">
        ${escapeHtml(fmtMoneyFine(trade.pnl))}
        <small>${escapeHtml(trade.r == null ? '-' : `${fmtNum(trade.r, 2)}R`)}</small>
      </span>
      <span data-label="Hold">${escapeHtml(fmtAge(trade.holdHours))}</span>
      <span data-label="Trade Analyst Score">
        <strong>${escapeHtml(String(trade.analystScore))}</strong>
        <small class="trade-pill ${escapeHtml(scoreClass(trade.analystScore))}">${escapeHtml(trade.scoreLabel)}</small>
      </span>
      <span data-label="Reason">${escapeHtml(trade.reason || '-')}</span>
    </div>
  `).join('') || '<div class="dim">No closed trades</div>';

  return `
    <article class="trade-desk-card">
      <div class="command-card-head">
        <h3>Closed Trade Review</h3>
        <strong>${escapeHtml(String(closedTrades.length))} scored</strong>
      </div>
      <div class="trade-table">
        <div class="trade-table-row trade-table-head closed-trade-row">
          <span>Trade</span>
          <span>Exit</span>
          <span>P/L</span>
          <span>Hold</span>
          <span>Trade Analyst Score</span>
          <span>Reason</span>
        </div>
        ${rows}
      </div>
    </article>
  `;
}

function ensembleCardHtml(ensemble, strategies) {
  const checks = strategies.map(item => `
    <label class="ensemble-check">
      <input type="checkbox" data-ensemble-strategy="${escapeHtml(item.name)}" ${ensemble.selectedNames.includes(item.name) ? 'checked' : ''}>
      <span>${escapeHtml(shortName(item.name))}</span>
    </label>
  `).join('');
  return `
    <article class="command-card ensemble-card">
      <div class="command-card-head">
        <h3>Ensemble View</h3>
        <strong>${escapeHtml(String(ensemble.selectedNames.length))}</strong>
      </div>
      <div class="mini-grid">
        ${miniStatHtml('Return', fmtPct(ensemble.returnPct))}
        ${miniStatHtml('Max DD', fmtPct(ensemble.maxDd))}
        ${miniStatHtml('PF', fmtNum(ensemble.pf))}
        ${miniStatHtml('Trades', String(ensemble.trades))}
      </div>
      <div class="mini-grid">
        ${miniStatHtml('Exposure', fmtMoney(ensemble.openExposure))}
        ${miniStatHtml('Overlap', ensemble.overlapSymbols.length ? ensemble.overlapSymbols.join(', ') : 'None')}
      </div>
      <div class="ensemble-checks">${checks}</div>
    </article>
  `;
}

function buildHeat(strategies) {
  const positions = strategies.flatMap(item => item.positions);
  const totalExposure = sum(positions.map(pos => pos.exposure));
  const longExposure = sum(positions.filter(pos => pos.side !== 'short').map(pos => pos.exposure));
  const shortExposure = sum(positions.filter(pos => pos.side === 'short').map(pos => pos.exposure));
  return {
    positions,
    totalExposure,
    longExposure,
    shortExposure,
    longPct: totalExposure ? Math.round(longExposure / totalExposure * 100) : 0,
    shortPct: totalExposure ? Math.round(shortExposure / totalExposure * 100) : 0,
    bySymbol: groupedExposure(positions, 'pair', 'symbol'),
    byStrategy: groupedExposure(positions, 'strategy', 'strategy'),
  };
}

function buildOpenTradeRows(strategies) {
  return strategies
    .flatMap(item => {
      const asOf = item.quality?.cycleTime || item.quality?.recordedAt || latestEventTime(item.events);
      return item.positions.map(position => enrichOpenPosition(position, item.events, asOf));
    })
    .sort((a, b) => openTradeRank(a.status) - openTradeRank(b.status)
      || Math.abs(b.unrealizedPnl ?? 0) - Math.abs(a.unrealizedPnl ?? 0)
      || a.strategy.localeCompare(b.strategy));
}

function enrichOpenPosition(position, events, asOf) {
  const openEvent = [...events]
    .filter(event => event.action === 'OPEN'
      && event.symbol === position.pair
      && (!position.sleeve || event.sleeve === position.sleeve))
    .sort((a, b) => compareTimeDesc(a.time, b.time))[0];
  const pnlPct = position.entry && position.mark
    ? ((position.mark - position.entry) / position.entry) * (position.side === 'short' ? -100 : 100)
    : null;
  const distanceToStopPct = distanceToStop(position);
  const ageHours = openEvent?.time && asOf ? hoursBetween(openEvent.time, asOf) : null;
  const status = openPositionStatus({ ...position, pnlPct, distanceToStopPct });
  return {
    ...position,
    openedAt: openEvent?.time || '',
    pnlPct,
    distanceToStopPct,
    ageHours,
    status,
  };
}

function distanceToStop(position) {
  if (!position.mark || !position.stop) return null;
  if (position.side === 'short') return ((position.stop - position.mark) / position.mark) * 100;
  return ((position.mark - position.stop) / position.mark) * 100;
}

function openPositionStatus(position) {
  if (position.distanceToStopPct != null && position.distanceToStopPct <= 1) return 'At Risk';
  if ((position.pnlPct ?? 0) < 0 || (position.distanceToStopPct != null && position.distanceToStopPct <= 3)) {
    return 'Watch';
  }
  return 'Clean';
}

function openTradeRank(status) {
  return {
    'At Risk': 0,
    Watch: 1,
    Clean: 2,
  }[status] ?? 3;
}

function buildClosedTradeRows(strategies) {
  return strategies
    .flatMap(item => item.trips.map(trip => {
      const closeEvent = item.events.find(event => event.action === 'CLOSE'
        && event.symbol === trip.symbol
        && event.time === trip.exit_time);
      return scoreClosedTrade({
        ...trip,
        strategy: item.name,
        side: closeEvent?.side || trip.side || '',
        sleeve: closeEvent?.sleeve || trip.sleeve || '',
      });
    }))
    .filter(trade => trade.exit_time)
    .sort((a, b) => compareTimeDesc(a.exit_time, b.exit_time))
    .slice(0, 25);
}

function scoreClosedTrade(trip) {
  const holdHours = trip.entry_time && trip.exit_time ? hoursBetween(trip.entry_time, trip.exit_time) : null;
  const analystScore = tradeAnalystScore({ ...trip, holdHours });
  return {
    ...trip,
    holdHours,
    analystScore,
    scoreLabel: analystScoreLabel(analystScore),
  };
}

function tradeAnalystScore(trade) {
  let score = 50;
  if (trade.r != null) score += Math.max(-25, Math.min(25, trade.r * 12));
  if ((trade.pnl ?? 0) > 0) score += 8;
  if ((trade.pnl ?? 0) < 0) score -= 6;
  const reason = String(trade.reason || '').toLowerCase();
  if (reason) score += 8;
  if (/(target|trail|time-stop|stop|momentum|breakout|regime|risk)/.test(reason)) score += 6;
  if (trade.holdHours != null && trade.holdHours >= 0) score += 3;
  if (trade.r != null && trade.r <= -1.5) score -= 12;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function analystScoreLabel(score) {
  if (score >= 80) return 'Strong';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Mixed';
  return 'Poor';
}

function buildEnsemble(strategies, selectedSet) {
  const selected = strategies.filter(item => selectedSet.has(item.name));
  const trips = selected
    .flatMap(item => item.trips.map(trip => ({ ...trip, strategy: item.name })))
    .filter(trip => trip.pnl != null)
    .sort((a, b) => compareTimeAsc(a.exit_time, b.exit_time));
  const pnls = trips.map(trip => trip.pnl);
  const capital = sum(selected.map(item => item.startingCapital || 0));
  const openPositions = selected.flatMap(item => item.positions);
  const symbolCounts = new Map();
  for (const position of openPositions) {
    const key = position.pair;
    symbolCounts.set(key, (symbolCounts.get(key) || 0) + 1);
  }
  return {
    selectedNames: selected.map(item => item.name),
    returnPct: pctReturn(pnls, capital),
    maxDd: maxDrawdown(pnls, capital),
    pf: profitFactor(pnls),
    trades: trips.length,
    openExposure: sum(openPositions.map(position => position.exposure)),
    overlapSymbols: [...symbolCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([symbol]) => symbol),
  };
}

function readinessFor({ row, strategy, goal, quality }) {
  const qualityBlocked = quality?.quality === 'blocked';
  const ddLimit = goal?.ddLimit ?? strategy.killswitch_dd_pct ?? null;
  const drawdown = goal?.drawdown ?? Math.abs(row.max_dd ?? 0);
  const pf = goal?.pf ?? row.pf;
  const closedTrades = goal?.closedTrades ?? row.trades_n ?? 0;
  const weeksObserved = goal?.weeksObserved ?? 0;

  if (row.status === 'error' || qualityBlocked || (ddLimit != null && drawdown >= ddLimit)) {
    return { status: 'Pause', reason: qualityBlocked ? 'data quality blocker' : 'risk or source issue' };
  }
  if (closedTrades >= 60 && weeksObserved >= 8 && pf != null && pf >= 1.2) {
    return { status: 'Promote', reason: 'review sample reached' };
  }
  if (closedTrades >= 30 && weeksObserved >= 6 && pf != null && pf >= 1.2) {
    return { status: 'Eligible', reason: 'minimum sample reached' };
  }
  if ((pf != null && pf >= 1) || (row.returns?.['90d'] ?? 0) > 0 || row.sharpe > 0) {
    return { status: 'Watch', reason: 'positive but still collecting' };
  }
  return { status: 'Collecting', reason: 'needs more sample' };
}

function extractTradeData(snapshot, strategyName) {
  if (snapshot.tradeLog?.ok && snapshot.tradeLog.text) {
    const parsed = parseTradeLog(snapshot.tradeLog.text);
    return {
      detailed: true,
      events: parsed.map(row => eventFromTradeLogRow(row, strategyName)),
      trips: buildTripsWithEntryTime(parsed).map(trip => ({
        ...trip,
        strategy: strategyName,
      })),
    };
  }
  if (snapshot.sheet?.ok) {
    const events = sheetEvents(snapshot.sheet, strategyName);
    return {
      detailed: true,
      events,
      trips: events
        .filter(event => event.action === 'CLOSE' && event.pnl != null)
        .map(event => ({
          entry_time: event.time,
          exit_time: event.time,
          pnl: event.pnl,
          r: event.r,
          symbol: event.symbol,
          reason: event.reason,
          strategy: strategyName,
        })),
    };
  }
  return { detailed: false, events: [], trips: [] };
}

function eventFromTradeLogRow(row, strategyName) {
  return {
    strategy: strategyName,
    time: row.time,
    action: row.action,
    symbol: row.symbol,
    side: row.side,
    price: row.price,
    pnl: row.pnl,
    r: row.r,
    reason: row.reason,
    sleeve: row.sleeve,
  };
}

function sheetEvents(sheet, strategyName) {
  const headers = (sheet.headers || []).map(header => String(header).toLowerCase());
  const get = (row, key) => {
    if (row && !Array.isArray(row) && typeof row === 'object') return row[key];
    const index = headers.indexOf(key);
    return index >= 0 ? row[index] : undefined;
  };
  return (sheet.rows || []).map(row => {
    const signal = String(get(row, 'signal') || '').toUpperCase();
    const action = signal.includes('ENTRY')
      ? 'OPEN'
      : signal.includes('EXIT') || signal.includes('PARTIAL')
        ? 'CLOSE'
        : '';
    if (!action) return null;
    return {
      strategy: strategyName,
      time: parseTime(get(row, 'timestamp')),
      action,
      symbol: String(get(row, 'asset') || ''),
      side: signal.includes('SHORT') ? 'short' : signal.includes('LONG') ? 'long' : '',
      price: numberOrNull(get(row, 'price')),
      pnl: moneyOrNull(get(row, 'pnl_dollar')),
      r: numberOrNull(get(row, 'r_multiple')),
      reason: String(get(row, 'notes') || get(row, 'filter_blocked') || signal.toLowerCase()),
      sleeve: '',
    };
  }).filter(Boolean);
}

function latestForensicsByStrategy(rows) {
  const latestAny = new Map();
  const latestActionable = new Map();
  for (const row of rows) {
    latestAny.set(row.strategy, row);
    if (row.quality !== 'skipped') {
      latestActionable.set(row.strategy, row);
    }
  }
  return new Map([...latestAny, ...latestActionable]);
}

function hermesItemsByStrategy(items, strategyNames) {
  const byStrategy = new Map(strategyNames.map(name => [name, []]));
  const aliases = strategyNames.map(name => [name, strategyAlias(name)]);
  for (const item of items) {
    const haystack = `${item.title || ''} ${item.rationale || ''} ${item.requested_action || ''}`.toLowerCase();
    for (const [name, alias] of aliases) {
      if (haystack.includes(name.toLowerCase()) || (alias.length > 8 && haystack.includes(alias))) {
        byStrategy.get(name).push(item);
      }
    }
  }
  return byStrategy;
}

function strategyAlias(name) {
  return String(name)
    .toLowerCase()
    .replace(/\bv\d+\b/g, '')
    .replace(/\bwfo\b/g, 'wfo')
    .replace(/\s+/g, ' ')
    .trim();
}

function defaultSelectedNames(rows) {
  return [...rows]
    .filter(row => row.returns?.['90d'] != null)
    .sort((a, b) => (b.returns?.['90d'] ?? -Infinity) - (a.returns?.['90d'] ?? -Infinity))
    .slice(0, 8)
    .map(row => row.name);
}

function groupedExposure(positions, field, outputField) {
  const map = new Map();
  for (const position of positions) {
    const key = position[field] || '-';
    map.set(key, (map.get(key) || 0) + position.exposure);
  }
  return [...map.entries()]
    .map(([key, exposure]) => ({ [outputField]: key, exposure }))
    .sort((a, b) => b.exposure - a.exposure);
}

function positionsListHtml(positions) {
  if (!positions.length) return '<div class="dim">No open positions</div>';
  return positions.map(position => `
    <div class="mini-row">
      <span>${escapeHtml(position.pair)} ${escapeHtml(position.side)}</span>
      <strong>${escapeHtml(fmtMoney(position.exposure))}</strong>
    </div>
  `).join('');
}

function eventsListHtml(events) {
  if (!events.length) return '<div class="dim">No recent trades</div>';
  return events.map(event => `
    <div class="mini-row">
      <span>${escapeHtml(shortTime(event.time))} ${escapeHtml(event.action)} ${escapeHtml(event.symbol)}</span>
      <strong>${event.pnl == null ? '-' : escapeHtml(fmtMoney(event.pnl))}</strong>
    </div>
  `).join('');
}

function goalHtml(goal) {
  if (!goal) return '<div class="dim">No goal row</div>';
  return `
    <div class="mini-grid">
      ${miniStatHtml('Closed', String(goal.closedTrades))}
      ${miniStatHtml('Weeks', fmtNum(goal.weeksObserved, 1))}
      ${miniStatHtml('PF', fmtNum(goal.pf))}
      ${miniStatHtml('DD', fmtPct(-Math.abs(goal.drawdown ?? 0)))}
    </div>
    <p class="drawer-note">${escapeHtml(goal.notes || '-')}</p>
  `;
}

function qualityHtml(quality) {
  if (!quality) return '<div class="dim">No quality row</div>';
  const issue = (quality.blockers?.length ? quality.blockers : quality.warnings || []).slice(0, 2).join('; ');
  return `
    <div class="mini-row">
      <span>${escapeHtml(quality.quality || 'unknown')} ${escapeHtml(quality.dataSource || '')}</span>
      <strong>${escapeHtml(shortTime(quality.recordedAt))}</strong>
    </div>
    <p class="drawer-note">${escapeHtml(issue || '-')}</p>
  `;
}

function hermesListHtml(items) {
  if (!items.length) return '<div class="dim">No Hermes item</div>';
  return items.slice(0, 4).map(item => `
    <div class="mini-row">
      <span>P${escapeHtml(item.priority)} ${escapeHtml(item.title)}</span>
      <strong>${escapeHtml(item.type)}</strong>
    </div>
  `).join('');
}

function shadowListHtml(rows) {
  if (!rows.length) return '<div class="dim">No shadow observations</div>';
  return rows.slice(0, 4).map(row => `
    <div class="mini-row">
      <span>${escapeHtml(row.pair)} ${escapeHtml(row.session)} ${escapeHtml(row.regime)}</span>
      <strong>${escapeHtml(row.decision)}</strong>
    </div>
  `).join('');
}

function miniStatHtml(label, value) {
  return `
    <div class="mini-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function markdownRows(text) {
  const rows = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
      .map(cell => cell.trim());
    if (cells.every(cell => /^[-:]+$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows;
}

function readinessRank(status) {
  return {
    Promote: 0,
    Eligible: 1,
    Watch: 2,
    Pause: 3,
    Collecting: 4,
  }[status] ?? 5;
}

function readinessClass(status) {
  return {
    Promote: 'pos',
    Eligible: 'pos',
    Watch: 'warn-text',
    Pause: 'neg',
    Collecting: 'dim',
  }[status] || 'dim';
}

function compareTimeDesc(a, b) {
  return compareTimeAsc(b, a);
}

function compareTimeAsc(a, b) {
  return new Date(a || 0).getTime() - new Date(b || 0).getTime();
}

function latestEventTime(events) {
  const latestMs = Math.max(
    ...events
      .map(event => new Date(event.time || 0).getTime())
      .filter(Number.isFinite)
  );
  return Number.isFinite(latestMs) ? new Date(latestMs).toISOString() : '';
}

function hoursBetween(start, end) {
  const startMs = new Date(start || 0).getTime();
  const endMs = new Date(end || 0).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Number(((endMs - startMs) / 36e5).toFixed(1));
}

function parseTime(value) {
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string' && /^\d+$/.test(value)) return new Date(Number(value)).toISOString();
  return value ? String(value) : '';
}

function moneyOrNull(value) {
  if (value == null || value === '' || value === '-' || value === 'n/a') return null;
  return numberOrNull(String(value).replace(/[$,%]/g, ''));
}

function percentOrNull(value) {
  if (value == null || value === '' || value === '-' || value === 'n/a') return null;
  return numberOrNull(String(value).replace('%', ''));
}

function metricOrNull(value) {
  if (String(value).toLowerCase() === 'inf') return Infinity;
  return numberOrNull(value);
}

function numberOrNull(value) {
  if (value == null) return null;
  const text = String(value).replace(/[,$+]/g, '').replace(/^−/, '-').trim();
  if (!text || text === '-' || text.toLowerCase() === 'n/a') return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function sum(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function fmtMoney(value) {
  if (value == null || Number.isNaN(value)) return '-';
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(0)}`;
}

function fmtMoneyFine(value) {
  if (value == null || Number.isNaN(value)) return '-';
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function fmtPrice(value) {
  if (value == null || Number.isNaN(value)) return '-';
  const abs = Math.abs(value);
  if (abs >= 100) return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (abs >= 1) return trimFixed(value, 4);
  return trimFixed(value, 6);
}

function fmtPct(value) {
  if (value == null || Number.isNaN(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function fmtNum(value, digits = 2) {
  if (value == null || Number.isNaN(value) || value === Infinity) return value === Infinity ? 'Inf' : '-';
  return value.toFixed(digits);
}

function fmtAge(hours) {
  if (hours == null || Number.isNaN(hours)) return '-';
  if (hours < 24) return `${fmtNum(hours, hours % 1 ? 1 : 0)}h`;
  return `${fmtNum(hours / 24, hours % 24 ? 1 : 0)}d`;
}

function trimFixed(value, digits) {
  return value.toFixed(digits).replace(/\.?0+$/, '');
}

function statusClass(status) {
  return {
    'At Risk': 'trade-pill-risk',
    Watch: 'trade-pill-watch',
    Clean: 'trade-pill-clean',
  }[status] || 'trade-pill-muted';
}

function scoreClass(score) {
  if (score >= 80) return 'trade-pill-clean';
  if (score >= 65) return 'trade-pill-good';
  if (score >= 45) return 'trade-pill-watch';
  return 'trade-pill-risk';
}

function shortTime(value) {
  return String(value || '').replace('T', ' ').replace(/:00Z$/, 'Z') || '-';
}

function shortName(value) {
  return String(value)
    .replace(/^CODEX\s+/, '')
    .replace(/^Basket Breakout\s+/, 'Basket ')
    .replace(/^Stocks\s+/, '')
    .replace(/\s+v\d+$/, '');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}
