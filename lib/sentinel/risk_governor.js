import { normalizeSymbolForAlpaca, validateTicket } from './ticket_schema.js';

const PAPER_ACTION = 'auto-submit paper order';
const BLOCK_ACTION = 'block';
const CLOSE_EXPOSURE_TOLERANCE = 0.000001;

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

function configuredFiniteNumber(config, key, reasons) {
  const value = config?.[key];
  let parsed = null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    parsed = value;
  }

  if (parsed === null && typeof value === 'string' && value.trim() !== '') {
    const number = Number(value);
    parsed = Number.isFinite(number) ? number : null;
  }

  if (parsed === null) {
    reasons.push(`${key} must be a finite number`);
    return null;
  }

  if (parsed < 0) {
    reasons.push(`${key} must be non-negative`);
    return null;
  }

  return parsed;
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

function telemetryNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function dailyRealizedLoss(account, riskState) {
  for (const source of [account, riskState]) {
    for (const field of ['daily_realized_loss', 'daily_realized_loss_usd']) {
      if (Object.hasOwn(source ?? {}, field)) {
        const loss = telemetryNumber(source[field]);
        return loss === null ? { ok: false, loss: null } : { ok: true, loss: Math.max(0, loss) };
      }
    }

    if (Object.hasOwn(source ?? {}, 'daily_realized_pnl')) {
      const pnl = telemetryNumber(source.daily_realized_pnl);
      return pnl === null ? { ok: false, loss: null } : { ok: true, loss: Math.max(0, -pnl) };
    }
  }

  const equity = telemetryNumber(account?.equity);
  const lastEquity = telemetryNumber(account?.last_equity);
  if (equity !== null && lastEquity !== null) {
    return { ok: true, loss: Math.max(0, lastEquity - equity) };
  }

  return { ok: false, loss: null };
}

function existingSymbolExposure(positions, ticketSymbol) {
  return asArray(positions)
    .filter((position) => normalizeSymbolForAlpaca(position?.symbol) === ticketSymbol)
    .reduce((total, position) => total + Math.abs(finiteNumber(position?.market_value)), 0);
}

function signedMarketValue(position) {
  return finiteNumber(position?.market_value);
}

function absoluteMarketValue(position) {
  return Math.abs(signedMarketValue(position));
}

function symbolPositions(positions, ticketSymbol) {
  return asArray(positions)
    .filter((position) => normalizeSymbolForAlpaca(position?.symbol) === ticketSymbol);
}

function symbolSignedExposure(positions, ticketSymbol) {
  return symbolPositions(positions, ticketSymbol)
    .reduce((total, position) => total + signedMarketValue(position), 0);
}

function grossExposure(positions) {
  return asArray(positions).reduce((total, position) => total + absoluteMarketValue(position), 0);
}

function strategyExposure(positions, strategy) {
  return asArray(positions)
    .filter((position) => position?.strategy === strategy)
    .reduce((total, position) => total + absoluteMarketValue(position), 0);
}

function hasUnattributedExposure(positions) {
  return asArray(positions).some(
    (position) =>
      absoluteMarketValue(position) > 0 &&
      String(position?.strategy ?? '').trim() === '',
  );
}

function ticketDirection(ticket) {
  return ticket?.side === 'sell' ? -1 : 1;
}

function closeExposureScope(ticket, positions, ticketSymbol) {
  const allSymbolPositions = symbolPositions(positions, ticketSymbol);
  const strategyPositions = allSymbolPositions.filter((position) => position?.strategy === ticket.strategy);
  return strategyPositions.length > 0 ? strategyPositions : allSymbolPositions;
}

function closeExposureCheck(ticket, positions, ticketSymbol) {
  if (ticket?.intent !== 'close') {
    return { reducing: false, overClose: false, exposure: 0 };
  }

  const scopedPositions = closeExposureScope(ticket, positions, ticketSymbol);
  const signedExposure = scopedPositions.reduce(
    (total, position) => total + signedMarketValue(position),
    0,
  );
  const exposure = Math.abs(signedExposure);
  const reducing = signedExposure !== 0 && Math.sign(signedExposure) !== ticketDirection(ticket);

  return {
    reducing,
    invalidClose: !reducing,
    overClose: reducing && ticket.notional_usd > exposure + CLOSE_EXPOSURE_TOLERANCE,
    exposure,
  };
}

function projectedExposureAmount(currentExposure, ticket, reducing) {
  if (reducing) {
    return Math.max(0, currentExposure - ticket.notional_usd);
  }

  return currentExposure + ticket.notional_usd;
}

function eventTimeMs(value) {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : null;
}

function recentOrdersForSymbol(ticket, recentTickets, referenceTime) {
  const ticketTime = eventTimeMs(ticket.created_at);
  const contextTime = eventTimeMs(referenceTime);
  if (ticketTime === null && contextTime === null) {
    return 0;
  }

  const cutoffTime = Math.max(ticketTime ?? Number.NEGATIVE_INFINITY, contextTime ?? Number.NEGATIVE_INFINITY);
  const ticketSymbol = normalizeSymbolForAlpaca(ticket.symbol);
  const oneHourMs = 60 * 60 * 1000;

  return asArray(recentTickets).filter((recentTicket) => {
    if (!isSubmitAttemptRecord(recentTicket)) {
      return false;
    }

    if (normalizeSymbolForAlpaca(recentTicket?.symbol) !== ticketSymbol) {
      return false;
    }

    const recentTime = eventTimeMs(
      recentTicket?.processed_at ?? recentTicket?.created_at ?? recentTicket?.at,
    );
    return recentTime !== null && recentTime <= cutoffTime && cutoffTime - recentTime < oneHourMs;
  }).length;
}

