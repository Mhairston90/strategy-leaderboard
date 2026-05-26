import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Hermes monitor page loads its dedicated app module', async () => {
  const html = await readFile(path.join(root, 'hermes.html'), 'utf8');

  assert.match(html, /Hermes Monitor/);
  assert.match(html, /hermes_app\.js/);
});

test('Hermes monitor launcher opens the monitor page with cache busting', async () => {
  const bat = await readFile(path.join(root, 'Open Hermes Monitor.bat'), 'utf8');

  assert.match(bat, /serve_leaderboard\.py/);
  assert.match(bat, /set URL=http:\/\/127\.0\.0\.1:%PORT%\/hermes\.html\?v=!CACHE_BUSTER!/);
  assert.match(bat, /--app=!URL!/);
});

test('Hermes monitor desktop shortcut targets the monitor launcher', async () => {
  const script = await readFile(path.join(root, 'scripts', 'create-hermes-monitor-shortcut.ps1'), 'utf8');

  assert.match(script, /Hermes Monitor\.lnk/);
  assert.match(script, /Open Hermes Monitor\.bat/);
  assert.match(script, /Hermes monitoring dashboard/);
});
