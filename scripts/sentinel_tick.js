import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAlpacaPaperClient } from '../lib/sentinel/alpaca_paper.js';
import { loadSentinelConfigFromText } from '../lib/sentinel/config.js';
import { appendJsonl, readJsonlFile } from '../lib/sentinel/jsonl.js';
import { replayLedgerEvents } from '../lib/sentinel/ledger.js';
import { buildReconciliationUpdate } from '../lib/sentinel/reconcile.js';
import { evaluateTicketRisk } from '../lib/sentinel/risk_governor.js';
import { normalizeSymbolForAlpaca, validateTicket } from '../lib/sentinel/ticket_schema.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SENTINEL_DIR = path.join(REPO_ROOT, 'data', 'sentinel');
const SUPPORTED_SYMBOLS = new Set(['AAPL', 'MSFT', 'SPY', 'QQQ', 'BTC/USD', 'ETH/USD']);
const ENV_SECRET_NAMES = ['APCA_API_KEY_ID', 'APCA_API_SECRET_KEY', 'ALPACA_API_KEY_ID', 'ALPACA_API_SECRET_KEY'];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function copyAccountTelemetry(target, source, field) {
  if (Object.hasOwn(source ?? {}, field)) {
    target[field] = source[field];
  }
}

function redactKnownSecrets(text) {
  let safeText = String(text ?? '');
  for (const name of ENV_SECRET_NAMES) {
    const secret = process.env[name];
    if (typeof secret === 'string' && secret !== '') {
      safeText = safeText.split(secret).join('***');
    }
  }

  return safeText.replace(
    /(APCA-API-(?:KEY-ID|SECRET-KEY)|authorization|secret|token|password)\s*[:=]\s*[^,\s}]+/gi,
    '$1: ***',
  );
}

function brokerFailureReason(result) {
  const error = result?.error;
  if (typeof error === 'string' && error.trim() !== '') {
    return redactKnownSecrets(error);
  }
  if (typeof error?.message === 'string' && error.message.trim() !== '') {
    return redactKnownSecrets(error.message);
  }
  if (typeof error?.error === 'string' && error.error.trim() !== '') {
    return redactKnownSecrets(error.error);
  }
  if (result?.status) {
    return `broker rejected order with status ${result.status}`;
  }
  return 'broker rejected order';
}

function brokerOrderId(order) {
  const id = order?.id ?? order?.client_order_id ?? order?.order_id;
  return id === undefined || id === null ? '' : String(id);
}

function ledgerRecentTickets(ledgerEvents) {
  return asArray(ledgerEvents)
    .filter(
      (event) =>
        (event?.type === 'order_submitted' || event?.type === 'order_rejected') &&
        event?.source_signal_id &&
        event?.symbol &&
        event?.strategy,
    )
    .map((event) => ({
      ticket_id: event.ticket_id ?? null,
      at: event.at ?? null,
      type: event.type,
      source_signal_id: event.source_signal_id,
      symbol: event.symbol,
      strategy: event.strategy,
    }));
}

function decisionFor(ticket, now, decision, reasons = [], extra = {}) {
  return {
    ticket_id: ticket?.ticket_id ?? null,
    processed_at: now,
    decision,
    risk_status:
      decision === 'submitted' ? 'approved' : decision === 'broker_rejected' ? 'rejected' : 'blocked',
    strategy: ticket?.strategy ?? null,
    symbol: ticket?.symbol ? normalizeSymbolForAlpaca(ticket.symbol) : null,
    asset_class: ticket?.asset_class ?? null,
    side: ticket?.side ?? null,
    intent: ticket?.intent ?? null,
    notional_usd: ticket?.notional_usd ?? null,
    quantity: Object.hasOwn(ticket ?? {}, 'quantity') ? ticket.quantity : null,
    order_type: ticket?.order_type ?? null,
    time_in_force: ticket?.time_in_force ?? null,
    reason: ticket?.reason ?? null,
    source_signal_id: ticket?.source_signal_id ?? null,
    broker: ticket?.broker ?? null,
    reasons,
    ...extra,
  };
}

