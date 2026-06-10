import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHermesMonitorModel,
  parseHypothesisLedgerText,
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
