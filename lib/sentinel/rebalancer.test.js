import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildRebalanceOrders } from './rebalancer.js';

test('buildRebalanceOrders keeps newer pending NinjaTrader orders visible after an older rejection shares the source signal', () => {
  const target = {
    symbol: 'BTC/USD',
    asset_class: 'crypto',
    venue: 'ninjatrader-sim',
    adapter: 'ninjatrader_sim',
    instrument: 'MBT 07-26',
    point_value: 0.1,
    account: 'DEMO8256098',
    target_notional_usd: 6000,
    reference_price_usd: 60000,
  };
  const source = 'position-sync:ninjatrader-sim:MBT 07-26:1';

  const result = buildRebalanceOrders({
    routedTargets: [target],
    ninjaPositions: [],
    ninjaOrders: [],
    ledgerEvents: [
      {
        type: 'order_submitted',
        at: '2026-07-02T10:00:00Z',
        broker_order_id: 'NT-first',
        venue: 'ninjatrader-sim',
        symbol: 'BTC/USD',
        instrument: 'MBT 07-26',
        side: 'buy',
        quantity: 1,
        source_signal_id: source,
      },
      {
        type: 'order_rejected',
        at: '2026-07-02T10:00:30Z',
        broker_order_id: 'NT-first',
        venue: 'ninjatrader-sim',
        symbol: 'BTC/USD',
        instrument: 'MBT 07-26',
        side: 'buy',
        quantity: 1,
        source_signal_id: source,
        reason: 'ninjatrader feedback: rejected',
      },
      {
        type: 'order_submitted',
        at: '2026-07-02T10:05:00Z',
        broker_order_id: 'NT-second',
        venue: 'ninjatrader-sim',
        symbol: 'BTC/USD',
        instrument: 'MBT 07-26',
        side: 'buy',
        quantity: 1,
        source_signal_id: source,
      },
    ],
    config: { drift_band_pct: 0.2, min_order_usd: 25, ninjatrader: { pending_order_ttl_minutes: 15 } },
    now: '2026-07-02T10:06:00Z',
  });

  assert.deepEqual(result.orders, [], 'newer pending order should suppress a duplicate submission');
  assert.equal(result.pendingOrders.length, 1);
  assert.equal(result.pendingOrders[0].broker_order_id, 'NT-second');
  assert.equal(result.pendingOrders[0].status, 'pending_feedback');
});

test('buildRebalanceOrders stamps NinjaTrader orders with a traceable client_order_id', () => {
  const result = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'BTC/USD',
        asset_class: 'crypto',
        venue: 'ninjatrader-sim',
        adapter: 'ninjatrader_sim',
        instrument: 'MBT 07-26',
        point_value: 0.1,
        account: 'DEMO8256098',
        target_notional_usd: 6000,
        reference_price_usd: 60000,
      },
    ],
    ninjaPositions: [],
    config: { drift_band_pct: 0.2, min_order_usd: 25 },
    now: '2026-07-02T10:06:00.123Z',
  });

  assert.equal(result.orders.length, 1);
  const order = result.orders[0];
  assert.match(order.client_order_id, /^sentinel-sync-ninjatrader-sim-btc-usd-buy-/);
  assert.match(order.client_order_id, /-\d+$/, 'client order id should end with a tick timestamp');
  assert.ok(order.client_order_id.length <= 80);
  assert.notEqual(order.client_order_id, order.ticket_id);
});

test('buildRebalanceOrders creates Alpaca notional orders outside the drift band', () => {
  const result = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'AMD',
        asset_class: 'us_equity',
        venue: 'alpaca-paper',
        target_notional_usd: -1000,
        reference_price_usd: 100,
      },
    ],
    alpacaPositions: [{ symbol: 'AMD', market_value: '-100' }],
    config: { drift_band_pct: 0.2, min_order_usd: 25 },
    now: '2026-07-01T20:00:00Z',
  });

  assert.deepEqual(result.orders.map((order) => ({
    venue: order.venue,
    symbol: order.symbol,
    side: order.side,
    notional_usd: order.notional_usd,
    quantity: order.quantity,
    intent: order.intent,
  })), [
    {
      venue: 'alpaca-paper',
      symbol: 'AMD',
      side: 'sell',
      notional_usd: 900,
      quantity: 9,
      intent: 'rebalance',
    },
  ]);
});

