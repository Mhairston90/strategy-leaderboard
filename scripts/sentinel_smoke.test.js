import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSmokeSummary } from './sentinel_smoke.js';

function validInputs(overrides = {}) {
  return {
    config: { mode: 'paper', paper_auto_submit_enabled: true },
    allocation: { strategies: [{ name: 'CODEX Aggro v0' }] },
    riskState: { frozen: false },
    promotion: { strategies: [{ name: 'CODEX Aggro v0', status: 'core' }] },
    ...overrides,
  };
}

test('buildSmokeSummary reports autosubmit mode and files present', () => {
  const summary = buildSmokeSummary({
    config: { mode: 'paper', paper_auto_submit_enabled: true },
    allocation: { strategies: [{ name: 'CODEX Aggro v0' }] },
    riskState: { frozen: false },
    promotion: { strategies: [{ name: 'CODEX Aggro v0', status: 'core' }] },
  });

  assert.equal(summary.mode, 'paper');
  assert.equal(summary.paper_auto_submit_enabled, true);
  assert.equal(summary.allocation_count, 1);
  assert.equal(summary.ok, true);
});

test('buildSmokeSummary fails for non-paper mode', () => {
  const summary = buildSmokeSummary(validInputs({
    config: { mode: 'live', paper_auto_submit_enabled: true },
  }));

  assert.equal(summary.ok, false);
  assert.match(summary.errors.join('\n'), /paper mode/);
});

test('buildSmokeSummary fails when paper autosubmit is disabled', () => {
  const summary = buildSmokeSummary(validInputs({
    config: { mode: 'paper', paper_auto_submit_enabled: false },
  }));

  assert.equal(summary.ok, false);
  assert.match(summary.errors.join('\n'), /paper auto-submit/);
});

test('buildSmokeSummary fails for frozen risk state', () => {
  const summary = buildSmokeSummary(validInputs({
    riskState: { frozen: true },
  }));

  assert.equal(summary.ok, false);
  assert.match(summary.errors.join('\n'), /risk state/);
});

test('buildSmokeSummary fails for missing allocation', () => {
  const summary = buildSmokeSummary(validInputs({
    allocation: {},
  }));

  assert.equal(summary.ok, false);
  assert.equal(summary.allocation_count, 0);
  assert.match(summary.errors.join('\n'), /allocation/);
});

test('buildSmokeSummary fails for empty allocation', () => {
  const summary = buildSmokeSummary(validInputs({
    allocation: { strategies: [] },
  }));

  assert.equal(summary.ok, false);
  assert.equal(summary.allocation_count, 0);
  assert.match(summary.errors.join('\n'), /allocation/);
});

test('buildSmokeSummary fails when promotion strategies are missing', () => {
  const summary = buildSmokeSummary(validInputs({
    promotion: {},
  }));

  assert.equal(summary.ok, false);
  assert.equal(summary.promotion_count, 0);
  assert.match(summary.errors.join('\n'), /promotion/);
});

test('buildSmokeSummary fails for reconciliation error status', () => {
  const summary = buildSmokeSummary(validInputs({
    reconciliation: { status: 'error' },
  }));

  assert.equal(summary.ok, false);
  assert.equal(summary.reconciliation_status, 'error');
  assert.match(summary.errors.join('\n'), /reconciliation/);
});
