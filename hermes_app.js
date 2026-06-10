import { fetchLocalText } from './lib/fetch.js';
import { parseHermesQueueText } from './lib/hermes.js';
import { buildHermesMonitorModel, renderHermesMonitorHtml } from './lib/hermes_monitor.js';

const REFRESH_MS = 5 * 60 * 1000;

const PATHS = {
  codexQueue: 'data/codex/hermes_experiment_queue.json',
  claudeQueue: 'data/claude/hermes_experiment_queue.json',
  routineStatus: 'data/codex/routine_status.md',
  automationHealth: 'data/codex/automation_health.md',
  supervisorReport: 'data/codex/hermes_supervisor_report.md',
  mode: 'data/codex/hermes_mode.json',
  contract: 'data/codex/hermes_contract.md',
  review: 'data/codex/hermes_review.md',
  ledger: 'data/codex/hypothesis_ledger.md',
  staleTradeSentinel: 'data/codex/hermes_stale_trade_sentinel.json',
  staleTradeSentinelMarkdown: 'data/codex/hermes_stale_trade_sentinel.md',
  missedTradeAuditor: 'data/codex/hermes_missed_trade_auditor.json',
};

async function loadMonitor() {
  const target = document.getElementById('hermes-monitor');
  const updated = document.getElementById('updated');
  if (!target) return;

  const [
    codexQueueResp,
    claudeQueueResp,
    routineResp,
    automationResp,
    supervisorResp,
    modeResp,
    contractResp,
    reviewResp,
    ledgerResp,
    staleTradeSentinelResp,
    staleTradeSentinelMarkdownResp,
    missedTradeAuditorResp,
  ] = await Promise.all([
    fetchLocalText(PATHS.codexQueue),
    fetchLocalText(PATHS.claudeQueue),
    fetchLocalText(PATHS.routineStatus),
    fetchLocalText(PATHS.automationHealth),
    fetchLocalText(PATHS.supervisorReport),
    fetchLocalText(PATHS.mode),
    fetchLocalText(PATHS.contract),
    fetchLocalText(PATHS.review),
    fetchLocalText(PATHS.ledger),
    fetchLocalText(PATHS.staleTradeSentinel),
    fetchLocalText(PATHS.staleTradeSentinelMarkdown),
    fetchLocalText(PATHS.missedTradeAuditor),
  ]);

  const model = buildHermesMonitorModel({
    codexQueue: parseHermesQueueText(
      codexQueueResp.ok ? codexQueueResp.text : '',
      { error: codexQueueResp.error || 'CODEX queue unavailable' }
    ),
    claudeQueue: parseHermesQueueText(
      claudeQueueResp.ok ? claudeQueueResp.text : '',
      { error: claudeQueueResp.error || 'Claude queue unavailable' }
    ),
    routineStatusText: routineResp.ok ? routineResp.text : '',
    automationHealthText: automationResp.ok ? automationResp.text : '',
    supervisorReportText: supervisorResp.ok ? supervisorResp.text : '',
    modeText: modeResp.ok ? modeResp.text : '',
    contractText: contractResp.ok ? contractResp.text : '',
    reviewText: reviewResp.ok ? reviewResp.text : '',
    ledgerText: ledgerResp.ok ? ledgerResp.text : '',
    staleTradeSentinelText: staleTradeSentinelResp.ok ? staleTradeSentinelResp.text : '',
    staleTradeSentinelMarkdownText: staleTradeSentinelMarkdownResp.ok ? staleTradeSentinelMarkdownResp.text : '',
    missedTradeAuditorText: missedTradeAuditorResp.ok ? missedTradeAuditorResp.text : '',
    lastUpdatedAt: new Date().toISOString(),
  });

  target.innerHTML = renderHermesMonitorHtml(model);
  if (updated) {
    updated.textContent = `updated ${new Date().toLocaleTimeString()}`;
  }
}

function init() {
  const refresh = document.getElementById('refresh-btn');
  if (refresh) {
    refresh.addEventListener('click', () => {
      loadMonitor().catch(error => renderError(error));
    });
  }
  loadMonitor().catch(error => renderError(error));
  setInterval(() => {
    loadMonitor().catch(error => renderError(error));
  }, REFRESH_MS);
}

function renderError(error) {
  const target = document.getElementById('hermes-monitor');
  if (!target) return;
  target.innerHTML = `
    <section class="monitor-panel full-width">
      <h2>Hermes Monitor</h2>
      <p class="warn-text">Could not load monitor data: ${escapeHtml(error?.message || error)}</p>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

init();