test('buildRebalanceOrders suppresses tiny drifts', () => {
  const result = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'ADA/USD',
        asset_class: 'crypto',
        venue: 'alpaca-paper',
        target_notional_usd: 1000,
        reference_price_usd: 0.15,
      },
    ],
    alpacaPositions: [{ symbol: 'ADA/USD', market_value: '875' }],
    config: { drift_band_pct: 0.2, min_order_usd: 25 },
  });

  assert.deepEqual(result.orders, []);
});

test('buildRebalanceOrders treats open Alpaca orders as pending exposure', () => {
  const result = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'LLY',
        asset_class: 'us_equity',
        venue: 'alpaca-paper',
        target_notional_usd: 2644.2,
        reference_price_usd: 1191.73,
      },
    ],
    alpacaPositions: [],
    alpacaOpenOrders: [
      {
        symbol: 'LLY',
        side: 'buy',
        notional: '2644.2',
        status: 'accepted',
      },
    ],
    config: { drift_band_pct: 0.2, min_order_usd: 25 },
  });

  assert.deepEqual(result.orders, []);
});

test('buildRebalanceOrders treats open Alpaca quantity sell orders as pending exposure', () => {
  const result = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'AMD',
        asset_class: 'us_equity',
        venue: 'alpaca-paper',
        target_notional_usd: -2230,
        reference_price_usd: 557.5,
      },
    ],
    alpacaPositions: [],
    alpacaOpenOrders: [
      {
        symbol: 'AMD',
        side: 'sell',
        qty: '4',
        status: 'accepted',
      },
    ],
    config: { drift_band_pct: 0.2, min_order_usd: 25 },
  });

  assert.deepEqual(result.orders, []);
});

test('buildRebalanceOrders does not send another equity short when target whole shares are already pending', () => {
  const result = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'CAT',
        asset_class: 'us_equity',
        venue: 'alpaca-paper',
        target_notional_usd: -1471.85,
        reference_price_usd: 1049.19,
      },
    ],
    alpacaPositions: [],
    alpacaOpenOrders: [
      {
        symbol: 'CAT',
        side: 'sell',
        qty: '1',
        status: 'accepted',
      },
    ],
    config: { drift_band_pct: 0.2, min_order_usd: 25 },
  });

  assert.deepEqual(result.orders, []);
});

test('buildRebalanceOrders avoids wash-trade sells against pending same-direction buy orders', () => {
  const result = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'LLY',
        asset_class: 'us_equity',
        venue: 'alpaca-paper',
        target_notional_usd: 2644.2,
        reference_price_usd: 1191.73,
      },
    ],
    alpacaPositions: [],
    alpacaOpenOrders: [
      { symbol: 'LLY', side: 'buy', notional: '2644.2', status: 'accepted' },
      { symbol: 'LLY', side: 'buy', notional: '2644.2', status: 'accepted' },
    ],
    config: { drift_band_pct: 0.2, min_order_usd: 25 },
  });

  assert.deepEqual(result.orders, []);
  assert.deepEqual(result.skipped, [
    {
      type: 'divergence',
      symbol: 'LLY',
      target_notional_usd: 2644.2,
      reason: 'pending_alpaca_orders_exceed_target',
    },
  ]);
});

