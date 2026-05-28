import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('smoke script applies the same live-start cutoff as the browser app', async () => {
  const smoke = await readFile(path.join(root, 'scripts', 'smoke.js'), 'utf8');

  assert.match(smoke, /import \{ STRATEGIES, effectiveCutoff \} from '\.\.\/registry\.js';/);
  assert.equal(
    smoke.match(/liveStartIso:\s*effectiveCutoff\(strategy\.live_start_iso\)/g)?.length,
    3
  );
});
