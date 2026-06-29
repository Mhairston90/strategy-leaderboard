import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { appendJsonl, readJsonlText, readJsonlFile } from './jsonl.js';

test('readJsonlText ignores blanks and parses objects', () => {
  assert.deepEqual(readJsonlText('{"a":1}\n\n{"b":2}\n'), [{ a: 1 }, { b: 2 }]);
});

test('readJsonlText can convert malformed lines into anomaly events', () => {
  assert.deepEqual(readJsonlText('{"a":1}\nnot json\n{"b":2}\n', { tolerateMalformed: true }), [
    { a: 1 },
    {
      type: 'malformed_jsonl',
      line_number: 2,
      raw_line: 'not json',
      reason: 'Unexpected token \'o\', "not json" is not valid JSON',
    },
    { b: 2 },
  ]);
});

test('readJsonlText and readJsonlFile treat empty inputs as empty', async () => {
  assert.deepEqual(readJsonlText(undefined), []);

  const dir = await mkdtemp(path.join(tmpdir(), 'sentinel-jsonl-'));
  const file = path.join(dir, 'missing.jsonl');
  assert.deepEqual(await readJsonlFile(file), []);
  await rm(dir, { recursive: true, force: true });
});

test('appendJsonl writes one object per line', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sentinel-jsonl-'));
  const file = path.join(dir, 'events.jsonl');
  await appendJsonl(file, { type: 'created', id: 'one' });
  await appendJsonl(file, { type: 'submitted', id: 'one' });

  const raw = await readFile(file, 'utf8');
  assert.equal(raw, '{"type":"created","id":"one"}\n{"type":"submitted","id":"one"}\n');
  assert.deepEqual(await readJsonlFile(file), [
    { type: 'created', id: 'one' },
    { type: 'submitted', id: 'one' },
  ]);
  await rm(dir, { recursive: true, force: true });
});
