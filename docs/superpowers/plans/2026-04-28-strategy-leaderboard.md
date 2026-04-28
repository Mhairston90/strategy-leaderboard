# Strategy Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page static HTML dashboard that reads 6 trading strategies' performance data (5 from Google Sheets `doGet` API + BULL from GitHub raw), normalizes to a common shape, and renders as a sortable Bloomberg-style table that auto-refreshes every 5 minutes.

**Architecture:** Vanilla JS, no framework, no build step, no backend. ES modules loaded directly by `index.html` via `<script type="module">`. Pure functions for metrics + pairing + parsing live in `lib/`. Per-strategy adapters in `adapters/`. Registry wires it all up. App controller owns the fetch+render+refresh loop. Tests run with Node's built-in `node:test`.

**Tech Stack:** ES modules (browser native), `node:test` for unit tests, `fetch()` API, `localStorage` for cache, vanilla DOM (no frameworks).

**Spec:** `docs/superpowers/specs/2026-04-28-strategy-leaderboard-design.md`

---

## File structure

```
strategy-leaderboard/
├── .gitignore                              (exists)
├── README.md                               (Task 1)
├── package.json                            (Task 1; "type": "module", test script)
├── index.html                              (Task 14)
├── app.js                                  (Task 16)
├── registry.js                             (Task 13)
├── css/
│   └── style.css                           (Task 14)
├── lib/
│   ├── metrics.js                          (Task 3)
│   ├── metrics.test.js                     (Task 3)
│   ├── pairing.js                          (Task 4)
│   ├── pairing.test.js                     (Task 4)
│   ├── parse_bull_md.js                    (Task 5)
│   ├── parse_bull_md.test.js               (Task 5)
│   ├── fetch.js                            (Task 6)
│   └── render.js                           (Task 15)
├── adapters/
│   ├── adapter_basket_breakout.js          (Task 7)
│   ├── adapter_basket_breakout.test.js     (Task 7)
│   ├── adapter_analyst_hy.js               (Task 8)
│   ├── adapter_analyst_hy.test.js          (Task 8)
│   ├── adapter_aggro_doge.js               (Task 9)
│   ├── adapter_aggro_doge.test.js          (Task 9)
│   ├── adapter_hy_v4.js                    (Task 10)
│   ├── adapter_hy_v4.test.js               (Task 10)
│   ├── adapter_v7_btc_tg.js                (Task 11)
│   ├── adapter_v7_btc_tg.test.js           (Task 11)
│   ├── adapter_bull.js                     (Task 12)
│   └── adapter_bull.test.js                (Task 12)
├── fixtures/
│   ├── basket-breakout-signals.json        (Task 2)
│   ├── basket-breakout-open-positions.json (Task 2)
│   ├── analyst-hy-v1.json                  (Task 2)
│   ├── aggro-leader-cont.json              (Task 2)
│   ├── v7-btc-tg.json                      (Task 2)
│   ├── hy-v4-signals.json                  (Task 2)
│   ├── bull-portfolio.md                   (Task 2)
│   └── bull-trade-log.md                   (Task 2)
└── docs/superpowers/
    ├── specs/2026-04-28-strategy-leaderboard-design.md  (exists)
    └── plans/2026-04-28-strategy-leaderboard.md         (this file)
```

**Working directory for all commands:** `C:/Users/Mhair/OneDrive/Desktop/strategy-leaderboard`

---

### Task 1: Bootstrap project (package.json, README)

**Files:**
- Create: `package.json`
- Create: `README.md`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "strategy-leaderboard",
  "version": "0.1.0",
  "description": "Sortable cross-strategy performance dashboard. Reads Sheets doGet + BULL GitHub raw.",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test lib/*.test.js adapters/*.test.js"
  }
}
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Strategy Leaderboard

Single-page static dashboard ranking 6 trading strategies on the same view. Read-only — pulls Sheets `doGet` + GitHub raw. No backend.

## Run

Open `index.html` in any browser. Auto-refreshes every 5 min.

## Test

```
npm test
```

(Requires Node 20+.)

## Add a new strategy

1. Create `adapters/adapter_<name>.js` with `default export (rawData) => StrategyRow`
2. Add fixture in `fixtures/`
3. Add test `adapters/adapter_<name>.test.js`
4. Append entry to `STRATEGIES` array in `registry.js`

See `docs/superpowers/specs/2026-04-28-strategy-leaderboard-design.md` for design.
```

- [ ] **Step 3: Verify Node version**

Run: `node --version`
Expected: `v20.x` or higher (built-in `node:test` requires 20+).

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "chore: bootstrap project with package.json and README"
```

---

### Task 2: Capture fixtures from real endpoints

**Goal:** Capture one snapshot per data source so tests run against realistic input. Resolves spec §12 open questions about tab names and pagination depth.

**Files:**
- Create: `fixtures/basket-breakout-signals.json`
- Create: `fixtures/basket-breakout-open-positions.json`
- Create: `fixtures/analyst-hy-v1.json`
- Create: `fixtures/aggro-leader-cont.json`
- Create: `fixtures/v7-btc-tg.json`
- Create: `fixtures/hy-v4-signals.json`
- Create: `fixtures/bull-portfolio.md`
- Create: `fixtures/bull-trade-log.md`

- [ ] **Step 1: Define base URLs as shell vars**

```bash
SHEET="https://script.google.com/macros/s/AKfycbyVLBnBLtremcupVRW-9B7a9tST7CpjTZQPr8OWxeGvMfs17Md53u01yFks8Y4uQ4ny/exec"
BULL_RAW="https://raw.githubusercontent.com/Mhairston90/trading-bull/main"
```

- [ ] **Step 2: Capture Basket Breakout signals + open positions**

```bash
curl.exe -sSL --max-time 15 "$SHEET?tab=Basket%20Breakout%20Signals&limit=200" > fixtures/basket-breakout-signals.json
curl.exe -sSL --max-time 15 "$SHEET?tab=Basket%20Breakout%20Open%20Positions&limit=200" > fixtures/basket-breakout-open-positions.json
```

Verify each file is valid JSON with rows:

```bash
node -e "const d=JSON.parse(require('fs').readFileSync('fixtures/basket-breakout-signals.json','utf8')); console.log('rows:', d.total_rows, 'headers:', d.headers);"
```

- [ ] **Step 3: Capture Analyst HY v1**

```bash
curl.exe -sSL --max-time 15 "$SHEET?tab=Analyst%20HY%20v1&limit=200" > fixtures/analyst-hy-v1.json
```

- [ ] **Step 4: Capture Aggro Leader Continuation Signals**

```bash
curl.exe -sSL --max-time 15 "$SHEET?tab=Aggro%20Leader%20Continuation%20Signals&limit=200" > fixtures/aggro-leader-cont.json
```

If `total_rows` is 0 or the tab returns an error, try `Aggro Leader Breakout Signals` instead and document which tab is the live one in `registry.js` later.

- [ ] **Step 5: Capture V7-BTC Trend Gated**

```bash
curl.exe -sSL --max-time 15 "$SHEET?tab=V7-BTC%20Trend%20Gated%20Signals&limit=200" > fixtures/v7-btc-tg.json
```

- [ ] **Step 6: Capture HY v4 Tuned signals**

The spec defers tab choice. Try in order, keep the first one with non-zero rows that look like v4 4H trades:

```bash
curl.exe -sSL --max-time 15 "$SHEET?tab=V6%20Signals&limit=200" > /tmp/v6.json
curl.exe -sSL --max-time 15 "$SHEET?tab=V5%20Signals&limit=200" > /tmp/v5.json
curl.exe -sSL --max-time 15 "$SHEET?tab=Signals&limit=200" > /tmp/signals.json
```

Inspect each: `node -e "const d=JSON.parse(require('fs').readFileSync('/tmp/v6.json','utf8')); console.log(d.rows.slice(-3));"`. Pick the one with recent BTCUSD/SOLUSD 4H entries — that's HY v4 Tuned. Move it to `fixtures/hy-v4-signals.json` and note the tab name for use in `registry.js`.

- [ ] **Step 7: Capture BULL portfolio + trade log**

```bash
curl.exe -sSL --max-time 15 "$BULL_RAW/memory/portfolio.md" > fixtures/bull-portfolio.md
curl.exe -sSL --max-time 15 "$BULL_RAW/memory/trade_log.md" > fixtures/bull-trade-log.md
```

- [ ] **Step 8: Sanity-check fixtures**

Run: `ls -la fixtures/`
Expected: 8 files, each non-empty (>500 bytes for the JSON files, >100 bytes for the markdown).

- [ ] **Step 9: Document tab discoveries**

Create `fixtures/README.md`:

```markdown
# Fixtures — captured 2026-04-28

| File | Source tab/path |
|---|---|
| basket-breakout-signals.json | Sheets tab "Basket Breakout Signals" |
| basket-breakout-open-positions.json | Sheets tab "Basket Breakout Open Positions" |
| analyst-hy-v1.json | Sheets tab "Analyst HY v1" |
| aggro-leader-cont.json | Sheets tab "Aggro Leader Continuation Signals" |
| v7-btc-tg.json | Sheets tab "V7-BTC Trend Gated Signals" |
| hy-v4-signals.json | Sheets tab "<FILL_IN_AFTER_STEP_6>" |
| bull-portfolio.md | github.com/Mhairston90/trading-bull/main/memory/portfolio.md |
| bull-trade-log.md | github.com/Mhairston90/trading-bull/main/memory/trade_log.md |

Refresh by re-running Task 2 commands.
```

Replace `<FILL_IN_AFTER_STEP_6>` with the actual tab name.

- [ ] **Step 10: Commit**

```bash
git add fixtures/
git commit -m "chore: capture fixtures from live endpoints"
```

---

### Task 3: Metrics formulas (`lib/metrics.js`)

**Files:**
- Create: `lib/metrics.js`
- Create: `lib/metrics.test.js`

- [ ] **Step 1: Write the failing test**

Create `lib/metrics.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  profitFactor, maxDrawdown, sharpe, winPct, avgR, pctReturn,
  dailyReturnsFromTrades
} from './metrics.js';

test('profitFactor: simple wins and losses', () => {
  assert.equal(profitFactor([10, -5, 20, -10]), 30 / 15);
});

test('profitFactor: all wins returns Infinity', () => {
  assert.equal(profitFactor([10, 20]), Infinity);
});

test('profitFactor: empty array returns null', () => {
  assert.equal(profitFactor([]), null);
});

test('profitFactor: all losses returns 0', () => {
  assert.equal(profitFactor([-10, -5]), 0);
});

test('maxDrawdown: peak-to-trough on running equity', () => {
  // PnLs: +10, +20, -15, -10 -> equity 10, 30, 15, 5 -> peak 30, trough 5 -> DD 25/30 = 83.33%
  const dd = maxDrawdown([10, 20, -15, -10]);
  assert.ok(Math.abs(dd - (-83.33)) < 0.1, `expected ~-83.33, got ${dd}`);
});

test('maxDrawdown: monotonic up returns 0', () => {
  assert.equal(maxDrawdown([10, 20, 30]), 0);
});

test('maxDrawdown: empty array returns 0', () => {
  assert.equal(maxDrawdown([]), 0);
});

test('sharpe: stable positive returns produces positive sharpe', () => {
  const s = sharpe([0.01, 0.012, 0.008, 0.011, 0.009]);
  assert.ok(s > 0, `expected positive, got ${s}`);
});

test('sharpe: zero variance returns null', () => {
  assert.equal(sharpe([0.01, 0.01, 0.01]), null);
});

test('sharpe: < 2 returns produces null', () => {
  assert.equal(sharpe([0.01]), null);
  assert.equal(sharpe([]), null);
});

test('winPct: 50% winners', () => {
  assert.equal(winPct([10, -5, 20, -10]), 50);
});

test('winPct: empty returns null', () => {
  assert.equal(winPct([]), null);
});

test('avgR: mean of valid R-multiples, ignores nulls', () => {
  assert.equal(avgR([1, -1, 2, null, NaN]), (1 - 1 + 2) / 3);
});

test('avgR: all-null returns null', () => {
  assert.equal(avgR([null, NaN]), null);
});

test('pctReturn: total pnl divided by capital', () => {
  assert.equal(pctReturn([100, 200, -50], 1000), 25);
});

test('dailyReturnsFromTrades: groups by exit-date and normalizes', () => {
  const trips = [
    { exit_time: '2026-01-01T10:00:00Z', pnl: 100 },
    { exit_time: '2026-01-01T15:00:00Z', pnl: -50 },
    { exit_time: '2026-01-02T10:00:00Z', pnl: 75 },
  ];
  const returns = dailyReturnsFromTrades(trips, 1000);
  // Day 1: +50 on 1000 capital -> 0.05; Day 2 starts at 1050, +75 -> 0.0714
  assert.equal(returns.length, 2);
  assert.ok(Math.abs(returns[0] - 0.05) < 1e-9);
  assert.ok(Math.abs(returns[1] - 75 / 1050) < 1e-9);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `metrics.js` doesn't exist or exports are missing.

- [ ] **Step 3: Implement `lib/metrics.js`**

Create `lib/metrics.js`:

```js
/**
 * Profit factor = sum(positive PnLs) / |sum(negative PnLs)|.
 * Returns null for empty input. Returns Infinity if no losers. Returns 0 if no winners.
 */
