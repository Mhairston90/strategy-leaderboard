import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SCRIPT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'ninjatrader_watchdog.ps1',
);

async function scriptText() {
  return readFile(SCRIPT_PATH, 'utf8');
}

test('watchdog corrects the connection status file when NinjaTrader is not running', async () => {
  const text = await scriptText();
  assert.match(text, /Set-Content -Path \$connectionFile -Value "DISCONNECTED"/);
  assert.match(text, /Get-Process -Name "NinjaTrader"/);
});

test('watchdog reads documents root and connection name from the sentinel config', async () => {
  const text = await scriptText();
  assert.match(text, /data\\sentinel\\config\.json/);
  assert.match(text, /\$config\.ninjatrader\.documents_root/);
  assert.match(text, /\$config\.ninjatrader\.connection_name/);
});

test('watchdog clears stale OIF files before starting NinjaTrader', async () => {
  const text = await scriptText();
  assert.match(text, /Clear-StaleOifs/);
  assert.match(text, /-Filter "oif\*\.txt"/);
});

test('watchdog enforces a restart cooldown and a disconnect grace period', async () => {
  const text = await scriptText();
  assert.match(text, /RestartCooldownMinutes = 30/);
  assert.match(text, /DisconnectedGraceMinutes = 6/);
  assert.match(text, /Restart-Allowed/);
});

test('watchdog uses non-interactive-safe destructive flags', async () => {
  const text = await scriptText();
  assert.match(text, /Stop-Process -Force -Confirm:\$false/);
  assert.match(text, /Remove-Item \$file\.FullName -Force -Confirm:\$false/);
});
