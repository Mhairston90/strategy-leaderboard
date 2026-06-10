const QUEUE_TYPES = {
  repair: 'Repairs',
  experiment: 'Experiments',
  sample_collection: 'Samples',
};

export function parseRoutineStatusText(text) {
  return parseMarkdownTable(text)
    .map(row => ({
      routine: row.routine || '',
      strategy: row.strategy || '',
      timestamp: row['timestamp utc'] || row.timestamp || '',
      status: row.status || '',
      dataSource: row['data source'] || '',
      message: row.message || '',
    }))
    .filter(row => row.routine);
}

/**
 * Cache Health (data/health/cache_health.md, FABLE contribution) — the
 * data-integrity sentinel on the shared OHLC caches. The file is in
 * routine-status table format; the summary rows are the two CACHE lines.
 * Returns a run-row-shaped object for the Run Health panel, or null if the
 * sentinel has not exported yet (runHtml renders a 'no run' state for null).
 */
export function buildCacheHealth(text) {
  const rows = parseRoutineStatusText(text || '').filter(r => r.routine === 'cache-health');
  if (!rows.length) return null;
  const caches = rows.filter(r => r.strategy.includes('CACHE'));
  const pick = caches.length ? caches : rows;
  const sev = { ok: 0, warn: 1, error: 2 };
  const worst = pick.reduce((a, r) => (sev[r.status] || 0) > (sev[a.status] || 0) ? r : a, pick[0]);
  const problems = pick.filter(r => r.status !== 'ok');
  return {
    routine: 'cache-health',
    strategy: 'shared OHLC caches',
    timestamp: worst.timestamp,
    status: worst.status || 'ok',
    dataSource: 'local',
    message: problems.length
      ? problems.map(r => `${r.strategy}: ${r.message}`).join(' | ')
      : `all caches fresh (${pick.length} checked)`,
  };
}

export function parseHypothesisLedgerText(text) {
  return parseMarkdownTable(text)
    .map(row => ({
      generatedAt: row.generated_at || '',
      source: row.source || '',
      family: row.family || '',
      variable: row.variable || '',
      currentSignal: row.current_signal || '',
      proposedChange: row.proposed_change || '',
      expectedEffect: row.expected_effect || '',
      status: row.status || '',
      key: row.key || '',
    }))
    .filter(row => row.key || row.family || row.proposedChange);
}

export function parseStaleTradeSentinelText(text) {
  if (!text || !text.trim()) {
    return {
      exported: false,
      generatedAt: '',
      status: 'pending',
      scanned: 0,
      errors: 0,
      warnings: 0,
      findings: [],
      summary: 'stale trade sentinel not exported',
    };
  }

  try {
    const data = JSON.parse(text);
    const findings = Array.isArray(data.findings)
      ? data.findings.map(finding => ({
          severity: String(finding?.severity || 'warn'),
          strategy: String(finding?.strategy || 'Unknown strategy'),
          action: String(finding?.action || '-'),
          pair: String(finding?.pair || '-'),
          sleeve: String(finding?.sleeve || '-'),
          reason: String(finding?.reason || '-'),
          cycleTime: String(finding?.cycle_time || finding?.cycleTime || '-'),
          message: String(finding?.message || ''),
        }))
      : [];
    const status = String(data.status || (findings.length ? 'warn' : 'ok'));
    const errors = Number(data.errors || findings.filter(finding => finding.severity === 'error').length);
    const warnings = Number(data.warnings || findings.filter(finding => finding.severity === 'warn').length);
    return {
      exported: true,
      generatedAt: String(data.generated_at || data.generatedAt || ''),
      status,
      scanned: Number(data.scanned || 0),
      errors,
      warnings,
      findings,
      summary: `${status} errors=${errors} warnings=${warnings}`,
    };
  } catch {
    return {
      exported: true,
      generatedAt: '',
      status: 'warn',
      scanned: 0,
      errors: 0,
      warnings: 1,
      findings: [
        {
          severity: 'warn',
          strategy: 'Hermes Stale Trade Sentinel',
          action: 'PARSE',
          pair: '-',
          sleeve: '-',
          reason: 'unreadable-json',
          cycleTime: '-',
          message: 'sentinel artifact could not be parsed',
        },
      ],
      summary: 'sentinel artifact could not be parsed',
    };
  }
}

