const REQUIRED_FIELDS = [
  'ticket_id',
  'created_at',
  'strategy',
  'symbol',
  'asset_class',
  'side',
  'intent',
  'notional_usd',
  'quantity',
  'order_type',
  'time_in_force',
  'reason',
  'source_signal_id',
  'risk_status',
  'broker',
];

const REQUIRED_STRING_FIELDS = [
  'ticket_id',
  'created_at',
  'strategy',
  'symbol',
  'asset_class',
  'side',
  'intent',
  'order_type',
  'time_in_force',
  'reason',
  'source_signal_id',
  'risk_status',
  'broker',
];

const ISO_TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/;

export function normalizeSymbolForAlpaca(symbol) {
  return String(symbol ?? '').trim().toUpperCase();
}

function isStrictUtcIsoTimestamp(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const expected = `${match[1]}.${(match[2] ?? '000').padEnd(3, '0')}Z`;
  return date.toISOString() === expected;
}

export function validateTicket(ticket) {
  const errors = [];

  if (!ticket || typeof ticket !== 'object' || Array.isArray(ticket)) {
    return { ok: false, errors: ['ticket must be an object'] };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(ticket, field) || ticket[field] === undefined) {
      errors.push(`${field} is required`);
    }
  }

  for (const field of REQUIRED_FIELDS) {
    if (field !== 'quantity' && Object.hasOwn(ticket, field) && ticket[field] === null) {
      errors.push(`${field} is required`);
    }
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (
      Object.hasOwn(ticket, field) &&
      (typeof ticket[field] !== 'string' || ticket[field].trim() === '')
    ) {
      errors.push(`${field} is required`);
    }
  }

  if (ticket.broker !== 'alpaca-paper') {
    errors.push('broker must be alpaca-paper');
  }

  if (!['crypto', 'equity'].includes(ticket.asset_class)) {
    errors.push('asset_class must be crypto or equity');
  }

  if (!['buy', 'sell'].includes(ticket.side)) {
    errors.push('side must be buy or sell');
  }

  if (!['open', 'close'].includes(ticket.intent)) {
    errors.push('intent must be open or close');
  }

  if (ticket.order_type !== 'market') {
    errors.push('order_type must be market');
  }

  if (!['day', 'gtc'].includes(ticket.time_in_force)) {
    errors.push('time_in_force must be day or gtc');
  }

  if (
    typeof ticket.notional_usd !== 'number' ||
    !Number.isFinite(ticket.notional_usd) ||
    ticket.notional_usd <= 0
  ) {
    errors.push('notional_usd must be positive');
  }

  if (
    Object.hasOwn(ticket, 'quantity') &&
    ticket.quantity !== null &&
    (typeof ticket.quantity !== 'number' || !Number.isFinite(ticket.quantity) || ticket.quantity <= 0)
  ) {
    errors.push('quantity must be null or a positive finite number');
  }

  if (!isStrictUtcIsoTimestamp(ticket.created_at)) {
    errors.push('created_at must be an ISO timestamp');
  }

  if (normalizeSymbolForAlpaca(ticket.symbol) === '') {
    errors.push('symbol is required');
  }

  return { ok: errors.length === 0, errors };
}
