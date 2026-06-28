import { fetchLocalText } from './lib/fetch.js';
import { readJsonlText } from './lib/sentinel/jsonl.js';
import { renderSentinelHtml } from './lib/sentinel/render.js';

const PATHS = {
  config: 'data/sentinel/config.json',
  allocation: 'data/sentinel/allocation.json',
  promotion: 'data/sentinel/promotion_status.json',
  riskState: 'data/sentinel/risk_state.json',
  reconciliation: 'data/sentinel/reconciliation_report.json',
  tickets: 'data/sentinel/trade_tickets.jsonl',
  ledger: 'data/sentinel/execution_ledger.jsonl',
  status: 'data/sentinel/sentinel_status.md',
};

const FALLBACKS = {
  config: {
    mode: 'paper',
    paper_auto_submit_enabled: false,
    live_trading_enabled: false,
  },
  allocation: { strategies: [] },
  promotion: { strategies: [] },
  riskState: { frozen: false },
  reconciliation: { status: 'not_run', differences: [] },
  tickets: [],
  ledger: [],
  statusText: '',
};

async function loadSentinel() {
  const root = document.getElementById('sentinel-root');
  const updated = document.getElementById('updated');
  const refresh = document.getElementById('refresh-btn');
  if (!root) return;

  if (refresh) refresh.disabled = true;
  try {
    const loadErrors = [];
    const [
      config,
      allocation,
      promotion,
      riskState,
      reconciliation,
      tickets,
      ledger,
      statusText,
    ] = await Promise.all([
      loadJson(PATHS.config, FALLBACKS.config, loadErrors),
      loadJson(PATHS.allocation, FALLBACKS.allocation, loadErrors),
      loadJson(PATHS.promotion, FALLBACKS.promotion, loadErrors),
      loadJson(PATHS.riskState, FALLBACKS.riskState, loadErrors),
      loadJson(PATHS.reconciliation, FALLBACKS.reconciliation, loadErrors),
      loadJsonl(PATHS.tickets, FALLBACKS.tickets, loadErrors),
      loadJsonl(PATHS.ledger, FALLBACKS.ledger, loadErrors),
      loadText(PATHS.status, FALLBACKS.statusText, loadErrors),
    ]);

    root.innerHTML = renderSentinelHtml({
      statusText,
      config,
      allocation,
      promotion,
      riskState,
      reconciliation,
      tickets,
      ledger,
      loadErrors,
    });

    if (updated) {
      updated.textContent = `updated ${new Date().toLocaleTimeString()}`;
    }
  } finally {
    if (refresh) refresh.disabled = false;
  }
}

async function loadText(path, fallback, loadErrors) {
  const response = await fetchLocalText(path);
  if (!response.ok) {
    loadErrors.push({ path, message: response.error || 'unavailable' });
    return fallback;
  }
  return response.text;
}

async function loadJson(path, fallback, loadErrors) {
  const text = await loadText(path, '', loadErrors);
  if (!text.trim()) {
    return cloneFallback(fallback);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    loadErrors.push({ path, message: error?.message || 'invalid JSON' });
    return cloneFallback(fallback);
  }
}

async function loadJsonl(path, fallback, loadErrors) {
  const text = await loadText(path, '', loadErrors);
  if (!text.trim()) {
    return cloneFallback(fallback);
  }

  try {
    return readJsonlText(text);
  } catch (error) {
    loadErrors.push({ path, message: error?.message || 'invalid JSONL' });
    return cloneFallback(fallback);
  }
}

function cloneFallback(value) {
  return JSON.parse(JSON.stringify(value));
}

function renderError(error) {
  const root = document.getElementById('sentinel-root');
  if (!root) return;

  const section = document.createElement('section');
  section.className = 'sentinel-panel sentinel-load-errors';

  const heading = document.createElement('h2');
  heading.textContent = 'Trade Sentinel';

  const message = document.createElement('p');
  message.className = 'warn-text';
  message.textContent = `Could not load Sentinel data: ${error?.message || error}`;

  section.append(heading, message);
  root.replaceChildren(section);
}

function init() {
  const refresh = document.getElementById('refresh-btn');
  if (refresh) {
    refresh.addEventListener('click', () => {
      loadSentinel().catch(renderError);
    });
  }

  loadSentinel().catch(renderError);
}

init();
