import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { appendJsonl } from '../lib/sentinel/jsonl.js';
import { normalizeSymbolForAlpaca } from '../lib/sentinel/ticket_schema.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseNotional(value) {
  const notional = Number(value ?? 5);
  if (!Number.isFinite(notional) || notional <= 0) {
    throw new Error('notional must be positive');
  }
  return notional;
}

const symbol = normalizeSymbolForAlpaca(process.argv[2] ?? 'AAPL');
const notional = parseNotional(process.argv[3]);
const now = new Date().toISOString();
const isCrypto = symbol.includes('/');
const suffix = Date.now();

await appendJsonl(path.join(REPO_ROOT, 'data', 'sentinel', 'ticket_inbox.jsonl'), {
  ticket_id: `sentinel-smoke-${suffix}`,
  created_at: now,
  strategy: 'SENTINEL Paper Smoke',
  symbol,
  asset_class: isCrypto ? 'crypto' : 'equity',
  side: 'buy',
  intent: 'open',
  notional_usd: notional,
  quantity: null,
  order_type: 'market',
  time_in_force: isCrypto ? 'gtc' : 'day',
  reason: 'paper auto-submit smoke ticket',
  source_signal_id: `paper-smoke-${suffix}`,
  risk_status: 'pending',
  broker: 'alpaca-paper',
});

console.log(`queued paper ticket ${symbol} $${notional.toFixed(2)}`);
