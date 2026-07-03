import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { STRATEGIES } from '../registry.js';
import { buildSentinelAlerts, worstAlertSeverity } from '../lib/sentinel/alerts.js';
import { createAlpacaPaperClient } from '../lib/sentinel/alpaca_paper.js';
import { applyEnvText, loadSentinelConfigFromText } from '../lib/sentinel/config.js';
import { appendJsonl, readJsonlFile } from '../lib/sentinel/jsonl.js';
import { applyKillSwitchRiskState, readKillSwitch } from '../lib/sentinel/kill_switch.js';
import { replayLedgerEvents } from '../lib/sentinel/ledger.js';
import { createNinjaTraderSimClient } from '../lib/sentinel/ninjatrader_sim.js';
import { buildRebalanceOrders } from '../lib/sentinel/rebalancer.js';
import { buildReconciliationUpdate } from '../lib/sentinel/reconcile.js';
import { evaluateTicketRisk } from '../lib/sentinel/risk_governor.js';
import { buildTargetPortfolio } from '../lib/sentinel/target_portfolio.js';
import { acquireTickLock } from '../lib/sentinel/tick_lock.js';
import { buildLeaderboardTickets } from '../lib/sentinel/ticket_generator.js';
import { normalizeSymbolForAlpaca, validateTicket } from '../lib/sentinel/ticket_schema.js';
import { routeTargetPortfolio } from '../lib/sentinel/venue_router.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SENTINEL_DIR = path.join(REPO_ROOT, 'data', 'sentinel');
export const SENTINEL_SUPPORTED_SYMBOLS = new Set([
  'AAPL',
  'AMD',
  'AVGO',
  'CAT',
  'DIS',
  'FCX',
  'JPM',
  'LLY',
  'META',
  'MSFT',
  'NFLX',
  'NKE',
  'NVDA',
  'OXY',
  'PLTR',
  'SPY',
  'QQQ',
  'TSLA',
  'ADA/USD',
  'AVAX/USD',
  'BTC/USD',
  'DOGE/USD',
  'DOT/USD',
  'ETH/USD',
  'LINK/USD',
  'LTC/USD',
  'SOL/USD',
  'XRP/USD',
]);
const ENV_SECRET_NAMES = ['APCA_API_KEY_ID', 'APCA_API_SECRET_KEY', 'ALPACA_API_KEY_ID', 'ALPACA_API_SECRET_KEY'];
const DEFAULT_LEADERBOARD_LOOKBACK_MINUTES = 24 * 60;
const DEFAULT_LEADERBOARD_TICKET_NOTIONAL_USD = 5;
const DEFAULT_TICK_LOCK_STALE_MS = 3 * 60 * 1000;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizedIso(value) {
  const parsed = Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) {
    return new Date().toISOString().replace('.000Z', 'Z');
  }

  return new Date(parsed).toISOString().replace('.000Z', 'Z');
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function positionSyncDecisionFor(order, now, decision, reasons = [], extra = {}) {
  return {
    ticket_id: order?.ticket_id ?? null,
    processed_at: now,
    decision,
    risk_status:
      decision === 'submitted' ? 'approved' : decision === 'broker_rejected' ? 'rejected' : 'blocked',
    strategy: order?.strategy ?? 'Sentinel Position Sync',
    symbol: order?.symbol ? normalizeSymbolForAlpaca(order.symbol) : null,
    asset_class: order?.asset_class ?? null,
    side: order?.side ?? null,
    intent: order?.intent ?? 'rebalance',
    notional_usd: order?.notional_usd ?? null,
    quantity: Object.hasOwn(order ?? {}, 'quantity') ? order.quantity : null,
    order_type: order?.order_type ?? null,
    time_in_force: order?.time_in_force ?? null,
    reason: order?.reason ?? null,
    source_signal_id: order?.source_signal_id ?? null,
    broker: order?.broker ?? null,
    venue: order?.venue ?? order?.broker ?? null,
    instrument: order?.instrument ?? null,
    reasons,
    ...extra,
  };
}

function positionSyncSubmittedEvent(order, now, orderId) {
  return {
    type: 'order_submitted',
    at: now,
    ticket_id: order.ticket_id,
    broker_order_id: orderId,
    broker: order.broker,
    venue: order.venue,
    symbol: normalizeSymbolForAlpaca(order.symbol),
    instrument: order.instrument ?? null,
    side: order.side,
    notional_usd: order.notional_usd,
    quantity: Object.hasOwn(order ?? {}, 'quantity') ? order.quantity : null,
    strategy: order.strategy,
    source_signal_id: order.source_signal_id,
  };
}

