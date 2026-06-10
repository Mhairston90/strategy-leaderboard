import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHermesMonitorModel,
  parseHypothesisLedgerText,
  parseMissedTradeAuditorText,
  parseRoutineStatusText,
  renderHermesMonitorHtml,
} from './hermes_monitor.js';

test('parseRoutineStatusText extracts routine rows from markdown status table', () => {
  const rows = parseRoutineStatusText(`# CODEX Routine Status

| Routine | Strategy | Timestamp UTC | Status | Data source | Message |
|---------|----------|---------------|--------|-------------|---------|
| hermes-supervisor | Hermes Research Supervisor | 2026-05-26T11:58:59Z | ok | local | queue=24 repairs=0 experiments=9 sample=15 |
| hermes_review_cycle | paper_review | 2026-05-26T13:08:36Z | ok | local | new_hypotheses=2 queue_items=24 |
`);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], {
    routine: 'hermes_review_cycle',
    strategy: 'paper_review',
    timestamp: '2026-05-26T13:08:36Z',
    status: 'ok',
    dataSource: 'local',
    message: 'new_hypotheses=2 queue_items=24',
  });
});

test('parseHypothesisLedgerText extracts proposed hypotheses from markdown ledger', () => {
  const rows = parseHypothesisLedgerText(`| generated_at | source | family | variable | current_signal | proposed_change | expected_effect | status | key |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-26T12:00:00Z | memory/overnight_foundry_report.md | CODEX Pulse Foundry | target_pct | PF 0.09 | Reduce target_pct by one notch | Lower drawdown | proposed | pulse-target |
`);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].family, 'CODEX Pulse Foundry');
  assert.equal(rows[0].variable, 'target_pct');
  assert.equal(rows[0].status, 'proposed');
});

test('buildHermesMonitorModel summarizes readiness and safety state', () => {
  const model = buildHermesMonitorModel({
    codexQueue: {
      generated_at: '2026-05-26T11:58:59Z',
      mode: 'paper-only',
      items: [
        { type: 'experiment', priority: 2, title: 'Refine Pulse' },
        { type: 'sample_collection', priority: 3, title: 'Collect sample' },
      ],
      error: '',
    },
    claudeQueue: { generated_at: '', mode: 'paper-only', items: [], error: 'missing' },
    routineStatusText: `| Routine | Strategy | Timestamp UTC | Status | Data source | Message |
|---------|----------|---------------|--------|-------------|---------|
| hermes-supervisor | Hermes Research Supervisor | 2026-05-26T11:58:59Z | ok | local | queue=24 repairs=0 experiments=9 sample=15 |
| hermes_review_cycle | paper_review | 2026-05-26T13:08:36Z | ok | local | new_hypotheses=2 queue_items=24 |
`,
    modeText: '{"mode":"review_only"}',
    reviewText: '# Hermes review\n\n- safety: No strategy state was changed.\n',
    ledgerText: `| generated_at | source | family | variable | current_signal | proposed_change | expected_effect | status | key |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-26T12:00:00Z | memory/overnight_foundry_report.md | CODEX Pulse Foundry | target_pct | PF 0.09 | Reduce target_pct by one notch | Lower drawdown | proposed | pulse-target |
`,
  });

  assert.equal(model.mode, 'review_only');
  assert.equal(model.queue.total, 2);
  assert.equal(model.hypotheses.total, 1);
  assert.equal(model.safety.level, 'ok');
  assert.equal(model.readiness.readyForRailway, false);
  assert.equal(model.readiness.gates.some(gate => gate.status === 'pending'), true);
});

test('buildHermesMonitorModel parses stale trade sentinel artifact', () => {
  const model = buildHermesMonitorModel({
    codexQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    claudeQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    modeText: '{"mode":"review_only"}',
    reviewText: '# Hermes review\n\n- safety: No strategy state was changed.\n',
    staleTradeSentinelText: JSON.stringify({
      version: 1,
      generated_at: '2026-06-10T16:05:00Z',
      status: 'error',
      scanned: 3,
      errors: 1,
      warnings: 1,
      findings: [
        {
          severity: 'error',
          strategy: 'CODEX Regime Short Plus v1',
          action: 'CLOSE',
          pair: 'ADA/USD',
          sleeve: 'regime_short_plus_trend',
          reason: 'time-stop',
          cycle_time: '2026-06-10T16:00:00Z',
          message: 'paper-cycle replay expected close is still pending in the current paper state',
        },
      ],
    }),
  });

  assert.equal(model.staleTradeSentinel.exported, true);
  assert.equal(model.staleTradeSentinel.status, 'error');
  assert.equal(model.staleTradeSentinel.scanned, 3);
  assert.equal(model.staleTradeSentinel.findings[0].pair, 'ADA/USD');
});

