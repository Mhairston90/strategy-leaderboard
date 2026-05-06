import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('launcher uses quiet pythonw-compatible server instead of stdlib http.server', async () => {
  const bat = await readFile(path.join(root, 'Open Leaderboard.bat'), 'utf8');

  assert.match(bat, /serve_leaderboard\.py/);
  assert.doesNotMatch(bat, /pythonw\s+-m\s+http\.server/i);
});

test('launcher opens Chrome app with a cache-busting URL', async () => {
  const bat = await readFile(path.join(root, 'Open Leaderboard.bat'), 'utf8');

  assert.match(bat, /CACHE_BUSTER/);
  assert.match(bat, /set URL=http:\/\/127\.0\.0\.1:%PORT%\/\?v=!CACHE_BUSTER!/);
});

test('launcher isolates the Chrome app from stale default-profile windows', async () => {
  const bat = await readFile(path.join(root, 'Open Leaderboard.bat'), 'utf8');

  assert.match(bat, /CHROME_USER_DATA_DIR/);
  assert.match(bat, /--user-data-dir="!CHROME_USER_DATA_DIR!"/);
  assert.match(bat, /--new-window --app=!URL!/);
});

test('launcher checks for a healthy existing server before starting another one', async () => {
  const bat = await readFile(path.join(root, 'Open Leaderboard.bat'), 'utf8');

  assert.match(bat, /START_SERVER=1/);
  assert.match(bat, /Invoke-WebRequest .*127\.0\.0\.1:%PORT%\/registry\.js/);
  assert.match(bat, /if !START_SERVER! EQU 1/);
});

test('index forwards the launcher cache-buster to the app module', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');

  assert.match(html, /new URLSearchParams\(location\.search\)\.get\('v'\)/);
  assert.match(html, /import\(`\.\/app\.js\?v=\$\{encodeURIComponent\(assetVersion\)\}`\)/);
  assert.doesNotMatch(html, /<script type="module" src="app\.js"><\/script>/);
});

test('app cache key is bumped for the stock challenger leaderboard shape', async () => {
  const app = await readFile(path.join(root, 'app.js'), 'utf8');

  assert.match(app, /leaderboard-cache-v10/);
});

test('quiet server serves index when started without stdio', async () => {
  const fixtureDir = await mkdtemp(path.join(tmpdir(), 'leaderboard-server-'));
  await writeFile(
    path.join(fixtureDir, 'index.html'),
    '<!doctype html><title>Fixture Leaderboard</title>',
    'utf8'
  );

  const port = await getFreePort();
  const child = spawn(
    'python',
    [
      path.join(root, 'scripts', 'serve_leaderboard.py'),
      '--port',
      String(port),
      '--directory',
      fixtureDir,
    ],
    { stdio: 'ignore', windowsHide: true }
  );

  try {
    const response = await waitForResponse(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.match(await response.text(), /Fixture Leaderboard/);
  } finally {
    child.kill();
  }
});

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForResponse(url) {
  const deadline = Date.now() + 5000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }
  throw lastError || new Error(`No response from ${url}`);
}