function positionSyncRejectedEvent(order, now, reason) {
  return {
    type: 'order_rejected',
    at: now,
    ticket_id: order?.ticket_id ?? null,
    broker_order_id: null,
    broker: order?.broker ?? null,
    venue: order?.venue ?? null,
    symbol: order?.symbol ? normalizeSymbolForAlpaca(order.symbol) : null,
    instrument: order?.instrument ?? null,
    side: order?.side ?? null,
    notional_usd: order?.notional_usd ?? null,
    quantity: Object.hasOwn(order ?? {}, 'quantity') ? order.quantity : null,
    strategy: order?.strategy ?? 'Sentinel Position Sync',
    source_signal_id: order?.source_signal_id ?? null,
    reason,
  };
}

const NINJA_VENUE = 'ninjatrader-sim';
const TERMINAL_FEEDBACK_STATUSES = new Set(['filled', 'rejected', 'cancelled', 'canceled', 'expired']);

export function buildNinjaFeedbackLedgerEvents({ ledgerEvents = [], ninjaOrders = [], now = new Date().toISOString() } = {}) {
  const alreadyTerminal = new Set();
  const submittedById = new Map();
  for (const event of asArray(ledgerEvents)) {
    const venue = String(event?.venue ?? event?.broker ?? '').trim();
    const brokerOrderId = String(event?.broker_order_id ?? '').trim();
    if (venue !== NINJA_VENUE || !brokerOrderId) {
      continue;
    }
    if (['order_filled', 'order_rejected'].includes(event?.type)) {
      alreadyTerminal.add(brokerOrderId);
    } else if (event?.type === 'order_submitted' && !submittedById.has(brokerOrderId)) {
      submittedById.set(brokerOrderId, event);
    }
  }

  const events = [];
  for (const order of asArray(ninjaOrders)) {
    const brokerOrderId = String(order?.id ?? order?.broker_order_id ?? '').trim();
    const status = String(order?.status ?? '').trim().toLowerCase();
    if (!brokerOrderId || alreadyTerminal.has(brokerOrderId) || !TERMINAL_FEEDBACK_STATUSES.has(status)) {
      continue;
    }
    const submitted = submittedById.get(brokerOrderId);
    if (!submitted) {
      continue;
    }

    const base = {
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
    };
    if (status === 'filled') {
      events.push({
        type: 'order_filled',
        ...base,
        filled_qty: numeric(order?.filled_qty),
        fill_price: numeric(order?.fill_price),
      });
    } else {
      events.push({
        type: 'order_rejected',
        ...base,
        reason: `ninjatrader feedback: ${status}`,
      });
    }
    alreadyTerminal.add(brokerOrderId);
  }

  return events;
}