test('parseMissedTradeAuditorText extracts audits and findings from error report', () => {
  const auditor = parseMissedTradeAuditorText(JSON.stringify({
    version: 1,
    generated_at: '2026-06-10T16:05:00Z',
    status: 'error',
    scanned: 3,
    errors: 1,
    warnings: 1,
    audits: [
      {
        strategy: 'codex_regime_plus_ls_v1',
        strategy_name: 'CODEX Regime Plus L/S v1',
        cycle_time: '2026-06-10T16:00:00Z',
        replay_status: 'ok',
        expected_opens: 1,
        expected_closes: 1,
        matched_opens: 1,
        matched_closes: 0,
        routine_status: 'warn',
        routine_message: 'close missing from paper state',
        forensics_quality: 'good',
        forensics_message: 'evidence captured',
      },
    ],
    findings: [
      {
        severity: 'error',
        strategy: 'codex_regime_plus_ls_v1',
        strategy_name: 'CODEX Regime Plus L/S v1',
        action: 'CLOSE',
        pair: 'ADA/USD',
        sleeve: 'regime_plus_ls_trend',
        reason: 'missing-close',
        cycle_time: '2026-06-10T16:00:00Z',
        evidence: 'expected close did not match a paper state close',
        message: 'review-only audit found a missed close',
      },
    ],
  }));

  assert.equal(auditor.exported, true);
  assert.equal(auditor.status, 'error');
  assert.equal(auditor.scanned, 3);
  assert.equal(auditor.audits[0].matchedCloses, 0);
  assert.equal(auditor.findings[0].pair, 'ADA/USD');
});

test('parseMissedTradeAuditorText uses audit count when scanned is missing', () => {
  const auditor = parseMissedTradeAuditorText(JSON.stringify({
    generated_at: '2026-06-10T16:05:00Z',
    status: 'ok',
    errors: 0,
    warnings: 0,
    audits: [
      { strategy_name: 'CODEX Regime Plus L/S v1' },
      { strategy_name: 'CODEX Apex WFO v1' },
    ],
    findings: [],
  }));

  assert.equal(auditor.scanned, 2);
  assert.equal(auditor.summary, 'ok errors=0 warnings=0');
});

test('parseMissedTradeAuditorText includes evidence on parse failure', () => {
  const auditor = parseMissedTradeAuditorText('{not json');

  assert.equal(auditor.exported, true);
  assert.equal(auditor.status, 'warn');
  assert.equal(auditor.findings[0].action, 'PARSE');
  assert.equal(auditor.findings[0].evidence, 'artifact parse failed');
});

test('buildHermesMonitorModel parses missed trade auditor summary', () => {
  const model = buildHermesMonitorModel({
    codexQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    claudeQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    missedTradeAuditorText: JSON.stringify({
      generated_at: '2026-06-10T16:05:00Z',
      status: 'ok',
      scanned: 3,
      errors: 0,
      warnings: 0,
      audits: [],
      findings: [],
    }),
  });

  assert.equal(model.missedTradeAuditor.exported, true);
  assert.equal(model.missedTradeAuditor.summary, 'ok errors=0 warnings=0');
});

test('renderHermesMonitorHtml renders high-signal monitor sections', () => {
  const html = renderHermesMonitorHtml(buildHermesMonitorModel({
    codexQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    claudeQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    routineStatusText: '',
    modeText: '',
    reviewText: '',
    ledgerText: '',
  }));

  assert.match(html, /Hermes Monitor/);
  assert.match(html, /Safety/);
  assert.match(html, /Railway Readiness/);
  assert.match(html, /Not ready/);
});

test('renderHermesMonitorHtml renders stale trade sentinel panel', () => {
  const html = renderHermesMonitorHtml(buildHermesMonitorModel({
    codexQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    claudeQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    modeText: '{"mode":"review_only"}',
    reviewText: '# Hermes review\n\n- safety: No strategy state was changed.\n',
    staleTradeSentinelText: JSON.stringify({
      generated_at: '2026-06-10T16:05:00Z',
      status: 'warn',
      scanned: 3,
      errors: 0,
      warnings: 1,
      findings: [
        {
          severity: 'warn',
          strategy: 'CODEX Regime Plus L/S v1',
          action: 'OPEN',
          pair: 'LTC/USD',
          sleeve: 'regime_plus_ls_trend',
          reason: 'test-candidate',
          cycle_time: '2026-06-10T16:00:00Z',
          message: 'paper-cycle replay expected open is still pending in the current paper state',
        },
      ],
    }),
  }));

  assert.match(html, /Stale Trade Sentinel/);
  assert.match(html, /CODEX Regime Plus L\/S v1/);
  assert.match(html, /LTC\/USD/);
  assert.match(html, /review-only/);
});