export function parseMissedTradeAuditorText(text) {
  if (!text || !text.trim()) {
    return {
      exported: false,
      generatedAt: '',
      status: 'pending',
      scanned: 0,
      errors: 0,
      warnings: 0,
      audits: [],
      findings: [],
      summary: 'missed trade auditor not exported',
    };
  }

  try {
    const data = JSON.parse(text);
    const audits = Array.isArray(data.audits)
      ? data.audits.map(audit => ({
          strategy: String(audit?.strategy || ''),
          strategyName: String(audit?.strategy_name || audit?.strategyName || audit?.strategy || 'Unknown strategy'),
          cycleTime: String(audit?.cycle_time || audit?.cycleTime || '-'),
          replayStatus: String(audit?.replay_status || audit?.replayStatus || '-'),
          expectedOpens: Number(audit?.expected_opens || audit?.expectedOpens || 0),
          expectedCloses: Number(audit?.expected_closes || audit?.expectedCloses || 0),
          matchedOpens: Number(audit?.matched_opens || audit?.matchedOpens || 0),
          matchedCloses: Number(audit?.matched_closes || audit?.matchedCloses || 0),
          routineStatus: String(audit?.routine_status || audit?.routineStatus || '-'),
          routineMessage: String(audit?.routine_message || audit?.routineMessage || ''),
          forensicsQuality: String(audit?.forensics_quality || audit?.forensicsQuality || '-'),
          forensicsMessage: String(audit?.forensics_message || audit?.forensicsMessage || ''),
        }))
      : [];
    const findings = Array.isArray(data.findings)
      ? data.findings.map(finding => ({
          severity: String(finding?.severity || 'warn'),
          strategy: String(finding?.strategy || ''),
          strategyName: String(finding?.strategy_name || finding?.strategyName || finding?.strategy || 'Unknown strategy'),
          action: String(finding?.action || '-'),
          pair: String(finding?.pair || '-'),
          sleeve: String(finding?.sleeve || '-'),
          reason: String(finding?.reason || '-'),
          cycleTime: String(finding?.cycle_time || finding?.cycleTime || '-'),
          evidence: String(finding?.evidence || ''),
          message: String(finding?.message || ''),
        }))
      : [];
    const status = String(data.status || (findings.length ? 'warn' : 'ok'));
    const errors = Number(data.errors || findings.filter(finding => finding.severity === 'error').length);
    const warnings = Number(data.warnings || findings.filter(finding => finding.severity === 'warn').length);
    return {
      exported: true,
      generatedAt: String(data.generated_at || data.generatedAt || ''),
      status,
      scanned: Number(data.scanned || audits.length || 0),
      errors,
      warnings,
      audits,
      findings,
      summary: `${status} errors=${errors} warnings=${warnings}`,
    };
  } catch {
    return {
      exported: true,
      generatedAt: '',
      status: 'warn',
      scanned: 0,
      errors: 0,
      warnings: 1,
      audits: [],
      findings: [
        {
          severity: 'warn',
          strategy: 'Hermes Missed Trade Auditor',
          strategyName: 'Hermes Missed Trade Auditor',
          action: 'PARSE',
          pair: '-',
          sleeve: '-',
          reason: 'unreadable-json',
          cycleTime: '-',
          evidence: 'artifact parse failed',
          message: 'auditor artifact could not be parsed',
        },
      ],
      summary: 'auditor artifact could not be parsed',
    };
  }
}

