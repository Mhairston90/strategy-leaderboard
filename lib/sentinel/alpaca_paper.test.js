import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as alpacaPaper from './alpaca_paper.js';

const {
  ALPACA_PAPER_BASE_URL,
  createAlpacaPaperClient,
  ticketToAlpacaOrder,
} = alpacaPaper;

const env = {
  ALPACA_ENV: 'paper',
  APCA_API_KEY_ID: 'PK1234567890',
  APCA_API_SECRET_KEY: 'SUPERSECRET1234567890',
};

const baseTicket = {
  ticket_id: 'sentinel-20260628-000001',
  created_at: '2026-06-28T18:00:00Z',
  strategy: 'CODEX Regime Plus L/S v1',
  symbol: ' aapl ',
  asset_class: 'equity',
  side: 'buy',
  intent: 'open',
  notional_usd: 25,
  quantity: null,
  order_type: 'market',
  time_in_force: 'day',
  reason: 'paper adapter test',
  source_signal_id: 'signal-1',
  risk_status: 'approved',
  broker: 'alpaca-paper',
};

function fakeResponse({ ok = true, status = 200, textBody = '', jsonBody } = {}) {
  return {
    ok,
    status,
    text: async () => textBody,
    json: async () => jsonBody,
  };
}

function fakeFetchQueue(responses) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    const response = responses.shift();
    assert.ok(response, `unexpected fetch call to ${url}`);
    return response;
  };

  return { calls, fetchImpl };
}

function assertNoRawCredentials(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, new RegExp(env.APCA_API_KEY_ID));
  assert.doesNotMatch(serialized, new RegExp(env.APCA_API_SECRET_KEY));
}

test('ticketToAlpacaOrder maps normalized ticket to Alpaca body', () => {
  assert.deepEqual(ticketToAlpacaOrder(baseTicket), {
    symbol: 'AAPL',
    side: 'buy',
    type: 'market',
    time_in_force: 'day',
    notional: '25.00',
  });
});

test('ticketToAlpacaOrder uses qty instead of notional for positive quantity tickets', () => {
  assert.deepEqual(ticketToAlpacaOrder({ ...baseTicket, quantity: 3.25 }), {
    symbol: 'AAPL',
    side: 'buy',
    type: 'market',
    time_in_force: 'day',
    qty: '3.25',
  });
});

test('ticketToAlpacaOrder rejects missing notional when quantity is absent', () => {
  assert.throws(
    () => ticketToAlpacaOrder({ ...baseTicket, notional_usd: undefined, quantity: null }),
    /notional_usd must be positive/
  );
  assert.throws(
    () => ticketToAlpacaOrder({ ...baseTicket, notional_usd: 0, quantity: null }),
    /notional_usd must be positive/
  );
});

