// Sentinel ledger reconciliation: terminal-ize orphaned NinjaTrader submissions.
//
// Why this exists: if NinjaTrader stops writing order feedback (data feed
// disconnect, app crash), `order_submitted` ledger events are left with no
// terminal outcome. The rebalancer counts them as stale pending orders forever,
// which keeps the risk state frozen (`ninjatrader_feedback`). This script
// appends synthetic `order_rejected` events (keyed by broker_order_id, never by
// source_signal_id alone) so the ledger converges and the freeze can clear.
//
// Usage: node scripts/sentinel_ledger_reconcile.js [--dry-run]

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { appendJsonl, readJsonlFile } from '../lib/sentinel/jsonl.js';
import { loadSentinelConfigFromText } from '../lib/sentinel/config.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SENTINEL_DIR = path.join(REPO_ROOT, 'data', 'sentinel');
const NINJA_VENUE = 'ninjatrader-sim';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseTimeMs(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildOrphanReconciliationEvents({
  ledgerEvents = [],
  feedbackOrderIds = [],
  ttlMinutes = 15,
  now = new Date().toISOString(),
} = {}) {
  const feedbackIds = new Set(asArray(feedbackOrderIds).map((id) => String(id ?? '').trim()).filter(Boolean));
  const terminalIds = new Set();
  const submittedById = new Map();

  for (const event of asArray(ledgerEvents)) {
    const venue = String(event?.venue ?? event?.broker ?? '').trim();
    const brokerOrderId = String(event?.broker_order_id ?? '').trim();
    if (venue !== NINJA_VENUE || !brokerOrderId) {
      continue;
    }
    if (['order_filled', 'order_rejected'].includes(event?.type)) {
      terminalIds.add(brokerOrderId);
    } else if (event?.type === 'order_submitted' && !submittedById.has(brokerOrderId)) {
      submittedById.set(brokerOrderId, event);
    }
  }

  const nowMs = parseTimeMs(now) ?? Date.now();
  const ttlMs = Math.max(1, Number(ttlMinutes) || 15) * 60 * 1000;
  const events = [];

  for (const [brokerOrderId, submitted] of submittedById.entries()) {
    if (terminalIds.has(brokerOrderId) || feedbackIds.has(brokerOrderId)) {
      continue;
    }
    const submittedMs = parseTimeMs(submitted?.at);
    if (submittedMs !== null && nowMs - submittedMs <= ttlMs) {
      continue;
    }

    events.push({
      type: 'order_rejected',
      at: now,
      ticket_id: submitted.ticket_id ?? null,
      broker_order_id: brokerOrderId,
      broker: NINJA_VENUE,
      venue: NINJA_VENUE,
      symbol: submitted.symbol ?? null,
      instrument: submitted.instrument ?? null,
      side: submitted.side ?? null,
      quantity: Object.hasOwn(submitted, 'quantity') ? submitted.quantity : null,
      strategy: submitted.strategy ?? 'Sentinel Position Sync',
      source_signal_id: submitted.source_signal_id ?? null,
      reason: 'reconciled:orphaned_no_feedback',
    });
  }

  return events;
}

async function readOutgoingFeedbackOrderIds(documentsRoot, account) {
  const outgoingDir = path.join(documentsRoot, 'outgoing');
  let entries;
  try {
    entries = await readdir(outgoingDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const prefix = `${account}_`;
  return entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.txt') && !entry.name.endsWith('_position.txt'))
    .map((entry) => entry.name.slice(prefix.length, -'.txt'.length));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const config = loadSentinelConfigFromText(
    await readFile(path.join(SENTINEL_DIR, 'config.json'), 'utf8'),
  );
  const documentsRoot = String(config?.ninjatrader?.documents_root ?? '').trim();
  const account = String(config?.ninjatrader?.account ?? 'Sim101').trim();
  const ttlMinutes = Number(config?.ninjatrader?.pending_order_ttl_minutes) || 15;

  const ledgerPath = path.join(SENTINEL_DIR, 'execution_ledger.jsonl');
  const ledgerEvents = await readJsonlFile(ledgerPath, { tolerateMalformed: true });
  const feedbackOrderIds = documentsRoot
    ? await readOutgoingFeedbackOrderIds(documentsRoot, account)
    : [];

  const events = buildOrphanReconciliationEvents({
    ledgerEvents,
    feedbackOrderIds,
    ttlMinutes,
    now: new Date().toISOString(),
  });

  if (!events.length) {
    console.log('sentinel ledger reconcile: no orphaned NinjaTrader submissions found');
    return;
  }

  const bySymbol = new Map();
  for (const event of events) {
    bySymbol.set(event.symbol, (bySymbol.get(event.symbol) ?? 0) + 1);
  }
  for (const [symbol, count] of bySymbol.entries()) {
    console.log(`sentinel ledger reconcile: ${count} orphaned order(s) for ${symbol}`);
  }

  if (dryRun) {
    console.log(`sentinel ledger reconcile: dry run, ${events.length} event(s) NOT appended`);
    return;
  }

  for (const event of events) {
    await appendJsonl(ledgerPath, event);
  }
  console.log(`sentinel ledger reconcile: appended ${events.length} synthetic terminal event(s)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
