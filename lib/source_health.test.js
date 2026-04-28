import { test } from 'node:test';
import assert from 'node:assert/strict';

import { healthSeverityForRow, mergeHealth } from './source_health.js';

test('codex live row with source errors degrades health to warn', () => {
  const row = {
    status: 'live',
    errors: ['portfolio: HTTP 404 Not Found'],
  };

  assert.equal(healthSeverityForRow(row, 'codex-local'), 'warn');
});

test('external error rows degrade health to error', () => {
  assert.equal(
    healthSeverityForRow({ status: 'error', errors: ['tradeLog: failed'] }, 'codex-local'),
    'error'
  );
  assert.equal(
    healthSeverityForRow({ status: 'error', errors: ['tradeLog: failed'] }, 'bull-github'),
    'error'
  );
});

test('sheet error rows degrade health to warn like the existing app behavior', () => {
  assert.equal(
    healthSeverityForRow({ status: 'error', errors: ['tab unavailable'] }, 'sheets'),
    'warn'
  );
});

test('mergeHealth preserves the highest severity', () => {
  assert.equal(mergeHealth('ok', 'warn'), 'warn');
  assert.equal(mergeHealth('warn', 'error'), 'error');
  assert.equal(mergeHealth('error', 'warn'), 'error');
});
