import { STRATEGIES, effectiveCutoff } from './registry.js';
import { fetchSheetTab, fetchBullFile, fetchLocalText } from './lib/fetch.js';
import { parseTradeForensicsText, renderTradeForensicsHtml } from './lib/forensics.js';
import { parseHermesQueueText, renderHermesCockpitHtml, mergeHermesQueues } from './lib/hermes.js';
import {
  buildCommandCenterModel,
  parseGoalStatusText,
  parseShadowReportText,
  renderCommandCenterHtml,
  renderStrategyDrawerHtml,
} from './lib/command_center.js';
import { renderProvenanceLedgerHtml } from './lib/provenance.js';
import { buildContestScoreboard, renderContestScoreboardHtml } from './lib/contest.js';
import { renderRows, renderHealth, renderUpdatedAt, setupSortHandlers } from './lib/render.js';
import { makeErrorRow } from './lib/strategy_row.js';
import { healthBucketForSource, healthSeverityForRow, mergeHealth } from './lib/source_health.js';

const REFRESH_MS = 5 * 60 * 1000;
const CACHE_KEY = 'leaderboard-cache-v12';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HERMES_QUEUES = [
  { path: 'data/codex/hermes_experiment_queue.json', owner: 'codex' },
  { path: 'data/claude/hermes_experiment_queue.json', owner: 'claude' },
];
const TRADE_FORENSICS_PATH = 'data/codex/trade_forensics.md';
const GOAL_STATUS_PATH = 'data/codex/goal_status.md';
const SHADOW_REPORT_PATH = 'data/codex/regime_session_shadow_report.md';

const currentSort = { key: 'r90', asc: false };
let rowsState = [];
let snapshotsState = [];
let lastUpdatedAt = null;
let forensicsState = parseTradeForensicsText('');
let hermesState = null;
let goalState = parseGoalStatusText('');
let shadowState = parseShadowReportText('');
let selectedStrategyName = '';
let selectedEnsembleNames = new Set();

const getRows = () => rowsState;

async function fetchOne(strategy) {
  if (strategy.source.type === 'sheets') {
    const resp = await fetchSheetTab(strategy.source.tab);
    return {
      strategy,
      sheet: resp,
      row: strategy.adapter(resp, { startingCapital: strategy.starting_capital }),
    };
  }
  if (strategy.source.type === 'bull-github') {
    const [portfolio, tradeLog] = await Promise.all([
      fetchBullFile(strategy.source.portfolio_path),
      fetchBullFile(strategy.source.trade_log_path),
    ]);
    const row = strategy.adapter(
      { portfolio, tradeLog },
      {
        startingCapital: strategy.starting_capital,
        name: strategy.name,
        liveStartIso: effectiveCutoff(strategy.live_start_iso),
      }
    );
    return { strategy, portfolio, tradeLog, row };
  }
  if (strategy.source.type === 'codex-local') {
    const [portfolio, tradeLog, status] = await Promise.all([
      fetchLocalText(strategy.source.portfolio_path),
      fetchLocalText(strategy.source.trade_log_path),
      fetchLocalText(strategy.source.status_path || 'data/codex/routine_status.md'),
    ]);
    const row = strategy.adapter(
      { portfolio, tradeLog, status },
      {
        startingCapital: strategy.starting_capital,
        name: strategy.name,
        liveStartIso: effectiveCutoff(strategy.live_start_iso),
      }
    );
    return { strategy, portfolio, tradeLog, status, row };
  }
  throw new Error('Unknown source type: ' + strategy.source.type);
}

async function fetchAll() {
  const results = await Promise.allSettled(STRATEGIES.map(fetchOne));
  const rows = [];
  snapshotsState = [];
  let sheetsHealth = 'ok';
  let filesHealth = 'ok';

  const applyHealth = (strategy, severity) => {
    if (healthBucketForSource(strategy.source.type) === 'sheets') {
      sheetsHealth = mergeHealth(sheetsHealth, severity);
    } else {
      filesHealth = mergeHealth(filesHealth, severity);
    }
  };

  results.forEach((res, i) => {
    const strategy = STRATEGIES[i];
    let row;
    if (res.status === 'fulfilled') {
      row = res.value.row;
      snapshotsState.push(res.value);
      applyHealth(strategy, healthSeverityForRow(row, strategy.source.type));
    } else {
      // Whole adapter threw — synthesize an error row so the table still has all entries.
      row = makeErrorRow(strategy.name, String(res.reason));
      snapshotsState.push({ strategy, row });
      applyHealth(strategy, 'error');
    }
    rows.push(row);
  });

  rowsState = rows;
  lastUpdatedAt = Date.now();
  saveCache(rows, lastUpdatedAt);

  renderRows(rowsState, STRATEGIES, currentSort.key, currentSort.asc, {
    selectedName: selectedStrategyName,
  });
  renderContestScoreboard();
  renderProvenanceLedger();
  renderCommandCenter();
  renderDrawer();
  renderHealth('health-sheets', sheetsHealth,
    sheetsHealth !== 'ok' ? 'one or more Sheet tabs failed' : null);
  renderHealth('health-bull', filesHealth,
    filesHealth !== 'ok' ? 'BULL GitHub or CODEX local file fetch issue' : null);
  renderUpdatedAt(lastUpdatedAt);
}

async function fetchHermes() {
  const target = document.getElementById('hermes-cockpit');
  if (!target) return;
  // Fetch both codex and claude supervisor queues in parallel; tolerate either missing.
  const results = await Promise.allSettled(
    HERMES_QUEUES.map(({ path }) => fetchLocalText(path))
  );
  const inputs = results.map((res, i) => {
    const { owner } = HERMES_QUEUES[i];
    const resp = res.status === 'fulfilled'
      ? res.value
      : { ok: false, error: String(res.reason || 'fetch failed') };
    const queue = parseHermesQueueText(
      resp.ok ? resp.text : '',
      { error: resp.error || `${owner} queue unavailable` }
    );
    return { queue, owner };
  });
  const merged = mergeHermesQueues(inputs);
  hermesState = merged;
  target.innerHTML = renderHermesCockpitHtml(merged);
  renderCommandCenter();
  renderDrawer();
}

