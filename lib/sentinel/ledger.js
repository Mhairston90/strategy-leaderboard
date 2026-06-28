function toFiniteNumber(value) {
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function eventObject(event) {
  return event && typeof event === 'object' ? event : null;
}

function eventSymbol(event) {
  const symbol = String(event?.symbol ?? '').trim();
  return symbol || null;
}

function eventSide(event) {
  const side = String(event?.side ?? '').trim().toLowerCase();
  return side === 'buy' || side === 'sell' ? side : null;
}

function eventOrderId(event) {
  const brokerOrderId = event?.broker_order_id;
  if (brokerOrderId === null || brokerOrderId === undefined || brokerOrderId === '') {
    return null;
  }

  return String(brokerOrderId);
}

function eventReason(event) {
  const reason = String(event?.reason ?? '').trim();
  return reason || null;
}

function addAnomaly(anomalies, event, reasons) {
  anomalies.push({
    type: 'malformed_event',
    event_type: String(event?.type ?? ''),
    reason: reasons.join('; '),
    event: { ...event },
  });
}

function setOrderStatus(orders, event, status) {
  const brokerOrderId = eventOrderId(event);
  if (!brokerOrderId) {
    return;
  }

  orders.set(brokerOrderId, {
    ...(orders.get(brokerOrderId) ?? {}),
    ...event,
    broker_order_id: brokerOrderId,
    status,
  });
}

function applySubmitted(orders, anomalies, event) {
  const reasons = [];

  if (!eventOrderId(event)) {
    reasons.push('missing broker_order_id');
  }
  if (!eventSymbol(event)) {
    reasons.push('missing symbol');
  }
  if (!eventSide(event)) {
    reasons.push('missing side');
  }

  if (reasons.length > 0) {
    addAnomaly(anomalies, event, reasons);
    return;
  }

  setOrderStatus(orders, event, 'submitted');
}

function applyRejected(orders, rejections, anomalies, event) {
  const reasons = [];

  if (!eventSymbol(event)) {
    reasons.push('missing symbol');
  }
  if (!eventReason(event)) {
    reasons.push('missing reason');
  }

  const rejection = { ...event, status: 'rejected' };
  rejections.push(rejection);
  setOrderStatus(orders, rejection, 'rejected');

  if (reasons.length > 0) {
    addAnomaly(anomalies, event, reasons);
  }
}

function applyFill(orders, positions, anomalies, event) {
  const symbol = eventSymbol(event);
  const side = eventSide(event);
  const brokerOrderId = eventOrderId(event);
  const filledQty = toFiniteNumber(event?.filled_qty);
  const filledAvgPrice = toFiniteNumber(event?.filled_avg_price);
  const reasons = [];

  if (!brokerOrderId) {
    reasons.push('missing broker_order_id');
  }
  if (!symbol) {
    reasons.push('missing symbol');
  }
  if (!side) {
    reasons.push('missing side');
  }
  if (filledQty === null || filledQty <= 0) {
    reasons.push('invalid filled_qty');
  }
  if (filledAvgPrice === null) {
    reasons.push('invalid filled_avg_price');
  }

  if (reasons.length > 0) {
    addAnomaly(anomalies, event, reasons);
  }

  if (!symbol || !side || filledQty === null || filledQty <= 0 || filledAvgPrice === null) {
    return;
  }

  setOrderStatus(orders, event, 'filled');

  const existing = positions.get(symbol) ?? { symbol, qty: 0, market_value: 0, fill_value: 0 };
  const direction = side === 'sell' ? -1 : 1;
  const qty = existing.qty + direction * filledQty;
  const fillValue = existing.fill_value + direction * filledQty * filledAvgPrice;

  positions.set(symbol, {
    symbol,
    qty,
    market_value: fillValue,
    fill_value: fillValue,
  });
}

export function replayLedgerEvents(events = []) {
  const orders = new Map();
  const positions = new Map();
  const rejections = [];
  const anomalies = [];

  for (const rawEvent of Array.isArray(events) ? events : []) {
    const event = eventObject(rawEvent);
    if (!event) {
      continue;
    }

    if (event.type === 'order_submitted') {
      applySubmitted(orders, anomalies, event);
    } else if (event.type === 'order_rejected') {
      applyRejected(orders, rejections, anomalies, event);
    } else if (event.type === 'order_filled') {
      applyFill(orders, positions, anomalies, event);
    }
  }

  return { orders, positions, rejections, anomalies };
}
