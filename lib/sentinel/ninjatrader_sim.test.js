import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClosePositionOifLine,
  buildNinjaTraderOifFileName,
  buildPlaceOifLine,
  createNinjaTraderSimClient,
  parseNinjaTraderOrderFeedback,
  parseNinjaTraderPositionFeedback,
} from './ninjatrader_sim.js';

async function withTempNinjaRoot(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ninjatrader-sim-test-'));
  await mkdir(path.join(root, 'incoming'), { recursive: true });
  await mkdir(path.join(root, 'outgoing'), { recursive: true });
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('buildNinjaTraderOifFileName emits strict oif-plus-digits filenames', () => {
  assert.equal(buildNinjaTraderOifFileName({ id: '20260701161035052' }), 'oif20260701161035052.txt');
  assert.match(buildNinjaTraderOifFileName({ id: 'abc-123' }), /^oif\d+123\.txt$/);
  assert.doesNotMatch(buildNinjaTraderOifFileName({ id: '2026_0701' }), /_/);
});

test('buildPlaceOifLine formats a short market order with explicit account and order id', () => {
  assert.equal(
    buildPlaceOifLine({
      account: 'DEMO8256098',
      instrument: 'MNQ 09-26',
      side: 'sell',
      quantity: 1,
      order_type: 'market',
      time_in_force: 'day',
      client_order_id: 'CODEXNT8SHORT20260701160958594',
    }),
    'PLACE;DEMO8256098;MNQ 09-26;SELL;1;MARKET;;;DAY;;CODEXNT8SHORT20260701160958594;;',
  );
});

test('buildClosePositionOifLine formats a flatten command for one account and instrument', () => {
  assert.equal(
    buildClosePositionOifLine({
      account: 'DEMO8256098',
      instrument: 'MNQ 09-26',
    }),
    'CLOSEPOSITION;DEMO8256098;MNQ 09-26;;;;;;;;;;',
  );
});

test('createNinjaTraderSimClient writes direct final OIF files into incoming', async () => {
  await withTempNinjaRoot(async (root) => {
    const client = createNinjaTraderSimClient({
      documentsRoot: root,
      account: 'DEMO8256098',
      nextOifId: () => '20260701160958594',
      waitForFeedback: false,
    });

    const result = await client.submitOrder({
      instrument: 'MNQ 09-26',
      side: 'sell',
      quantity: 1,
      order_type: 'market',
      time_in_force: 'day',
      client_order_id: 'CODEXNT8SHORT20260701160958594',
    });

    assert.equal(result.ok, true);
    assert.equal(result.order.id, 'CODEXNT8SHORT20260701160958594');
    assert.equal(path.basename(result.order.oif_file), 'oif20260701160958594.txt');

    const text = await readFile(path.join(root, 'incoming', 'oif20260701160958594.txt'), 'utf8');
    assert.equal(
      text,
      'PLACE;DEMO8256098;MNQ 09-26;SELL;1;MARKET;;;DAY;;CODEXNT8SHORT20260701160958594;;\r\n',
    );
  });
});

test('createNinjaTraderSimClient refuses non-simulation-looking accounts by default', async () => {
  await withTempNinjaRoot(async (root) => {
    assert.throws(
      () => createNinjaTraderSimClient({ documentsRoot: root, account: 'LIVE123456' }),
      /NinjaTrader sim account must start with Sim or DEMO/,
    );
  });
});

test('createNinjaTraderSimClient writes close-position OIF commands', async () => {
  await withTempNinjaRoot(async (root) => {
    const client = createNinjaTraderSimClient({
      documentsRoot: root,
      account: 'DEMO8256098',
      nextOifId: () => '20260701161035052',
      waitForFeedback: false,
    });

    const result = await client.closePosition({ instrument: 'MNQ 09-26' });

    assert.equal(result.ok, true);
    assert.equal(path.basename(result.close.oif_file), 'oif20260701161035052.txt');
    assert.equal(
      await readFile(path.join(root, 'incoming', 'oif20260701161035052.txt'), 'utf8'),
      'CLOSEPOSITION;DEMO8256098;MNQ 09-26;;;;;;;;;;\r\n',
    );
  });
});

test('parseNinjaTraderOrderFeedback parses filled order feedback', () => {
  assert.deepEqual(parseNinjaTraderOrderFeedback('FILLED;1;30080.75'), {
    status: 'filled',
    filled_qty: 1,
    fill_price: 30080.75,
    raw: 'FILLED;1;30080.75',
  });
});

test('parseNinjaTraderPositionFeedback parses flat and short position feedback', () => {
  assert.deepEqual(parseNinjaTraderPositionFeedback('FLAT;0;0'), {
    market_position: 'flat',
    qty: 0,
    avg_price: 0,
    raw: 'FLAT;0;0',
  });
  assert.deepEqual(parseNinjaTraderPositionFeedback('SHORT;1;30080.75'), {
    market_position: 'short',
    qty: 1,
    avg_price: 30080.75,
    raw: 'SHORT;1;30080.75',
  });
});

test('getAccount reads the configured connection status file', async () => {
  await withTempNinjaRoot(async (root) => {
    await writeFile(path.join(root, 'outgoing', 'My Demo Feed.txt'), 'CONNECTED\r\n', 'utf8');
    const client = createNinjaTraderSimClient({
      documentsRoot: root,
      account: 'DEMO8256098',
      connectionName: 'My Demo Feed',
      waitForFeedback: false,
    });

    const result = await client.getAccount();
    assert.equal(result.ok, true);
    assert.equal(result.account.connection, 'connected');
  });
});

test('getAccount reports unknown when the connection status file is missing', async () => {
  await withTempNinjaRoot(async (root) => {
    const client = createNinjaTraderSimClient({
      documentsRoot: root,
      account: 'DEMO8256098',
      connectionName: 'My Demo Feed',
      waitForFeedback: false,
    });

    const result = await client.getAccount();
    assert.equal(result.account.connection, 'unknown');
  });
});

test('getPositions reads NinjaTrader outgoing position files for the configured account', async () => {
  await withTempNinjaRoot(async (root) => {
    await writeFile(
      path.join(root, 'outgoing', 'MNQ 09-26 Globex_DEMO8256098_position.txt'),
      'FLAT;0;0',
      'utf8',
    );
    await writeFile(
      path.join(root, 'outgoing', 'MNQ 09-26 Globex_Sim101_position.txt'),
      'SHORT;1;30080.75',
      'utf8',
    );
    const client = createNinjaTraderSimClient({
      documentsRoot: root,
      account: 'DEMO8256098',
      waitForFeedback: false,
    });

    assert.deepEqual(await client.getPositions(), {
      ok: true,
      positions: [
        {
          account: 'DEMO8256098',
          instrument: 'MNQ 09-26',
          exchange: 'Globex',
          market_position: 'flat',
          qty: 0,
          avg_price: 0,
          raw: 'FLAT;0;0',
        },
      ],
    });
  });
});