test('createAlpacaPaperClient posts paper orders with auth headers and redacted result metadata', async () => {
  const order = { id: 'order-1', symbol: 'AAPL', status: 'accepted' };
  const { calls, fetchImpl } = fakeFetchQueue([
    fakeResponse({ jsonBody: order }),
  ]);
  const client = createAlpacaPaperClient({ env, fetchImpl });

  const result = await client.submitOrder(baseTicket);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${ALPACA_PAPER_BASE_URL}/v2/orders`);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['APCA-API-KEY-ID'], env.APCA_API_KEY_ID);
  assert.equal(calls[0].options.headers['APCA-API-SECRET-KEY'], env.APCA_API_SECRET_KEY);
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), ticketToAlpacaOrder(baseTicket));
  assert.deepEqual(result, {
    ok: true,
    order,
    key_id: 'PK12...7890',
  });
  assert.doesNotMatch(JSON.stringify(result), new RegExp(env.APCA_API_KEY_ID));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(env.APCA_API_SECRET_KEY));
  assertNoRawCredentials(result);
});

test('createAlpacaPaperClient refuses non-paper environment', () => {
  assert.throws(
    () => createAlpacaPaperClient({ env: { ...env, ALPACA_ENV: 'live' }, fetchImpl: async () => {} }),
    /ALPACA_ENV must be paper/
  );
});

test('createAlpacaPaperClient requires local Alpaca paper credentials', () => {
  for (const missingField of ['APCA_API_KEY_ID', 'APCA_API_SECRET_KEY']) {
    const incompleteEnv = { ...env };
    delete incompleteEnv[missingField];

    assert.throws(
      () => createAlpacaPaperClient({ env: incompleteEnv, fetchImpl: async () => {} }),
      /Alpaca paper credentials are missing from local environment/,
      `${missingField} should be required`
    );
  }
});

test('createAlpacaPaperClient returns non-OK errors without exposing secrets', async () => {
  const responseBody = JSON.stringify({
    message: `rejected credential ${env.APCA_API_SECRET_KEY}`,
  });
  const { fetchImpl } = fakeFetchQueue([
    fakeResponse({ ok: false, status: 403, textBody: responseBody }),
  ]);
  const client = createAlpacaPaperClient({ env, fetchImpl });

  const result = await client.submitOrder(baseTicket);

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.key_id, 'PK12...7890');
  assert.match(JSON.stringify(result.error), /rejected credential/);
  assertNoRawCredentials(result);
});

test('createAlpacaPaperClient redacts credentials from JSON error object keys and values', async () => {
  const { fetchImpl } = fakeFetchQueue([
    fakeResponse({
      ok: false,
      status: 403,
      jsonBody: {
        [`${env.APCA_API_SECRET_KEY}_field`]: env.APCA_API_SECRET_KEY,
        nested: {
          [env.APCA_API_KEY_ID]: env.APCA_API_KEY_ID,
        },
      },
    }),
  ]);
  const client = createAlpacaPaperClient({ env, fetchImpl });

  const result = await client.submitOrder(baseTicket);

  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.key_id, 'PK12...7890');
  assertNoRawCredentials(result);
  assert.equal(Object.hasOwn(result.error, 'redacted_key'), true);
  assert.equal(Object.hasOwn(result.error.nested, 'redacted_key'), true);
});

test('createAlpacaPaperClient redacts credentials from plain-text non-OK bodies', async () => {
  const { fetchImpl } = fakeFetchQueue([
    fakeResponse({
      ok: false,
      status: 429,
      textBody: `rate limited ${env.APCA_API_KEY_ID} ${env.APCA_API_SECRET_KEY}`,
    }),
  ]);
  const client = createAlpacaPaperClient({ env, fetchImpl });

  const result = await client.getAccount();

  assert.equal(result.ok, false);
  assert.equal(result.status, 429);
  assert.match(result.error, /rate limited/);
  assertNoRawCredentials(result);
});

test('createAlpacaPaperClient redacts credentials from fetch exceptions', async () => {
  const fetchImpl = async () => {
    throw new Error(`network failed for ${env.APCA_API_KEY_ID} ${env.APCA_API_SECRET_KEY}`);
  };
  const client = createAlpacaPaperClient({ env, fetchImpl });

  const result = await client.getOrders();

  assert.equal(result.ok, false);
  assert.equal(result.status, 0);
  assert.match(result.error, /network failed/);
  assertNoRawCredentials(result);
});

test('createAlpacaPaperClient parses explicit JSON text response bodies', async () => {
  const account = { account_number: 'paper-account', status: 'ACTIVE' };
  const positions = [{ symbol: 'AAPL', qty: '1' }];
  const orders = [{ id: 'order-open', status: 'new' }];
  const { calls, fetchImpl } = fakeFetchQueue([
    fakeResponse({ textBody: JSON.stringify(account) }),
    fakeResponse({ textBody: JSON.stringify(positions) }),
    fakeResponse({ textBody: JSON.stringify(orders) }),
  ]);
  const client = createAlpacaPaperClient({ env, fetchImpl });

  assert.deepEqual(await client.getAccount(), {
    ok: true,
    account,
    key_id: 'PK12...7890',
  });
  assert.deepEqual(await client.getPositions(), {
    ok: true,
    positions,
    key_id: 'PK12...7890',
  });
  assert.deepEqual(await client.getOrders(), {
    ok: true,
    orders,
    key_id: 'PK12...7890',
  });
  assert.deepEqual(calls.map((call) => call.url), [
    `${ALPACA_PAPER_BASE_URL}/v2/account`,
    `${ALPACA_PAPER_BASE_URL}/v2/positions`,
    `${ALPACA_PAPER_BASE_URL}/v2/orders?status=open`,
  ]);
});

test('adapter exports only paper adapter API and no live Alpaca endpoint string', () => {
  assert.deepEqual(Object.keys(alpacaPaper).sort(), [
    'ALPACA_PAPER_BASE_URL',
    'createAlpacaPaperClient',
    'ticketToAlpacaOrder',
  ].sort());
  assert.equal(ALPACA_PAPER_BASE_URL, 'https://paper-api.alpaca.markets');

  const source = readFileSync(new URL('./alpaca_paper.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /https:\/\/api\.alpaca\.markets/);
});