test('renderHermesMonitorHtml renders missed trade auditor after stale trade sentinel', () => {
  const html = renderHermesMonitorHtml(buildHermesMonitorModel({
    codexQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    claudeQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    modeText: '{"mode":"review_only"}',
    reviewText: '# Hermes review\n\n- safety: No strategy state was changed.\n',
    staleTradeSentinelText: JSON.stringify({
      generated_at: '2026-06-10T16:05:00Z',
      status: 'ok',
      scanned: 3,
      errors: 0,
      warnings: 0,
      findings: [],
    }),
    missedTradeAuditorText: JSON.stringify({
      generated_at: '2026-06-10T16:06:00Z',
      status: 'warn',
      scanned: 3,
      errors: 0,
      warnings: 1,
      audits: [],
      findings: [
        {
          severity: 'warn',
          strategy: 'codex_regime_plus_ls_v1',
          strategy_name: 'CODEX Regime Plus L/S v1',
          action: 'OPEN',
          pair: 'LTC/USD',
          sleeve: 'regime_plus_ls_trend',
          reason: 'missing-open',
          cycle_time: '2026-06-10T16:00:00Z',
          evidence: 'expected open not found in paper state',
          message: 'review-only audit found a missed open',
        },
      ],
    }),
  }));

  assert.ok(html.indexOf('Stale Trade Sentinel') < html.indexOf('Missed Trade Auditor'));
  assert.match(html, /CODEX Regime Plus L\/S v1/);
  assert.match(html, /LTC\/USD/);
  assert.match(html, /review-only/);
});

test('renderHermesMonitorHtml escapes hostile missed trade auditor finding content', () => {
  const html = renderHermesMonitorHtml(buildHermesMonitorModel({
    codexQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    claudeQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    missedTradeAuditorText: JSON.stringify({
      generated_at: '2026-06-10T16:06:00Z',
      status: 'warn',
      scanned: 1,
      errors: 0,
      warnings: 1,
      audits: [],
      findings: [
        {
          severity: 'warn',
          strategy: 'codex_hostile',
          strategy_name: '<script>alert("strategy")</script>',
          action: 'OPEN',
          pair: 'BTC/USD & ETH/USD',
          sleeve: 'hostile',
          reason: '<b>missing & dangerous</b>',
          cycle_time: '2026-06-10T16:00:00Z',
          evidence: 'artifact & broker <script>alert("evidence")</script>',
          message: 'A & B > C',
        },
      ],
    }),
  }));

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /&lt;script&gt;alert\(&quot;strategy&quot;\)&lt;\/script&gt;/);
  assert.match(html, /BTC\/USD &amp; ETH\/USD/);
  assert.match(html, /&lt;b&gt;missing &amp; dangerous&lt;\/b&gt;/);
  assert.match(html, /artifact &amp; broker &lt;script&gt;alert\(&quot;evidence&quot;\)&lt;\/script&gt;/);
  assert.match(html, /A &amp; B &gt; C/);
});

// ---- FABLE queue merge + cache health (added 2026-06-10) ----
import { buildCacheHealth } from './hermes_monitor.js';

test('fable queue merges into monitor model with owner badge', () => {
  const model = buildHermesMonitorModel({
    codexQueue: { items: [{ type: 'experiment', title: 'cx', priority: 2 }], generatedAt: '2026-06-10T00:00:00Z' },
    claudeQueue: { items: [], generatedAt: '' },
    fableQueue: {
      items: [{ type: 'sample_collection', title: 'Keep collecting forward sample for FABLE Crypto Drift v1', priority: 3 }],
      generatedAt: '2026-06-10T21:00:00Z',
    },
  });
  assert.equal(model.queue.total, 2);
  assert.equal(model.queue.sources.length, 3);
  assert.ok(model.queue.items.some(i => i.owner === 'fable'));
  assert.equal(model.queue.samples, 1);
});

test('buildCacheHealth summarizes the sentinel markdown into a run row', () => {
  const md = [
    '| Routine | Strategy | Timestamp UTC | Status | Data source | Message |',
    '|---|---|---|---|---|---|',
    '| cache-health | EQUITIES CACHE (wide-15 1h/1d) | 2026-06-10T21:16:30Z | ok | local | all files fresh |',
    '| cache-health | CRYPTO CACHE (Kraken-8 1h/4h) | 2026-06-10T21:16:30Z | warn | local | 8 issue(s): BTC_1h.csv (stale 31.0h) |',
  ].join('\n');
  const row = buildCacheHealth(md);
  assert.equal(row.status, 'warn');
  assert.match(row.message, /BTC_1h/);
  assert.equal(buildCacheHealth(''), null);
});
