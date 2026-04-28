import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchLocalText } from './fetch.js';

test('fetchLocalText reads repo-local files under node', async () => {
  const resp = await fetchLocalText('fixtures/codex-trade-log.md');

  assert.equal(resp.ok, true);
  assert.equal(resp.path, 'fixtures/codex-trade-log.md');
  assert.match(resp.text, /# CODEX v0 Trade Log/);
});

test('fetchLocalText returns error shape for missing repo-local files under node', async () => {
  const resp = await fetchLocalText('fixtures/missing-codex-file.md');

  assert.equal(resp.ok, false);
  assert.equal(resp.path, 'fixtures/missing-codex-file.md');
  assert.equal(resp.text, '');
  assert.equal(typeof resp.error, 'string');
});