export function buildHermesMonitorModel(input = {}) {
  const codexQueue = normalizeQueue(input.codexQueue, 'codex');
  const claudeQueue = normalizeQueue(input.claudeQueue, 'claude');
  const fableQueue = normalizeQueue(input.fableQueue, 'fable');
  const queueItems = [...codexQueue.items, ...claudeQueue.items, ...fableQueue.items];
  const routineRows = parseRoutineStatusText(input.routineStatusText || '');
  const hypotheses = parseHypothesisLedgerText(input.ledgerText || '');
  const staleTradeSentinel = parseStaleTradeSentinelText(input.staleTradeSentinelText || '');
  const missedTradeAuditor = parseMissedTradeAuditorText(input.missedTradeAuditorText || '');
  const mode = parseMode(input.modeText);
  const latestSupervisor = findRoutine(routineRows, 'hermes-supervisor');
  const cacheHealth = buildCacheHealth(input.cacheHealthText || '');
  const reviewCycle = findRoutine(routineRows, 'hermes_review_cycle');
  const reviewAvailable = Boolean((input.reviewText || '').trim());
  const ledgerAvailable = Boolean((input.ledgerText || '').trim());
  const contractAvailable = Boolean((input.contractText || '').trim());
  const reviewSaysSafe = /No strategy state was changed/i.test(input.reviewText || '');
  const automationHealth = summarizeAutomationHealth(input.automationHealthText || '');

  const safety = buildSafety({
    mode,
    reviewAvailable,
    reviewSaysSafe,
    contractAvailable,
  });

  const readiness = buildReadiness({
    latestSupervisor,
    reviewCycle,
    reviewAvailable,
    ledgerAvailable,
    automationHealth,
  });

  return {
    generatedAt: latestNonEmpty([
      input.lastUpdatedAt,
      codexQueue.generatedAt,
      claudeQueue.generatedAt,
      fableQueue.generatedAt,
      latestSupervisor?.timestamp,
      reviewCycle?.timestamp,
    ]),
    mode,
    safety,
    readiness,
    queue: {
      total: queueItems.length,
      repairs: countQueueType(queueItems, 'repair'),
      experiments: countQueueType(queueItems, 'experiment'),
      samples: countQueueType(queueItems, 'sample_collection'),
      items: queueItems,
      sources: [
        queueSourceSummary(codexQueue),
        queueSourceSummary(claudeQueue),
        queueSourceSummary(fableQueue),
      ],
    },
    runs: {
      latestSupervisor,
      reviewCycle,
      automationHealth,
      cacheHealth,
    },
    hypotheses: {
      total: hypotheses.length,
      proposed: hypotheses.filter(row => row.status === 'proposed').length,
      latest: hypotheses.slice(-8).reverse(),
      exported: ledgerAvailable,
    },
    staleTradeSentinel,
    missedTradeAuditor,
    artifacts: {
      reviewAvailable,
      ledgerAvailable,
      contractAvailable,
      modeAvailable: Boolean((input.modeText || '').trim()),
    },
    raw: {
      reviewPreview: previewText(input.reviewText || ''),
      supervisorPreview: previewText(input.supervisorReportText || ''),
      automationPreview: previewText(input.automationHealthText || ''),
    },
  };
}

export function renderHermesMonitorHtml(model) {
  const readinessLabel = model.readiness.readyForRailway ? 'Ready for Railway shadow run' : 'Not ready';
  return `
    <section class="monitor-head">
      <div>
        <div class="section-kicker">Hermes</div>
        <h1>Hermes Monitor</h1>
      </div>
      <div class="monitor-meta">
        <span class="status-pill status-${escapeHtml(model.safety.level)}">${escapeHtml(model.safety.label)}</span>
        <span class="dim">${model.generatedAt ? escapeHtml(model.generatedAt) : 'No run yet'}</span>
      </div>
    </section>

    <section class="monitor-grid monitor-grid-top" aria-label="Hermes status summary">
      ${metricHtml('Mode', model.mode === 'not_exported' ? 'Not exported' : model.mode, model.mode === 'review_only' ? 'ok' : 'warn')}
      ${metricHtml('Queue', model.queue.total, model.queue.total ? 'warn' : 'ok')}
      ${metricHtml('Hypotheses', model.hypotheses.total, model.hypotheses.exported ? 'ok' : 'warn')}
      ${metricHtml('Railway', readinessLabel, model.readiness.readyForRailway ? 'ok' : 'pending')}
    </section>

    <section class="monitor-layout">
      <section class="monitor-panel safety-panel" aria-label="Safety">
        <div class="panel-head">
          <h2>Safety</h2>
          <span class="status-pill status-${escapeHtml(model.safety.level)}">${escapeHtml(model.safety.level)}</span>
        </div>
        <p>${escapeHtml(model.safety.message)}</p>
        <div class="check-list">
          ${model.safety.checks.map(checkHtml).join('')}
        </div>
      </section>

      <section class="monitor-panel" aria-label="Run health">
        <div class="panel-head">
          <h2>Run Health</h2>
          <span class="dim">${escapeHtml(model.runs.automationHealth.summary)}</span>
        </div>
        <div class="run-list">
          ${runHtml('Hermes supervisor', model.runs.latestSupervisor)}
          ${runHtml('Review cycle', model.runs.reviewCycle)}
          ${runHtml('Cache health (OHLC)', model.runs.cacheHealth)}
        </div>
      </section>

      <section class="monitor-panel" aria-label="Queue">
        <div class="panel-head">
          <h2>Queue</h2>
          <span class="dim">${escapeHtml(model.queue.total)} items</span>
        </div>
        <div class="queue-breakdown">
          ${smallStatHtml('Repairs', model.queue.repairs)}
          ${smallStatHtml('Experiments', model.queue.experiments)}
          ${smallStatHtml('Samples', model.queue.samples)}
        </div>
        <div class="queue-source-list">
          ${model.queue.sources.map(sourceHtml).join('')}
        </div>
      </section>

      <section class="monitor-panel" aria-label="Railway Readiness">
        <div class="panel-head">
          <h2>Railway Readiness</h2>
          <span class="status-pill status-${model.readiness.readyForRailway ? 'ok' : 'pending'}">${escapeHtml(readinessLabel)}</span>
        </div>
        <div class="check-list">
          ${model.readiness.gates.map(checkHtml).join('')}
        </div>
      </section>
    </section>

    ${staleTradeSentinelHtml(model.staleTradeSentinel)}
    ${missedTradeAuditorHtml(model.missedTradeAuditor)}

    <section class="monitor-panel full-width" aria-label="Hypotheses">
      <div class="panel-head">
        <h2>Hypotheses</h2>
        <span class="dim">${model.hypotheses.exported ? `${model.hypotheses.proposed} proposed` : 'ledger not exported yet'}</span>
      </div>
      ${hypothesisListHtml(model.hypotheses.latest, model.hypotheses.exported)}
    </section>

    <section class="monitor-panel full-width" aria-label="Artifact previews">
      <div class="panel-head">
        <h2>Artifacts</h2>
        <span class="dim">read-only previews</span>
      </div>
      <div class="artifact-grid">
        ${artifactHtml('Hermes review', model.raw.reviewPreview, model.artifacts.reviewAvailable)}
        ${artifactHtml('Supervisor report', model.raw.supervisorPreview, Boolean(model.raw.supervisorPreview))}
        ${artifactHtml('Automation health', model.raw.automationPreview, Boolean(model.raw.automationPreview))}
      </div>
    </section>
  `;
}