function orderSubmittedEvent(ticket, now, orderId) {
  return {
    type: 'order_submitted',
    at: now,
    ticket_id: ticket.ticket_id,
    broker_order_id: orderId,
    symbol: normalizeSymbolForAlpaca(ticket.symbol),
    side: ticket.side,
    notional_usd: ticket.notional_usd,
    strategy: ticket.strategy,
    source_signal_id: ticket.source_signal_id,
  };
}

function orderRejectedEvent(ticket, now, reason) {
  return {
    type: 'order_rejected',
    at: now,
    ticket_id: ticket.ticket_id,
    symbol: ticket?.symbol ? normalizeSymbolForAlpaca(ticket.symbol) : null,
    side: ticket?.side ?? null,
    notional_usd: ticket?.notional_usd ?? null,
    strategy: ticket?.strategy ?? null,
    source_signal_id: ticket?.source_signal_id ?? null,
    reason,
  };
}

function projectedAccount(account, openOrders) {
  return {
    ...(account ?? {}),
    open_orders: openOrders,
  };
}

function projectedOpenOrder(ticket, orderId) {
  return {
    id: orderId,
    ticket_id: ticket.ticket_id,
    symbol: normalizeSymbolForAlpaca(ticket.symbol),
    side: ticket.side,
    notional_usd: ticket.notional_usd,
    strategy: ticket.strategy,
    source_signal_id: ticket.source_signal_id,
  };
}

function projectedExposurePosition(ticket) {
  return {
    symbol: normalizeSymbolForAlpaca(ticket.symbol),
    strategy: ticket.strategy,
    market_value: ticket.side === 'sell' ? -ticket.notional_usd : ticket.notional_usd,
  };
}

function sameProjectedPosition(position, ticket) {
  return (
    normalizeSymbolForAlpaca(position?.symbol) === normalizeSymbolForAlpaca(ticket.symbol) &&
    (position?.strategy === ticket.strategy || position?.strategy === undefined)
  );
}

function applyProjectedExposure(positions, ticket) {
  const projected = projectedExposurePosition(ticket);
  const existingIndex = positions.findIndex((position) => sameProjectedPosition(position, ticket));
  if (existingIndex === -1) {
    positions.push(projected);
    return;
  }

  const existing = positions[existingIndex];
  positions[existingIndex] = {
    ...existing,
    symbol: normalizeSymbolForAlpaca(existing.symbol),
    strategy: existing.strategy ?? ticket.strategy,
    market_value: numeric(existing.market_value) + projected.market_value,
  };
}

function signsCompatible(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
    return false;
  }
  if (Math.abs(leftNumber) <= 0.000001 || Math.abs(rightNumber) <= 0.000001) {
    return false;
  }

  return Math.sign(leftNumber) === Math.sign(rightNumber);
}

function quantitiesMatch(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  return (
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    Math.abs(leftNumber - rightNumber) <= 0.000001
  );
}

function canAttributeBrokerPosition(brokerPosition, ledgerPosition) {
  if (!ledgerPosition?.strategy) {
    return false;
  }

  if (quantitiesMatch(brokerPosition?.qty, ledgerPosition.qty)) {
    return true;
  }

  return signsCompatible(brokerPosition?.market_value, ledgerPosition.market_value);
}