export function profitFactor(pnls) {
  if (pnls.length === 0) return null;
  let wins = 0, losses = 0;
  for (const p of pnls) {
    if (p > 0) wins += p;
    else if (p < 0) losses += -p;
  }
  if (losses === 0) return wins > 0 ? Infinity : null;
  if (wins === 0) return 0;
  return wins / losses;
}

/**
 * Max drawdown as a negative percentage of peak equity.
 * Running-equity model: equity starts at 0, each pnl is added.
 * Returns 0 for empty input or monotonic-up series.
 */
export function maxDrawdown(pnls) {
  if (pnls.length === 0) return 0;
  let equity = 0, peak = 0, maxDD = 0;
  for (const p of pnls) {
    equity += p;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }
  if (peak <= 0) return 0;
  return -(maxDD / peak * 100);
}

/**
 * Annualized Sharpe ratio.
 * Treats crypto as 24/7 (annualization factor sqrt(365)).
 * Returns null if insufficient data or zero variance.
 */
export function sharpe(dailyReturns) {
  if (dailyReturns.length < 2) return null;
  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  const stdev = Math.sqrt(variance);
  if (stdev === 0) return null;
  return (mean / stdev) * Math.sqrt(365);
}

export function winPct(pnls) {
  if (pnls.length === 0) return null;
  const wins = pnls.filter(p => p > 0).length;
  return Math.round((wins / pnls.length) * 100);
}

export function avgR(rMultiples) {
  const valid = rMultiples.filter(r => r != null && !Number.isNaN(r));
  if (valid.length === 0) return null;
  return valid.reduce((s, r) => s + r, 0) / valid.length;
}

export function pctReturn(pnls, startingCapital) {
  if (!startingCapital || startingCapital <= 0) return null;
  const total = pnls.reduce((s, p) => s + p, 0);
  return (total / startingCapital) * 100;
}

/**
 * Convert per-trade pnls (with exit_time) into a daily-returns series
 * for use in Sharpe. Returns are pct-of-prior-day-equity.
 */
export function dailyReturnsFromTrades(roundTrips, startingCapital) {
  if (roundTrips.length === 0) return [];
  const byDay = new Map();
  for (const rt of roundTrips) {
    const day = (rt.exit_time || '').slice(0, 10);
    if (!day) continue;
    byDay.set(day, (byDay.get(day) || 0) + (rt.pnl || 0));
  }
  const days = [...byDay.keys()].sort();
  let equity = startingCapital;
  const returns = [];
  for (const d of days) {
    const dayPnl = byDay.get(d);
    returns.push(dayPnl / equity);
    equity += dayPnl;
  }
  return returns;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: 14 tests passing in `lib/metrics.test.js`.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics.js lib/metrics.test.js
git commit -m "feat: metrics formulas (PF, Sharpe, Max DD, win%, avg R, % return)"
```

---

### Task 4: Round-trip pairing (`lib/pairing.js`)

**Files:**
- Create: `lib/pairing.js`
- Create: `lib/pairing.test.js`

- [ ] **Step 1: Write the failing test**

Create `lib/pairing.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairRoundTrips } from './pairing.js';