test('buildRebalanceOrders emits stable ids for identical sync orders across ticks', () => {
  const first = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'ADA/USD',
        asset_class: 'crypto',
        venue: 'alpaca-paper',
        target_notional_usd: 1000,
        reference_price_usd: 0.15,
      },
    ],
    config: { drift_band_pct: 0.2, min_order_usd: 25 },
    now: '2026-07-01T20:00:00Z',
  });
  const second = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'ADA/USD',
        asset_class: 'crypto',
        venue: 'alpaca-paper',
        target_notional_usd: 1000,
        reference_price_usd: 0.15,
      },
    ],
    config: { drift_band_pct: 0.2, min_order_usd: 25 },
    now: '2026-07-01T20:01:00Z',
  });

  assert.equal(first.orders[0].ticket_id, second.orders[0].ticket_id);
  assert.equal(first.orders[0].source_signal_id, second.orders[0].source_signal_id);
});

test('buildRebalanceOrders converts Ninja crypto target notional to contract deltas', () => {
  const result = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'SOL/USD',
        asset_class: 'crypto',
        venue: 'ninjatrader-sim',
        instrument: 'MSL 07-26',
        point_value: 25,
        target_notional_usd: 3900,
        reference_price_usd: 78,
        account: 'DEMO8256098',
      },
    ],
    ninjaPositions: [
      {
        instrument: 'MSL 07-26',
        market_position: 'short',
        qty: 1,
        avg_price: 78,
      },
    ],
    config: { drift_band_pct: 0.2, min_order_usd: 25 },
    now: '2026-07-01T20:00:00Z',
  });

  assert.deepEqual(result.orders.map((order) => ({
    venue: order.venue,
    symbol: order.symbol,
    instrument: order.instrument,
    side: order.side,
    quantity: order.quantity,
    notional_usd: order.notional_usd,
    current_contracts: order.current_contracts,
    target_contracts: order.target_contracts,
  })), [
    {
      venue: 'ninjatrader-sim',
      symbol: 'SOL/USD',
      instrument: 'MSL 07-26',
      side: 'buy',
      quantity: 3,
      notional_usd: 5850,
      current_contracts: -1,
      target_contracts: 2,
    },
  ]);
});

test('buildRebalanceOrders treats recent Ninja submissions as pending exposure', () => {
  const result = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'SOL/USD',
        asset_class: 'crypto',
        venue: 'ninjatrader-sim',
        instrument: 'MSL 07-26',
        point_value: 25,
        target_notional_usd: 3900,
        reference_price_usd: 78,
        account: 'DEMO8256098',
      },
    ],
    ninjaPositions: [],
    ninjaOrders: [],
    ledgerEvents: [
      {
        type: 'order_submitted',
        at: '2026-07-01T20:01:00Z',
        broker_order_id: 'NT-pending-sol',
        broker: 'ninjatrader-sim',
        venue: 'ninjatrader-sim',
        symbol: 'SOL/USD',
        instrument: 'MSL 07-26',
        side: 'buy',
        quantity: 2,
        source_signal_id: 'position-sync:ninjatrader-sim:MSL 07-26:2',
      },
    ],
    config: {
      drift_band_pct: 0.2,
      min_order_usd: 25,
      ninjatrader: { pending_order_ttl_minutes: 15 },
    },
    now: '2026-07-01T20:02:00Z',
  });

  assert.deepEqual(result.orders, []);
  assert.deepEqual(result.skipped, []);
  assert.deepEqual(result.pendingOrders.map((order) => ({
    id: order.id,
    symbol: order.symbol,
    instrument: order.instrument,
    status: order.status,
    target_contracts: order.target_contracts,
    pending_contracts: order.pending_contracts,
    notional_usd: order.notional_usd,
  })), [
    {
      id: 'NT-pending-sol',
      symbol: 'SOL/USD',
      instrument: 'MSL 07-26',
      status: 'pending_feedback',
      target_contracts: 2,
      pending_contracts: 2,
      notional_usd: 3900,
    },
  ]);
});

