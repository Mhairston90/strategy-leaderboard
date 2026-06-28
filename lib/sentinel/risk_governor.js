import { normalizeSymbolForAlpaca, validateTicket } from './ticket_schema.js';

const PAPER_ACTION = 'auto-submit paper order';
const BLOCK_ACTION = 'block';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function formatAmount(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function normalizedSymbolSet(symbols) {
  if (symbols instanceof Set) {
    return new Set([...symbols].map(normalizeSymbolForAlpaca));
  }

  return new Set(asArray(symbols).map(normalizeSymbolForAlpaca));
}

function dailyRealizedLoss(account, riskState) {
  for (const source of [account, riskState]) {
    for (const field of ['daily_realized_loss', 'daily_realized_loss_usd']) {
      if (typeof source?.[field] === 'number' && Number.isFinite(source[field])) {
        return Math.max(0, source[field]);
      }
    }

    if (typeof source?.daily_realized_pnl === 'number' && Number.isFinite(source.daily_realized_pnl)) {
      return Math.max(0, -source.daily_realized_pnl);
    }
  }

  return 0;
}

function existingSymbolExposure(positions, ticketSymbol) {
  return asArray(positions)
    .filter((position) => normalizeSymbolForAlpaca(position?.symbol) === ticketSymbol)
    .reduce((total, position) => total + Math.abs(finiteNumber(position?.market_value)), 0);
}

function hasDuplicateSourceSignal(ticket, recentTickets) {
  const ticketSymbol = normalizeSymbolForAlpaca(ticket.symbol);

  return asArray(recentTickets).some(
    (recentTicket) =>
      recentTicket?.source_signal_id === ticket.source_signal_id &&
      normalizeSymbolForAlpaca(recentTicket?.symbol) === ticketSymbol &&
      recentTicket?.strategy === ticket.strategy,
  );
}

export function evaluateTicketRisk(ticket, context = {}) {
  const validation = validateTicket(ticket);
  if (!validation.ok) {
    return {
      ok: false,
      action: BLOCK_ACTION,
      reasons: validation.errors,
    };
  }

  const config = context?.config ?? {};
  const riskState = context?.riskState ?? {};
  const account = context?.account ?? {};
  const ticketSymbol = normalizeSymbolForAlpaca(ticket.symbol);
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

  if (riskState.frozen) {
    const freezeReason =
      typeof riskState.freeze_reason === 'string' && riskState.freeze_reason.trim() !== ''
        ? `: ${riskState.freeze_reason.trim()}`
        : '';
    reasons.push(`risk state frozen${freezeReason}`);
  }

  if (!normalizedSymbolSet(context?.supportedSymbols).has(ticketSymbol)) {
    reasons.push(`unsupported symbol: ${ticketSymbol}`);
  }

  const equity = finiteNumber(account.equity);
  const symbolExposureCap = (equity * finiteNumber(config.max_symbol_exposure_pct)) / 100;
  const positions = Array.isArray(context?.positions) ? context.positions : account.positions;
  const projectedSymbolExposure =
    existingSymbolExposure(positions, ticketSymbol) + ticket.notional_usd;

  if (projectedSymbolExposure > symbolExposureCap) {
    reasons.push(
      `symbol exposure ${formatAmount(projectedSymbolExposure)} exceeds cap ${formatAmount(symbolExposureCap)}`,
    );
  }

  const dailyLossCap = (equity * finiteNumber(config.max_daily_loss_pct)) / 100;
  const realizedLoss = dailyRealizedLoss(account, riskState);
  if (realizedLoss >= dailyLossCap) {
    reasons.push(
      `daily realized loss ${formatAmount(realizedLoss)} is at or beyond cap ${formatAmount(dailyLossCap)}`,
    );
  }

  const maxOpenOrders = finiteNumber(config.max_open_orders, Number.POSITIVE_INFINITY);
  const openOrderCount = asArray(account.open_orders).length;
  if (openOrderCount >= maxOpenOrders) {
    reasons.push(`open orders ${openOrderCount} at or above cap ${formatAmount(maxOpenOrders)}`);
  }

  if (hasDuplicateSourceSignal(ticket, context?.recentTickets)) {
    reasons.push(`duplicate source signal: ${ticket.source_signal_id}`);
  }

  return {
    ok: reasons.length === 0,
    action: reasons.length === 0 ? PAPER_ACTION : BLOCK_ACTION,
    reasons,
  };
}