test('pairs single entry with single exit, computes long pnl', () => {
  const events = [
    { time: '2026-01-01T10:00Z', symbol: 'BTC', action: 'ENTRY', side: 'long', price: 100, size: 1 },
    { time: '2026-01-01T15:00Z', symbol: 'BTC', action: 'EXIT', side: 'long', price: 110, size: 1 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 1);
  assert.equal(trips[0].pnl, 10);
  assert.equal(trips[0].symbol, 'BTC');
  assert.equal(trips[0].entry_price, 100);
  assert.equal(trips[0].exit_price, 110);
});

test('short trade: profit when price drops', () => {
  const events = [
    { time: '2026-01-01T10:00Z', symbol: 'SOL', action: 'ENTRY', side: 'short', price: 100, size: 2 },
    { time: '2026-01-01T15:00Z', symbol: 'SOL', action: 'EXIT', side: 'short', price: 90, size: 2 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 1);
  assert.equal(trips[0].pnl, 20); // (90 - 100) * 2 * -1 = 20
});

test('partial exit closes a fraction', () => {
  const events = [
    { time: '2026-01-01T10:00Z', symbol: 'BTC', action: 'ENTRY', side: 'long', price: 100, size: 4 },
    { time: '2026-01-01T12:00Z', symbol: 'BTC', action: 'PARTIAL_EXIT', side: 'long', price: 110, size: 2 },
    { time: '2026-01-01T15:00Z', symbol: 'BTC', action: 'EXIT', side: 'long', price: 120, size: 2 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 2);
  assert.equal(trips[0].pnl, 20); // (110-100)*2
  assert.equal(trips[1].pnl, 40); // (120-100)*2
});

test('multiple symbols tracked independently (FIFO per symbol)', () => {
  const events = [
    { time: '2026-01-01T10:00Z', symbol: 'BTC', action: 'ENTRY', side: 'long', price: 100, size: 1 },
    { time: '2026-01-01T11:00Z', symbol: 'ETH', action: 'ENTRY', side: 'long', price: 50, size: 2 },
    { time: '2026-01-01T15:00Z', symbol: 'BTC', action: 'EXIT', side: 'long', price: 110, size: 1 },
    { time: '2026-01-01T16:00Z', symbol: 'ETH', action: 'EXIT', side: 'long', price: 55, size: 2 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 2);
  assert.equal(trips.find(t => t.symbol === 'BTC').pnl, 10);
  assert.equal(trips.find(t => t.symbol === 'ETH').pnl, 10);
});

test('orphan exit (exit without prior entry) is skipped, no throw', () => {
  const events = [
    { time: '2026-01-01T10:00Z', symbol: 'BTC', action: 'EXIT', side: 'long', price: 110, size: 1 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 0);
});

test('pyramid entry: two entries then one big exit closes both FIFO', () => {
  const events = [
    { time: '2026-01-01T10:00Z', symbol: 'BTC', action: 'ENTRY', side: 'long', price: 100, size: 1 },
    { time: '2026-01-01T11:00Z', symbol: 'BTC', action: 'ENTRY', side: 'long', price: 105, size: 1 },
    { time: '2026-01-01T15:00Z', symbol: 'BTC', action: 'EXIT', side: 'long', price: 120, size: 2 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 2);
  assert.equal(trips[0].pnl, 20); // (120-100)*1
  assert.equal(trips[1].pnl, 15); // (120-105)*1
});

test('events processed in chronological order regardless of input order', () => {
  const events = [
    { time: '2026-01-01T15:00Z', symbol: 'BTC', action: 'EXIT', side: 'long', price: 110, size: 1 },
    { time: '2026-01-01T10:00Z', symbol: 'BTC', action: 'ENTRY', side: 'long', price: 100, size: 1 },
  ];
  const trips = pairRoundTrips(events);
  assert.equal(trips.length, 1);
  assert.equal(trips[0].pnl, 10);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `pairing.js` doesn't exist.

- [ ] **Step 3: Implement `lib/pairing.js`**

Create `lib/pairing.js`:

```js
/**
 * Pair entry events with exit events into round-trips, FIFO per symbol.
 * Supports partial exits, pyramiding, and shorts. Orphan exits are silently skipped.
 *
 * @param {Array<{time, symbol, action, side, price, size}>} events
 *   action: 'ENTRY' | 'EXIT' | 'PARTIAL_EXIT'
 * @returns {Array<{entry_time, exit_time, symbol, side, entry_price, exit_price, size, pnl}>}
 */
export function pairRoundTrips(events) {
  const sorted = [...events].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const openBySymbol = new Map(); // symbol -> [{entry_time, entry_price, remaining_size, side}]
  const roundTrips = [];

  for (const ev of sorted) {
    if (ev.action === 'ENTRY') {
      if (!openBySymbol.has(ev.symbol)) openBySymbol.set(ev.symbol, []);
      openBySymbol.get(ev.symbol).push({
        entry_time: ev.time,
        entry_price: ev.price,
        remaining_size: ev.size,
        side: ev.side,
      });
    } else if (ev.action === 'EXIT' || ev.action === 'PARTIAL_EXIT') {
      const lots = openBySymbol.get(ev.symbol) || [];
      let toClose = ev.size;
      while (toClose > 1e-12 && lots.length > 0) {
        const lot = lots[0];
        const closeSize = Math.min(toClose, lot.remaining_size);
        const direction = lot.side === 'long' ? 1 : -1;
        const pnl = (ev.price - lot.entry_price) * closeSize * direction;
        roundTrips.push({
          entry_time: lot.entry_time,
          exit_time: ev.time,
          symbol: ev.symbol,
          side: lot.side,
          entry_price: lot.entry_price,
          exit_price: ev.price,
          size: closeSize,
          pnl,
        });
        lot.remaining_size -= closeSize;
        toClose -= closeSize;
        if (lot.remaining_size <= 1e-12) lots.shift();
      }
      // toClose > 0 here means orphan exit beyond available size — silently dropped
    }
  }
  return roundTrips;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All metrics + pairing tests passing (21 total).

- [ ] **Step 5: Commit**

```bash
git add lib/pairing.js lib/pairing.test.js
git commit -m "feat: round-trip pairing with FIFO partial-fill support"
```

---

### Task 5: BULL markdown parser (`lib/parse_bull_md.js`)

**Files:**
- Create: `lib/parse_bull_md.js`
- Create: `lib/parse_bull_md.test.js`

- [ ] **Step 1: Inspect the BULL fixture format**

Open `fixtures/bull-portfolio.md` and `fixtures/bull-trade-log.md` to confirm the format. Expected key lines in `portfolio.md`:

```
- Cash: **$7,325.59**
- Realized PnL (all-time): **−$222.89**
- Unrealized PnL: **−$7.62**
- Current equity (cash + positions MTM): **$9,769.46**
- Equity peak: **$10,027.55** (set 2026-04-24 midday)
- Drawdown from peak: **2.57%**
```

Trade log rows look like:

```
| 2026-04-21T18:00:00Z | OPEN | TRX/USD | long | 7531 | 0.331943 | 0.330285 | — | — | — | entry-rule-v0-momentum |
| 2026-04-24T04:00:00Z | CLOSE | BTC/USD | long | 0.0322 | 77720.72 | — | — | +0.10 | -9.14 | exit-ema-cross |
```

Column order: `timestamp | action | symbol | side | size | price | stop | _ | r | pnl | reason`. Note: column 8 is empty in current logs (formerly a "stop_dist" field). The parser should handle 11-column rows.

- [ ] **Step 2: Write the failing test**

Create `lib/parse_bull_md.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePortfolio, parseTradeLog } from './parse_bull_md.js';

const portfolioMd = readFileSync(new URL('../fixtures/bull-portfolio.md', import.meta.url), 'utf8');
const tradeLogMd  = readFileSync(new URL('../fixtures/bull-trade-log.md', import.meta.url), 'utf8');

test('parsePortfolio extracts cash, equity, peak, drawdown, realized', () => {
  const p = parsePortfolio(portfolioMd);
  assert.ok(p.cash > 0, 'cash should parse to positive');
  assert.ok(p.equity > 0, 'equity should parse to positive');
  assert.ok(p.peak >= p.equity, 'peak should be >= current equity');
  assert.ok(p.drawdown_pct >= 0, 'drawdown_pct should be non-negative (stored as positive number)');
  assert.equal(typeof p.realized_pnl, 'number');
});

test('parsePortfolio handles negative realized PnL with em-dash', () => {
  const md = '- Realized PnL (all-time): **−$222.89**';
  const p = parsePortfolio(md);
  assert.equal(p.realized_pnl, -222.89);
});

test('parsePortfolio handles ASCII minus realized PnL', () => {
  const md = '- Realized PnL (all-time): **-$222.89**';
  const p = parsePortfolio(md);
  assert.equal(p.realized_pnl, -222.89);
});

test('parseTradeLog returns OPEN and CLOSE rows', () => {
  const rows = parseTradeLog(tradeLogMd);
  assert.ok(rows.length > 0, 'should parse at least one row');
  const opens = rows.filter(r => r.action === 'OPEN');
  const closes = rows.filter(r => r.action === 'CLOSE');
  assert.ok(opens.length > 0);
  assert.ok(closes.length > 0);
});

test('parseTradeLog: CLOSE row has r and pnl populated', () => {
  const rows = parseTradeLog(tradeLogMd);
  const close = rows.find(r => r.action === 'CLOSE');
  assert.equal(typeof close.r, 'number');
  assert.equal(typeof close.pnl, 'number');
  assert.ok(close.symbol.includes('/'));
});

test('parseTradeLog: OPEN row has stop populated, r/pnl null', () => {
  const rows = parseTradeLog(tradeLogMd);
  const open = rows.find(r => r.action === 'OPEN');
  assert.equal(open.r, null);
  assert.equal(open.pnl, null);
  assert.ok(open.stop > 0 || open.stop === null);
});

test('parseTradeLog skips header and separator lines', () => {
  const rows = parseTradeLog(tradeLogMd);
  for (const r of rows) {
    assert.ok(r.action === 'OPEN' || r.action === 'CLOSE',
      `unexpected action: ${r.action}`);
  }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 4: Implement `lib/parse_bull_md.js`**

Create `lib/parse_bull_md.js`:

```js
/**
 * Parse BULL portfolio.md to extract account state.
 * Returns { cash, realized_pnl, unrealized_pnl, equity, peak, drawdown_pct }.
 * Any field that fails to parse is set to null.
 */
export function parsePortfolio(md) {
  const numericFromMatch = (m) => {
    if (!m || !m[1]) return null;
    // Strip $, commas. Em-dash (−, U+2212) and ASCII minus (-) both indicate negative.
    let s = m[1].replace(/[\$,]/g, '').trim();
    let negative = false;
    if (s.startsWith('−') || s.startsWith('-')) {
      negative = true;
      s = s.slice(1);
    }
    const n = parseFloat(s);
    if (Number.isNaN(n)) return null;
    return negative ? -n : n;
  };

  return {
    cash:           numericFromMatch(md.match(/Cash:\s*\*\*([^*]+)\*\*/)),
    realized_pnl:   numericFromMatch(md.match(/Realized PnL[^*]*\*\*([^*]+)\*\*/)),
    unrealized_pnl: numericFromMatch(md.match(/Unrealized PnL:\s*\*\*([^*]+)\*\*/)),
    equity:         numericFromMatch(md.match(/Current equity[^*]*\*\*([^*]+)\*\*/)),
    peak:           numericFromMatch(md.match(/Equity peak:\s*\*\*([^*]+)\*\*/)),
    drawdown_pct:   numericFromMatch(md.match(/Drawdown from peak:\s*\*\*([^*]+)%\*\*/)),
  };
}

/**
 * Parse BULL trade_log.md table rows.
 * Returns array of {time, action, symbol, side, size, price, stop, r, pnl, reason}.
 * Rows that don't match expected structure are skipped.
 */
export function parseTradeLog(md) {
  const out = [];
  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;
    if (line.includes('---')) continue;
    if (/timestamp\s*\|/i.test(line)) continue;

    const cells = line.split('|').map(c => c.trim());
    // Drop leading/trailing empty cells from leading/trailing pipes
    while (cells.length && cells[0] === '') cells.shift();
    while (cells.length && cells[cells.length - 1] === '') cells.pop();
    if (cells.length < 10) continue;

    const [time, action, symbol, side, size, price, stop, , r, pnl, reason = ''] = cells;
    if (action !== 'OPEN' && action !== 'CLOSE') continue;

    const num = (v) => {
      if (v == null) return null;
      const t = v.trim();
      if (t === '' || t === '—' || t === '?' || t === '-') return null;
      // Handle leading + (e.g., "+0.10") and em-dash minus
      let cleaned = t.replace(/[+,$]/g, '').replace(/^−/, '-');
      const n = parseFloat(cleaned);
      return Number.isNaN(n) ? null : n;
    };

    out.push({
      time,
      action,
      symbol,
      side,
      size: num(size),
      price: num(price),
      stop: num(stop),
      r: num(r),
      pnl: num(pnl),
      reason,
    });
  }
  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: All tests passing (28 total now).

- [ ] **Step 6: Commit**

```bash
git add lib/parse_bull_md.js lib/parse_bull_md.test.js
git commit -m "feat: BULL portfolio.md and trade_log.md parsers"
```

---

### Task 6: Fetch layer (`lib/fetch.js`)

**Files:**
- Create: `lib/fetch.js`

This module is browser-side `fetch()` with timeout and unified error shape. Not unit-tested (would require mocking `fetch`); validated end-to-end in Task 17.

- [ ] **Step 1: Implement `lib/fetch.js`**

Create `lib/fetch.js`:

```js
const SHEET_BASE = 'https://script.google.com/macros/s/AKfycbyVLBnBLtremcupVRW-9B7a9tST7CpjTZQPr8OWxeGvMfs17Md53u01yFks8Y4uQ4ny/exec';
const BULL_RAW_BASE = 'https://raw.githubusercontent.com/Mhairston90/trading-bull/main';

const DEFAULT_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, timeout = DEFAULT_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return res;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch a Sheets tab. Returns { ok, tab, rows, headers, error? }.
 */
export async function fetchSheetTab(tab, limit = 200) {
  const url = `${SHEET_BASE}?tab=${encodeURIComponent(tab)}&limit=${limit}`;
  try {
    const res = await fetchWithTimeout(url);
    const data = await res.json();
    if (data.status !== 'ok') {
      return { ok: false, tab, rows: [], headers: [], error: data.message || 'doGet returned non-ok' };
    }
    return { ok: true, tab, rows: data.rows || [], headers: data.headers || [] };
  } catch (e) {
    return { ok: false, tab, rows: [], headers: [], error: e.message };
  }
}

/**
 * Fetch a BULL repo file (markdown). Returns { ok, path, text, error? }.
 */
export async function fetchBullFile(relPath) {
  const url = `${BULL_RAW_BASE}/${relPath}`;
  try {
    const res = await fetchWithTimeout(url);
    const text = await res.text();
    return { ok: true, path: relPath, text };
  } catch (e) {
    return { ok: false, path: relPath, text: '', error: e.message };
  }
}
```

- [ ] **Step 2: Verify imports work (syntax check via Node)**

Run: `node --check lib/fetch.js`
Expected: No output (syntax valid).

- [ ] **Step 3: Commit**

```bash
git add lib/fetch.js
git commit -m "feat: browser fetch layer with timeout for Sheets + GitHub raw"
```

---

### Task 7: Adapter — Basket Breakout v1

**Files:**
- Create: `adapters/adapter_basket_breakout.js`
- Create: `adapters/adapter_basket_breakout.test.js`

This is the first adapter and sets the pattern for the others. Inspect `fixtures/basket-breakout-signals.json` first to confirm the field schema. Expected fields per row: `timestamp, version, action, symbol, price, atr, stop, heat_status, open_count_at_receipt, notes`.

`heat_status` values seen: `ACCEPTED` (entry confirmed by Apps Script heat cap), `EXIT`, possibly `REJECTED` (we ignore those).

- [ ] **Step 1: Write the failing test**

Create `adapters/adapter_basket_breakout.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import adaptBasketBreakout from './adapter_basket_breakout.js';

const fixture = JSON.parse(readFileSync(
  new URL('../fixtures/basket-breakout-signals.json', import.meta.url), 'utf8'
));

test('basket breakout adapter returns normalized StrategyRow shape', () => {
  const row = adaptBasketBreakout(fixture, { startingCapital: 10000 });
  assert.equal(typeof row.name, 'string');
  assert.equal(row.name, 'Basket Breakout v1');
  assert.equal(row.status, 'live');
  assert.ok(row.returns);
  assert.ok('7d' in row.returns);
  assert.ok('30d' in row.returns);
  assert.ok('90d' in row.returns);
  assert.ok('all' in row.returns);
  assert.equal(typeof row.trades_n, 'number');
  assert.deepEqual(row.confidence, { sharpe: 'best-effort', pf: 'best-effort', max_dd: 'best-effort' });
  assert.ok(Array.isArray(row.errors));
});

test('adapter handles fixture without throwing', () => {
  assert.doesNotThrow(() => adaptBasketBreakout(fixture, { startingCapital: 10000 }));
});

test('adapter on synthetic 1-trip dataset computes correct PnL', () => {
  const synth = {
    ok: true,
    rows: [
      { timestamp: '2026-01-01T10:00Z', action: 'ENTRY_REQUEST', heat_status: 'ACCEPTED',
        symbol: 'BTCUSD', price: 100, stop: 95, side: 'long', size: 1 },
      { timestamp: '2026-01-01T15:00Z', action: 'EXIT', heat_status: 'EXIT',
        symbol: 'BTCUSD', price: 110, side: 'long', size: 1 },
    ]
  };
  const row = adaptBasketBreakout(synth, { startingCapital: 1000 });
  assert.equal(row.trades_n, 1);
  assert.equal(row.returns.all, 1.0); // $10 / $1000 = 1%
});

test('adapter ignores REJECTED entries', () => {
  const synth = {
    ok: true,
    rows: [
      { timestamp: '2026-01-01T10:00Z', action: 'ENTRY_REQUEST', heat_status: 'REJECTED',
        symbol: 'BTCUSD', price: 100, side: 'long', size: 1 },
    ]
  };
  const row = adaptBasketBreakout(synth, { startingCapital: 1000 });
  assert.equal(row.trades_n, 0);
});

test('adapter sets last_signal_at to most recent event time', () => {
  const synth = {
    ok: true,
    rows: [
      { timestamp: '2026-01-01T10:00Z', action: 'ENTRY_REQUEST', heat_status: 'ACCEPTED',
        symbol: 'BTC', price: 100, side: 'long', size: 1 },
      { timestamp: '2026-02-15T10:00Z', action: 'EXIT', heat_status: 'EXIT',
        symbol: 'BTC', price: 110, side: 'long', size: 1 },
    ]
  };
  const row = adaptBasketBreakout(synth, { startingCapital: 1000 });
  assert.equal(row.last_signal_at, '2026-02-15T10:00Z');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — adapter doesn't exist.

- [ ] **Step 3: Implement `adapters/adapter_basket_breakout.js`**

Create `adapters/adapter_basket_breakout.js`:

```js
import { pairRoundTrips } from '../lib/pairing.js';
import {
  profitFactor, maxDrawdown, sharpe, winPct, avgR, pctReturn, dailyReturnsFromTrades
} from '../lib/metrics.js';

/**
 * Adapter for Basket Breakout v1 Sheets tab.
 * Long-only multi-asset 1H crossover-breakout. heat_status='ACCEPTED' means entry fired,
 * heat_status='EXIT' means exit fired. REJECTED entries are dropped.
 *
 * @param {{ok, rows}} sheetResp - response from fetchSheetTab
 * @param {{startingCapital: number}} opts
 * @returns {StrategyRow}
 */
export default function adaptBasketBreakout(sheetResp, opts) {
  const errors = [];
  if (!sheetResp || !sheetResp.ok) {
    return makeErrorRow('Basket Breakout v1', sheetResp?.error || 'no data');
  }
  const startingCapital = opts.startingCapital;

  const events = [];
  for (const r of sheetResp.rows) {
    const action = String(r.action || '').toUpperCase();
    const heat = String(r.heat_status || '').toUpperCase();

    if (action.includes('ENTRY') && heat === 'ACCEPTED') {
      events.push({
        time: r.timestamp,
        symbol: r.symbol,
        action: 'ENTRY',
        side: r.side || 'long',
        price: Number(r.price),
        size: Number(r.size) || 1, // Basket may not log size; fall back to 1 unit
      });
    } else if (action === 'EXIT' || heat === 'EXIT') {
      events.push({
        time: r.timestamp,
        symbol: r.symbol,
        action: 'EXIT',
        side: 'long',
        price: Number(r.price),
        size: Number(r.size) || 1,
      });
    }
    // ENTRY_REQUEST + REJECTED is ignored.
  }

  const trips = pairRoundTrips(events);
  return computeStrategyRow({
    name: 'Basket Breakout v1',
    status: 'live',
    trips,
    startingCapital,
    last_signal_at: latestTime(events),
    errors,
  });
}

// ----- shared helpers (will be extracted in Task 8 if duplicated) -----

export function makeErrorRow(name, err) {
  return {
    name, status: 'error',
    returns: { '7d': null, '30d': null, '90d': null, all: null },
    sharpe: null, pf: null, max_dd: null, win_pct: null, trades_n: 0,
    avg_r: null, last_signal_at: null,
    confidence: { sharpe: 'best-effort', pf: 'best-effort', max_dd: 'best-effort' },
    errors: [err],
  };
}

export function latestTime(events) {
  if (!events.length) return null;
  return events.reduce((a, b) => (a > b.time ? a : b.time), events[0].time);
}

export function computeStrategyRow({ name, status, trips, startingCapital, last_signal_at, errors }) {
  const now = Date.now();
  const cutoff = (days) => now - days * 24 * 60 * 60 * 1000;
  const tripsInWindow = (days) => trips.filter(t => new Date(t.exit_time).getTime() >= cutoff(days));

  const pnls    = trips.map(t => t.pnl);
  const pnls7   = tripsInWindow(7).map(t => t.pnl);
  const pnls30  = tripsInWindow(30).map(t => t.pnl);
  const pnls90  = tripsInWindow(90).map(t => t.pnl);

  return {
    name,
    status,
    returns: {
      '7d':  pctReturn(pnls7,  startingCapital),
      '30d': pctReturn(pnls30, startingCapital),
      '90d': pctReturn(pnls90, startingCapital),
      all:   pctReturn(pnls,    startingCapital),
    },
    sharpe:    sharpe(dailyReturnsFromTrades(trips, startingCapital)),
    pf:        profitFactor(pnls),
    max_dd:    maxDrawdown(pnls),
    win_pct:   winPct(pnls),
    trades_n:  trips.length,
    avg_r:     null, // Basket doesn't log per-trade R explicitly
    last_signal_at,
    confidence: { sharpe: 'best-effort', pf: 'best-effort', max_dd: 'best-effort' },
    errors,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All previous tests + 5 basket adapter tests passing.

- [ ] **Step 5: Commit**

```bash
git add adapters/adapter_basket_breakout.js adapters/adapter_basket_breakout.test.js
git commit -m "feat: Basket Breakout v1 adapter"
```

---

### Task 8: Adapter — Analyst HY v1

**Files:**
- Create: `adapters/adapter_analyst_hy.js`
- Create: `adapters/adapter_analyst_hy.test.js`

Analyst HY v1: SOL 4H breakout, long-only. Tab schema may use `signal: ENTRY_LONG | EXIT_LONG` or `action: ENTRY | EXIT`. Inspect `fixtures/analyst-hy-v1.json` row shape and adapt below.

- [ ] **Step 1: Inspect fixture schema**

Run: `node -e "const d=JSON.parse(require('fs').readFileSync('fixtures/analyst-hy-v1.json','utf8')); console.log('headers:', d.headers); console.log('sample:', d.rows.slice(0,2));"`

Document the actual field names. The implementation below assumes `signal` and `price` fields with `ENTRY_LONG` / `EXIT_LONG` values. If your fixture differs, adjust the field names in step 3 before writing the test.

- [ ] **Step 2: Write the failing test**

Create `adapters/adapter_analyst_hy.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import adaptAnalystHY from './adapter_analyst_hy.js';

const fixture = JSON.parse(readFileSync(
  new URL('../fixtures/analyst-hy-v1.json', import.meta.url), 'utf8'
));

test('analyst hy adapter returns normalized row', () => {
  const row = adaptAnalystHY(fixture, { startingCapital: 2000 });
  assert.equal(row.name, 'Analyst HY v1');
  assert.equal(row.status, 'live');
  assert.ok(row.returns);
  assert.equal(typeof row.trades_n, 'number');
});

test('analyst hy adapter does not throw on real fixture', () => {
  assert.doesNotThrow(() => adaptAnalystHY(fixture, { startingCapital: 2000 }));
});

test('analyst hy adapter computes pnl on synthetic data', () => {
  const synth = {
    ok: true,
    rows: [
      { timestamp: '2026-01-01T10:00Z', signal: 'ENTRY_LONG', symbol: 'SOLUSD', price: 100, size: 1 },
      { timestamp: '2026-01-01T15:00Z', signal: 'EXIT_LONG', symbol: 'SOLUSD', price: 110, size: 1 },
    ]
  };
  const row = adaptAnalystHY(synth, { startingCapital: 1000 });
  assert.equal(row.trades_n, 1);
  assert.equal(row.returns.all, 1.0);
});
```

- [ ] **Step 3: Implement `adapters/adapter_analyst_hy.js`**

Create `adapters/adapter_analyst_hy.js`:

```js
import { pairRoundTrips } from '../lib/pairing.js';
import { computeStrategyRow, latestTime, makeErrorRow } from './adapter_basket_breakout.js';

export default function adaptAnalystHY(sheetResp, opts) {
  if (!sheetResp || !sheetResp.ok) {
    return makeErrorRow('Analyst HY v1', sheetResp?.error || 'no data');
  }
  const events = [];
  for (const r of sheetResp.rows) {
    const sig = String(r.signal || r.action || '').toUpperCase();
    if (sig === 'ENTRY_LONG' || sig === 'ENTRY') {
      events.push({
        time: r.timestamp, symbol: r.symbol, action: 'ENTRY',
        side: 'long', price: Number(r.price), size: Number(r.size) || 1,
      });
    } else if (sig === 'EXIT_LONG' || sig === 'EXIT') {
      events.push({
        time: r.timestamp, symbol: r.symbol, action: 'EXIT',
        side: 'long', price: Number(r.price), size: Number(r.size) || 1,
      });
    }
  }
  const trips = pairRoundTrips(events);
  return computeStrategyRow({
    name: 'Analyst HY v1',
    status: 'live',
    trips,
    startingCapital: opts.startingCapital,
    last_signal_at: latestTime(events),
    errors: [],
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All previous + 3 analyst tests passing.

- [ ] **Step 5: Commit**

```bash
git add adapters/adapter_analyst_hy.js adapters/adapter_analyst_hy.test.js
git commit -m "feat: Analyst HY v1 adapter"
```

---

### Task 9: Adapter — Aggro Leader Continuation v1

**Files:**
- Create: `adapters/adapter_aggro_doge.js`
- Create: `adapters/adapter_aggro_doge.test.js`

DOGE 1H continuation. Inspect `fixtures/aggro-leader-cont.json` schema first.

- [ ] **Step 1: Inspect fixture**

Run: `node -e "const d=JSON.parse(require('fs').readFileSync('fixtures/aggro-leader-cont.json','utf8')); console.log(d.headers); console.log(d.rows.slice(0,2));"`

- [ ] **Step 2: Write the failing test**

Create `adapters/adapter_aggro_doge.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import adaptAggroDoge from './adapter_aggro_doge.js';

const fixture = JSON.parse(readFileSync(
  new URL('../fixtures/aggro-leader-cont.json', import.meta.url), 'utf8'
));

test('aggro adapter returns normalized row', () => {
  const row = adaptAggroDoge(fixture, { startingCapital: 5000 });
  assert.equal(row.name, 'Aggro Leader Continuation v1');
  assert.equal(row.status, 'canary');
  assert.ok(row.returns);
});

test('aggro adapter does not throw on real fixture', () => {
  assert.doesNotThrow(() => adaptAggroDoge(fixture, { startingCapital: 5000 }));
});

test('aggro adapter computes pnl on synthetic data', () => {
  const synth = {
    ok: true,
    rows: [
      { timestamp: '2026-01-01T10:00Z', signal: 'ENTRY_LONG', symbol: 'DOGEUSD', price: 0.10, size: 1000 },
      { timestamp: '2026-01-01T15:00Z', signal: 'EXIT_LONG', symbol: 'DOGEUSD', price: 0.11, size: 1000 },
    ]
  };
  const row = adaptAggroDoge(synth, { startingCapital: 1000 });
  assert.equal(row.trades_n, 1);
  // 0.01 * 1000 = $10 pnl, $10/$1000 = 1%
  assert.equal(row.returns.all, 1.0);
});
```

- [ ] **Step 3: Implement `adapters/adapter_aggro_doge.js`**

Create `adapters/adapter_aggro_doge.js`:

```js
import { pairRoundTrips } from '../lib/pairing.js';
import { computeStrategyRow, latestTime, makeErrorRow } from './adapter_basket_breakout.js';

export default function adaptAggroDoge(sheetResp, opts) {
  if (!sheetResp || !sheetResp.ok) {
    return makeErrorRow('Aggro Leader Continuation v1', sheetResp?.error || 'no data');
  }
  const events = [];
  for (const r of sheetResp.rows) {
    const sig = String(r.signal || r.action || '').toUpperCase();
    if (sig === 'ENTRY_LONG' || sig === 'ENTRY') {
      events.push({
        time: r.timestamp, symbol: r.symbol, action: 'ENTRY',
        side: 'long', price: Number(r.price), size: Number(r.size) || 1,
      });
    } else if (sig === 'EXIT_LONG' || sig === 'EXIT') {
      events.push({
        time: r.timestamp, symbol: r.symbol, action: 'EXIT',
        side: 'long', price: Number(r.price), size: Number(r.size) || 1,
      });
    }
  }
  const trips = pairRoundTrips(events);
  return computeStrategyRow({
    name: 'Aggro Leader Continuation v1',
    status: 'canary',
    trips,
    startingCapital: opts.startingCapital,
    last_signal_at: latestTime(events),
    errors: [],
  });
}
```

- [ ] **Step 4: Run tests, commit**

Run: `npm test`
Expected: All passing.

```bash
git add adapters/adapter_aggro_doge.js adapters/adapter_aggro_doge.test.js
git commit -m "feat: Aggro Leader Continuation v1 adapter"
```

---

### Task 10: Adapter — HY v4 Tuned

**Files:**
- Create: `adapters/adapter_hy_v4.js`
- Create: `adapters/adapter_hy_v4.test.js`

HY v4 supports both long and short on SOLUSD. Schema likely uses `signal: ENTRY_LONG | ENTRY_SHORT | EXIT_LONG | EXIT_SHORT`.

- [ ] **Step 1: Inspect fixture**

Run: `node -e "const d=JSON.parse(require('fs').readFileSync('fixtures/hy-v4-signals.json','utf8')); console.log(d.headers); console.log(d.rows.slice(0,3));"`

- [ ] **Step 2: Write the failing test**

Create `adapters/adapter_hy_v4.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import adaptHYv4 from './adapter_hy_v4.js';

const fixture = JSON.parse(readFileSync(
  new URL('../fixtures/hy-v4-signals.json', import.meta.url), 'utf8'
));

test('HY v4 adapter returns normalized row', () => {
  const row = adaptHYv4(fixture, { startingCapital: 2000 });
  assert.equal(row.name, 'HY v4 Tuned');
  assert.equal(row.status, 'live');
  assert.ok(row.returns);
});

test('HY v4 adapter does not throw on real fixture', () => {
  assert.doesNotThrow(() => adaptHYv4(fixture, { startingCapital: 2000 }));
});

test('HY v4 adapter handles short trades', () => {
  const synth = {
    ok: true,
    rows: [
      { timestamp: '2026-01-01T10:00Z', signal: 'ENTRY_SHORT', symbol: 'SOLUSD', price: 100, size: 1 },
      { timestamp: '2026-01-01T15:00Z', signal: 'EXIT_SHORT', symbol: 'SOLUSD', price: 90, size: 1 },
    ]
  };
  const row = adaptHYv4(synth, { startingCapital: 1000 });
  assert.equal(row.trades_n, 1);
  // Short profit when price drops: (90-100)*1*-1 = +10, +10/1000 = 1.0%
  assert.equal(row.returns.all, 1.0);
});
```

- [ ] **Step 3: Implement `adapters/adapter_hy_v4.js`**

Create `adapters/adapter_hy_v4.js`:

```js
import { pairRoundTrips } from '../lib/pairing.js';
import { computeStrategyRow, latestTime, makeErrorRow } from './adapter_basket_breakout.js';

export default function adaptHYv4(sheetResp, opts) {
  if (!sheetResp || !sheetResp.ok) {
    return makeErrorRow('HY v4 Tuned', sheetResp?.error || 'no data');
  }
  const events = [];
  for (const r of sheetResp.rows) {
    const sig = String(r.signal || r.action || '').toUpperCase();
    let action = null, side = null;
    if (sig === 'ENTRY_LONG')  { action = 'ENTRY'; side = 'long';  }
    else if (sig === 'ENTRY_SHORT') { action = 'ENTRY'; side = 'short'; }
    else if (sig === 'EXIT_LONG')  { action = 'EXIT'; side = 'long';  }
    else if (sig === 'EXIT_SHORT') { action = 'EXIT'; side = 'short'; }
    if (!action) continue;

    events.push({
      time: r.timestamp,
      symbol: r.symbol,
      action,
      side,
      price: Number(r.price),
      size: Number(r.size) || 1,
    });
  }
  const trips = pairRoundTrips(events);
  return computeStrategyRow({
    name: 'HY v4 Tuned',
    status: 'live',
    trips,
    startingCapital: opts.startingCapital,
    last_signal_at: latestTime(events),
    errors: [],
  });
}
```

- [ ] **Step 4: Run tests, commit**

Run: `npm test`

```bash
git add adapters/adapter_hy_v4.js adapters/adapter_hy_v4.test.js
git commit -m "feat: HY v4 Tuned adapter (long+short)"
```

---

### Task 11: Adapter — HY v7-Best BTC Trend Gated

**Files:**
- Create: `adapters/adapter_v7_btc_tg.js`
- Create: `adapters/adapter_v7_btc_tg.test.js`

V7-Best is "research only" per spec — its row may have all `null` returns if no live signals were ever sent. The adapter handles that gracefully.

- [ ] **Step 1: Write the failing test**

Create `adapters/adapter_v7_btc_tg.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import adaptV7BtcTG from './adapter_v7_btc_tg.js';

const fixture = JSON.parse(readFileSync(
  new URL('../fixtures/v7-btc-tg.json', import.meta.url), 'utf8'
));

test('V7 BTC TG adapter returns normalized row, status=research', () => {
  const row = adaptV7BtcTG(fixture, { startingCapital: 2000 });
  assert.equal(row.name, 'HY v7-Best BTC TG');
  assert.equal(row.status, 'research');
});

test('V7 BTC TG adapter handles empty fixture without throwing', () => {
  const empty = { ok: true, rows: [] };
  const row = adaptV7BtcTG(empty, { startingCapital: 2000 });
  assert.equal(row.trades_n, 0);
  assert.equal(row.returns.all, 0);
});
```

- [ ] **Step 2: Implement `adapters/adapter_v7_btc_tg.js`**

Create `adapters/adapter_v7_btc_tg.js`:

```js
import { pairRoundTrips } from '../lib/pairing.js';
import { computeStrategyRow, latestTime, makeErrorRow } from './adapter_basket_breakout.js';

export default function adaptV7BtcTG(sheetResp, opts) {
  if (!sheetResp || !sheetResp.ok) {
    return makeErrorRow('HY v7-Best BTC TG', sheetResp?.error || 'no data');
  }
  const events = [];
  for (const r of sheetResp.rows) {
    const sig = String(r.signal || r.action || '').toUpperCase();
    let action = null, side = null;
    if (sig === 'ENTRY_LONG')  { action = 'ENTRY'; side = 'long';  }
    else if (sig === 'ENTRY_SHORT') { action = 'ENTRY'; side = 'short'; }
    else if (sig === 'EXIT_LONG')  { action = 'EXIT'; side = 'long';  }
    else if (sig === 'EXIT_SHORT') { action = 'EXIT'; side = 'short'; }
    if (!action) continue;
    events.push({
      time: r.timestamp, symbol: r.symbol, action, side,
      price: Number(r.price), size: Number(r.size) || 1,
    });
  }
  const trips = pairRoundTrips(events);
  return computeStrategyRow({
    name: 'HY v7-Best BTC TG',
    status: 'research',
    trips,
    startingCapital: opts.startingCapital,
    last_signal_at: latestTime(events),
    errors: [],
  });
}
```

- [ ] **Step 3: Run tests, commit**

Run: `npm test`

```bash
git add adapters/adapter_v7_btc_tg.js adapters/adapter_v7_btc_tg.test.js
git commit -m "feat: HY v7-Best BTC TG adapter (research)"
```

---

### Task 12: Adapter — BULL v0

**Files:**
- Create: `adapters/adapter_bull.js`
- Create: `adapters/adapter_bull.test.js`

BULL is special: data comes as TWO markdown files (portfolio.md + trade_log.md), not Sheets JSON. Adapter receives `{ portfolio, tradeLog }` (both `{ok, text, error?}` from `fetchBullFile`).

- [ ] **Step 1: Write the failing test**

Create `adapters/adapter_bull.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import adaptBull from './adapter_bull.js';

const portfolio = readFileSync(
  new URL('../fixtures/bull-portfolio.md', import.meta.url), 'utf8'
);
const tradeLog = readFileSync(
  new URL('../fixtures/bull-trade-log.md', import.meta.url), 'utf8'
);

test('bull adapter returns normalized row from real fixtures', () => {
  const row = adaptBull(
    { portfolio: { ok: true, text: portfolio }, tradeLog: { ok: true, text: tradeLog } },
    { startingCapital: 10000 }
  );
  assert.equal(row.name, 'BULL v0');
  assert.equal(row.status, 'live');
  assert.equal(typeof row.trades_n, 'number');
  assert.ok(row.trades_n > 0);
  assert.equal(typeof row.returns.all, 'number');
});

test('bull adapter avg_r populated from trade_log r-multiples', () => {
  const row = adaptBull(
    { portfolio: { ok: true, text: portfolio }, tradeLog: { ok: true, text: tradeLog } },
    { startingCapital: 10000 }
  );
  assert.notEqual(row.avg_r, null);
  assert.equal(typeof row.avg_r, 'number');
});

test('bull adapter handles missing portfolio source gracefully', () => {
  const row = adaptBull(
    { portfolio: { ok: false, error: 'fetch failed' }, tradeLog: { ok: true, text: tradeLog } },
    { startingCapital: 10000 }
  );
  assert.equal(row.name, 'BULL v0');
  assert.ok(row.errors.some(e => e.includes('portfolio')));
});

test('bull adapter handles missing trade log gracefully', () => {
  const row = adaptBull(
    { portfolio: { ok: true, text: portfolio }, tradeLog: { ok: false, error: 'fetch failed' } },
    { startingCapital: 10000 }
  );
  assert.equal(row.name, 'BULL v0');
  assert.equal(row.trades_n, 0);
});
```

- [ ] **Step 2: Implement `adapters/adapter_bull.js`**

Create `adapters/adapter_bull.js`:

```js
import { pairRoundTrips } from '../lib/pairing.js';
import { parsePortfolio, parseTradeLog } from '../lib/parse_bull_md.js';
import { computeStrategyRow, latestTime, makeErrorRow } from './adapter_basket_breakout.js';
import {
  profitFactor, maxDrawdown, sharpe, winPct, avgR, pctReturn, dailyReturnsFromTrades
} from '../lib/metrics.js';

/**
 * BULL adapter. Receives both portfolio and trade-log fetch results.
 * Trades are parsed from trade_log.md (preferred — has R-multiples).
 * Portfolio.md is used to surface live equity / drawdown / kill-switch state.
 */
export default function adaptBull({ portfolio, tradeLog }, opts) {
  const errors = [];
  if (!portfolio || !portfolio.ok) errors.push('portfolio: ' + (portfolio?.error || 'missing'));
  if (!tradeLog || !tradeLog.ok)   errors.push('tradeLog: ' + (tradeLog?.error || 'missing'));

  // If trade log is unavailable, return empty-row but with portfolio data if present.
  let trips = [];
  let rMultiples = [];
  let lastSig = null;

  if (tradeLog && tradeLog.ok) {
    const rows = parseTradeLog(tradeLog.text);
    rMultiples = rows.filter(r => r.action === 'CLOSE' && r.r != null).map(r => r.r);
    lastSig = rows.length ? rows[rows.length - 1].time : null;

    // Convert OPEN/CLOSE rows to event stream for pairing
    const events = rows.map(r => ({
      time: r.time,
      symbol: r.symbol,
      action: r.action === 'OPEN' ? 'ENTRY' : 'EXIT',
      side: r.side,
      price: r.price,
      size: r.size,
    })).filter(e => e.price != null && e.size != null);

    trips = pairRoundTrips(events);
  }

  const row = computeStrategyRow({
    name: 'BULL v0',
    status: 'live',
    trips,
    startingCapital: opts.startingCapital,
    last_signal_at: lastSig,
    errors,
  });

  // Override avg_r with explicit R-multiples from trade log (more accurate than computed)
  row.avg_r = avgR(rMultiples);

  return row;
}
```

- [ ] **Step 3: Run tests, commit**

Run: `npm test`
Expected: All passing.

```bash
git add adapters/adapter_bull.js adapters/adapter_bull.test.js
git commit -m "feat: BULL v0 adapter (portfolio.md + trade_log.md)"
```

---

### Task 13: Strategy registry (`registry.js`)

**Files:**
- Create: `registry.js`

- [ ] **Step 1: Implement `registry.js`**

Create `registry.js`:

```js
import adaptHYv4         from './adapters/adapter_hy_v4.js';
import adaptV7BtcTG      from './adapters/adapter_v7_btc_tg.js';
import adaptBasket       from './adapters/adapter_basket_breakout.js';
import adaptAggroDoge    from './adapters/adapter_aggro_doge.js';
import adaptAnalystHY    from './adapters/adapter_analyst_hy.js';
import adaptBull         from './adapters/adapter_bull.js';

/**
 * STRATEGIES registry: defines source, adapter, and per-strategy capital + kill-switch.
 *
 * source.type: 'sheets' | 'bull-github'
 *   - 'sheets': single-tab fetch, source.tab = tab name
 *   - 'bull-github': dual-fetch, hardcoded portfolio.md + trade_log.md paths
 *
 * starting_capital: paper-account size used for % return normalization.
 *   For strategies without an explicit declared capital (Basket, Aggro), this is a
 *   *virtual* capital — change it if you want to anchor returns differently.
 *   Document the rationale in the comment.
 *
 * killswitch_dd_pct: max drawdown threshold (positive %); row tints amber at 90% of this.
 */
export const STRATEGIES = [
  {
    name: 'HY v4 Tuned',
    starting_capital: 2000,
    killswitch_dd_pct: 25,
    source: { type: 'sheets', tab: 'V6 Signals' }, // CONFIRM in Task 2 step 6
    adapter: adaptHYv4,
  },
  {
    name: 'HY v7-Best BTC TG',
    starting_capital: 2000,
    killswitch_dd_pct: 25,
    source: { type: 'sheets', tab: 'V7-BTC Trend Gated Signals' },
    adapter: adaptV7BtcTG,
  },
  {
    name: 'Basket Breakout v1',
    // virtual capital — Basket uses 0.5% risk-per-trade with no explicit declared starting capital.
    // $10k chosen to match BULL for visual symmetry. Adjust if you want different anchor.
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    source: { type: 'sheets', tab: 'Basket Breakout Signals' },
    adapter: adaptBasket,
  },
  {
    name: 'Aggro Leader Continuation v1',
    // virtual capital — Aggro is canary-sized. $5k chosen as plausible canary account.
    starting_capital: 5000,
    killswitch_dd_pct: 12,
    source: { type: 'sheets', tab: 'Aggro Leader Continuation Signals' },
    adapter: adaptAggroDoge,
  },
  {
    name: 'Analyst HY v1',
    starting_capital: 2000,
    killswitch_dd_pct: 25,
    source: { type: 'sheets', tab: 'Analyst HY v1' },
    adapter: adaptAnalystHY,
  },
  {
    name: 'BULL v0',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    source: {
      type: 'bull-github',
      portfolio_path: 'memory/portfolio.md',
      trade_log_path: 'memory/trade_log.md',
    },
    adapter: adaptBull,
  },
];
```

- [ ] **Step 2: Verify imports work**

Run: `node --check registry.js`
Expected: No output (syntax valid).

- [ ] **Step 3: Commit**

```bash
git add registry.js
git commit -m "feat: STRATEGIES registry wiring all 6 adapters"
```

---

### Task 14: HTML + CSS skeleton

**Files:**
- Create: `index.html`
- Create: `css/style.css`

- [ ] **Step 1: Create `index.html`**

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Strategy Leaderboard</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="dash">
    <header class="dash-header">
      <div class="title">Strategy Leaderboard</div>
      <div class="meta">
        <span id="health-sheets" class="health"><span class="dot"></span>Sheets</span>
        <span id="health-bull"   class="health"><span class="dot"></span>GitHub</span>
        <span id="updated" class="dim">loading…</span>
        <button id="refresh-btn" class="refresh-btn">⟳ Refresh</button>
      </div>
    </header>

    <table id="leaderboard">
      <thead>
        <tr>
          <th data-key="name" class="sortable left">Strategy</th>
          <th data-key="status" class="sortable left">Status</th>
          <th data-key="r90" class="sortable sorted">90d %</th>
          <th data-key="r30" class="sortable">30d %</th>
          <th data-key="r7"  class="sortable">7d %</th>
          <th data-key="sharpe" class="sortable">Sharpe</th>
          <th data-key="pf" class="sortable">PF</th>
          <th data-key="max_dd" class="sortable">Max DD</th>
          <th data-key="trades_n" class="sortable">Trades</th>
          <th data-key="win_pct" class="sortable">Win %</th>
          <th data-key="avg_r" class="sortable">Avg R</th>
          <th data-key="last_signal_at" class="sortable">Last sig</th>
        </tr>
      </thead>
      <tbody id="rows">
        <tr><td colspan="12" class="loading">Loading data from Sheets and GitHub…</td></tr>
      </tbody>
    </table>

    <footer class="dash-footer">
      <span>data: Sheets doGet · raw.githubusercontent.com</span>
      <span style="margin-left:auto;">v1 · auto-refresh 5m</span>
    </footer>
  </div>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `css/style.css`**

Create `css/style.css`:

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #0a0a0a;
  color: #ccc;
  font-family: 'SF Mono', Consolas, 'Courier New', monospace;
  font-size: 12px;
}

#dash {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0;
}

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: #0a0a0a;
  border: 1px solid #222;
  border-bottom: none;
}

.dash-header .title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.meta {
  display: flex;
  gap: 14px;
  align-items: center;
  font-size: 11px;
  color: #888;
}

.health { display: inline-flex; align-items: center; gap: 4px; }
.health .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
  display: inline-block;
}
.health.error .dot { background: #f87171; }
.health.warn  .dot { background: #fbbf24; }

.refresh-btn {
  background: #1a1a1a;
  color: #aaa;
  border: 1px solid #333;
  padding: 4px 10px;
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  border-radius: 3px;
}
.refresh-btn:hover { color: #fff; border-color: #555; }

table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #222;
}

th {
  text-align: right;
  padding: 8px 8px;
  background: #1a1a1a;
  color: #aaa;
  border-bottom: 1px solid #333;
  cursor: pointer;
  user-select: none;
  font-weight: 500;
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.6px;
  position: sticky;
  top: 0;
}
th:hover { color: #fff; }
th.sorted { color: #4ade80; background: #0f1f10; }
th.sorted::after { content: ' ▼'; }
th.sorted.asc::after { content: ' ▲'; }
th.left, td.left { text-align: left; }

td {
  padding: 8px 8px;
  border-bottom: 1px solid #1f1f1f;
  text-align: right;
}
td.name { font-weight: 600; color: #fff; padding-left: 12px; text-align: left; }

tr:hover td { background: #131313; }
tr.warn td { background: #2a1a0a; }
tr.warn:hover td { background: #3a2210; }

.pos { color: #4ade80; }
.neg { color: #f87171; }
.dim { color: #666; }
.warn-text { color: #fbbf24; }

.badge {
  display: inline-block;
  padding: 1px 6px;
  font-size: 9px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}
.badge-live    { background: #0f3a1a; color: #4ade80; }
.badge-canary  { background: #3a280f; color: #fbbf24; }
.badge-research{ background: #2a2a2a; color: #aaa; }
.badge-error   { background: #3a0f1a; color: #f87171; }
.badge-paused  { background: #2a2a2a; color: #888; }

.loading {
  text-align: center;
  color: #666;
  padding: 40px !important;
}

.dash-footer {
  display: flex;
  gap: 14px;
  padding: 8px 14px;
  font-size: 10px;
  color: #555;
  background: #0a0a0a;
  border: 1px solid #222;
  border-top: none;
}
```

- [ ] **Step 3: Open `index.html` in browser, sanity-check**

Run: open `index.html` in any browser.
Expected: header bar visible, "Loading data…" placeholder row, no JS errors yet (`app.js` doesn't exist — browser console will show 404 for app.js, that's fine).

- [ ] **Step 4: Commit**

```bash
git add index.html css/style.css
git commit -m "feat: HTML skeleton + Bloomberg dark CSS"
```

---

### Task 15: Renderer (`lib/render.js`)

**Files:**
- Create: `lib/render.js`

Renderer is pure DOM: takes an array of `StrategyRow` and a sort spec, paints `<tbody id="rows">`. Also paints health dots and the "updated Xs ago" timer. No fetching here.

- [ ] **Step 1: Implement `lib/render.js`**

Create `lib/render.js`:

```js
const SORT_KEY_TO_VALUE = {
  name:           (r) => r.name,
  status:         (r) => r.status,
  r7:             (r) => r.returns?.['7d'],
  r30:            (r) => r.returns?.['30d'],
  r90:            (r) => r.returns?.['90d'],
  sharpe:         (r) => r.sharpe,
  pf:             (r) => r.pf,
  max_dd:         (r) => r.max_dd,
  trades_n:       (r) => r.trades_n,
  win_pct:        (r) => r.win_pct,
  avg_r:          (r) => r.avg_r,
  last_signal_at: (r) => r.last_signal_at,
};

function compareNullable(a, b, asc) {
  // null/undefined sort to bottom regardless of asc/desc
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a < b) return asc ? -1 : 1;
  if (a > b) return asc ? 1 : -1;
  return 0;
}

export function sortRows(rows, sortKey, asc) {
  const getVal = SORT_KEY_TO_VALUE[sortKey] || (() => null);
  return [...rows].sort((a, b) => compareNullable(getVal(a), getVal(b), asc));
}

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '<span class="dim">—</span>';
  const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : 'dim';
  const sign = v > 0 ? '+' : '';
  return `<span class="${cls}">${sign}${v.toFixed(1)}</span>`;
}
function fmtNum(v, digits = 2) {
  if (v == null || Number.isNaN(v) || v === Infinity) return '<span class="dim">—</span>';
  return v.toFixed(digits);
}
function fmtInt(v) {
  if (v == null) return '<span class="dim">—</span>';
  return String(v);
}
function fmtR(v) {
  if (v == null || Number.isNaN(v)) return '<span class="dim">—</span>';
  const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : 'dim';
  const sign = v > 0 ? '+' : '';
  return `<span class="${cls}">${sign}${v.toFixed(2)}</span>`;
}

function fmtRelTime(iso) {
  if (!iso) return '<span class="dim">—</span>';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '<span class="dim">—</span>';
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60000);
  if (mins < 0) return '<span class="pos">just now</span>';
  if (mins < 1) return '<span class="pos">just now</span>';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 1) return `${mins}m`;
  if (hrs < 24) return `<span class="${hrs < 1 ? 'pos' : ''}">${hrs}h</span>`;
  const days = Math.round(hrs / 24);
  return `<span class="dim">${days}d</span>`;
}

function statusBadge(status) {
  const cls = `badge badge-${status || 'paused'}`;
  return `<span class="${cls}">${status || '—'}</span>`;
}

function isWarnRow(row, killswitchDdPct) {
  if (row.max_dd == null || !killswitchDdPct) return false;
  return Math.abs(row.max_dd) >= killswitchDdPct * 0.9;
}

export function renderRows(rows, registry, sortKey, asc) {
  const tbody = document.getElementById('rows');
  if (!tbody) return;

  const sorted = sortRows(rows, sortKey, asc);
  tbody.innerHTML = sorted.map(r => {
    const reg = registry.find(s => s.name === r.name);
    const warn = isWarnRow(r, reg?.killswitch_dd_pct);
    return `<tr class="${warn ? 'warn' : ''}">
      <td class="name">${escapeHtml(r.name)}</td>
      <td class="left">${statusBadge(r.status)}</td>
      <td>${fmtPct(r.returns?.['90d'])}</td>
      <td>${fmtPct(r.returns?.['30d'])}</td>
      <td>${fmtPct(r.returns?.['7d'])}</td>
      <td>${fmtNum(r.sharpe)}</td>
      <td>${fmtNum(r.pf)}</td>
      <td>${fmtPct(r.max_dd)}</td>
      <td>${fmtInt(r.trades_n)}</td>
      <td>${fmtInt(r.win_pct)}</td>
      <td>${fmtR(r.avg_r)}</td>
      <td>${fmtRelTime(r.last_signal_at)}</td>
    </tr>`;
  }).join('');
}

export function renderHealth(elementId, status, errorMsg) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.classList.remove('error', 'warn');
  if (status === 'error') el.classList.add('error');
  else if (status === 'warn') el.classList.add('warn');
  if (errorMsg) el.title = errorMsg; else el.removeAttribute('title');
}

export function renderUpdatedAt(timestamp) {
  const el = document.getElementById('updated');
  if (!el) return;
  if (!timestamp) {
    el.textContent = 'never';
    return;
  }
  const secs = Math.round((Date.now() - timestamp) / 1000);
  if (secs < 5) el.textContent = 'just now · auto-refresh 5m';
  else if (secs < 60) el.textContent = `Updated ${secs}s ago · auto-refresh 5m`;
  else el.textContent = `Updated ${Math.round(secs / 60)}m ago · auto-refresh 5m`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export function setupSortHandlers(rows, registry, currentSort) {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (currentSort.key === key) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort.key = key;
        currentSort.asc = false; // most useful default for numeric is desc
      }
      document.querySelectorAll('th').forEach(t => {
        t.classList.remove('sorted', 'asc');
      });
      th.classList.add('sorted');
      if (currentSort.asc) th.classList.add('asc');
      renderRows(rows, registry, currentSort.key, currentSort.asc);
    });
  });
}
```

- [ ] **Step 2: Syntax check**

Run: `node --check lib/render.js`
Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add lib/render.js
git commit -m "feat: render layer (rows, health, sort, relative time)"
```

---

### Task 16: App controller (`app.js`)

**Files:**
- Create: `app.js`

This wires everything: fetch → adapt → render → cache → repeat every 5 min.

- [ ] **Step 1: Implement `app.js`**

Create `app.js`:

```js
import { STRATEGIES } from './registry.js';
import { fetchSheetTab, fetchBullFile } from './lib/fetch.js';
import { renderRows, renderHealth, renderUpdatedAt, setupSortHandlers } from './lib/render.js';

const REFRESH_MS = 5 * 60 * 1000;
const CACHE_KEY = 'leaderboard-cache-v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const currentSort = { key: 'r90', asc: false };
let rowsState = [];          // last successful StrategyRow[] for each strategy
let lastUpdatedAt = null;    // ms timestamp
let updatedTimerId = null;

async function fetchOne(strategy) {
  if (strategy.source.type === 'sheets') {
    const resp = await fetchSheetTab(strategy.source.tab);
    return strategy.adapter(resp, { startingCapital: strategy.starting_capital });
  }
  if (strategy.source.type === 'bull-github') {
    const [portfolio, tradeLog] = await Promise.all([
      fetchBullFile(strategy.source.portfolio_path),
      fetchBullFile(strategy.source.trade_log_path),
    ]);
    return strategy.adapter(
      { portfolio, tradeLog },
      { startingCapital: strategy.starting_capital }
    );
  }
  throw new Error('Unknown source type: ' + strategy.source.type);
}

async function fetchAll() {
  const results = await Promise.allSettled(STRATEGIES.map(fetchOne));
  const rows = [];
  let sheetsHealth = 'ok';
  let bullHealth = 'ok';

  results.forEach((res, i) => {
    const strategy = STRATEGIES[i];
    let row;
    if (res.status === 'fulfilled') {
      row = res.value;
      if (row.status === 'error') {
        if (strategy.source.type === 'bull-github') bullHealth = 'error';
        else sheetsHealth = sheetsHealth === 'ok' ? 'warn' : sheetsHealth;
      }
    } else {
      row = {
        name: strategy.name,
        status: 'error',
        returns: { '7d': null, '30d': null, '90d': null, all: null },
        sharpe: null, pf: null, max_dd: null, win_pct: null, trades_n: 0,
        avg_r: null, last_signal_at: null,
        confidence: { sharpe: 'best-effort', pf: 'best-effort', max_dd: 'best-effort' },
        errors: [String(res.reason)],
      };
      if (strategy.source.type === 'bull-github') bullHealth = 'error';
      else sheetsHealth = 'error';
    }
    rows.push(row);
  });

  rowsState = rows;
  lastUpdatedAt = Date.now();
  saveCache(rows, lastUpdatedAt);

  renderRows(rowsState, STRATEGIES, currentSort.key, currentSort.asc);
  renderHealth('health-sheets', sheetsHealth,
    sheetsHealth !== 'ok' ? 'one or more Sheet tabs failed' : null);
  renderHealth('health-bull', bullHealth,
    bullHealth !== 'ok' ? 'BULL repo fetch failed' : null);
  renderUpdatedAt(lastUpdatedAt);
}

function saveCache(rows, ts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rows, ts }));
  } catch {} // quota/private-mode — non-fatal
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { rows, ts } = JSON.parse(raw);
    if (!ts || Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return { rows, ts };
  } catch {
    return null;
  }
}

function tickUpdatedTimer() {
  if (lastUpdatedAt) renderUpdatedAt(lastUpdatedAt);
}

function init() {
  // Hydrate from cache first for instant feel
  const cached = loadCache();
  if (cached) {
    rowsState = cached.rows;
    lastUpdatedAt = cached.ts;
    renderRows(rowsState, STRATEGIES, currentSort.key, currentSort.asc);
    renderUpdatedAt(lastUpdatedAt);
  }

  // Wire sort
  setupSortHandlers(rowsState, STRATEGIES, currentSort);

  // Wire refresh button
  document.getElementById('refresh-btn').addEventListener('click', () => {
    fetchAll().catch(e => console.error('manual refresh failed:', e));
  });

  // First live fetch
  fetchAll().catch(e => console.error('initial fetch failed:', e));

  // Periodic refresh
  setInterval(() => {
    fetchAll().catch(e => console.error('scheduled fetch failed:', e));
  }, REFRESH_MS);

  // Updated-timer tick (every 10 sec for fresh "Xs ago" text)
  updatedTimerId = setInterval(tickUpdatedTimer, 10000);
}

init();
```

- [ ] **Step 2: Note about sort wiring**

The sort handler in Task 15 captures `rows` by reference. After each `fetchAll()` we mutate `rowsState`, but the sort handler holds onto the array originally passed. Verify this works — if not, refactor to make `setupSortHandlers` look up `rowsState` via a getter.

To verify: after sort handlers are set up and the first fetch happens, click a column header. Sort should reflect the new data. If it sorts the empty initial array, refactor below.

If broken, replace `setupSortHandlers(rowsState, ...)` with:

```js
setupSortHandlers(() => rowsState, STRATEGIES, currentSort);
```

And in `lib/render.js` change the function signature to accept a getter:

```js
export function setupSortHandlers(getRows, registry, currentSort) {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      // ... existing sort logic ...
      renderRows(getRows(), registry, currentSort.key, currentSort.asc);
    });
  });
}
```

- [ ] **Step 3: Open `index.html` in browser**

Open `index.html` in Chrome / Edge / Firefox.
Expected: data loads within ~2-5 seconds, all 6 rows render, source dots green, sort works on every column.

If you see CORS errors in console: re-check `lib/fetch.js` URL constants and confirm against Task 2 Step 1 base URLs.

If specific strategy rows show `error` status: check console for the adapter error message. Most likely cause: tab name mismatch in `registry.js` — fix per actual tab name from Task 2 step 6.

- [ ] **Step 4: Commit**

```bash
git add app.js
# If you also fixed render.js sort handler:
git add lib/render.js 2>/dev/null
git commit -m "feat: app controller (fetch + adapt + render + 5min refresh + cache)"
```

---

### Task 17: End-to-end smoke + Chrome shortcut + README finalization

**Files:**
- Modify: `README.md`
- Create: optional Desktop shortcut

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests passing — 14 metrics + 7 pairing + 7 parse_bull + 5+3+3+3+2+4 adapter tests = ~48 tests total.

- [ ] **Step 2: Manual end-to-end smoke**

Open `index.html` in Chrome. Verify each:

- [ ] All 6 rows render (HY v4, v7-Best, Basket, Aggro, Analyst HY, BULL)
- [ ] Source-health dots both green
- [ ] "Updated Xs ago" timer counts up
- [ ] Click each column header → table re-sorts; second click flips asc/desc
- [ ] DevTools Network tab: in 5 minutes, watch a fresh round of `script.google.com` + `raw.githubusercontent.com` requests fire
- [ ] Disable wifi → click manual refresh → source dot turns red, last-good data persists
- [ ] Re-enable wifi → next refresh restores green
- [ ] Close + reopen tab → instant render of last-cached data, then live refresh

- [ ] **Step 3: Sanity-check best-effort metrics vs source data**

Open the Google Sheet. For Basket Breakout, manually count entries vs exits in the `Basket Breakout Signals` tab and compare:
- "Trades" column on dashboard ≈ count of completed round-trips in sheet
- 90d % return: rough mental arithmetic — e.g., if dashboard says +12% on $10k virtual capital, that's $1,200 net PnL; eyeball the trade-by-trade pnl in the sheet

If any strategy's row is off by >10% on a metric, the adapter's pairing logic has a bug. Fix the adapter, ship a v1.1 commit.

- [ ] **Step 4: Optional Chrome chromeless shortcut**

Create a Windows Desktop shortcut:
- Target: `"C:\Program Files\Google\Chrome\Application\chrome.exe" --app=file:///C:/Users/Mhair/OneDrive/Desktop/strategy-leaderboard/index.html`
- Name: "Strategy Leaderboard"
- Icon: optional, any chart icon

Double-click the shortcut → opens chromeless, looks like a desktop app.

- [ ] **Step 5: Finalize README**

Update `README.md`:

```markdown
# Strategy Leaderboard

Single-page static dashboard ranking 6 trading strategies on the same view. Read-only — pulls from Google Sheets `doGet()` API + GitHub raw. No backend.

![screenshot](docs/screenshot.png) <!-- optional -->

## Strategies

| Strategy | Asset | TF | Status | Source |
|---|---|---|---|---|
| HY v4 Tuned | BTC + SOL | 4H | live | Sheets |
| HY v7-Best BTC TG | BTC | 4H | research | Sheets |
| Basket Breakout v1 | 8-pair basket | 1H | live | Sheets |
| Aggro Leader Cont v1 | DOGE | 1H | canary | Sheets |
| Analyst HY v1 | SOL | 4H | live | Sheets |
| BULL v0 | Kraken top-15 | 15m–1H | live | GitHub raw |

## Run

Open `index.html` in any modern browser (Chrome/Edge/Firefox). Auto-refreshes every 5 min. Sort by clicking any column.

For chromeless app feel:
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --app=file:///C:/Users/Mhair/OneDrive/Desktop/strategy-leaderboard/index.html
```

## Test

```bash
npm test
```

Requires Node 20+ (built-in `node:test`).

## Add a new strategy

1. Capture a fixture: `curl ... > fixtures/<name>.json`
2. Create adapter `adapters/adapter_<name>.js` — default-export `(rawData, opts) => StrategyRow`
3. Create test `adapters/adapter_<name>.test.js`
4. Add an entry to `STRATEGIES` array in `registry.js`

A new row appears on next refresh.

## Refresh fixtures

If a strategy's tab schema changes, re-run Task 2 from the implementation plan to capture fresh fixtures.

## Architecture

See `docs/superpowers/specs/2026-04-28-strategy-leaderboard-design.md`.
```

- [ ] **Step 6: Commit and push**

```bash
git add README.md
git commit -m "docs: finalize README with run instructions and strategy list"

# Optional: push to GitHub
# git remote add origin git@github.com:Mhairston90/strategy-leaderboard.git
# git push -u origin main
```

---

## Self-review

Reviewing this plan against the spec:

- **§1 Purpose** → Tasks 14-17 build the dashboard ✅
- **§2 Strategies** → Tasks 7-12, one adapter each, all 6 covered ✅
- **§3 Architecture** (no backend, no build, vanilla JS) → All implementation tasks use ES modules, no framework ✅
- **§4 Data flow** (CORS-verified Sheets + GitHub) → Task 6 fetch layer ✅
- **§4.3 Adapter pattern** → Tasks 7-12, normalized `StrategyRow` ✅
- **§4.4 Metric formulas** → Task 3 `metrics.js` ✅
- **§4.5 Capital normalization** → Registry entries declare per-strategy starting capital, including virtual capitals for Basket/Aggro ✅
- **§5 Layout & 12 columns** → Tasks 14-15 (HTML + render layer); columns mapped 1-to-1 ✅
- **§5.4 Row warning** → `lib/render.js` `isWarnRow()` checks `killswitch_dd_pct * 0.9` ✅
- **§5.5 Sort UX** → `setupSortHandlers` in render.js, click-to-sort + flip on re-click ✅
- **§6 Refresh + error handling** → Task 16 `setInterval`, `Promise.allSettled`, per-source health dots ✅
- **§6.3 localStorage cache 24h** → Task 16 `saveCache`/`loadCache` with TTL ✅
- **§7 Testing** → TDD throughout, fixtures committed (Task 1 .gitignore reverted; spec self-review fix already applied) ✅
- **§8 Deployment** → Task 17 step 4 + step 6 ✅
- **§10 Adding a new strategy** → README documents it ✅

Type consistency: `StrategyRow` shape used consistently across all adapter tests and the render layer. `name`, `status`, `returns.{7d,30d,90d,all}`, `sharpe`, `pf`, `max_dd`, `win_pct`, `trades_n`, `avg_r`, `last_signal_at`, `confidence`, `errors`. All match.

No placeholders found in steps. All "TBD"s in the spec (§12) are explicitly resolved in Task 2 Step 6 (HY v4 tab name) or documented as runtime-confirmed (Aggro tab name in Step 4, pagination depth in Step 1's `limit=200`).

Plan complete and saved to `docs/superpowers/plans/2026-04-28-strategy-leaderboard.md`.