test('buildRebalanceOrders skips stale Ninja submissions instead of resubmitting them', () => {
  const result = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'ETH/USD',
        asset_class: 'crypto',
        venue: 'ninjatrader-sim',
        instrument: 'MET 07-26',
        point_value: 0.1,
        target_notional_usd: 6680,
        reference_price_usd: 1670,
        account: 'DEMO8256098',
      },
    ],
    ninjaPositions: [],
    ninjaOrders: [],
    ledgerEvents: [
      {
        type: 'order_submitted',
        at: '2026-07-01T20:00:00Z',
        broker_order_id: 'NT-stale-eth',
        broker: 'ninjatrader-sim',
        venue: 'ninjatrader-sim',
        symbol: 'ETH/USD',
        instrument: 'MET 07-26',
        side: 'buy',
        quantity: 40,
        source_signal_id: 'position-sync:ninjatrader-sim:MET 07-26:40',
      },
    ],
    config: {
      drift_band_pct: 0.2,
      min_order_usd: 25,
      ninjatrader: { pending_order_ttl_minutes: 15 },
    },
    now: '2026-07-01T20:20:30Z',
  });

  assert.deepEqual(result.orders, []);
  assert.deepEqual(result.skipped.map((row) => ({
    symbol: row.symbol,
    instrument: row.instrument,
    reason: row.reason,
    broker_order_id: row.broker_order_id,
  })), [
    {
      symbol: 'ETH/USD',
      instrument: 'MET 07-26',
      reason: 'stale_ninjatrader_feedback',
      broker_order_id: 'NT-stale-eth',
    },
  ]);
  assert.equal(result.pendingOrders[0].status, 'stale_feedback');
});

test('buildRebalanceOrders ignores Ninja submissions that have terminal ledger rejections', () => {
  const result = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'BTC/USD',
        asset_class: 'crypto',
        venue: 'ninjatrader-sim',
        instrument: 'MBT 07-26',
        point_value: 0.1,
        target_notional_usd: 6200,
        reference_price_usd: 62000,
        account: 'DEMO8256098',
      },
    ],
    ninjaPositions: [],
    ninjaOrders: [],
    ledgerEvents: [
      {
        type: 'order_submitted',
        at: '2026-07-01T20:00:00Z',
        broker_order_id: 'NT-rejected-btc',
        broker: 'ninjatrader-sim',
        venue: 'ninjatrader-sim',
        symbol: 'BTC/USD',
        instrument: 'MBT 07-26',
        side: 'buy',
        quantity: 1,
        source_signal_id: 'position-sync:ninjatrader-sim:MBT 07-26:1',
      },
      {
        type: 'order_rejected',
        at: '2026-07-01T20:01:00Z',
        broker_order_id: 'NT-rejected-btc',
        broker: 'ninjatrader-sim',
        venue: 'ninjatrader-sim',
        symbol: 'BTC/USD',
        instrument: 'MBT 07-26',
        side: 'buy',
        quantity: 1,
        reason: 'acknowledged stale Ninja feedback after broker verification',
        source_signal_id: 'position-sync:ninjatrader-sim:MBT 07-26:1',
      },
    ],
    config: {
      drift_band_pct: 0.2,
      min_order_usd: 25,
      ninjatrader: { pending_order_ttl_minutes: 15 },
    },
    now: '2026-07-01T20:20:30Z',
  });

  assert.deepEqual(result.pendingOrders, []);
  assert.deepEqual(result.skipped, []);
  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].source_signal_id, 'position-sync:ninjatrader-sim:MBT 07-26:1');
});

test('buildRebalanceOrders skips Ninja targets below one contract', () => {
  const result = buildRebalanceOrders({
    routedTargets: [
      {
        symbol: 'SOL/USD',
        asset_class: 'crypto',
        venue: 'ninjatrader-sim',
        instrument: 'MSL 07-26',
        point_value: 25,
        target_notional_usd: 500,
        reference_price_usd: 78,
      },
    ],
    config: { drift_band_pct: 0.2, min_order_usd: 25 },
  });

  assert.deepEqual(result.orders, []);
  assert.deepEqual(result.skipped, [
    {
      type: 'divergence',
      symbol: 'SOL/USD',
      target_notional_usd: 500,
      reason: 'below_one_ninjatrader_contract',
    },
  ]);
});