function strategyAttributedPositions(positions, ledgerEvents) {
  const brokerPositions = asArray(positions);
  const replay = replayLedgerEvents(ledgerEvents);
  const ledgerPositions = new Map(
    [...replay.positions.entries()].map(([symbol, position]) => [
      normalizeSymbolForAlpaca(symbol),
      { ...position, symbol: normalizeSymbolForAlpaca(position.symbol ?? symbol) },
    ]),
  );

  if (brokerPositions.length === 0) {
    return [...ledgerPositions.values()];
  }

  const attributed = brokerPositions.map((position) => {
    const symbol = normalizeSymbolForAlpaca(position?.symbol);
    const ledgerPosition = ledgerPositions.get(symbol);
    const strategy = String(position?.strategy ?? '').trim();
    if (strategy || !canAttributeBrokerPosition(position, ledgerPosition)) {
      return { ...position, symbol };
    }

    return {
      ...position,
      symbol,
      strategy: ledgerPosition.strategy,
    };
  });

  for (const [symbol, ledgerPosition] of ledgerPositions.entries()) {
    if (!attributed.some((position) => normalizeSymbolForAlpaca(position?.symbol) === symbol)) {
      attributed.push(ledgerPosition);
    }
  }

  return attributed;
}

async function recordLedgerEvent(ledgerEvents, onLedgerEvent, event) {
  ledgerEvents.push(event);
  if (typeof onLedgerEvent === 'function') {
    await onLedgerEvent(event);
  }
}

export async function processTickets({
  tickets,
  broker,
  config,
  riskState,
  account,
  positions,
  recentTickets,
  ledgerEvents: existingLedgerEvents,
  supportedSymbols,
  onLedgerEvent,
  now = new Date().toISOString(),
} = {}) {
  const decisions = [];
  const ledgerEvents = [];
  const projectedRecentTickets = [...asArray(recentTickets), ...ledgerRecentTickets(existingLedgerEvents)];
  const projectedOpenOrders = [...asArray(account?.open_orders)];
  const projectedPositions = strategyAttributedPositions(
    Array.isArray(positions) ? positions : account?.positions,
    existingLedgerEvents,
  );

  for (const ticket of asArray(tickets)) {
    const schema = validateTicket(ticket);
    if (!schema.ok) {
      const decision = decisionFor(ticket, now, 'blocked', schema.errors);
      decisions.push(decision);
      projectedRecentTickets.push(decision);
      continue;
    }

    const riskContext = {
      config,
      riskState,
      account: projectedAccount(account, projectedOpenOrders),
      positions: projectedPositions,
      recentTickets: projectedRecentTickets,
      supportedSymbols,
      now,
    };
    const risk = evaluateTicketRisk(ticket, riskContext);
    if (!risk.ok) {
      const decision = decisionFor(ticket, now, 'blocked', risk.reasons);
      decisions.push(decision);
      projectedRecentTickets.push(decision);
      continue;
    }

    const submitted = await broker.submitOrder(ticket);
    if (!submitted?.ok) {
      const reason = brokerFailureReason(submitted);
      const decision = decisionFor(ticket, now, 'broker_rejected', [reason]);
      decisions.push(decision);
      projectedRecentTickets.push(decision);
      await recordLedgerEvent(ledgerEvents, onLedgerEvent, orderRejectedEvent(ticket, now, reason));
      continue;
    }

    const orderId = brokerOrderId(submitted.order);
    const decision = decisionFor(ticket, now, 'submitted', [], { broker_order_id: orderId });
    decisions.push(decision);
    projectedRecentTickets.push(decision);
    await recordLedgerEvent(ledgerEvents, onLedgerEvent, orderSubmittedEvent(ticket, now, orderId));
    projectedOpenOrders.push(projectedOpenOrder(ticket, orderId));
    applyProjectedExposure(projectedPositions, ticket);
  }

  return { decisions, ledgerEvents };
}

export function buildSentinelStatusMarkdown({ generatedAt, decisions = [], riskState = {} } = {}) {
  const submitted = decisions.filter((decision) => decision.decision === 'submitted').length;
  const blocked = decisions.filter((decision) => decision.decision === 'blocked').length;
  const brokerRejected = decisions.filter((decision) => decision.decision === 'broker_rejected').length;

  return [
    '# Trade Sentinel Status',
    '',
    `- generated_at: ${generatedAt ?? ''}`,
    `- processed_tickets: ${decisions.length}`,
    `- submitted: ${submitted}`,
    `- blocked: ${blocked}`,
    `- broker_rejected: ${brokerRejected}`,
    `- frozen: ${riskState.frozen === true}`,
    '',
  ].join('\n');
}

