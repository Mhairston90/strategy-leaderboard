import { normalizeSymbolForAlpaca } from './ticket_schema.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
  return Number(Number(value).toFixed(2));
}

function parseTimeMs(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanIdPart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function syncOrderId({ venue, symbol, side, key }) {
  return ['sentinel-sync', venue, cleanIdPart(symbol), side, cleanIdPart(key)]
    .filter(Boolean)
    .join('-')
    .slice(0, 80);
}

function driftThreshold(targetNotional, config) {
  const pct = finiteNumber(config?.drift_band_pct, 0.2);
  const minOrderUsd = finiteNumber(config?.min_order_usd, 25);
  return Math.max(Math.abs(targetNotional) * pct, minOrderUsd);
}

function openOrderSignedNotional(order, referencePrice) {
  const status = String(order?.status ?? '').trim().toLowerCase();
  if (['canceled', 'cancelled', 'expired', 'filled', 'rejected'].includes(status)) {
    return 0;
  }

  const explicitNotional = finiteNumber(order?.notional ?? order?.notional_usd);
  const qty = finiteNumber(order?.qty ?? order?.quantity);
  const notional = explicitNotional > 0 ? explicitNotional : qty > 0 ? qty * finiteNumber(referencePrice) : 0;
  if (notional <= 0) {
    return 0;
  }

  const side = String(order?.side ?? '').trim().toLowerCase();
  if (side === 'sell') {
    return -notional;
  }
  if (side === 'buy') {
    return notional;
  }
  return 0;
}

function openOrderSignedShares(order) {
  const status = String(order?.status ?? '').trim().toLowerCase();
  if (['canceled', 'cancelled', 'expired', 'filled', 'rejected'].includes(status)) {
    return 0;
  }

  const qty = finiteNumber(order?.qty ?? order?.quantity);
  if (qty <= 0) {
    return 0;
  }

  const side = String(order?.side ?? '').trim().toLowerCase();
  if (side === 'sell') {
    return -qty;
  }
  if (side === 'buy') {
    return qty;
  }
  return 0;
}

function alpacaOpenOrderNotional(openOrders, symbol, referencePrice) {
  const normalized = normalizeSymbolForAlpaca(symbol);
  return asArray(openOrders)
    .filter((order) => normalizeSymbolForAlpaca(order?.symbol) === normalized)
    .reduce((total, order) => total + openOrderSignedNotional(order, referencePrice), 0);
}

function alpacaPositionOnlyNotional(positions, symbol) {
  const normalized = normalizeSymbolForAlpaca(symbol);
  return asArray(positions)
    .filter((position) => normalizeSymbolForAlpaca(position?.symbol) === normalized)
    .reduce((total, position) => total + finiteNumber(position?.market_value), 0);
}

function alpacaPositionNotional(positions, openOrders, symbol, referencePrice) {
  const positionNotional = alpacaPositionOnlyNotional(positions, symbol);
  return positionNotional + alpacaOpenOrderNotional(openOrders, symbol, referencePrice);
}

function alpacaPositionSignedShares(positions, symbol, referencePrice) {
  const normalized = normalizeSymbolForAlpaca(symbol);
  const fallbackPrice = finiteNumber(referencePrice);
  return asArray(positions)
    .filter((position) => normalizeSymbolForAlpaca(position?.symbol) === normalized)
    .reduce((total, position) => {
      const qty = finiteNumber(position?.qty);
      const side = String(position?.side ?? '').trim().toLowerCase();
      if (qty > 0 && side === 'short') {
        return total - qty;
      }
      if (qty > 0 && side === 'long') {
        return total + qty;
      }
      const marketValue = finiteNumber(position?.market_value);
      return fallbackPrice > 0 ? total + marketValue / fallbackPrice : total;
    }, 0);
}

function alpacaOpenOrderSignedShares(openOrders, symbol) {
  const normalized = normalizeSymbolForAlpaca(symbol);
  return asArray(openOrders)
    .filter((order) => normalizeSymbolForAlpaca(order?.symbol) === normalized)
    .reduce((total, order) => total + openOrderSignedShares(order), 0);
}

function pendingOrdersExceedSameDirectionTarget({
  targetNotional,
  positionNotional,
  pendingNotional,
  threshold,
}) {
  if (Math.abs(positionNotional) > 1) {
    return false;
  }
  if (Math.sign(targetNotional) === 0 || Math.sign(pendingNotional) !== Math.sign(targetNotional)) {
    return false;
  }
  return Math.abs(pendingNotional) - Math.abs(targetNotional) > threshold;
}

function ninjaSignedContracts(position) {
  const side = String(position?.market_position ?? '').trim().toLowerCase();
  const qty = finiteNumber(position?.qty);
  if (side === 'long') {
    return qty;
  }
  if (side === 'short') {
    return -qty;
  }
  return 0;
}

function ninjaPositionByInstrument(positions, instrument) {
  return asArray(positions).find((position) => position?.instrument === instrument) ?? null;
}

function terminalNinjaOrderIds(orders) {
  const terminalStatuses = new Set(['filled', 'rejected', 'cancelled', 'canceled', 'expired']);
  return new Set(
    asArray(orders)
      .filter((order) => terminalStatuses.has(String(order?.status ?? '').trim().toLowerCase()))
      .map((order) => String(order?.id ?? order?.order_id ?? '').trim())
      .filter(Boolean),
  );
}

function terminalNinjaLedgerKeys(events) {
  // Terminal state is tracked per broker_order_id ONLY. Source signal ids are
  // deterministic per target state, so treating a rejected source as terminal
  // would permanently hide every later submission that shares it — this is the
  // exact defect behind the 2026-07-02 resubmission storm.
  const ids = new Set();
  for (const event of asArray(events)) {
    const venue = String(event?.venue ?? event?.broker ?? '').trim();
    if (!['order_rejected', 'order_filled'].includes(event?.type) || venue !== 'ninjatrader-sim') {
      continue;
    }
    const brokerOrderId = String(event?.broker_order_id ?? '').trim();
    if (brokerOrderId) {
      ids.add(brokerOrderId);
    }
  }
  return { ids };
}

function parseTargetContractsFromSource(sourceSignalId) {
  const text = String(sourceSignalId ?? '').trim();
  const match = /:([+-]?\d+)\s*$/.exec(text);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function signedOrderContracts(event) {
  const qty = finiteNumber(event?.quantity ?? event?.qty);
  const side = String(event?.side ?? '').trim().toLowerCase();
  if (qty <= 0) {
    return 0;
  }
  if (side === 'sell') {
    return -qty;
  }
  if (side === 'buy') {
    return qty;
  }
  return 0;
}

function pendingOrderTtlMs(config) {
  const minutes = finiteNumber(config?.ninjatrader?.pending_order_ttl_minutes, 15);
  return Math.max(1, minutes) * 60 * 1000;
}

function pendingNinjaOrdersForTarget({
  ledgerEvents,
  ninjaOrders,
  target,
  currentContracts,
  notionalPerContract,
  now,
  config,
}) {
  const terminalOrderIds = terminalNinjaOrderIds(ninjaOrders);
  const terminalLedger = terminalNinjaLedgerKeys(ledgerEvents);
  const nowMs = parseTimeMs(now) ?? Date.now();
  const ttlMs = pendingOrderTtlMs(config);
  const bySource = new Map();

  for (const event of asArray(ledgerEvents)) {
    const venue = String(event?.venue ?? event?.broker ?? '').trim();
    if (event?.type !== 'order_submitted' || venue !== 'ninjatrader-sim') {
      continue;
    }
    if (String(event?.instrument ?? '').trim() !== String(target?.instrument ?? '').trim()) {
      continue;
    }

    const brokerOrderId = String(event?.broker_order_id ?? '').trim();
    const sourceSignalId = String(event?.source_signal_id ?? '').trim();
    if (brokerOrderId && (terminalOrderIds.has(brokerOrderId) || terminalLedger.ids.has(brokerOrderId))) {
      continue;
    }

    const sourceKey = sourceSignalId || brokerOrderId || `${event?.instrument}:${event?.side}:${event?.quantity}`;
    if (!sourceKey) {
      continue;
    }

    const submittedMs = parseTimeMs(event?.at);
    const existing = bySource.get(sourceKey);
    if (existing && submittedMs !== null && existing.submittedMs !== null && submittedMs >= existing.submittedMs) {
      continue;
    }
    if (existing && submittedMs === null) {
      continue;
    }

    bySource.set(sourceKey, {
      event,
      submittedMs,
    });
  }

  const rows = [];
  for (const { event, submittedMs } of bySource.values()) {
    const targetContracts = parseTargetContractsFromSource(event?.source_signal_id);
    if (targetContracts !== null && targetContracts === currentContracts) {
      continue;
    }

    const pendingContracts =
      targetContracts !== null ? targetContracts - currentContracts : signedOrderContracts(event);
    if (pendingContracts === 0) {
      continue;
    }

    const ageMs = submittedMs === null ? Number.POSITIVE_INFINITY : Math.max(0, nowMs - submittedMs);
    const status = ageMs > ttlMs ? 'stale_feedback' : 'pending_feedback';
    rows.push({
      id: String(event?.broker_order_id ?? '').trim() || null,
      broker_order_id: String(event?.broker_order_id ?? '').trim() || null,
      ticket_id: event?.ticket_id ?? null,
      source_signal_id: event?.source_signal_id ?? null,
      symbol: target.symbol,
      instrument: target.instrument,
      venue: 'ninjatrader-sim',
      side: pendingContracts >= 0 ? 'buy' : 'sell',
      quantity: Math.abs(pendingContracts),
      status,
      submitted_at: event?.at ?? null,
      age_minutes: Number((ageMs / 60000).toFixed(2)),
      target_contracts: targetContracts,
      pending_contracts: pendingContracts,
      notional_usd: roundMoney(Math.abs(pendingContracts) * notionalPerContract),
    });
  }

  rows.sort((left, right) => String(left.submitted_at ?? '').localeCompare(String(right.submitted_at ?? '')));
  return rows;
}

function alpacaOrder({ target, currentNotional, delta, now }) {
  const side = delta >= 0 ? 'buy' : 'sell';
  let notional = roundMoney(Math.abs(delta));
  let quantity = null;
  if (target.asset_class === 'us_equity' && side === 'sell') {
    const referencePrice = finiteNumber(target.reference_price_usd);
    if (referencePrice > 0) {
      quantity = Math.max(1, Math.round(notional / referencePrice));
      notional = roundMoney(quantity * referencePrice);
    }
  }
  const sourceSignalId = `position-sync:${target.venue}:${target.symbol}:${roundMoney(target.target_notional_usd)}`;
  return {
    ticket_id: syncOrderId({ venue: target.venue, symbol: target.symbol, side, key: sourceSignalId }),
    created_at: now,
    strategy: 'Sentinel Position Sync',
    symbol: target.symbol,
    asset_class: target.asset_class === 'us_equity' ? 'equity' : 'crypto',
    side,
    intent: 'rebalance',
    notional_usd: notional,
    quantity,
    order_type: 'market',
    time_in_force: target.asset_class === 'crypto' ? 'gtc' : 'day',
    reason: 'position-sync drift rebalance',
    source_signal_id: sourceSignalId,
    risk_status: 'pending',
    broker: 'alpaca-paper',
    venue: target.venue,
    current_notional_usd: roundMoney(currentNotional),
    target_notional_usd: roundMoney(target.target_notional_usd),
    delta_notional_usd: roundMoney(delta),
  };
}

function ninjaClientOrderId(ticketId, now) {
  const stamp = String(now ?? '').replace(/\D+/g, '') || String(Date.now());
  return `${String(ticketId).slice(0, 79 - stamp.length)}-${stamp}`.slice(0, 80);
}

function ninjaOrder({ target, currentContracts, targetContracts, deltaContracts, notionalPerContract, now }) {
  const side = deltaContracts >= 0 ? 'buy' : 'sell';
  const sourceSignalId = `position-sync:${target.venue}:${target.instrument}:${targetContracts}`;
  const ticketId = syncOrderId({ venue: target.venue, symbol: target.symbol, side, key: sourceSignalId });
  return {
    ticket_id: ticketId,
    client_order_id: ninjaClientOrderId(ticketId, now),
    created_at: now,
    strategy: 'Sentinel Position Sync',
    symbol: target.symbol,
    asset_class: 'crypto',
    side,
    intent: 'rebalance',
    notional_usd: roundMoney(Math.abs(deltaContracts) * notionalPerContract),
    quantity: Math.abs(deltaContracts),
    order_type: 'market',
    time_in_force: 'day',
    reason: 'position-sync futures contract rebalance',
    source_signal_id: sourceSignalId,
    risk_status: 'pending',
    broker: 'ninjatrader-sim',
    venue: target.venue,
    account: target.account,
    instrument: target.instrument,
    point_value: target.point_value,
    current_contracts: currentContracts,
    target_contracts: targetContracts,
    delta_contracts: deltaContracts,
  };
}

function divergence(target, reason) {
  return {
    type: 'divergence',
    symbol: target.symbol,
    target_notional_usd: target.target_notional_usd,
    reason,
  };
}

export function buildRebalanceOrders({
  routedTargets = [],
  alpacaPositions = [],
  alpacaOpenOrders = [],
  ninjaPositions = [],
  ninjaOrders = [],
  ledgerEvents = [],
  config = {},
  now = new Date().toISOString(),
} = {}) {
  const orders = [];
  const skipped = [];
  const pendingOrders = [];

  for (const target of asArray(routedTargets)) {
    const targetNotional = finiteNumber(target?.target_notional_usd);
    const threshold = driftThreshold(targetNotional, config);

    if (target?.venue === 'alpaca-paper') {
      const positionNotional = alpacaPositionOnlyNotional(alpacaPositions, target.symbol);
      const pendingNotional = alpacaOpenOrderNotional(
        alpacaOpenOrders,
        target.symbol,
        target.reference_price_usd,
      );
      const currentNotional = alpacaPositionNotional(
        alpacaPositions,
        alpacaOpenOrders,
        target.symbol,
        target.reference_price_usd,
      );
      if (
        pendingOrdersExceedSameDirectionTarget({
          targetNotional,
          positionNotional,
          pendingNotional,
          threshold,
        })
      ) {
        skipped.push(divergence(target, 'pending_alpaca_orders_exceed_target'));
        continue;
      }

      if (target.asset_class === 'us_equity' && targetNotional < 0 && finiteNumber(target.reference_price_usd) > 0) {
        const referencePrice = finiteNumber(target.reference_price_usd);
        const currentShares =
          alpacaPositionSignedShares(alpacaPositions, target.symbol, referencePrice) +
          alpacaOpenOrderSignedShares(alpacaOpenOrders, target.symbol);
        const targetShares = -Math.round(Math.abs(targetNotional) / referencePrice);
        const deltaShares = targetShares - currentShares;
        const shareDeltaNotional = deltaShares * referencePrice;
        if (deltaShares !== 0 && Math.abs(shareDeltaNotional) > threshold) {
          orders.push(alpacaOrder({ target, currentNotional, delta: shareDeltaNotional, now }));
        }
        continue;
      }

      const delta = targetNotional - currentNotional;
      if (Math.abs(delta) > threshold) {
        orders.push(alpacaOrder({ target, currentNotional, delta, now }));
      }
      continue;
    }

    if (target?.venue === 'ninjatrader-sim') {
      const pointValue = finiteNumber(target.point_value);
      const referencePrice = finiteNumber(target.reference_price_usd);
      const notionalPerContract = pointValue * referencePrice;
      if (notionalPerContract <= 0) {
        skipped.push(divergence(target, 'invalid_ninjatrader_contract_notional'));
        continue;
      }

      const currentPosition = ninjaPositionByInstrument(ninjaPositions, target.instrument);
      const currentContracts = ninjaSignedContracts(currentPosition);
      const pending = pendingNinjaOrdersForTarget({
        ledgerEvents,
        ninjaOrders,
        target,
        currentContracts,
        notionalPerContract,
        now,
        config,
      });
      pendingOrders.push(...pending);
      const stale = pending.filter((order) => order.status === 'stale_feedback');
      if (stale.length) {
        for (const order of stale) {
          skipped.push({
            ...divergence(target, 'stale_ninjatrader_feedback'),
            instrument: target.instrument,
            broker_order_id: order.broker_order_id,
            submitted_at: order.submitted_at,
            age_minutes: order.age_minutes,
          });
        }
        continue;
      }

      const effectiveContracts =
        currentContracts + pending.reduce((total, order) => total + finiteNumber(order.pending_contracts), 0);
      const currentNotional = effectiveContracts * notionalPerContract;
      const desiredAbsContracts = Math.round(Math.abs(targetNotional) / notionalPerContract);
      const targetContracts = Math.sign(targetNotional) * desiredAbsContracts;
      const deltaContracts = targetContracts - effectiveContracts;
      const drift = targetNotional - currentNotional;

      if (desiredAbsContracts === 0 && currentContracts === 0 && Math.abs(targetNotional) > 0) {
        skipped.push(divergence(target, 'below_one_ninjatrader_contract'));
        continue;
      }

      if (deltaContracts !== 0 && Math.abs(drift) > threshold) {
        orders.push(
          ninjaOrder({
            target,
            currentContracts: effectiveContracts,
            targetContracts,
            deltaContracts,
            notionalPerContract,
            now,
          }),
        );
      }
    }
  }

  return { orders, skipped, pendingOrders };
}