function isSubmitAttemptRecord(record) {
  const decision = String(record?.decision ?? '').trim();
  const type = String(record?.type ?? '').trim();
  const status = String(record?.status ?? '').trim();

  return (
    decision === 'submitted' ||
    decision === 'broker_rejected' ||
    type === 'order_submitted' ||
    type === 'order_rejected' ||
    status === 'submitted' ||
    status === 'broker_rejected'
  );
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
  const maxGrossExposurePct = configuredFiniteNumber(config, 'max_gross_exposure_pct', reasons);
  const maxStrategyWeightPct = configuredFiniteNumber(config, 'max_strategy_weight_pct', reasons);
  const maxSymbolExposurePct = configuredFiniteNumber(config, 'max_symbol_exposure_pct', reasons);
  const maxDailyLossPct = configuredFiniteNumber(config, 'max_daily_loss_pct', reasons);
  const maxOpenOrders = configuredFiniteNumber(config, 'max_open_orders', reasons);
  const maxOrdersPerSymbolPerHour = configuredFiniteNumber(
    config,
    'max_orders_per_symbol_per_hour',
    reasons,
  );
  const positions = Array.isArray(context?.positions) ? context.positions : account.positions;
  const closeCheck = closeExposureCheck(ticket, positions, ticketSymbol);
  const reducing = closeCheck.reducing && !closeCheck.overClose;
  if (closeCheck.invalidClose) {
    reasons.push('close ticket does not reduce existing exposure');
  }
  if (closeCheck.overClose) {
    reasons.push(
      `close notional ${formatAmount(ticket.notional_usd)} exceeds existing exposure ${formatAmount(closeCheck.exposure)}`,
    );
  }
  const projectedSymbolExposure = projectedExposureAmount(
    existingSymbolExposure(positions, ticketSymbol),
    ticket,
    reducing,
  );

  if (!reducing && maxSymbolExposurePct !== null) {
    const symbolExposureCap = (equity * maxSymbolExposurePct) / 100;
    if (projectedSymbolExposure > symbolExposureCap) {
      reasons.push(
        `symbol exposure ${formatAmount(projectedSymbolExposure)} exceeds cap ${formatAmount(symbolExposureCap)}`,
      );
    }
  }

  if (maxStrategyWeightPct !== null && hasUnattributedExposure(positions)) {
    reasons.push(
      'existing exposure lacks strategy attribution for strategy weight cap',
    );
  }

  if (!reducing && maxGrossExposurePct !== null) {
    const grossExposureCap = (equity * maxGrossExposurePct) / 100;
    const projectedGrossExposure = projectedExposureAmount(grossExposure(positions), ticket, reducing);
    if (projectedGrossExposure > grossExposureCap) {
      reasons.push(
        `gross exposure ${formatAmount(projectedGrossExposure)} exceeds cap ${formatAmount(grossExposureCap)}`,
      );
    }
  }

  if (!reducing && maxStrategyWeightPct !== null) {
    const strategyWeightCap = (equity * maxStrategyWeightPct) / 100;
    const projectedStrategyExposure = projectedExposureAmount(
      strategyExposure(positions, ticket.strategy),
      ticket,
      reducing,
    );
    if (projectedStrategyExposure > strategyWeightCap) {
      reasons.push(
        `strategy weight ${formatAmount(projectedStrategyExposure)} exceeds cap ${formatAmount(strategyWeightCap)}`,
      );
    }
  }

  if (maxDailyLossPct !== null) {
    const dailyLossCap = (equity * maxDailyLossPct) / 100;
    const realizedLoss = dailyRealizedLoss(account, riskState);
    if (!realizedLoss.ok) {
      reasons.push('daily loss telemetry must be finite');
    } else if (realizedLoss.loss >= dailyLossCap) {
      reasons.push(
        `daily realized loss ${formatAmount(realizedLoss.loss)} is at or beyond cap ${formatAmount(dailyLossCap)}`,
      );
    }
  }

  const openOrderCount = asArray(account.open_orders).length;
  if (maxOpenOrders !== null && openOrderCount >= maxOpenOrders) {
    reasons.push(`open orders ${openOrderCount} at or above cap ${formatAmount(maxOpenOrders)}`);
  }

  if (maxOrdersPerSymbolPerHour !== null) {
    const recentSymbolOrders = recentOrdersForSymbol(ticket, context?.recentTickets, context?.now);
    if (recentSymbolOrders >= maxOrdersPerSymbolPerHour) {
      reasons.push(
        `orders for ${ticketSymbol} in the past hour ${recentSymbolOrders} at or above cap ${formatAmount(maxOrdersPerSymbolPerHour)}`,
      );
    }
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
