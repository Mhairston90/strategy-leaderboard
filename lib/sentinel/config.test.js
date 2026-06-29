import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SENTINEL_CONFIG,
  applyEnvText,
  assertPaperEnv,
  loadSentinelConfigFromText,
  redactSecret,
} from './config.js';

test('default sentinel config is paper autosubmit only', () => {
  assert.equal(DEFAULT_SENTINEL_CONFIG.mode, 'paper');
  assert.equal(DEFAULT_SENTINEL_CONFIG.paper_auto_submit_enabled, true);
  assert.equal(DEFAULT_SENTINEL_CONFIG.broker, 'alpaca-paper');
  assert.equal(DEFAULT_SENTINEL_CONFIG.live_trading_enabled, false);
});

test('assertPaperEnv rejects live-like environments', () => {
  assert.doesNotThrow(() => assertPaperEnv({ ALPACA_ENV: 'paper' }));
  assert.throws(
    () => assertPaperEnv({ ALPACA_ENV: 'live' }),
    /ALPACA_ENV must be paper/
  );
  assert.throws(
    () => assertPaperEnv({}),
    /ALPACA_ENV must be paper/
  );
});

test('applyEnvText fills missing local env values without overriding existing ones', () => {
  const env = { APCA_API_KEY_ID: 'already-set' };

  applyEnvText(env, `
    # local paper credentials
    ALPACA_ENV=paper
    APCA_API_KEY_ID=from-file
    APCA_API_SECRET_KEY="secret from file"
  `);

  assert.equal(env.ALPACA_ENV, 'paper');
  assert.equal(env.APCA_API_KEY_ID, 'already-set');
  assert.equal(env.APCA_API_SECRET_KEY, 'secret from file');
});

test('loadSentinelConfigFromText merges user config over defaults', () => {
  const config = loadSentinelConfigFromText(JSON.stringify({
    max_daily_loss_pct: 1.25,
    max_open_orders: 4,
  }));

  assert.equal(config.mode, 'paper');
  assert.equal(config.paper_auto_submit_enabled, true);
  assert.equal(config.max_daily_loss_pct, 1.25);
  assert.equal(config.max_open_orders, 4);
});

test('loadSentinelConfigFromText treats blank config as defaults', () => {
  const config = loadSentinelConfigFromText('');

  assert.equal(config.mode, 'paper');
  assert.equal(config.broker, 'alpaca-paper');
  assert.equal(config.live_trading_enabled, false);
});

test('loadSentinelConfigFromText rejects live mode', () => {
  assert.throws(
    () => loadSentinelConfigFromText(JSON.stringify({ mode: 'live' })),
    /sentinel config mode must be paper/
  );
});

test('loadSentinelConfigFromText rejects non-paper broker', () => {
  assert.throws(
    () => loadSentinelConfigFromText(JSON.stringify({ broker: 'alpaca-live' })),
    /sentinel broker must be alpaca-paper/
  );
});

test('loadSentinelConfigFromText rejects live trading enabled', () => {
  assert.throws(
    () => loadSentinelConfigFromText(JSON.stringify({ live_trading_enabled: true })),
    /live_trading_enabled must be false/
  );
});

test('redactSecret never exposes full key material', () => {
  assert.equal(redactSecret('PK12345678904'), 'PK12...8904');
  assert.equal(redactSecret('short'), '***');
  assert.equal(redactSecret(''), '***');
});