function parseEventMs(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function recentLedgerEventsForSymbol({ ledgerEvents, type, symbol, venue, sinceMs }) {
  const normalizedSymbol = normalizeSymbolForAlpaca(symbol);
  return asArray(ledgerEvents).filter((event) => {
    if (event?.type !== type) {
      return false;
    }
    if (normalizeSymbolForAlpaca(event?.symbol) !== normalizedSymbol) {
      return false;
    }
    if (venue && String(event?.venue ?? event?.broker ?? '').trim() !== venue) {
      return false;
    }
    const atMs = parseEventMs(event?.at);
    return atMs !== null && atMs >= sinceMs;
  });
}

function telemetryLoss(account, riskState) {
  for (const source of [account, riskState]) {
    for (const field of ['daily_realized_loss', 'daily_realized_loss_usd']) {
      if (Object.hasOwn(source ?? {}, field)) {
        return Math.max(0, numeric(source[field], 0));
      }
    }
    if (Object.hasOwn(source ?? {}, 'daily_realized_pnl')) {
      return Math.max(0, -numeric(source.daily_realized_pnl, 0));
    }
  }

  return 0;
}

function evaluatePositionSyncOrderRisk(order, context = {}) {
  const config = context?.config ?? {};
  const riskState = context?.riskState ?? {};
  const account = context?.account ?? {};
  const reasons = [];

  if (config.mode !== 'paper') {
    reasons.push('mode must be paper');
  }
  if (config.live_trading_enabled) {
    reasons.push('live trading must be disabled');
  }
  if (config.paper_auto_submit_enabled !== true) {
    reasons.push('paper auto-submit must be enabled');
  }
  if (config.position_sync_auto_submit_enabled !== true) {
    reasons.push('position-sync auto-submit must be enabled');
  }
  if (riskState.frozen) {
    const freezeReason =
      typeof riskState.freeze_reason === 'string' && riskState.freeze_reason.trim() !== ''
        ? `: ${riskState.freeze_reason.trim()}`
        : '';
    reasons.push(`risk state frozen${freezeReason}`);
  }

  const venue = String(order?.venue ?? order?.broker ?? '').trim();
  if (!['alpaca-paper', 'ninjatrader-sim'].includes(venue)) {
    reasons.push(`unsupported execution venue: ${venue || 'unknown'}`);
  }
  if (!['buy', 'sell'].includes(order?.side)) {
    reasons.push('side must be buy or sell');
  }
  if (numeric(order?.notional_usd) <= 0) {
    reasons.push('notional_usd must be positive');
  }
  if (
    venue === 'ninjatrader-sim' &&
    (!Number.isInteger(Number(order?.quantity)) || Number(order?.quantity) <= 0)
  ) {
    reasons.push('NinjaTrader quantity must be a positive integer');
  }

  if (venue === NINJA_VENUE) {
    const connection = account?.venues?.ninjatrader_sim?.connection;
    if (connection !== undefined && String(connection).trim().toLowerCase() !== 'connected') {
      reasons.push(`NinjaTrader connection is not connected (status: ${String(connection).trim().toLowerCase() || 'unknown'})`);
    }
  }

  const ledgerEvents = asArray(context?.ledgerEvents);
  if (ledgerEvents.length && order?.symbol) {
    const nowMs = parseEventMs(context?.now) ?? Date.now();
    const cooldownMinutes = numeric(config.position_sync_reject_cooldown_minutes, 10);
    if (cooldownMinutes > 0) {
      const recentRejections = recentLedgerEventsForSymbol({
        ledgerEvents,
        type: 'order_rejected',
        symbol: order.symbol,
        venue,
        sinceMs: nowMs - cooldownMinutes * 60 * 1000,
      });
      if (recentRejections.length) {
        reasons.push(
          `recent broker rejection for ${normalizeSymbolForAlpaca(order.symbol)} on ${venue}; cooling down ${cooldownMinutes} minutes`,
        );
      }
    }

    const hourlyCap = numeric(config.max_orders_per_symbol_per_hour, 6);
    if (hourlyCap > 0) {
      const recentSubmissions = recentLedgerEventsForSymbol({
        ledgerEvents,
        type: 'order_submitted',
        symbol: order.symbol,
        venue: null,
        sinceMs: nowMs - 60 * 60 * 1000,
      });
      if (recentSubmissions.length >= hourlyCap) {
        reasons.push(
          `position-sync orders for ${normalizeSymbolForAlpaca(order.symbol)} in the past hour ${recentSubmissions.length} at or above cap ${hourlyCap}`,
        );
      }
    }
  }

  const riskEquity = positiveNumber(config.total_capital_usd, positiveNumber(account.equity, 100000));
  const maxGrossExposurePct = numeric(config.max_gross_exposure_pct, 100);
  const maxSymbolExposurePct = numeric(config.max_symbol_exposure_pct, 100);
  const maxDailyLossPct = numeric(config.max_daily_loss_pct, 100);
  const targetGrossExposureUsd = numeric(context?.targetGrossExposureUsd);
  const symbolTargetExposureUsd = Math.abs(numeric(order?.target_notional_usd, order?.notional_usd));

  if (targetGrossExposureUsd > (riskEquity * maxGrossExposurePct) / 100) {
    reasons.push(
      `target gross exposure ${targetGrossExposureUsd.toFixed(2)} exceeds cap ${((riskEquity * maxGrossExposurePct) / 100).toFixed(2)}`,
    );
  }
  if (symbolTargetExposureUsd > (riskEquity * maxSymbolExposurePct) / 100) {
    reasons.push(
      `target symbol exposure ${symbolTargetExposureUsd.toFixed(2)} exceeds cap ${((riskEquity * maxSymbolExposurePct) / 100).toFixed(2)}`,
    );
  }

  const dailyLoss = telemetryLoss(account, riskState);
  const dailyLossCap = (riskEquity * maxDailyLossPct) / 100;
  if (dailyLoss >= dailyLossCap) {
    reasons.push(`daily realized loss ${dailyLoss.toFixed(2)} is at or beyond cap ${dailyLossCap.toFixed(2)}`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export async function processPositionSyncOrders({
  orders,
  brokers = {},
  config,
  riskState,
  account,
  targetGrossExposureUsd,
  ledgerEvents: existingLedgerEvents = [],
  onLedgerEvent,
  now = new Date().toISOString(),
} = {}) {
  const decisions = [];
  const ledgerEvents = [];

  for (const order of asArray(orders)) {
    const risk = evaluatePositionSyncOrderRisk(order, {
      config,
      riskState,
      account,
      targetGrossExposureUsd,
      ledgerEvents: [...asArray(existingLedgerEvents), ...ledgerEvents],
      now,
    });
    if (!risk.ok) {
      decisions.push(positionSyncDecisionFor(order, now, 'blocked', risk.reasons));
      continue;
    }

    const broker = brokers[order?.venue] ?? brokers[order?.broker];
    if (!broker || typeof broker.submitOrder !== 'function') {
      decisions.push(positionSyncDecisionFor(order, now, 'blocked', [`missing broker for venue: ${order?.venue ?? order?.broker ?? 'unknown'}`]));
      continue;
    }

    const submitted = await broker.submitOrder(order);
    if (!submitted?.ok) {
      const reason = brokerFailureReason(submitted);
      decisions.push(positionSyncDecisionFor(order, now, 'broker_rejected', [reason]));
      await recordLedgerEvent(ledgerEvents, onLedgerEvent, positionSyncRejectedEvent(order, now, reason));
      continue;
    }

    const orderId = brokerOrderId(submitted.order);
    decisions.push(positionSyncDecisionFor(order, now, 'submitted', [], { broker_order_id: orderId }));
    await recordLedgerEvent(ledgerEvents, onLedgerEvent, positionSyncSubmittedEvent(order, now, orderId));
  }

  return { decisions, ledgerEvents };
}

export function buildLeaderboardGenerationWindow({ generatedAt, config = {} } = {}) {
  const until = normalizedIso(generatedAt);
  const untilMs = Date.parse(until);
  const lookbackMinutes = positiveNumber(
    config.leaderboard_ticket_lookback_minutes,
    DEFAULT_LEADERBOARD_LOOKBACK_MINUTES,
  );
  const since = new Date(untilMs - lookbackMinutes * 60 * 1000)
    .toISOString()
    .replace('.000Z', 'Z');

  return { since, until };
}

export function buildTickTickets({ inboxTickets = [], leaderboardTickets = [] } = {}) {
  return [...asArray(inboxTickets), ...asArray(leaderboardTickets)];
}

export function buildSentinelStatusMarkdown({
  generatedAt,
  decisions = [],
  riskState = {},
  generatedLeaderboardTickets = 0,
  executionModel = 'ticket-replay',
  targetCount = 0,
  routedTargetCount = 0,
  plannedOrders = 0,
  divergences = [],
  skipped = [],
} = {}) {
  const submitted = decisions.filter((decision) => decision.decision === 'submitted').length;
  const blocked = decisions.filter((decision) => decision.decision === 'blocked').length;
  const brokerRejected = decisions.filter((decision) => decision.decision === 'broker_rejected').length;

  const lines = [
    '# Trade Sentinel Status',
    '',
    `- generated_at: ${generatedAt ?? ''}`,
    `- execution_model: ${executionModel}`,
    `- processed_tickets: ${decisions.length}`,
    `- submitted: ${submitted}`,
    `- blocked: ${blocked}`,
    `- broker_rejected: ${brokerRejected}`,
    `- generated_leaderboard_tickets: ${generatedLeaderboardTickets}`,
    `- frozen: ${riskState.frozen === true}`,
  ];

  if (executionModel === 'position-sync') {
    lines.push(
      `- target_symbols: ${targetCount}`,
      `- routed_targets: ${routedTargetCount}`,
      `- planned_orders: ${plannedOrders}`,
      `- divergences: ${asArray(divergences).length}`,
      `- skipped_inputs: ${asArray(skipped).length}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

async function readJson(relativePath, fallback) {
  try {
    return JSON.parse((await readFile(path.join(REPO_ROOT, relativePath), 'utf8')).replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function loadLocalEnvFiles(env = process.env) {
  for (const filename of ['.env.local', '.env']) {
    try {
      applyEnvText(env, await readFile(path.join(REPO_ROOT, filename), 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
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

async function loadLeaderboardTradeLogs(allocation, strategies) {
  const allocatedNames = new Set(asArray(allocation?.strategies).map((row) => row?.name).filter(Boolean));
  const tradeLogs = {};

  await Promise.all(asArray(strategies).map(async (strategy) => {
    if (!allocatedNames.has(strategy?.name)) {
      return;
    }

    const tradeLogPath = strategy?.source?.trade_log_path;
    if (!tradeLogPath) {
      return;
    }

    try {
      tradeLogs[tradeLogPath] = await readFile(path.join(REPO_ROOT, tradeLogPath), 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }));

  return tradeLogs;
}

async function loadAllocatedPortfolioSnapshots(allocation, strategies) {
  const allocatedNames = new Set(asArray(allocation?.strategies).map((row) => row?.name).filter(Boolean));
  const portfolioTexts = {};

  await Promise.all(asArray(strategies).map(async (strategy) => {
    if (!allocatedNames.has(strategy?.name)) {
      return;
    }

    const portfolioPath = strategy?.source?.portfolio_path;
    if (!portfolioPath) {
      return;
    }

    try {
      portfolioTexts[portfolioPath] = await readFile(path.join(REPO_ROOT, portfolioPath), 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }));

  return portfolioTexts;
}

function brokerFetchError(label, result) {
  return new Error(`${label} fetch failed: ${brokerFailureReason(result)}`);
}

function ninjaClientOptions(config) {
  const options = {
    account: config?.ninjatrader?.account ?? process.env.NINJATRADER_ACCOUNT ?? 'Sim101',
    waitForFeedback: config?.ninjatrader?.wait_for_feedback === true,
  };
  const documentsRoot = String(config?.ninjatrader?.documents_root ?? '').trim();
  if (documentsRoot) {
    options.documentsRoot = documentsRoot;
  }
  const connectionName = String(config?.ninjatrader?.connection_name ?? '').trim();
  if (connectionName) {
    options.connectionName = connectionName;
  }
  return options;
}

function mergeAccountTelemetry({ alpacaAccount, ninjaAccount, openOrders }) {
  const account = {
    equity: alpacaAccount?.equity,
    open_orders: openOrders,
    venues: {
      alpaca_paper: alpacaAccount ?? {},
      ninjatrader_sim: ninjaAccount ?? {},
    },
  };
  for (const field of ['daily_realized_loss', 'daily_realized_loss_usd', 'daily_realized_pnl', 'last_equity']) {
    copyAccountTelemetry(account, alpacaAccount, field);
  }
  return account;
}

function clearReconciliationFreezeIfHealthy(riskState, report) {
  if (
    report?.status !== 'error' &&
    riskState?.frozen === true &&
    riskState?.freeze_source === 'reconciliation'
  ) {
    return {
      ...riskState,
      frozen: false,
      freeze_reason: '',
      freeze_source: '',
    };
  }

  return { ...(riskState ?? {}) };
}

export function applyPositionSyncHealthRiskState({
  riskState = {},
  report = {},
  generatedAt = new Date().toISOString(),
} = {}) {
  const staleFeedbackRows = asArray(report?.divergences).filter(
    (row) => row?.reason === 'stale_ninjatrader_feedback',
  );
  const currentSource = String(riskState?.freeze_source ?? '').trim();

  if (staleFeedbackRows.length) {
    if (riskState?.frozen === true && currentSource === 'kill_switch') {
      return { ...(riskState ?? {}) };
    }

    const labels = [
      ...new Set(staleFeedbackRows.map((row) => row?.symbol || row?.instrument).filter(Boolean)),
    ];
    return {
      ...(riskState ?? {}),
      frozen: true,
      freeze_source: 'ninjatrader_feedback',
      freeze_reason: `NinjaTrader feedback missing for ${labels.length ? labels.join(', ') : `${staleFeedbackRows.length} order${staleFeedbackRows.length === 1 ? '' : 's'}`}`,
      freeze_started_at:
        currentSource === 'ninjatrader_feedback'
          ? riskState?.freeze_started_at ?? generatedAt
          : generatedAt,
    };
  }

  if (riskState?.frozen === true && currentSource === 'ninjatrader_feedback') {
    return {
      ...(riskState ?? {}),
      frozen: false,
      freeze_reason: '',
      freeze_source: '',
      freeze_started_at: '',
    };
  }

  return { ...(riskState ?? {}) };
}

function buildPositionSyncReport({
  generatedAt,
  targetPortfolio,
  routedTargets,
  divergences,
  skipped,
  orders,
  decisions,
  alpacaPositions,
  alpacaOpenOrders,
  ninjaPositions,
  ninjaOpenOrders,
  ninjaPendingOrders,
  killSwitch,
} = {}) {
  const divergenceRows = [...asArray(divergences), ...asArray(skipped)];
  return {
    generated_at: generatedAt,
    execution_model: 'position-sync',
    status: divergenceRows.length > 0 ? 'warning' : 'ok',
    freeze_reason: '',
    target_count: asArray(targetPortfolio?.targets).length,
    routed_target_count: asArray(routedTargets).length,
    planned_order_count: asArray(orders).length,
    submitted_count: asArray(decisions).filter((decision) => decision.decision === 'submitted').length,
    blocked_count: asArray(decisions).filter((decision) => decision.decision === 'blocked').length,
    broker_rejected_count: asArray(decisions).filter((decision) => decision.decision === 'broker_rejected').length,
    divergences: divergenceRows,
    target_scaling: targetPortfolio?.scaling ?? null,
    targets: asArray(targetPortfolio?.targets),
    routed_targets: asArray(routedTargets),
    planned_orders: asArray(orders),
    decisions: asArray(decisions),
    broker_positions: {
      alpaca_paper: asArray(alpacaPositions),
      ninjatrader_sim: asArray(ninjaPositions),
    },
    open_orders: {
      alpaca_paper: asArray(alpacaOpenOrders),
      ninjatrader_sim: asArray(ninjaOpenOrders),
    },
    pending_orders: {
      ninjatrader_sim: asArray(ninjaPendingOrders),
    },
    kill_switch: killSwitch ?? { active: false },
  };
}

async function writeAlertArtifacts({
  generatedAt,
  heartbeat,
  statusText,
  riskState,
  reconciliation,
  decisions,
  killSwitch,
} = {}) {
  const alerts = buildSentinelAlerts({
    now: generatedAt,
    heartbeat,
    statusText,
    riskState,
    reconciliation,
    decisions,
    killSwitch,
  });
  await writeJson('data/sentinel/alerts.json', {
    generated_at: generatedAt,
    status: worstAlertSeverity(alerts),
    alerts,
  });
}

async function runPositionSyncTick({
  generatedAt,
  config,
  allocation,
  storedRiskState,
  killSwitch,
  existingLedgerEvents = [],
} = {}) {
  const portfolioTexts = await loadAllocatedPortfolioSnapshots(allocation, STRATEGIES);
  const riskEquity = positiveNumber(config.total_capital_usd, 100000);
  const grossCap = (riskEquity * numeric(config.max_gross_exposure_pct, 100)) / 100;
  const targetPortfolio = buildTargetPortfolio({
    allocation,
    strategies: STRATEGIES,
    portfolioTexts,
    totalCapitalUsd: positiveNumber(config.total_capital_usd, 100000),
    maxGrossExposureUsd: config.scale_targets_to_gross_cap === false ? null : grossCap,
  });
  const routed = routeTargetPortfolio({ targets: targetPortfolio.targets, config, now: generatedAt });

  const alpacaBroker = createAlpacaPaperClient();
  const ninjaBroker = createNinjaTraderSimClient(ninjaClientOptions(config));

  const accountResult = await alpacaBroker.getAccount();
  if (!accountResult.ok) {
    throw brokerFetchError('Alpaca account', accountResult);
  }

  const alpacaPositionsResult = await alpacaBroker.getPositions();
  if (!alpacaPositionsResult.ok) {
    throw brokerFetchError('Alpaca positions', alpacaPositionsResult);
  }

  const alpacaOrdersResult = await alpacaBroker.getOrders();
  if (!alpacaOrdersResult.ok) {
    throw brokerFetchError('Alpaca orders', alpacaOrdersResult);
  }

  const ninjaAccountResult = await ninjaBroker.getAccount();
  if (!ninjaAccountResult.ok) {
    throw brokerFetchError('NinjaTrader account', ninjaAccountResult);
  }

  const ninjaPositionsResult = await ninjaBroker.getPositions();
  if (!ninjaPositionsResult.ok) {
    throw brokerFetchError('NinjaTrader positions', ninjaPositionsResult);
  }

  const ninjaOrdersResult = await ninjaBroker.getOrders();
  if (!ninjaOrdersResult.ok) {
    throw brokerFetchError('NinjaTrader orders', ninjaOrdersResult);
  }

  const alpacaPositions = asArray(alpacaPositionsResult.positions);
  const ninjaPositions = asArray(ninjaPositionsResult.positions);
  const openOrders = asArray(alpacaOrdersResult.orders);
  const ninjaOpenOrders = asArray(ninjaOrdersResult.orders);

  // Sync terminal NinjaTrader feedback (fills/rejections) into the ledger so
  // pending-order tracking and reject cooldowns see broker outcomes.
  const feedbackEvents = buildNinjaFeedbackLedgerEvents({
    ledgerEvents: existingLedgerEvents,
    ninjaOrders: ninjaOpenOrders,
    now: generatedAt,
  });
  for (const event of feedbackEvents) {
    await appendJsonl(path.join(SENTINEL_DIR, 'execution_ledger.jsonl'), event);
    existingLedgerEvents.push(event);
  }

  const effectiveRiskState = applyKillSwitchRiskState(storedRiskState, killSwitch, generatedAt);
  const account = mergeAccountTelemetry({
    alpacaAccount: accountResult.account,
    ninjaAccount: ninjaAccountResult.account,
    openOrders,
  });
  const rebalance = buildRebalanceOrders({
    routedTargets: routed.routedTargets,
    alpacaPositions,
    alpacaOpenOrders: openOrders,
    ninjaPositions,
    ninjaOrders: ninjaOpenOrders,
    ledgerEvents: existingLedgerEvents,
    config,
    now: generatedAt,
  });
  const targetGrossExposureUsd = targetPortfolio.targets.reduce(
    (total, target) => total + Math.abs(numeric(target.target_notional_usd)),
    0,
  );
  const preProcessHealthReport = {
    divergences: [...routed.divergences, ...rebalance.skipped],
  };
  const preProcessRiskState = applyPositionSyncHealthRiskState({
    riskState: effectiveRiskState,
    report: preProcessHealthReport,
    generatedAt,
  });
  const processed = await processPositionSyncOrders({
    orders: rebalance.orders,
    brokers: {
      'alpaca-paper': alpacaBroker,
      'ninjatrader-sim': ninjaBroker,
    },
    config,
    riskState: preProcessRiskState,
    account,
    targetGrossExposureUsd,
    ledgerEvents: existingLedgerEvents,
    onLedgerEvent: (event) => appendJsonl(path.join(SENTINEL_DIR, 'execution_ledger.jsonl'), event),
    now: generatedAt,
  });
  const divergenceEvents = [
    ...routed.divergences,
    ...rebalance.skipped,
  ].map((event) => ({ ...event, at: generatedAt }));

  await appendAllJsonl('data/sentinel/trade_tickets.jsonl', processed.decisions);

  const report = buildPositionSyncReport({
    generatedAt,
    targetPortfolio,
    routedTargets: routed.routedTargets,
    divergences: divergenceEvents,
    skipped: targetPortfolio.skipped,
    orders: rebalance.orders,
    decisions: processed.decisions,
    alpacaPositions,
    alpacaOpenOrders: openOrders,
    ninjaPositions,
    ninjaOpenOrders,
    ninjaPendingOrders: rebalance.pendingOrders,
    killSwitch,
  });
  const nextRiskState = {
    ...applyPositionSyncHealthRiskState({
      riskState: clearReconciliationFreezeIfHealthy(preProcessRiskState, report),
      report,
      generatedAt,
    }),
    generated_at: generatedAt,
    paper_auto_submit_enabled: config.paper_auto_submit_enabled,
    position_sync_auto_submit_enabled: config.position_sync_auto_submit_enabled,
    live_trading_enabled: config.live_trading_enabled,
  };

  await writeJson('data/sentinel/reconciliation_report.json', report);
  await writeJson('data/sentinel/risk_state.json', nextRiskState);
  const statusText = buildSentinelStatusMarkdown({
      generatedAt,
      decisions: processed.decisions,
      riskState: nextRiskState,
      executionModel: 'position-sync',
      targetCount: targetPortfolio.targets.length,
      routedTargetCount: routed.routedTargets.length,
      plannedOrders: rebalance.orders.length,
      divergences: divergenceEvents,
      skipped: targetPortfolio.skipped,
    });
  await writeFile(path.join(SENTINEL_DIR, 'sentinel_status.md'), statusText, 'utf8');
  await writeAlertArtifacts({
    generatedAt,
    heartbeat: await readJson('data/sentinel/heartbeat.json', {}),
    statusText,
    riskState: nextRiskState,
    reconciliation: report,
    decisions: processed.decisions,
    killSwitch,
  });
}

async function runSentinelTick() {
  const generatedAt = new Date().toISOString();
  await loadLocalEnvFiles();
  const config = loadSentinelConfigFromText(
    await readFile(path.join(SENTINEL_DIR, 'config.json'), 'utf8'),
  );
  const allocation = await readJson('data/sentinel/allocation.json', { strategies: [] });
  const storedRiskState = await readJson('data/sentinel/risk_state.json', { frozen: false });
  const killSwitch = await readKillSwitch({ sentinelDir: SENTINEL_DIR, now: generatedAt });
  await writeJson('data/sentinel/kill_switch.json', killSwitch);
  const existingLedgerEvents = await readJsonlFile(path.join(SENTINEL_DIR, 'execution_ledger.jsonl'), {
    tolerateMalformed: true,
  });
  if (config.execution_model === 'position-sync') {
    await runPositionSyncTick({
      generatedAt,
      config,
      allocation,
      storedRiskState,
      killSwitch,
      existingLedgerEvents,
    });
    return;
  }

  const inboxTickets = await readJsonlFile(path.join(SENTINEL_DIR, 'ticket_inbox.jsonl'));
  const recentTickets = await readJsonlFile(path.join(SENTINEL_DIR, 'trade_tickets.jsonl'));
  const generationWindow = buildLeaderboardGenerationWindow({ generatedAt, config });
  const leaderboardTicketBatch = buildLeaderboardTickets({
    allocation,
    strategies: STRATEGIES,
    tradeLogs: await loadLeaderboardTradeLogs(allocation, STRATEGIES),
    existingRecords: [...inboxTickets, ...recentTickets, ...existingLedgerEvents],
    since: generationWindow.since,
    until: generationWindow.until,
    defaultNotionalUsd: positiveNumber(
      config.leaderboard_ticket_notional_usd,
      DEFAULT_LEADERBOARD_TICKET_NOTIONAL_USD,
    ),
  });
  const tickets = buildTickTickets({
    inboxTickets,
    leaderboardTickets: leaderboardTicketBatch.tickets,
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
  const effectiveStoredRiskState = applyKillSwitchRiskState(storedRiskState, killSwitch, generatedAt);
  const preProcessReconciliation = buildReconciliationUpdate({
    ledgerEvents: existingLedgerEvents,
    brokerPositions,
    riskState: effectiveStoredRiskState,
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
    supportedSymbols: SENTINEL_SUPPORTED_SYMBOLS,
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
    ...applyKillSwitchRiskState(postProcessReconciliation.riskState, killSwitch, generatedAt),
    generated_at: generatedAt,
    paper_auto_submit_enabled: config.paper_auto_submit_enabled,
    live_trading_enabled: config.live_trading_enabled,
  };

  await writeJson('data/sentinel/reconciliation_report.json', postProcessReconciliation.report);
  await writeJson('data/sentinel/risk_state.json', nextRiskState);
  const statusText = buildSentinelStatusMarkdown({
      generatedAt,
      decisions: processed.decisions,
      riskState: nextRiskState,
      generatedLeaderboardTickets: leaderboardTicketBatch.tickets.length,
    });
  await writeFile(path.join(SENTINEL_DIR, 'sentinel_status.md'), statusText, 'utf8');
  await writeAlertArtifacts({
    generatedAt,
    heartbeat: await readJson('data/sentinel/heartbeat.json', {}),
    statusText,
    riskState: nextRiskState,
    reconciliation: postProcessReconciliation.report,
    decisions: processed.decisions,
    killSwitch,
  });
}

async function main() {
  const lock = await acquireTickLock({
    lockPath: path.join(SENTINEL_DIR, 'sentinel_tick.lock'),
    staleMs: DEFAULT_TICK_LOCK_STALE_MS,
  });

  if (!lock.acquired) {
    console.log(`sentinel tick skipped: ${lock.reason}`);
    return;
  }

  try {
    if (lock.reclaimed) {
      console.log(`sentinel tick reclaimed lock: ${lock.reclaimReason}`);
    }
    await runSentinelTick();
  } finally {
    await lock.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(redactKnownSecrets(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
