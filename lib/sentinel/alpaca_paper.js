import { assertPaperEnv, redactSecret } from './config.js';
import { normalizeSymbolForAlpaca } from './ticket_schema.js';

export const ALPACA_PAPER_BASE_URL = 'https://paper-api.alpaca.markets';

function requireCredential(env, name) {
  const value = String(env?.[name] ?? '').trim();
  if (!value) {
    throw new Error('Alpaca paper credentials are missing from local environment');
  }

  return value;
}

async function parseResponseBody(response) {
  if (typeof response?.text === 'function') {
    try {
      const text = await response.text();
      if (typeof text === 'string' && text.trim() !== '') {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
    } catch {
      // Fall through to response.json() if the runtime provides it.
    }
  }

  if (typeof response?.json === 'function') {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  return null;
}

function redactCredentialText(text, keyId, secretKey) {
  return text
    .split(secretKey).join('***')
    .split(keyId).join(redactSecret(keyId));
}

function redactCredentialKey(key, keyId, secretKey) {
  const redactedKey = redactCredentialText(key, keyId, secretKey);
  return redactedKey === key ? key : 'redacted_key';
}

function setRedactedEntry(target, key, value) {
  let safeKey = key;
  let suffix = 2;
  while (Object.hasOwn(target, safeKey)) {
    safeKey = `${key}_${suffix}`;
    suffix += 1;
  }

  target[safeKey] = value;
}

function redactCredentials(value, keyId, secretKey) {
  if (typeof value === 'string') {
    return redactCredentialText(value, keyId, secretKey);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactCredentials(item, keyId, secretKey));
  }

  if (value && typeof value === 'object') {
    const redacted = {};
    for (const [key, item] of Object.entries(value)) {
      setRedactedEntry(
        redacted,
        redactCredentialKey(key, keyId, secretKey),
        redactCredentials(item, keyId, secretKey)
      );
    }

    return redacted;
  }

  return value;
}

function successResult(key, value, redactedKeyId) {
  return {
    ok: true,
    [key]: value,
    key_id: redactedKeyId,
  };
}

export function ticketToAlpacaOrder(ticket) {
  const order = {
    symbol: normalizeSymbolForAlpaca(ticket?.symbol),
    side: ticket?.side,
    type: ticket?.order_type,
    time_in_force: ticket?.time_in_force,
  };

  if (
    typeof ticket?.quantity === 'number' &&
    Number.isFinite(ticket.quantity) &&
    ticket.quantity > 0
  ) {
    order.qty = String(ticket.quantity);
  } else {
    if (
      typeof ticket?.notional_usd !== 'number' ||
      !Number.isFinite(ticket.notional_usd) ||
      ticket.notional_usd <= 0
    ) {
      throw new Error('notional_usd must be positive');
    }

    order.notional = Number(ticket?.notional_usd).toFixed(2);
  }

  return order;
}

export function createAlpacaPaperClient({ env = process.env, fetchImpl = fetch } = {}) {
  assertPaperEnv(env);

  const keyId = requireCredential(env, 'APCA_API_KEY_ID');
  const secretKey = requireCredential(env, 'APCA_API_SECRET_KEY');
  const redactedKeyId = redactSecret(keyId);

  async function request(path, options = {}, resultKey = 'data') {
    const headers = {
      ...(options.headers ?? {}),
      'APCA-API-KEY-ID': keyId,
      'APCA-API-SECRET-KEY': secretKey,
      'Content-Type': 'application/json',
    };

    let response;
    try {
      response = await fetchImpl(`${ALPACA_PAPER_BASE_URL}${path}`, {
        ...options,
        method: options.method ?? 'GET',
        headers,
      });
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: redactCredentials(error instanceof Error ? error.message : String(error), keyId, secretKey),
        key_id: redactedKeyId,
      };
    }

    const body = redactCredentials(await parseResponseBody(response), keyId, secretKey);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: body,
        key_id: redactedKeyId,
      };
    }

    return successResult(resultKey, body, redactedKeyId);
  }

  return {
    submitOrder(ticket) {
      return request('/v2/orders', {
        method: 'POST',
        body: JSON.stringify(ticketToAlpacaOrder(ticket)),
      }, 'order');
    },

    getAccount() {
      return request('/v2/account', {}, 'account');
    },

    getPositions() {
      return request('/v2/positions', {}, 'positions');
    },

    getOrders() {
      return request('/v2/orders?status=open', {}, 'orders');
    },
  };
}