async function fetchForensics() {
  const target = document.getElementById('data-quality-panel');
  if (!target) return;
  const forensicResp = await fetchLocalText(TRADE_FORENSICS_PATH);
  const report = parseTradeForensicsText(
    forensicResp.ok ? forensicResp.text : '',
    { error: forensicResp.error || 'Trade forensics ledger is unavailable' }
  );
  forensicsState = report;
  target.innerHTML = renderTradeForensicsHtml(report);
  renderCommandCenter();
  renderDrawer();
}

async function fetchCommandContext() {
  const [goalResp, shadowResp] = await Promise.all([
    fetchLocalText(GOAL_STATUS_PATH),
    fetchLocalText(SHADOW_REPORT_PATH),
  ]);
  goalState = parseGoalStatusText(
    goalResp.ok ? goalResp.text : '',
    { error: goalResp.error || 'Goal status is unavailable' }
  );
  shadowState = parseShadowReportText(
    shadowResp.ok ? shadowResp.text : '',
    { error: shadowResp.error || 'Regime shadow report is unavailable' }
  );
  renderCommandCenter();
  renderDrawer();
}

function buildCurrentCommandModel() {
  return buildCommandCenterModel({
    rows: rowsState,
    registry: STRATEGIES,
    snapshots: snapshotsState,
    forensicsReport: forensicsState,
    hermesQueue: hermesState,
    goalReport: goalState,
    shadowReport: shadowState,
    selectedNames: [...selectedEnsembleNames],
  });
}

function renderCommandCenter() {
  const target = document.getElementById('command-center');
  if (!target) return;
  const model = buildCurrentCommandModel();
  target.innerHTML = renderCommandCenterHtml(model);
}

function renderDrawer() {
  const target = document.getElementById('strategy-drawer');
  if (!target) return;
  const model = buildCurrentCommandModel();
  target.innerHTML = renderStrategyDrawerHtml(model, selectedStrategyName);
}

function renderContestScoreboard() {
  const target = document.getElementById('contest-scoreboard');
  if (!target) return;
  target.innerHTML = renderContestScoreboardHtml(buildContestScoreboard(snapshotsState));
}

function renderProvenanceLedger() {
  const target = document.getElementById('provenance-ledger');
  if (!target) return;
  target.innerHTML = renderProvenanceLedgerHtml(snapshotsState);
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
    renderRows(rowsState, STRATEGIES, currentSort.key, currentSort.asc, {
      selectedName: selectedStrategyName,
    });
    renderCommandCenter();
    renderDrawer();
    renderUpdatedAt(lastUpdatedAt);
  }

  // Wire sort handlers (use getter so they always see latest data)
  setupSortHandlers(getRows, STRATEGIES, currentSort);

  document.getElementById('rows').addEventListener('click', event => {
    const row = event.target.closest('tr[data-strategy]');
    if (!row) return;
    selectedStrategyName = row.dataset.strategy || '';
    currentSort.selectedName = selectedStrategyName;
    renderRows(rowsState, STRATEGIES, currentSort.key, currentSort.asc, {
      selectedName: selectedStrategyName,
    });
    renderDrawer();
  });

  document.getElementById('command-center').addEventListener('change', event => {
    const input = event.target.closest('input[data-ensemble-strategy]');
    if (!input) return;
    const model = buildCurrentCommandModel();
    if (selectedEnsembleNames.size === 0) {
      selectedEnsembleNames = new Set(model.ensemble.selectedNames);
    }
    if (input.checked) {
      selectedEnsembleNames.add(input.dataset.ensembleStrategy);
    } else {
      selectedEnsembleNames.delete(input.dataset.ensembleStrategy);
    }
    renderCommandCenter();
  });

  document.getElementById('strategy-drawer').addEventListener('click', event => {
    if (!event.target.closest('[data-drawer-close]')) return;
    selectedStrategyName = '';
    currentSort.selectedName = '';
    renderRows(rowsState, STRATEGIES, currentSort.key, currentSort.asc, {
      selectedName: selectedStrategyName,
    });
    renderDrawer();
  });

  // Manual refresh button
  document.getElementById('refresh-btn').addEventListener('click', () => {
    fetchAll().catch(e => console.error('manual refresh failed:', e));
    fetchHermes().catch(e => console.error('manual Hermes refresh failed:', e));
    fetchForensics().catch(e => console.error('manual forensics refresh failed:', e));
    fetchCommandContext().catch(e => console.error('manual command context refresh failed:', e));
  });

  // First live fetch
  fetchAll().catch(e => console.error('initial fetch failed:', e));
  fetchHermes().catch(e => console.error('initial Hermes fetch failed:', e));
  fetchForensics().catch(e => console.error('initial forensics fetch failed:', e));
  fetchCommandContext().catch(e => console.error('initial command context fetch failed:', e));

  // Periodic refresh
  setInterval(() => {
    fetchAll().catch(e => console.error('scheduled fetch failed:', e));
    fetchHermes().catch(e => console.error('scheduled Hermes fetch failed:', e));
    fetchForensics().catch(e => console.error('scheduled forensics fetch failed:', e));
    fetchCommandContext().catch(e => console.error('scheduled command context fetch failed:', e));
  }, REFRESH_MS);

  // Updated-timer tick (every 10s)
  setInterval(tickUpdatedTimer, 10000);
}

init();
