import { STRATEGIES } from './registry.js';
import { fetchSheetTab, fetchBullFile } from './lib/fetch.js';
import { renderRows, renderHealth, renderUpdatedAt, setupSortHandlers } from './lib/render.js';
import { makeErrorRow } from './lib/strategy_row.js';

const REFRESH_MS = 5 * 60 * 1000;
const CACHE_KEY = 'leaderboard-cache-v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const currentSort = { key: 'r90', asc: false };
let rowsState = [];
let lastUpdatedAt = null;

const getRows = () => rowsState;

async function fetchOne(strategy) {
  if (strategy.source.type === 'sheets') {
    const resp = await fetchSheetTab(strategy.source.tab);
    return strategy.adapter(resp, { startingCapital: strategy.starting_capital });
  }
  if (strategy.source.type === 'bull-github') {
    const [portfolio, tradeLog] = await Promise.all([
      fetchBullFile(strategy.source.portfolio_path),
      fetchBullFile(strategy.source.trade_log_path),
    ]);
    return strategy.adapter(
      { portfolio, tradeLog },
      { startingCapital: strategy.starting_capital }
    );
  }
  throw new Error('Unknown source type: ' + strategy.source.type);
}

async function fetchAll() {
  const results = await Promise.allSettled(STRATEGIES.map(fetchOne));
  const rows = [];
  let sheetsHealth = 'ok';
  let bullHealth = 'ok';

  results.forEach((res, i) => {
    const strategy = STRATEGIES[i];
    let row;
    if (res.status === 'fulfilled') {
      row = res.value;
      // Adapter-level error → degrade source health (but research status is OK)
      if (row.status === 'error') {
        if (strategy.source.type === 'bull-github') bullHealth = 'error';
        else sheetsHealth = sheetsHealth === 'ok' ? 'warn' : sheetsHealth;
      }
    } else {
      // Whole adapter threw — synthesize an error row so the table still has 6 entries
      row = makeErrorRow(strategy.name, String(res.reason));
      if (strategy.source.type === 'bull-github') bullHealth = 'error';
      else sheetsHealth = 'error';
    }
    rows.push(row);
  });

  rowsState = rows;
  lastUpdatedAt = Date.now();
  saveCache(rows, lastUpdatedAt);

  renderRows(rowsState, STRATEGIES, currentSort.key, currentSort.asc);
  renderHealth('health-sheets', sheetsHealth,
    sheetsHealth !== 'ok' ? 'one or more Sheet tabs failed' : null);
  renderHealth('health-bull', bullHealth,
    bullHealth !== 'ok' ? 'BULL repo fetch failed' : null);
  renderUpdatedAt(lastUpdatedAt);
}

function saveCache(rows, ts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rows, ts }));
  } catch { /* quota or private mode — non-fatal */ }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { rows, ts } = JSON.parse(raw);
    if (!ts || Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return { rows, ts };
  } catch {
    return null;
  }
}

function tickUpdatedTimer() {
  if (lastUpdatedAt) renderUpdatedAt(lastUpdatedAt);
}

function init() {
  // Hydrate from cache for instant feel
  const cached = loadCache();
  if (cached) {
    rowsState = cached.rows;
    lastUpdatedAt = cached.ts;
    renderRows(rowsState, STRATEGIES, currentSort.key, currentSort.asc);
    renderUpdatedAt(lastUpdatedAt);
  }

  // Wire sort handlers (use getter so they always see latest data)
  setupSortHandlers(getRows, STRATEGIES, currentSort);

  // Manual refresh button
  document.getElementById('refresh-btn').addEventListener('click', () => {
    fetchAll().catch(e => console.error('manual refresh failed:', e));
  });

  // First live fetch
  fetchAll().catch(e => console.error('initial fetch failed:', e));

  // Periodic refresh
  setInterval(() => {
    fetchAll().catch(e => console.error('scheduled fetch failed:', e));
  }, REFRESH_MS);

  // Updated-timer tick (every 10s)
  setInterval(tickUpdatedTimer, 10000);
}

init();