function staleTradeSentinelHtml(sentinel) {
  const statusClass = sentinel.status === 'ok'
    ? 'ok'
    : sentinel.status === 'pending'
      ? 'pending'
      : 'warn';
  const detail = sentinel.exported
    ? `review-only replay - scanned ${sentinel.scanned} - errors ${sentinel.errors} - warnings ${sentinel.warnings}`
    : sentinel.summary;
  return `
    <section class="monitor-panel full-width" aria-label="Stale Trade Sentinel">
      <div class="panel-head">
        <h2>Stale Trade Sentinel</h2>
        <span class="status-pill status-${escapeHtml(statusClass)}">${escapeHtml(sentinel.status)}</span>
      </div>
      <p class="dim">${escapeHtml(detail)}${sentinel.generatedAt ? ` - ${escapeHtml(sentinel.generatedAt)}` : ''}</p>
      ${staleTradeFindingListHtml(sentinel)}
    </section>
  `;
}

function missedTradeAuditorHtml(auditor) {
  const statusClass = auditor.status === 'ok'
    ? 'ok'
    : auditor.status === 'pending'
      ? 'pending'
      : 'warn';
  const detail = auditor.exported
    ? `review-only evidence audit - scanned ${auditor.scanned} - errors ${auditor.errors} - warnings ${auditor.warnings}`
    : auditor.summary;
  return `
    <section class="monitor-panel full-width" aria-label="Missed Trade Auditor">
      <div class="panel-head">
        <h2>Missed Trade Auditor</h2>
        <span class="status-pill status-${escapeHtml(statusClass)}">${escapeHtml(auditor.status)}</span>
      </div>
      <p class="dim">${escapeHtml(detail)}${auditor.generatedAt ? ` - ${escapeHtml(auditor.generatedAt)}` : ''}</p>
      ${missedTradeFindingListHtml(auditor)}
    </section>
  `;
}

