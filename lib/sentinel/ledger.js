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

function applyFill(orders, positions, event) {
  const symbol = eventSymbol(event);
  const side = eventSide(event);
  const filledQty = toFiniteNumber(event?.filled_qty);
  const filledAvgPrice = toFiniteNumber(event?.filled_avg_price);

  if (!symbol || !side || filledQty === null || filledQty <= 0 || filledAvgPrice === null) {
    return;
  }

  setOrderStatus(orders, event, 'filled');

  const existing = positions.get(symbol) ?? { symbol, qty: 0, market_value: 0 };
  const direction = side === 'sell' ? -1 : 1;
  const qty = existing.qty + direction * filledQty;
  const marketValue = existing.market_value + direction * filledQty * filledAvgPrice;

  positions.set(symbol, {
    symbol,
    qty,
    market_value: marketValue,
  });
}

export function replayLedgerEvents(events = []) {
  const orders = new Map();
  const positions = new Map();
  const rejections = [];

  for (const rawEvent of Array.isArray(events) ? events : []) {
    const event = eventObject(rawEvent);
    if (!event) {
      continue;
    }

    if (event.type === 'order_submitted') {
      setOrderStatus(orders, event, 'submitted');
    } else if (event.type === 'order_rejected') {
      const rejection = { ...event, status: 'rejected' };
      rejections.push(rejection);
      setOrderStatus(orders, rejection, 'rejected');
    } else if (event.type === 'order_filled') {
      applyFill(orders, positions, event);
    }
  }

  return { orders, positions, rejections };
}