async function readJson(relativePath, fallback) {
  try {
    return JSON.parse(await readFile(path.join(REPO_ROOT, relativePath), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(relativePath, value) {
  await writeFile(path.join(REPO_ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function appendAllJsonl(relativePath, values) {
  for (const value of values) {
    await appendJsonl(path.join(REPO_ROOT, relativePath), value);
  }
}

function brokerFetchError(label, result) {
  return new Error(`${label} fetch failed: ${brokerFailureReason(result)}`);
}

async function main() {
  const generatedAt = new Date().toISOString();
  const config = loadSentinelConfigFromText(
    await readFile(path.join(SENTINEL_DIR, 'config.json'), 'utf8'),
  );
  const storedRiskState = await readJson('data/sentinel/risk_state.json', { frozen: false });
  const tickets = await readJsonlFile(path.join(SENTINEL_DIR, 'ticket_inbox.jsonl'));
  const recentTickets = await readJsonlFile(path.join(SENTINEL_DIR, 'trade_tickets.jsonl'));
  const existingLedgerEvents = await readJsonlFile(path.join(SENTINEL_DIR, 'execution_ledger.jsonl'), {
    tolerateMalformed: true,
  });

  const broker = createAlpacaPaperClient();
  const accountResult = await broker.getAccount();
  if (!accountResult.ok) {
    throw brokerFetchError('Alpaca account', accountResult);
  }

  const positionsResult = await broker.getPositions();
  if (!positionsResult.ok) {
    throw brokerFetchError('Alpaca positions', positionsResult);
  }

  const ordersResult = await broker.getOrders();
  if (!ordersResult.ok) {
    throw brokerFetchError('Alpaca orders', ordersResult);
  }

  const brokerPositions = asArray(positionsResult.positions);
  const openOrders = asArray(ordersResult.orders);
  const account = {
    equity: accountResult.account?.equity,
    open_orders: openOrders,
  };
  for (const field of ['daily_realized_loss', 'daily_realized_loss_usd', 'daily_realized_pnl', 'last_equity']) {
    copyAccountTelemetry(account, accountResult.account, field);
  }
  const preProcessReconciliation = buildReconciliationUpdate({
    ledgerEvents: existingLedgerEvents,
    brokerPositions,
    riskState: storedRiskState,
    config,
    generatedAt,
  });

  const processed = await processTickets({
    tickets,
    broker,
    config,
    riskState: preProcessReconciliation.riskState,
    account,
    positions: brokerPositions,
    recentTickets,
    ledgerEvents: existingLedgerEvents,
    supportedSymbols: SUPPORTED_SYMBOLS,
    onLedgerEvent: (event) => appendJsonl(path.join(SENTINEL_DIR, 'execution_ledger.jsonl'), event),
    now: generatedAt,
  });

  await appendAllJsonl('data/sentinel/trade_tickets.jsonl', processed.decisions);

  const postProcessReconciliation = buildReconciliationUpdate({
    ledgerEvents: [...existingLedgerEvents, ...processed.ledgerEvents],
    brokerPositions,
    riskState: preProcessReconciliation.riskState,
    config,
    generatedAt,
  });
  const nextRiskState = {
    ...postProcessReconciliation.riskState,
    generated_at: generatedAt,
    paper_auto_submit_enabled: config.paper_auto_submit_enabled,
    live_trading_enabled: config.live_trading_enabled,
  };

  await writeJson('data/sentinel/reconciliation_report.json', postProcessReconciliation.report);
  await writeJson('data/sentinel/risk_state.json', nextRiskState);
  await writeFile(
    path.join(SENTINEL_DIR, 'sentinel_status.md'),
    buildSentinelStatusMarkdown({
      generatedAt,
      decisions: processed.decisions,
      riskState: nextRiskState,
    }),
    'utf8',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(redactKnownSecrets(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