function missedTradeFindingListHtml(auditor) {
  if (!auditor.exported) {
    return '<div class="empty-monitor">Missed trade auditor has not been exported yet.</div>';
  }
  if (!auditor.findings.length) {
    return '<div class="empty-monitor">No missed trade findings in the latest review-only evidence audit.</div>';
  }
  return `
    <div class="hypothesis-list">
      ${auditor.findings.slice(0, 8).map(finding => {
        const detail = [finding.reason, finding.evidence, finding.message].filter(Boolean).join(' - ');
        return `
          <article class="hypothesis-row">
            <div>
              <strong>${escapeHtml(finding.strategyName || finding.strategy)}</strong>
              <span class="dim">${escapeHtml(finding.cycleTime)}</span>
            </div>
            <span class="status-pill status-${escapeHtml(finding.severity === 'error' ? 'warn' : finding.severity)}">${escapeHtml(finding.action)} ${escapeHtml(finding.pair)}</span>
            <p>${escapeHtml(detail || '-')}</p>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function staleTradeFindingListHtml(sentinel) {
  if (!sentinel.exported) {
    return '<div class="empty-monitor">Stale trade sentinel has not been exported yet.</div>';
  }
  if (!sentinel.findings.length) {
    return '<div class="empty-monitor">No stale trade findings in the latest review-only replay.</div>';
  }
  return `
    <div class="hypothesis-list">
      ${sentinel.findings.slice(0, 8).map(finding => `
        <article class="hypothesis-row">
          <div>
            <strong>${escapeHtml(finding.strategy)}</strong>
            <span class="dim">${escapeHtml(finding.cycleTime)}</span>
          </div>
          <span class="status-pill status-${escapeHtml(finding.severity === 'error' ? 'warn' : finding.severity)}">${escapeHtml(finding.action)} ${escapeHtml(finding.pair)}</span>
          <p>${escapeHtml(finding.reason)} - ${escapeHtml(finding.message)}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function parseMode(text) {
  if (!text || !text.trim()) return 'not_exported';
  try {
    const data = JSON.parse(text);
    return String(data.mode || 'unknown');
  } catch {
    return 'unreadable';
  }
}

function parseMarkdownTable(text) {
  const lines = String(text || '').split(/\r?\n/).filter(line => line.trim().startsWith('|'));
  let headers = null;
  const rows = [];
  for (const line of lines) {
    const cells = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(cell => cell.trim());
    if (!headers) {
      headers = cells.map(normalizeHeader);
      continue;
    }
    if (cells.every(cell => /^-+$/.test(cell.replace(/\s/g, '')))) continue;
    if (cells.length !== headers.length) continue;
    rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
  }
  return rows;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeQueue(queue, owner) {
  const items = Array.isArray(queue?.items)
    ? queue.items.map(item => ({
        type: QUEUE_TYPES[item?.type] ? item.type : 'experiment',
        priority: Number(item?.priority || 3),
        title: String(item?.title || 'Untitled'),
        owner,
      }))
    : [];
  return {
    owner,
    generatedAt: String(queue?.generated_at || ''),
    mode: String(queue?.mode || 'paper-only'),
    items,
    error: String(queue?.error || ''),
  };
}

function buildSafety({ mode, reviewAvailable, reviewSaysSafe, contractAvailable }) {
  const checks = [
    {
      label: 'Review mode',
      detail: mode === 'review_only' ? 'review_only' : mode === 'not_exported' ? 'mode file not exported yet' : mode,
      status: mode === 'review_only' ? 'ok' : mode === 'not_exported' ? 'pending' : 'warn',
    },
    {
      label: 'Review artifact',
      detail: reviewAvailable ? 'exported' : 'not exported yet',
      status: reviewAvailable ? 'ok' : 'pending',
    },
    {
      label: 'No state mutation claim',
      detail: reviewSaysSafe ? 'present in review' : 'waiting for review cycle export',
      status: reviewSaysSafe ? 'ok' : 'pending',
    },
    {
      label: 'Operating contract',
      detail: contractAvailable ? 'exported' : 'not exported yet',
      status: contractAvailable ? 'ok' : 'pending',
    },
  ];

  const hasWarn = checks.some(check => check.status === 'warn');
  const level = hasWarn ? 'warn' : mode === 'review_only' && reviewSaysSafe ? 'ok' : 'pending';
  return {
    level,
    label: level === 'ok' ? 'Paper-only safe' : level === 'warn' ? 'Needs review' : 'Partially wired',
    message: level === 'ok'
      ? 'Hermes is in review-only mode and the latest review states no strategy state changed.'
      : 'Keep Hermes in local review-only mode until the review artifacts are exported and stable.',
    checks,
  };
}

function buildReadiness({ latestSupervisor, reviewCycle, reviewAvailable, ledgerAvailable, automationHealth }) {
  const gates = [
    {
      label: 'Supervisor running',
      detail: latestSupervisor ? `${latestSupervisor.status} at ${latestSupervisor.timestamp}` : 'no routine row found',
      status: latestSupervisor?.status === 'ok' ? 'ok' : 'pending',
    },
    {
      label: 'Review cycle running',
      detail: reviewCycle ? `${reviewCycle.status} at ${reviewCycle.timestamp}` : 'not scheduled/exported yet',
      status: reviewCycle?.status === 'ok' ? 'ok' : 'pending',
    },
    {
      label: 'Review artifacts exported',
      detail: reviewAvailable && ledgerAvailable ? 'review and ledger available' : 'waiting for export support to land',
      status: reviewAvailable && ledgerAvailable ? 'ok' : 'pending',
    },
    {
      label: 'Local automation health',
      detail: automationHealth.summary,
      status: automationHealth.level,
    },
    {
      label: 'Railway state store',
      detail: 'choose GitHub, Railway Volume, DB, or object storage',
      status: 'pending',
    },
    {
      label: 'Railway alerting',
      detail: 'logs and metrics plan before cloud autonomy',
      status: 'pending',
    },
  ];
  return {
    readyForRailway: gates.every(gate => gate.status === 'ok'),
    gates,
  };
}

function summarizeAutomationHealth(text) {
  if (!text.trim()) {
    return { level: 'pending', summary: 'automation health not exported' };
  }
  if (/fail|error|missed|blocked/i.test(text)) {
    return { level: 'warn', summary: 'automation report has warnings' };
  }
  return { level: 'ok', summary: 'automation report available' };
}

function findRoutine(rows, routine) {
  return rows.find(row => row.routine === routine) || null;
}

function latestNonEmpty(values) {
  return values.filter(Boolean).sort().at(-1) || '';
}

function queueSourceSummary(queue) {
  return {
    owner: queue.owner,
    generatedAt: queue.generatedAt,
    count: queue.items.length,
    error: queue.error,
  };
}

function countQueueType(items, type) {
  return items.filter(item => item.type === type).length;
}

function previewText(text) {
  return String(text || '').trim().split(/\r?\n/).slice(0, 12).join('\n');
}

function metricHtml(label, value, level) {
  return `
    <div class="monitor-metric metric-${escapeHtml(level)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function smallStatHtml(label, value) {
  return `
    <div class="small-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function checkHtml(check) {
  return `
    <div class="check-row check-${escapeHtml(check.status)}">
      <span class="check-dot"></span>
      <div>
        <strong>${escapeHtml(check.label)}</strong>
        <span>${escapeHtml(check.detail)}</span>
      </div>
    </div>
  `;
}

function runHtml(label, row) {
  if (!row) {
    return `
      <div class="run-row">
        <strong>${escapeHtml(label)}</strong>
        <span class="status-pill status-pending">missing</span>
        <span class="dim">No routine_status row yet</span>
      </div>
    `;
  }
  return `
    <div class="run-row">
      <strong>${escapeHtml(label)}</strong>
      <span class="status-pill status-${escapeHtml(row.status === 'ok' ? 'ok' : 'warn')}">${escapeHtml(row.status)}</span>
      <span>${escapeHtml(row.timestamp)}</span>
      <span class="dim">${escapeHtml(row.message)}</span>
    </div>
  `;
}

function sourceHtml(source) {
  const status = source.error ? 'warn' : 'ok';
  const detail = source.error || (source.generatedAt ? source.generatedAt : 'not loaded yet');
  return `
    <div class="source-row source-${status}">
      <strong>${escapeHtml(source.owner)}</strong>
      <span>${escapeHtml(source.count)} items</span>
      <span class="dim">${escapeHtml(detail)}</span>
    </div>
  `;
}

function hypothesisListHtml(rows, exported) {
  if (!exported) {
    return '<div class="empty-monitor">Hypothesis ledger has not been exported yet. The dashboard will populate this section after the review cycle lands and exports.</div>';
  }
  if (!rows.length) {
    return '<div class="empty-monitor">No hypotheses in the ledger yet.</div>';
  }
  return `
    <div class="hypothesis-list">
      ${rows.map(row => `
        <article class="hypothesis-row">
          <div>
            <strong>${escapeHtml(row.family || 'Unknown family')}</strong>
            <span class="dim">${escapeHtml(row.generatedAt)}</span>
          </div>
          <span class="status-pill status-pending">${escapeHtml(row.variable || 'variable')}</span>
          <p>${escapeHtml(row.proposedChange || row.currentSignal)}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function artifactHtml(label, text, available) {
  return `
    <section class="artifact-preview">
      <div class="artifact-title">
        <strong>${escapeHtml(label)}</strong>
        <span class="status-pill status-${available ? 'ok' : 'pending'}">${available ? 'available' : 'missing'}</span>
      </div>
      <pre>${escapeHtml(text || 'Not exported yet.')}</pre>
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
