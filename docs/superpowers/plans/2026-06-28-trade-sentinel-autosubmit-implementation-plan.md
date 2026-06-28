# Trade Sentinel Autosubmit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Trade Sentinel: a local UI plus Node paper-execution worker that reads leaderboard evidence, classifies/promotes strategies, risk-checks normalized tickets, and auto-submits safe tickets to Alpaca paper trading.

**Architecture:** Browser UI is read-only and never receives Alpaca secrets. A Node worker owns secret loading, risk checks, Alpaca paper submission, execution ledger writes, and reconciliation. Local JSON/JSONL/Markdown files under `data/sentinel/` are the contract between the worker and UI.

**Tech Stack:** Existing static HTML/CSS/ES modules, Node.js ESM, `node:test`, local JSON/JSONL files, Alpaca Trading API paper endpoint, current leaderboard registry/adapters.

---

## Scope And Safety

This plan implements paper auto-submit only. Live Alpaca endpoints are blocked in code. The worker must refuse to start if `ALPACA_ENV` is anything except `paper`.

No Alpaca key may appear in:

- Git-tracked files.
- Browser JavaScript.
- UI-rendered data files.
- Test snapshots.
- Console logs.

The first executable flow is:

```text
ticket inbox -> schema validation -> risk governor -> Alpaca paper order -> ledger event -> reconciliation report -> UI
```

Strategy signal generation is intentionally represented by a normalized ticket inbox in this first plan. That lets us test auto-submit safely before wiring each strategy's raw signal format.

## File Structure

Create:

- `sentinel.html`: static page shell for the sentinel UI.
- `sentinel_app.js`: browser loader/renderer for sentinel status files.
- `Open Trade Sentinel.bat`: local launcher that opens `sentinel.html` through the existing server.
- `data/sentinel/config.json`: paper-mode config and risk caps.
- `data/sentinel/allocation.json`: initial six-strategy target allocation.
- `data/sentinel/ticket_inbox.jsonl`: normalized tickets waiting for processing.
- `data/sentinel/trade_tickets.jsonl`: processed ticket decisions.
- `data/sentinel/execution_ledger.jsonl`: append-only order/fill/reconciliation events.
- `data/sentinel/promotion_status.json`: current status for leaderboard strategies.
- `data/sentinel/risk_state.json`: freeze state and risk limits.
- `data/sentinel/reconciliation_report.json`: latest Alpaca-vs-ledger reconciliation.
- `data/sentinel/sentinel_status.md`: human-readable status summary.
- `lib/sentinel/config.js`: loads non-secret config and local env safely.
- `lib/sentinel/jsonl.js`: reads/writes JSONL append-only files.
- `lib/sentinel/ticket_schema.js`: validates normalized trade tickets.
- `lib/sentinel/allocator.js`: computes active target weights.
- `lib/sentinel/promotion_engine.js`: classifies leaderboard strategies.
- `lib/sentinel/risk_governor.js`: approves or blocks tickets.
- `lib/sentinel/alpaca_paper.js`: Alpaca paper adapter with injected `fetch`.
- `lib/sentinel/ledger.js`: appends/replays execution events.
- `lib/sentinel/reconcile.js`: compares ledger-derived state to broker state.
- `lib/sentinel/render.js`: renders sentinel HTML fragments.
- `scripts/sentinel_tick.js`: main worker: process inbox, auto-submit paper orders, update status.
- `scripts/sentinel_create_test_ticket.js`: creates a tiny normalized test ticket in the inbox.
- `scripts/sentinel_smoke.js`: local smoke check that does not hit Alpaca unless explicitly asked.

Create tests:

- `lib/sentinel/config.test.js`
- `lib/sentinel/jsonl.test.js`
- `lib/sentinel/ticket_schema.test.js`
- `lib/sentinel/allocator.test.js`
- `lib/sentinel/promotion_engine.test.js`
- `lib/sentinel/risk_governor.test.js`
- `lib/sentinel/alpaca_paper.test.js`
- `lib/sentinel/ledger.test.js`
- `lib/sentinel/reconcile.test.js`
- `scripts/sentinel_tick.test.js`
- `scripts/sentinel_smoke.test.js`

Modify:

- `.gitignore`: add `.env`, `.env.local`, and sentinel secret file patterns.
- `package.json`: add sentinel smoke script.
- `index.html`: navigation link to `sentinel.html`.
- `scripts/serve_leaderboard.py`: no change expected; existing static serving should serve `sentinel.html`.

---

### Task 1: Secret Hygiene And Static Config

**Files:**
- Modify: `.gitignore`
- Create: `data/sentinel/config.json`
- Create: `data/sentinel/allocation.json`
- Create: `data/sentinel/risk_state.json`
- Create: `lib/sentinel/config.js`
- Test: `lib/sentinel/config.test.js`

- [ ] **Step 1: Write the failing config tests**

Create `lib/sentinel/config.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SENTINEL_CONFIG,
  assertPaperEnv,
  loadSentinelConfigFromText,
  redactSecret,
} from './config.js';

test('default sentinel config is paper autosubmit only', () => {
  assert.equal(DEFAULT_SENTINEL_CONFIG.mode, 'paper');
  assert.equal(DEFAULT_SENTINEL_CONFIG.paper_auto_submit_enabled, true);
  assert.equal(DEFAULT_SENTINEL_CONFIG.broker, 'alpaca-paper');
  assert.equal(DEFAULT_SENTINEL_CONFIG.live_trading_enabled, false);
});

test('assertPaperEnv rejects live-like environments', () => {
  assert.doesNotThrow(() => assertPaperEnv({ ALPACA_ENV: 'paper' }));
  assert.throws(
    () => assertPaperEnv({ ALPACA_ENV: 'live' }),
    /ALPACA_ENV must be paper/
  );
  assert.throws(
    () => assertPaperEnv({}),
    /ALPACA_ENV must be paper/
  );
});

test('loadSentinelConfigFromText merges user config over defaults', () => {
  const config = loadSentinelConfigFromText(JSON.stringify({
    max_daily_loss_pct: 1.25,
    max_open_orders: 4,
  }));

  assert.equal(config.mode, 'paper');
  assert.equal(config.paper_auto_submit_enabled, true);
  assert.equal(config.max_daily_loss_pct, 1.25);
  assert.equal(config.max_open_orders, 4);
});

test('redactSecret never exposes full key material', () => {
  assert.equal(redactSecret('PK12345678904'), 'PK12...8904');
  assert.equal(redactSecret('short'), '***');
  assert.equal(redactSecret(''), '***');
});
```

- [ ] **Step 2: Run the config tests and verify they fail**

Run:

```powershell
node --test lib/sentinel/config.test.js
```

Expected: fails with `Cannot find module ... lib/sentinel/config.js`.

- [ ] **Step 3: Add ignored secret patterns**

Modify `.gitignore` by appending:

```gitignore

# Local secrets
.env
.env.local
*.secret
local-secrets/
```

- [ ] **Step 4: Create initial static config files**

Create `data/sentinel/config.json`:

```json
{
  "mode": "paper",
  "broker": "alpaca-paper",
  "paper_auto_submit_enabled": true,
  "live_trading_enabled": false,
  "max_gross_exposure_pct": 100,
  "max_strategy_weight_pct": 25,
  "max_symbol_exposure_pct": 20,
  "max_daily_loss_pct": 2,
  "max_open_orders": 10,
  "max_orders_per_symbol_per_hour": 2,
  "stale_leaderboard_minutes": 15,
  "reconciliation_freeze_enabled": true
}
```

Create `data/sentinel/allocation.json`:

```json
{
  "generated_at": "",
  "mode": "paper",
  "total_weight": 1,
  "strategies": [
    { "name": "CODEX Regime Plus L/S v1", "target_weight": 0.22, "role": "core_return_engine" },
    { "name": "Basket Breakout Aggressive v1", "target_weight": 0.20, "role": "independent_breakout" },
    { "name": "CODEX Aggro v0", "target_weight": 0.18, "role": "proven_crypto_momentum" },
    { "name": "CODEX Aggro Short Plus Quality v2", "target_weight": 0.15, "role": "quality_short_momentum" },
    { "name": "Stocks Mean Reversion v2 (RSI<15)", "target_weight": 0.15, "role": "equity_mean_reversion_stabilizer" },
    { "name": "FABLE Equities Fader v1", "target_weight": 0.10, "role": "diversifier" }
  ]
}
```

Create `data/sentinel/risk_state.json`:

```json
{
  "generated_at": "",
  "frozen": false,
  "freeze_reason": "",
  "paper_auto_submit_enabled": true,
  "live_trading_enabled": false
}
```

- [ ] **Step 5: Implement config helper**

Create `lib/sentinel/config.js`:

```js
export const DEFAULT_SENTINEL_CONFIG = Object.freeze({
  mode: 'paper',
  broker: 'alpaca-paper',
  paper_auto_submit_enabled: true,
  live_trading_enabled: false,
  max_gross_exposure_pct: 100,
  max_strategy_weight_pct: 25,
  max_symbol_exposure_pct: 20,
  max_daily_loss_pct: 2,
  max_open_orders: 10,
  max_orders_per_symbol_per_hour: 2,
  stale_leaderboard_minutes: 15,
  reconciliation_freeze_enabled: true,
});

export function assertPaperEnv(env = process.env) {
  if (env.ALPACA_ENV !== 'paper') {
    throw new Error('ALPACA_ENV must be paper before the sentinel can submit orders');
  }
  if (!env.APCA_API_KEY_ID || !env.APCA_API_SECRET_KEY) {
    throw new Error('Alpaca paper credentials are missing from local environment');
  }
  return true;
}

export function loadSentinelConfigFromText(text) {
  const parsed = text ? JSON.parse(text) : {};
  const config = { ...DEFAULT_SENTINEL_CONFIG, ...parsed };
  if (config.mode !== 'paper') {
    throw new Error('sentinel config mode must be paper');
  }
  if (config.live_trading_enabled) {
    throw new Error('live_trading_enabled must be false in this implementation');
  }
  return config;
}

export function redactSecret(value) {
  const raw = String(value || '');
  if (raw.length < 8) return '***';
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
}
```

- [ ] **Step 6: Run config tests and commit**

Run:

```powershell
node --test lib/sentinel/config.test.js
```

Expected: 4 tests pass.

Commit:

```powershell
git add .gitignore data/sentinel/config.json data/sentinel/allocation.json data/sentinel/risk_state.json lib/sentinel/config.js lib/sentinel/config.test.js
git commit -m "feat: add sentinel paper config"
```

---

### Task 2: JSONL And Ticket Schema Contracts

**Files:**
- Create: `lib/sentinel/jsonl.js`
- Create: `lib/sentinel/ticket_schema.js`
- Create seed files: `data/sentinel/ticket_inbox.jsonl`, `data/sentinel/trade_tickets.jsonl`, `data/sentinel/execution_ledger.jsonl`
- Test: `lib/sentinel/jsonl.test.js`
- Test: `lib/sentinel/ticket_schema.test.js`

- [ ] **Step 1: Write failing JSONL tests**

Create `lib/sentinel/jsonl.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { appendJsonl, readJsonlText, readJsonlFile } from './jsonl.js';

test('readJsonlText ignores blanks and parses objects', () => {
  assert.deepEqual(readJsonlText('{"a":1}\n\n{"b":2}\n'), [{ a: 1 }, { b: 2 }]);
});

test('appendJsonl writes one object per line', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sentinel-jsonl-'));
  const file = path.join(dir, 'events.jsonl');
  await appendJsonl(file, { type: 'created', id: 'one' });
  await appendJsonl(file, { type: 'submitted', id: 'one' });

  const raw = await readFile(file, 'utf8');
  assert.equal(raw, '{"type":"created","id":"one"}\n{"type":"submitted","id":"one"}\n');
  assert.deepEqual(await readJsonlFile(file), [
    { type: 'created', id: 'one' },
    { type: 'submitted', id: 'one' },
  ]);
  await rm(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Write failing ticket schema tests**

Create `lib/sentinel/ticket_schema.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSymbolForAlpaca, validateTicket } from './ticket_schema.js';

const baseTicket = {
  ticket_id: 'sentinel-20260628-000001',
  created_at: '2026-06-28T18:00:00Z',
  strategy: 'CODEX Regime Plus L/S v1',
  symbol: 'BTC/USD',
  asset_class: 'crypto',
  side: 'buy',
  intent: 'open',
  notional_usd: 5,
  quantity: null,
  order_type: 'market',
  time_in_force: 'gtc',
  reason: 'paper smoke test',
  source_signal_id: 'smoke-1',
  risk_status: 'pending',
  broker: 'alpaca-paper',
};

test('validateTicket accepts a complete Alpaca paper ticket', () => {
  assert.deepEqual(validateTicket(baseTicket), { ok: true, errors: [] });
});

test('validateTicket rejects live broker and invalid notional', () => {
  const result = validateTicket({ ...baseTicket, broker: 'alpaca-live', notional_usd: 0 });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' | '), /broker must be alpaca-paper/);
  assert.match(result.errors.join(' | '), /notional_usd must be positive/);
});

test('normalizeSymbolForAlpaca maps slash crypto and stock symbols', () => {
  assert.equal(normalizeSymbolForAlpaca('BTC/USD'), 'BTC/USD');
  assert.equal(normalizeSymbolForAlpaca('AAPL'), 'AAPL');
  assert.equal(normalizeSymbolForAlpaca(' aapl '), 'AAPL');
});
```

- [ ] **Step 3: Run contract tests and verify they fail**

Run:

```powershell
node --test lib/sentinel/jsonl.test.js lib/sentinel/ticket_schema.test.js
```

Expected: fails because `jsonl.js` and `ticket_schema.js` do not exist.

- [ ] **Step 4: Implement JSONL helpers**

Create `lib/sentinel/jsonl.js`:

```js
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export function readJsonlText(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

export async function readJsonlFile(filePath) {
  try {
    return readJsonlText(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function appendJsonl(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, JSON.stringify(value) + '\n', 'utf8');
}
```

- [ ] **Step 5: Implement ticket schema**

Create `lib/sentinel/ticket_schema.js`:

```js
const SIDES = new Set(['buy', 'sell']);
const INTENTS = new Set(['open', 'close']);
const ASSET_CLASSES = new Set(['crypto', 'equity']);

export function normalizeSymbolForAlpaca(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

export function validateTicket(ticket) {
  const errors = [];
  const t = ticket || {};

  for (const field of ['ticket_id', 'created_at', 'strategy', 'symbol', 'asset_class', 'side', 'intent', 'order_type', 'time_in_force', 'reason', 'source_signal_id', 'broker']) {
    if (!t[field]) errors.push(`${field} is required`);
  }

  if (t.broker !== 'alpaca-paper') errors.push('broker must be alpaca-paper');
  if (!ASSET_CLASSES.has(t.asset_class)) errors.push('asset_class must be crypto or equity');
  if (!SIDES.has(t.side)) errors.push('side must be buy or sell');
  if (!INTENTS.has(t.intent)) errors.push('intent must be open or close');
  if (t.order_type !== 'market') errors.push('order_type must be market in v1');
  if (!Number.isFinite(Number(t.notional_usd)) || Number(t.notional_usd) <= 0) {
    errors.push('notional_usd must be positive');
  }
  if (Number.isNaN(new Date(t.created_at).getTime())) {
    errors.push('created_at must be an ISO timestamp');
  }

  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 6: Create empty seed JSONL files**

Create these files as empty UTF-8 files:

```text
data/sentinel/ticket_inbox.jsonl
data/sentinel/trade_tickets.jsonl
data/sentinel/execution_ledger.jsonl
```

- [ ] **Step 7: Run tests and commit**

Run:

```powershell
node --test lib/sentinel/jsonl.test.js lib/sentinel/ticket_schema.test.js
```

Expected: 5 tests pass.

Commit:

```powershell
git add data/sentinel/ticket_inbox.jsonl data/sentinel/trade_tickets.jsonl data/sentinel/execution_ledger.jsonl lib/sentinel/jsonl.js lib/sentinel/jsonl.test.js lib/sentinel/ticket_schema.js lib/sentinel/ticket_schema.test.js
git commit -m "feat: define sentinel ticket contracts"
```

---

### Task 3: Allocation And Promotion Engine

**Files:**
- Create: `lib/sentinel/allocator.js`
- Create: `lib/sentinel/promotion_engine.js`
- Create: `data/sentinel/promotion_status.json`
- Test: `lib/sentinel/allocator.test.js`
- Test: `lib/sentinel/promotion_engine.test.js`

- [ ] **Step 1: Write failing allocator tests**

Create `lib/sentinel/allocator.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildAllocationModel, validateAllocationConfig } from './allocator.js';

const allocationConfig = {
  strategies: [
    { name: 'CODEX Regime Plus L/S v1', target_weight: 0.22, role: 'core_return_engine' },
    { name: 'Basket Breakout Aggressive v1', target_weight: 0.20, role: 'independent_breakout' },
    { name: 'CODEX Aggro v0', target_weight: 0.18, role: 'proven_crypto_momentum' },
    { name: 'CODEX Aggro Short Plus Quality v2', target_weight: 0.15, role: 'quality_short_momentum' },
    { name: 'Stocks Mean Reversion v2 (RSI<15)', target_weight: 0.15, role: 'equity_mean_reversion_stabilizer' },
    { name: 'FABLE Equities Fader v1', target_weight: 0.10, role: 'diversifier' },
  ],
};

test('validateAllocationConfig accepts the six-sleeve allocation', () => {
  assert.deepEqual(validateAllocationConfig(allocationConfig), { ok: true, errors: [] });
});

test('buildAllocationModel joins rows and marks missing rows blocked', () => {
  const rows = [
    { name: 'CODEX Regime Plus L/S v1', status: 'live', trades_n: 57, returns: { '90d': 21.7 }, max_dd: -5.4 },
    { name: 'Basket Breakout Aggressive v1', status: 'live', trades_n: 58, returns: { '90d': 18.3 }, max_dd: -7.4 },
  ];
  const model = buildAllocationModel(allocationConfig, rows);

  assert.equal(model.totalTargetWeight, 1);
  assert.equal(model.items[0].status, 'active');
  assert.equal(model.items[2].status, 'blocked');
  assert.match(model.items[2].reason, /missing leaderboard row/);
});
```

- [ ] **Step 2: Write failing promotion tests**

Create `lib/sentinel/promotion_engine.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyStrategy, buildPromotionStatus } from './promotion_engine.js';

test('classifyStrategy promotes proven positive strategies to core', () => {
  const row = {
    name: 'CODEX Aggro v0',
    status: 'live',
    trades_n: 47,
    returns: { '90d': 12.6, '30d': 6.6, '7d': 5.8 },
    pf: 2.23,
    sharpe: 6.12,
    max_dd: -3.0,
    errors: [],
  };
  const result = classifyStrategy(row, { coreNames: new Set(['CODEX Aggro v0']) });
  assert.equal(result.status, 'core');
  assert.match(result.reason, /configured core/);
});

test('classifyStrategy blocks error rows and watches thin winners', () => {
  assert.equal(classifyStrategy({ name: 'Broken', status: 'error', trades_n: 0, returns: {}, errors: ['missing'] }).status, 'blocked');
  assert.equal(classifyStrategy({ name: 'Thin', status: 'live', trades_n: 9, returns: { '90d': 11 }, pf: 3, max_dd: -1, errors: [] }).status, 'satellite');
});

test('buildPromotionStatus returns every strategy with generated timestamp', () => {
  const report = buildPromotionStatus([
    { name: 'A', status: 'live', trades_n: 22, returns: { '90d': 3, '30d': 2 }, pf: 1.4, max_dd: -1, errors: [] },
    { name: 'B', status: 'error', trades_n: 0, returns: {}, errors: ['missing'] },
  ], { generatedAt: '2026-06-28T18:00:00Z', coreNames: new Set(['A']) });

  assert.equal(report.generated_at, '2026-06-28T18:00:00Z');
  assert.equal(report.strategies.length, 2);
  assert.equal(report.strategies[0].status, 'core');
  assert.equal(report.strategies[1].status, 'blocked');
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```powershell
node --test lib/sentinel/allocator.test.js lib/sentinel/promotion_engine.test.js
```

Expected: fails because modules do not exist.

- [ ] **Step 4: Implement allocator**

Create `lib/sentinel/allocator.js`:

```js
export function validateAllocationConfig(config) {
  const errors = [];
  const strategies = Array.isArray(config?.strategies) ? config.strategies : [];
  const total = strategies.reduce((sum, item) => sum + Number(item.target_weight || 0), 0);

  if (strategies.length === 0) errors.push('allocation must include at least one strategy');
  if (Math.abs(total - 1) > 0.000001) errors.push('target weights must sum to 1');
  for (const item of strategies) {
    if (!item.name) errors.push('strategy name is required');
    if (!Number.isFinite(Number(item.target_weight)) || Number(item.target_weight) <= 0) {
      errors.push(`${item.name || 'strategy'} target_weight must be positive`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function buildAllocationModel(config, leaderboardRows = []) {
  const rowsByName = new Map(leaderboardRows.map(row => [row.name, row]));
  const items = (config.strategies || []).map(item => {
    const row = rowsByName.get(item.name);
    if (!row) {
      return { ...item, status: 'blocked', reason: 'missing leaderboard row', row: null };
    }
    if (row.status === 'error') {
      return { ...item, status: 'blocked', reason: 'leaderboard row is error', row };
    }
    return { ...item, status: 'active', reason: 'configured allocation', row };
  });
  return {
    generated_at: new Date().toISOString(),
    totalTargetWeight: items.reduce((sum, item) => sum + Number(item.target_weight || 0), 0),
    items,
  };
}
```

- [ ] **Step 5: Implement promotion engine**

Create `lib/sentinel/promotion_engine.js`:

```js
export function classifyStrategy(row, options = {}) {
  const coreNames = options.coreNames || new Set();
  if (!row || row.status === 'error') {
    return { status: 'blocked', reason: row?.errors?.[0] || 'leaderboard row unavailable' };
  }
  if (coreNames.has(row.name)) {
    return { status: 'core', reason: 'configured core strategy' };
  }

  const trades = Number(row.trades_n || 0);
  const r90 = Number(row.returns?.['90d'] || 0);
  const r30 = Number(row.returns?.['30d'] || 0);
  const pf = Number.isFinite(row.pf) ? row.pf : null;
  const drawdown = Math.abs(Number(row.max_dd || 0));

  if (trades >= 20 && r90 > 0 && r30 >= 0 && (pf == null || pf >= 1.25) && drawdown <= 10) {
    return { status: 'watch', reason: 'eligible positive strategy, not configured core' };
  }
  if (trades >= 8 && r90 > 0 && (pf == null || pf >= 1.25) && drawdown <= 10) {
    return { status: 'satellite', reason: 'positive but sample is still limited' };
  }
  if (trades === 0) {
    return { status: 'watch', reason: 'no forward trades yet' };
  }
  if (r90 < 0 || (pf != null && pf < 1)) {
    return { status: 'cooldown', reason: 'negative or weak forward performance' };
  }
  return { status: 'watch', reason: 'collect more evidence' };
}

export function buildPromotionStatus(rows, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  return {
    generated_at: generatedAt,
    strategies: rows.map(row => ({
      name: row.name,
      ...classifyStrategy(row, options),
      trades_n: row.trades_n,
      r90: row.returns?.['90d'] ?? null,
      r30: row.returns?.['30d'] ?? null,
      r7: row.returns?.['7d'] ?? null,
      pf: row.pf ?? null,
      sharpe: row.sharpe ?? null,
      max_dd: row.max_dd ?? null,
    })),
  };
}
```

- [ ] **Step 6: Create empty promotion status seed**

Create `data/sentinel/promotion_status.json`:

```json
{
  "generated_at": "",
  "strategies": []
}
```

- [ ] **Step 7: Run tests and commit**

Run:

```powershell
node --test lib/sentinel/allocator.test.js lib/sentinel/promotion_engine.test.js
```

Expected: 5 tests pass.

Commit:

```powershell
git add data/sentinel/promotion_status.json lib/sentinel/allocator.js lib/sentinel/allocator.test.js lib/sentinel/promotion_engine.js lib/sentinel/promotion_engine.test.js
git commit -m "feat: classify sentinel strategies"
```

---

### Task 4: Risk Governor

**Files:**
- Create: `lib/sentinel/risk_governor.js`
- Test: `lib/sentinel/risk_governor.test.js`

- [ ] **Step 1: Write failing risk tests**

Create `lib/sentinel/risk_governor.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateTicketRisk } from './risk_governor.js';

const config = {
  mode: 'paper',
  paper_auto_submit_enabled: true,
  live_trading_enabled: false,
  max_symbol_exposure_pct: 20,
  max_daily_loss_pct: 2,
  max_open_orders: 10,
};

const ticket = {
  ticket_id: 'sentinel-1',
  created_at: '2026-06-28T18:00:00Z',
  strategy: 'CODEX Aggro v0',
  symbol: 'AAPL',
  asset_class: 'equity',
  side: 'buy',
  intent: 'open',
  notional_usd: 100,
  order_type: 'market',
  time_in_force: 'day',
  reason: 'test',
  source_signal_id: 'test-1',
  broker: 'alpaca-paper',
};

test('evaluateTicketRisk approves valid paper autosubmit tickets', () => {
  const result = evaluateTicketRisk(ticket, {
    config,
    riskState: { frozen: false },
    account: { equity: 10000, daily_realized_pnl: 0, open_orders: [] },
    positions: [],
    recentTickets: [],
    supportedSymbols: new Set(['AAPL']),
  });

  assert.equal(result.ok, true);
  assert.equal(result.action, 'auto-submit paper order');
});

test('evaluateTicketRisk blocks frozen risk state and unsupported symbols', () => {
  const result = evaluateTicketRisk(ticket, {
    config,
    riskState: { frozen: true, freeze_reason: 'reconciliation mismatch' },
    account: { equity: 10000, daily_realized_pnl: 0, open_orders: [] },
    positions: [],
    recentTickets: [],
    supportedSymbols: new Set(['MSFT']),
  });

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /reconciliation mismatch/);
  assert.match(result.reasons.join(' | '), /unsupported Alpaca paper symbol/);
});

test('evaluateTicketRisk blocks oversized symbol exposure and duplicate tickets', () => {
  const result = evaluateTicketRisk({ ...ticket, notional_usd: 2500 }, {
    config,
    riskState: { frozen: false },
    account: { equity: 10000, daily_realized_pnl: 0, open_orders: [] },
    positions: [],
    recentTickets: [{ source_signal_id: 'test-1', symbol: 'AAPL', strategy: 'CODEX Aggro v0' }],
    supportedSymbols: new Set(['AAPL']),
  });

  assert.equal(result.ok, false);
  assert.match(result.reasons.join(' | '), /symbol exposure exceeds/);
  assert.match(result.reasons.join(' | '), /duplicate source signal/);
});
```

- [ ] **Step 2: Run risk tests and verify they fail**

Run:

```powershell
node --test lib/sentinel/risk_governor.test.js
```

Expected: fails because `risk_governor.js` does not exist.

- [ ] **Step 3: Implement risk governor**

Create `lib/sentinel/risk_governor.js`:

```js
export function evaluateTicketRisk(ticket, context) {
  const reasons = [];
  const {
    config,
    riskState,
    account,
    positions,
    recentTickets,
    supportedSymbols,
  } = context;

  if (config.mode !== 'paper') reasons.push('sentinel mode is not paper');
  if (config.live_trading_enabled) reasons.push('live trading is disabled by design');
  if (!config.paper_auto_submit_enabled) reasons.push('paper auto-submit is disabled');
  if (riskState?.frozen) reasons.push(riskState.freeze_reason || 'risk state is frozen');
  if (!supportedSymbols?.has(ticket.symbol)) reasons.push(`unsupported Alpaca paper symbol: ${ticket.symbol}`);

  const equity = Number(account?.equity || 0);
  const notional = Number(ticket.notional_usd || 0);
  const symbolCap = equity * Number(config.max_symbol_exposure_pct || 0) / 100;
  const existingSymbolExposure = (positions || [])
    .filter(position => position.symbol === ticket.symbol)
    .reduce((sum, position) => sum + Math.abs(Number(position.market_value || 0)), 0);
  if (notional + existingSymbolExposure > symbolCap) {
    reasons.push(`symbol exposure exceeds ${config.max_symbol_exposure_pct}% cap`);
  }

  const dailyPnl = Number(account?.daily_realized_pnl || 0);
  const dailyLossCap = -equity * Number(config.max_daily_loss_pct || 0) / 100;
  if (dailyPnl <= dailyLossCap) {
    reasons.push(`daily loss exceeds ${config.max_daily_loss_pct}% cap`);
  }

  const openOrders = account?.open_orders || [];
  if (openOrders.length >= Number(config.max_open_orders || 0)) {
    reasons.push(`open order count exceeds ${config.max_open_orders}`);
  }

  const duplicate = (recentTickets || []).some(previous =>
    previous.source_signal_id === ticket.source_signal_id &&
    previous.symbol === ticket.symbol &&
    previous.strategy === ticket.strategy
  );
  if (duplicate) reasons.push('duplicate source signal');

  return {
    ok: reasons.length === 0,
    action: reasons.length === 0 ? 'auto-submit paper order' : 'block',
    reasons,
  };
}
```

- [ ] **Step 4: Run risk tests and commit**

Run:

```powershell
node --test lib/sentinel/risk_governor.test.js
```

Expected: 3 tests pass.

Commit:

```powershell
git add lib/sentinel/risk_governor.js lib/sentinel/risk_governor.test.js
git commit -m "feat: add sentinel risk governor"
```

---

### Task 5: Alpaca Paper Adapter

**Files:**
- Create: `lib/sentinel/alpaca_paper.js`
- Test: `lib/sentinel/alpaca_paper.test.js`

- [ ] **Step 1: Write failing Alpaca adapter tests**

Create `lib/sentinel/alpaca_paper.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAlpacaPaperClient, ticketToAlpacaOrder } from './alpaca_paper.js';

const ticket = {
  ticket_id: 'sentinel-1',
  symbol: 'AAPL',
  asset_class: 'equity',
  side: 'buy',
  notional_usd: 25,
  order_type: 'market',
  time_in_force: 'day',
};

test('ticketToAlpacaOrder maps a normalized ticket to Alpaca order request body', () => {
  assert.deepEqual(ticketToAlpacaOrder(ticket), {
    symbol: 'AAPL',
    side: 'buy',
    type: 'market',
    time_in_force: 'day',
    notional: '25.00',
  });
});

test('createAlpacaPaperClient posts to paper endpoint and redacts auth in result', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'alpaca-order-1', status: 'accepted', symbol: 'AAPL' }),
      text: async () => '',
    };
  };
  const client = createAlpacaPaperClient({
    env: {
      ALPACA_ENV: 'paper',
      APCA_API_KEY_ID: 'PK12345678904',
      APCA_API_SECRET_KEY: 'SECRET12345678904',
    },
    fetchImpl: fakeFetch,
  });

  const result = await client.submitOrder(ticket);

  assert.equal(calls[0].url, 'https://paper-api.alpaca.markets/v2/orders');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['APCA-API-KEY-ID'], 'PK12345678904');
  assert.equal(result.ok, true);
  assert.equal(result.order.id, 'alpaca-order-1');
  assert.equal(JSON.stringify(result).includes('SECRET12345678904'), false);
});

test('createAlpacaPaperClient refuses non-paper environment', () => {
  assert.throws(
    () => createAlpacaPaperClient({
      env: {
        ALPACA_ENV: 'live',
        APCA_API_KEY_ID: 'PK',
        APCA_API_SECRET_KEY: 'SECRET',
      },
      fetchImpl: async () => {},
    }),
    /ALPACA_ENV must be paper/
  );
});
```

- [ ] **Step 2: Run Alpaca adapter tests and verify they fail**

Run:

```powershell
node --test lib/sentinel/alpaca_paper.test.js
```

Expected: fails because `alpaca_paper.js` does not exist.

- [ ] **Step 3: Implement Alpaca paper adapter**

Create `lib/sentinel/alpaca_paper.js`:

```js
import { assertPaperEnv, redactSecret } from './config.js';
import { normalizeSymbolForAlpaca } from './ticket_schema.js';

export const ALPACA_PAPER_BASE_URL = 'https://paper-api.alpaca.markets';

export function ticketToAlpacaOrder(ticket) {
  return {
    symbol: normalizeSymbolForAlpaca(ticket.symbol),
    side: ticket.side,
    type: ticket.order_type,
    time_in_force: ticket.time_in_force,
    notional: Number(ticket.notional_usd).toFixed(2),
  };
}

export function createAlpacaPaperClient({ env = process.env, fetchImpl = fetch } = {}) {
  assertPaperEnv(env);
  const keyId = env.APCA_API_KEY_ID;
  const secret = env.APCA_API_SECRET_KEY;

  async function request(path, options = {}) {
    const response = await fetchImpl(`${ALPACA_PAPER_BASE_URL}${path}`, {
      ...options,
      headers: {
        'APCA-API-KEY-ID': keyId,
        'APCA-API-SECRET-KEY': secret,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const bodyText = await response.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: body.message || bodyText || `HTTP ${response.status}`,
        key_id: redactSecret(keyId),
      };
    }
    return { ok: true, status: response.status, body, key_id: redactSecret(keyId) };
  }

  return {
    async submitOrder(ticket) {
      const result = await request('/v2/orders', {
        method: 'POST',
        body: JSON.stringify(ticketToAlpacaOrder(ticket)),
      });
      return result.ok
        ? { ok: true, order: result.body, key_id: result.key_id }
        : result;
    },
    async getAccount() {
      return request('/v2/account');
    },
    async getPositions() {
      return request('/v2/positions');
    },
    async getOrders() {
      return request('/v2/orders?status=open');
    },
  };
}
```

- [ ] **Step 4: Run Alpaca adapter tests and commit**

Run:

```powershell
node --test lib/sentinel/alpaca_paper.test.js
```

Expected: 3 tests pass.

Commit:

```powershell
git add lib/sentinel/alpaca_paper.js lib/sentinel/alpaca_paper.test.js
git commit -m "feat: add Alpaca paper adapter"
```

---

### Task 6: Ledger Replay And Reconciliation

**Files:**
- Create: `lib/sentinel/ledger.js`
- Create: `lib/sentinel/reconcile.js`
- Create: `data/sentinel/reconciliation_report.json`
- Test: `lib/sentinel/ledger.test.js`
- Test: `lib/sentinel/reconcile.test.js`

- [ ] **Step 1: Write failing ledger tests**

Create `lib/sentinel/ledger.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { replayLedgerEvents } from './ledger.js';

test('replayLedgerEvents builds submitted order and position state', () => {
  const state = replayLedgerEvents([
    { type: 'order_submitted', ticket_id: 't1', broker_order_id: 'o1', symbol: 'AAPL', side: 'buy', notional_usd: 100 },
    { type: 'order_filled', ticket_id: 't1', broker_order_id: 'o1', symbol: 'AAPL', side: 'buy', filled_qty: 1, filled_avg_price: 100 },
  ]);

  assert.equal(state.orders.get('o1').status, 'filled');
  assert.equal(state.positions.get('AAPL').qty, 1);
  assert.equal(state.positions.get('AAPL').market_value, 100);
});

test('replayLedgerEvents records rejected orders without opening positions', () => {
  const state = replayLedgerEvents([
    { type: 'order_rejected', ticket_id: 't1', broker_order_id: null, symbol: 'AAPL', reason: 'bad symbol' },
  ]);

  assert.equal(state.positions.size, 0);
  assert.equal(state.rejections.length, 1);
});
```

- [ ] **Step 2: Write failing reconciliation tests**

Create `lib/sentinel/reconcile.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compareLedgerToBroker } from './reconcile.js';

test('compareLedgerToBroker reports clean state when positions match', () => {
  const result = compareLedgerToBroker({
    ledgerPositions: new Map([['AAPL', { symbol: 'AAPL', qty: 1, market_value: 100 }]]),
    brokerPositions: [{ symbol: 'AAPL', qty: '1', market_value: '100' }],
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.differences.length, 0);
});

test('compareLedgerToBroker freezes when broker has unexpected position', () => {
  const result = compareLedgerToBroker({
    ledgerPositions: new Map(),
    brokerPositions: [{ symbol: 'AAPL', qty: '1', market_value: '100' }],
  });

  assert.equal(result.status, 'error');
  assert.match(result.freeze_reason, /position mismatch/);
  assert.equal(result.differences.length, 1);
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```powershell
node --test lib/sentinel/ledger.test.js lib/sentinel/reconcile.test.js
```

Expected: fails because modules do not exist.

- [ ] **Step 4: Implement ledger replay**

Create `lib/sentinel/ledger.js`:

```js
export function replayLedgerEvents(events = []) {
  const orders = new Map();
  const positions = new Map();
  const rejections = [];

  for (const event of events) {
    if (event.type === 'order_submitted') {
      orders.set(event.broker_order_id, { ...event, status: 'submitted' });
    }
    if (event.type === 'order_rejected') {
      rejections.push(event);
    }
    if (event.type === 'order_filled') {
      const existing = orders.get(event.broker_order_id) || {};
      orders.set(event.broker_order_id, { ...existing, ...event, status: 'filled' });

      const current = positions.get(event.symbol) || { symbol: event.symbol, qty: 0, market_value: 0 };
      const signedQty = event.side === 'sell' ? -Number(event.filled_qty) : Number(event.filled_qty);
      const signedValue = signedQty * Number(event.filled_avg_price);
      positions.set(event.symbol, {
        symbol: event.symbol,
        qty: current.qty + signedQty,
        market_value: current.market_value + signedValue,
      });
    }
  }

  return { orders, positions, rejections };
}
```

- [ ] **Step 5: Implement reconciliation comparison**

Create `lib/sentinel/reconcile.js`:

```js
export function compareLedgerToBroker({ ledgerPositions, brokerPositions }) {
  const differences = [];
  const ledger = ledgerPositions || new Map();
  const brokerBySymbol = new Map((brokerPositions || []).map(position => [position.symbol, position]));
  const symbols = new Set([...ledger.keys(), ...brokerBySymbol.keys()]);

  for (const symbol of symbols) {
    const ledgerPosition = ledger.get(symbol) || { qty: 0, market_value: 0 };
    const brokerPosition = brokerBySymbol.get(symbol) || { qty: 0, market_value: 0 };
    const ledgerQty = Number(ledgerPosition.qty || 0);
    const brokerQty = Number(brokerPosition.qty || 0);
    const ledgerValue = Number(ledgerPosition.market_value || 0);
    const brokerValue = Number(brokerPosition.market_value || 0);

    if (Math.abs(ledgerQty - brokerQty) > 0.000001 || Math.abs(ledgerValue - brokerValue) > 0.01) {
      differences.push({ symbol, ledger_qty: ledgerQty, broker_qty: brokerQty, ledger_value: ledgerValue, broker_value: brokerValue });
    }
  }

  return differences.length
    ? { status: 'error', freeze_reason: 'position mismatch between ledger and broker', differences }
    : { status: 'ok', freeze_reason: '', differences };
}
```

- [ ] **Step 6: Create reconciliation seed**

Create `data/sentinel/reconciliation_report.json`:

```json
{
  "generated_at": "",
  "status": "not_run",
  "freeze_reason": "",
  "differences": []
}
```

- [ ] **Step 7: Run tests and commit**

Run:

```powershell
node --test lib/sentinel/ledger.test.js lib/sentinel/reconcile.test.js
```

Expected: 4 tests pass.

Commit:

```powershell
git add data/sentinel/reconciliation_report.json lib/sentinel/ledger.js lib/sentinel/ledger.test.js lib/sentinel/reconcile.js lib/sentinel/reconcile.test.js
git commit -m "feat: add sentinel ledger reconciliation"
```

---

### Task 7: Sentinel Worker And Auto-Submit Flow

**Files:**
- Create: `scripts/sentinel_tick.js`
- Create: `scripts/sentinel_create_test_ticket.js`
- Create: `data/sentinel/sentinel_status.md`
- Test: `scripts/sentinel_tick.test.js`

- [ ] **Step 1: Write failing worker tests**

Create `scripts/sentinel_tick.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { processTickets } from './sentinel_tick.js';

const ticket = {
  ticket_id: 'sentinel-test-1',
  created_at: '2026-06-28T18:00:00Z',
  strategy: 'CODEX Aggro v0',
  symbol: 'AAPL',
  asset_class: 'equity',
  side: 'buy',
  intent: 'open',
  notional_usd: 25,
  order_type: 'market',
  time_in_force: 'day',
  reason: 'paper smoke test',
  source_signal_id: 'paper-smoke-1',
  broker: 'alpaca-paper',
};

test('processTickets auto-submits approved paper tickets and records ledger events', async () => {
  const submitted = [];
  const broker = {
    submitOrder: async (t) => {
      submitted.push(t);
      return { ok: true, order: { id: 'alpaca-1', status: 'accepted', symbol: t.symbol } };
    },
  };

  const result = await processTickets({
    tickets: [ticket],
    broker,
    config: { mode: 'paper', paper_auto_submit_enabled: true, live_trading_enabled: false, max_symbol_exposure_pct: 20, max_daily_loss_pct: 2, max_open_orders: 10 },
    riskState: { frozen: false },
    account: { equity: 10000, daily_realized_pnl: 0, open_orders: [] },
    positions: [],
    recentTickets: [],
    supportedSymbols: new Set(['AAPL']),
    now: '2026-06-28T18:01:00Z',
  });

  assert.equal(submitted.length, 1);
  assert.equal(result.decisions[0].decision, 'submitted');
  assert.equal(result.ledgerEvents[0].type, 'order_submitted');
  assert.equal(result.ledgerEvents[0].broker_order_id, 'alpaca-1');
});

test('processTickets records blocked decisions without submitting', async () => {
  const broker = {
    submitOrder: async () => {
      throw new Error('submit should not be called');
    },
  };

  const result = await processTickets({
    tickets: [ticket],
    broker,
    config: { mode: 'paper', paper_auto_submit_enabled: true, live_trading_enabled: false, max_symbol_exposure_pct: 20, max_daily_loss_pct: 2, max_open_orders: 10 },
    riskState: { frozen: true, freeze_reason: 'test freeze' },
    account: { equity: 10000, daily_realized_pnl: 0, open_orders: [] },
    positions: [],
    recentTickets: [],
    supportedSymbols: new Set(['AAPL']),
    now: '2026-06-28T18:01:00Z',
  });

  assert.equal(result.decisions[0].decision, 'blocked');
  assert.match(result.decisions[0].reasons.join(' | '), /test freeze/);
  assert.equal(result.ledgerEvents.length, 0);
});
```

- [ ] **Step 2: Run worker tests and verify they fail**

Run:

```powershell
node --test scripts/sentinel_tick.test.js
```

Expected: fails because `scripts/sentinel_tick.js` does not exist.

- [ ] **Step 3: Implement worker processing function**

Create `scripts/sentinel_tick.js` with exported `processTickets` and a guarded CLI:

```js
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { createAlpacaPaperClient } from '../lib/sentinel/alpaca_paper.js';
import { loadSentinelConfigFromText } from '../lib/sentinel/config.js';
import { appendJsonl, readJsonlFile } from '../lib/sentinel/jsonl.js';
import { evaluateTicketRisk } from '../lib/sentinel/risk_governor.js';
import { validateTicket } from '../lib/sentinel/ticket_schema.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function processTickets({ tickets, broker, config, riskState, account, positions, recentTickets, supportedSymbols, now }) {
  const decisions = [];
  const ledgerEvents = [];

  for (const ticket of tickets) {
    const schema = validateTicket(ticket);
    if (!schema.ok) {
      decisions.push({ ...ticket, decided_at: now, decision: 'blocked', reasons: schema.errors });
      continue;
    }

    const risk = evaluateTicketRisk(ticket, { config, riskState, account, positions, recentTickets, supportedSymbols });
    if (!risk.ok) {
      decisions.push({ ...ticket, decided_at: now, decision: 'blocked', reasons: risk.reasons });
      continue;
    }

    const submitted = await broker.submitOrder(ticket);
    if (!submitted.ok) {
      decisions.push({ ...ticket, decided_at: now, decision: 'broker_rejected', reasons: [submitted.error || 'broker rejected order'] });
      ledgerEvents.push({ type: 'order_rejected', at: now, ticket_id: ticket.ticket_id, broker_order_id: null, symbol: ticket.symbol, reason: submitted.error || 'broker rejected order' });
      continue;
    }

    decisions.push({ ...ticket, decided_at: now, decision: 'submitted', broker_order_id: submitted.order.id, reasons: [] });
    ledgerEvents.push({
      type: 'order_submitted',
      at: now,
      ticket_id: ticket.ticket_id,
      broker_order_id: submitted.order.id,
      symbol: ticket.symbol,
      side: ticket.side,
      notional_usd: ticket.notional_usd,
      strategy: ticket.strategy,
    });
  }

  return { decisions, ledgerEvents };
}

async function readJson(relativePath, fallback) {
  try {
    return JSON.parse(await readFile(path.join(REPO_ROOT, relativePath), 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function main() {
  const now = new Date().toISOString();
  const config = loadSentinelConfigFromText(await readFile(path.join(REPO_ROOT, 'data/sentinel/config.json'), 'utf8'));
  const riskState = await readJson('data/sentinel/risk_state.json', { frozen: false });
  const tickets = await readJsonlFile(path.join(REPO_ROOT, 'data/sentinel/ticket_inbox.jsonl'));
  const recentTickets = await readJsonlFile(path.join(REPO_ROOT, 'data/sentinel/trade_tickets.jsonl'));
  const broker = createAlpacaPaperClient();

  const accountResp = await broker.getAccount();
  const positionsResp = await broker.getPositions();
  const ordersResp = await broker.getOrders();
  if (!accountResp.ok) throw new Error(`Alpaca account fetch failed: ${accountResp.error}`);
  if (!positionsResp.ok) throw new Error(`Alpaca positions fetch failed: ${positionsResp.error}`);
  if (!ordersResp.ok) throw new Error(`Alpaca orders fetch failed: ${ordersResp.error}`);

  const account = {
    equity: Number(accountResp.body.equity || 0),
    daily_realized_pnl: 0,
    open_orders: ordersResp.body,
  };
  const supportedSymbols = new Set(['AAPL', 'MSFT', 'SPY', 'QQQ', 'BTC/USD', 'ETH/USD']);
  const result = await processTickets({
    tickets,
    broker,
    config,
    riskState,
    account,
    positions: positionsResp.body,
    recentTickets,
    supportedSymbols,
    now,
  });

  for (const decision of result.decisions) {
    await appendJsonl(path.join(REPO_ROOT, 'data/sentinel/trade_tickets.jsonl'), decision);
  }
  for (const event of result.ledgerEvents) {
    await appendJsonl(path.join(REPO_ROOT, 'data/sentinel/execution_ledger.jsonl'), event);
  }
  await writeFile(path.join(REPO_ROOT, 'data/sentinel/sentinel_status.md'), `# Trade Sentinel Status\n\n- generated_at: ${now}\n- processed_tickets: ${result.decisions.length}\n- submitted: ${result.decisions.filter(d => d.decision === 'submitted').length}\n- blocked: ${result.decisions.filter(d => d.decision === 'blocked').length}\n`, 'utf8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Implement test-ticket creator**

Create `scripts/sentinel_create_test_ticket.js`:

```js
import { appendJsonl } from '../lib/sentinel/jsonl.js';

const symbol = process.argv[2] || 'AAPL';
const notional = Number(process.argv[3] || 5);
const now = new Date().toISOString();
const safeSymbol = symbol.trim().toUpperCase();

await appendJsonl('data/sentinel/ticket_inbox.jsonl', {
  ticket_id: `sentinel-smoke-${Date.now()}`,
  created_at: now,
  strategy: 'SENTINEL Paper Smoke',
  symbol: safeSymbol,
  asset_class: safeSymbol.includes('/') ? 'crypto' : 'equity',
  side: 'buy',
  intent: 'open',
  notional_usd: notional,
  quantity: null,
  order_type: 'market',
  time_in_force: safeSymbol.includes('/') ? 'gtc' : 'day',
  reason: 'paper auto-submit smoke ticket',
  source_signal_id: `paper-smoke-${Date.now()}`,
  risk_status: 'pending',
  broker: 'alpaca-paper'
});

console.log(`queued paper ticket ${safeSymbol} $${notional.toFixed(2)}`);
```

- [ ] **Step 5: Create status seed**

Create `data/sentinel/sentinel_status.md`:

```markdown
# Trade Sentinel Status

- generated_at:
- processed_tickets: 0
- submitted: 0
- blocked: 0
```

- [ ] **Step 6: Run worker tests and commit**

Run:

```powershell
node --test scripts/sentinel_tick.test.js
```

Expected: 2 tests pass.

Commit:

```powershell
git add data/sentinel/sentinel_status.md scripts/sentinel_tick.js scripts/sentinel_tick.test.js scripts/sentinel_create_test_ticket.js
git commit -m "feat: process sentinel paper tickets"
```

---

### Task 8: Sentinel UI

**Files:**
- Create: `sentinel.html`
- Create: `sentinel_app.js`
- Create: `lib/sentinel/render.js`
- Test: `lib/sentinel/render.test.js`
- Modify: `index.html`
- Create: `Open Trade Sentinel.bat`

- [ ] **Step 1: Write failing render tests**

Create `lib/sentinel/render.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderSentinelHtml } from './render.js';

test('renderSentinelHtml shows paper autosubmit and allocation', () => {
  const html = renderSentinelHtml({
    statusText: '# Trade Sentinel Status\n\n- submitted: 1\n- blocked: 0\n',
    config: { mode: 'paper', paper_auto_submit_enabled: true },
    allocation: {
      strategies: [{ name: 'CODEX Aggro v0', target_weight: 0.18, role: 'proven_crypto_momentum' }],
    },
    promotion: { strategies: [{ name: 'CODEX Aggro v0', status: 'core', reason: 'configured core' }] },
    riskState: { frozen: false },
    reconciliation: { status: 'ok', differences: [] },
    tickets: [{ ticket_id: 't1', decision: 'submitted', symbol: 'AAPL' }],
    ledger: [{ type: 'order_submitted', broker_order_id: 'o1', symbol: 'AAPL' }],
  });

  assert.match(html, /Paper Auto-Submit/);
  assert.match(html, /CODEX Aggro v0/);
  assert.match(html, /order_submitted/);
});
```

- [ ] **Step 2: Run render test and verify it fails**

Run:

```powershell
node --test lib/sentinel/render.test.js
```

Expected: fails because `render.js` does not exist.

- [ ] **Step 3: Implement renderer**

Create `lib/sentinel/render.js`:

```js
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(0)}%`;
}

export function renderSentinelHtml(model) {
  const frozen = model.riskState?.frozen;
  const allocationRows = (model.allocation?.strategies || []).map(item => `
    <tr><td>${esc(item.name)}</td><td>${pct(item.target_weight)}</td><td>${esc(item.role)}</td></tr>
  `).join('');
  const promotionRows = (model.promotion?.strategies || []).slice(0, 20).map(item => `
    <tr><td>${esc(item.name)}</td><td>${esc(item.status)}</td><td>${esc(item.reason)}</td></tr>
  `).join('');
  const ticketRows = (model.tickets || []).slice(-20).reverse().map(item => `
    <tr><td>${esc(item.ticket_id)}</td><td>${esc(item.symbol)}</td><td>${esc(item.decision || 'pending')}</td></tr>
  `).join('');
  const ledgerRows = (model.ledger || []).slice(-20).reverse().map(item => `
    <tr><td>${esc(item.type)}</td><td>${esc(item.symbol)}</td><td>${esc(item.broker_order_id || '')}</td></tr>
  `).join('');

  return `
    <section class="sentinel-hero">
      <div>
        <h2>Trade Sentinel</h2>
        <p>Paper Auto-Submit: ${model.config?.paper_auto_submit_enabled ? 'ON' : 'OFF'} · Mode: ${esc(model.config?.mode || 'unknown')}</p>
      </div>
      <div class="${frozen ? 'status-error' : 'status-ok'}">${frozen ? esc(model.riskState.freeze_reason || 'Frozen') : 'Ready'}</div>
    </section>
    <section><h3>Allocation</h3><table><tbody>${allocationRows}</tbody></table></section>
    <section><h3>Promotion Lab</h3><table><tbody>${promotionRows}</tbody></table></section>
    <section><h3>Trade Queue</h3><table><tbody>${ticketRows}</tbody></table></section>
    <section><h3>Execution Ledger</h3><table><tbody>${ledgerRows}</tbody></table></section>
  `;
}
```

- [ ] **Step 4: Implement `sentinel.html`**

Create `sentinel.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trade Sentinel</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="dash">
    <header class="dash-header">
      <div class="title">Trade Sentinel</div>
      <div class="meta">
        <span id="updated" class="dim">loading...</span>
        <button id="refresh-btn" class="refresh-btn" type="button">Refresh</button>
      </div>
    </header>
    <main id="sentinel-root">
      <div class="loading">Loading sentinel...</div>
    </main>
  </div>
  <script type="module">
    const assetVersion = new URLSearchParams(location.search).get('v') || Date.now().toString();
    import(`./sentinel_app.js?v=${encodeURIComponent(assetVersion)}`);
  </script>
</body>
</html>
```

- [ ] **Step 5: Implement browser app**

Create `sentinel_app.js`:

```js
import { fetchLocalText } from './lib/fetch.js';
import { readJsonlText } from './lib/sentinel/jsonl.js';
import { renderSentinelHtml } from './lib/sentinel/render.js';

const PATHS = {
  config: 'data/sentinel/config.json',
  allocation: 'data/sentinel/allocation.json',
  promotion: 'data/sentinel/promotion_status.json',
  riskState: 'data/sentinel/risk_state.json',
  reconciliation: 'data/sentinel/reconciliation_report.json',
  tickets: 'data/sentinel/trade_tickets.jsonl',
  ledger: 'data/sentinel/execution_ledger.jsonl',
  status: 'data/sentinel/sentinel_status.md',
};

async function fetchJson(path, fallback) {
  const resp = await fetchLocalText(path);
  if (!resp.ok || !resp.text.trim()) return fallback;
  return JSON.parse(resp.text);
}

async function fetchJsonl(path) {
  const resp = await fetchLocalText(path);
  if (!resp.ok) return [];
  return readJsonlText(resp.text);
}

async function loadSentinel() {
  const [config, allocation, promotion, riskState, reconciliation, tickets, ledger, statusResp] = await Promise.all([
    fetchJson(PATHS.config, {}),
    fetchJson(PATHS.allocation, { strategies: [] }),
    fetchJson(PATHS.promotion, { strategies: [] }),
    fetchJson(PATHS.riskState, {}),
    fetchJson(PATHS.reconciliation, {}),
    fetchJsonl(PATHS.tickets),
    fetchJsonl(PATHS.ledger),
    fetchLocalText(PATHS.status),
  ]);

  document.getElementById('sentinel-root').innerHTML = renderSentinelHtml({
    config,
    allocation,
    promotion,
    riskState,
    reconciliation,
    tickets,
    ledger,
    statusText: statusResp.ok ? statusResp.text : '',
  });
  document.getElementById('updated').textContent = `updated ${new Date().toLocaleTimeString()}`;
}

document.getElementById('refresh-btn').addEventListener('click', () => {
  loadSentinel().catch(error => {
    document.getElementById('sentinel-root').innerHTML = `<div class="loading">Sentinel load failed: ${error.message}</div>`;
  });
});

loadSentinel().catch(error => {
  document.getElementById('sentinel-root').innerHTML = `<div class="loading">Sentinel load failed: ${error.message}</div>`;
});
```

- [ ] **Step 6: Add launcher**

Create `Open Trade Sentinel.bat`:

```bat
@echo off
setlocal enabledelayedexpansion
set SERVER_DIR=%~dp0
if "%SERVER_DIR:~-1%"=="\" set SERVER_DIR=%SERVER_DIR:~0,-1%
set PORT=8123
for /f %%I in ('powershell -NoProfile -Command "[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()"') do set CACHE_BUSTER=%%I
set URL=http://127.0.0.1:%PORT%/sentinel.html?v=!CACHE_BUSTER!
start "" "%SERVER_DIR%\Open Leaderboard.bat"
timeout /t 2 /nobreak >nul
start "" !URL!
endlocal
```

- [ ] **Step 7: Optionally link from `index.html`**

In `index.html`, inside the header `.meta` block, add:

```html
<a class="refresh-btn" href="sentinel.html">Sentinel</a>
```

- [ ] **Step 8: Run render test and browser-static smoke**

Run:

```powershell
node --test lib/sentinel/render.test.js
Invoke-WebRequest http://127.0.0.1:8123/sentinel.html -UseBasicParsing
```

Expected: render test passes; HTTP request returns status 200 when local server is running.

Commit:

```powershell
git add sentinel.html sentinel_app.js "Open Trade Sentinel.bat" index.html lib/sentinel/render.js lib/sentinel/render.test.js
git commit -m "feat: add trade sentinel UI"
```

---

### Task 9: Smoke Command And Package Script

**Files:**
- Create: `scripts/sentinel_smoke.js`
- Test: `scripts/sentinel_smoke.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing smoke test**

Create `scripts/sentinel_smoke.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSmokeSummary } from './sentinel_smoke.js';

test('buildSmokeSummary reports autosubmit mode and files present', () => {
  const summary = buildSmokeSummary({
    config: { mode: 'paper', paper_auto_submit_enabled: true },
    allocation: { strategies: [{ name: 'CODEX Aggro v0' }] },
    riskState: { frozen: false },
    promotion: { strategies: [{ name: 'CODEX Aggro v0', status: 'core' }] },
  });

  assert.equal(summary.mode, 'paper');
  assert.equal(summary.paper_auto_submit_enabled, true);
  assert.equal(summary.allocation_count, 1);
  assert.equal(summary.ok, true);
});
```

- [ ] **Step 2: Run smoke test and verify it fails**

Run:

```powershell
node --test scripts/sentinel_smoke.test.js
```

Expected: fails because `sentinel_smoke.js` does not exist.

- [ ] **Step 3: Implement smoke script**

Create `scripts/sentinel_smoke.js`:

```js
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function buildSmokeSummary({ config, allocation, riskState, promotion }) {
  const errors = [];
  if (config.mode !== 'paper') errors.push('config mode is not paper');
  if (!config.paper_auto_submit_enabled) errors.push('paper auto-submit is not enabled');
  if (!Array.isArray(allocation.strategies) || allocation.strategies.length === 0) errors.push('allocation is empty');
  if (riskState.frozen) errors.push(`risk state frozen: ${riskState.freeze_reason || 'unknown'}`);
  if (!Array.isArray(promotion.strategies)) errors.push('promotion status missing strategies');
  return {
    ok: errors.length === 0,
    errors,
    mode: config.mode,
    paper_auto_submit_enabled: config.paper_auto_submit_enabled,
    allocation_count: allocation.strategies?.length || 0,
    promotion_count: promotion.strategies?.length || 0,
  };
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(REPO_ROOT, relativePath), 'utf8'));
}

async function main() {
  const summary = buildSmokeSummary({
    config: await readJson('data/sentinel/config.json'),
    allocation: await readJson('data/sentinel/allocation.json'),
    riskState: await readJson('data/sentinel/risk_state.json'),
    promotion: await readJson('data/sentinel/promotion_status.json'),
  });
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Add package script**

Modify `package.json` scripts:

```json
"sentinel:smoke": "node scripts/sentinel_smoke.js"
```

Keep existing scripts unchanged.

- [ ] **Step 5: Run smoke test and script**

Run:

```powershell
node --test scripts/sentinel_smoke.test.js
npm run sentinel:smoke
```

Expected: test passes; smoke script prints `"ok": true`.

Commit:

```powershell
git add package.json scripts/sentinel_smoke.js scripts/sentinel_smoke.test.js
git commit -m "test: add sentinel smoke check"
```

---

### Task 10: Full Verification And Paper Autosubmit Trial

**Files:**
- No new source files.
- Uses local `.env` or current PowerShell environment.

- [ ] **Step 1: Run all local tests**

Run:

```powershell
npm test
npm run smoke
npm run sentinel:smoke
```

Expected:

- `npm test`: all existing and new tests pass.
- `npm run smoke`: all 80 leaderboard rows validate.
- `npm run sentinel:smoke`: prints `"ok": true`.

- [ ] **Step 2: Verify secret files are ignored**

Run:

```powershell
git check-ignore .env .env.local local-secrets\alpaca.secret
```

Expected:

```text
.env
.env.local
local-secrets\alpaca.secret
```

- [ ] **Step 3: Set local Alpaca paper credentials in the current shell**

Use the values saved locally by the user. `Read-Host` keeps the values out of this plan and avoids writing them to a tracked file.

Run in PowerShell:

```powershell
$env:ALPACA_ENV='paper'
$env:APCA_API_KEY_ID = Read-Host 'Alpaca paper key id'
$env:APCA_API_SECRET_KEY = Read-Host 'Alpaca paper secret'
```

Expected: PowerShell prompts for two values and stores them only in the current process environment.

- [ ] **Step 4: Queue a tiny paper ticket**

Run:

```powershell
node scripts/sentinel_create_test_ticket.js AAPL 5
```

Expected:

```text
queued paper ticket AAPL $5.00
```

- [ ] **Step 5: Run the autosubmit worker against Alpaca paper**

Run:

```powershell
node scripts/sentinel_tick.js
```

Expected:

- Exit code 0.
- `data/sentinel/trade_tickets.jsonl` receives a `submitted` or `broker_rejected` decision.
- `data/sentinel/execution_ledger.jsonl` receives `order_submitted` if Alpaca accepted the paper order.
- `data/sentinel/sentinel_status.md` updates `processed_tickets`.

- [ ] **Step 6: Inspect resulting files without printing secrets**

Run:

```powershell
Get-Content data\sentinel\sentinel_status.md
Get-Content data\sentinel\trade_tickets.jsonl -Tail 5
Get-Content data\sentinel\execution_ledger.jsonl -Tail 5
```

Expected:

- No API key or secret appears.
- The test ticket appears with a clear decision.
- Ledger events include broker order id only when submission succeeded.

- [ ] **Step 7: Open the UI**

Run:

```powershell
Start-Process -FilePath 'C:\trading\strategy-leaderboard\Open Trade Sentinel.bat' -WindowStyle Hidden
```

Expected:

- Browser opens `sentinel.html`.
- UI shows `Paper Auto-Submit: ON`.
- Trade Queue shows the processed paper ticket.
- Execution Ledger shows the order event if submitted.

- [ ] **Step 8: Commit verified implementation**

Commit only source/config files that do not contain secrets. Do not commit `.env`, `.env.local`, local secret files, or accidental key material.

Run:

```powershell
git status --short
git diff --cached
git commit -m "feat: add paper autosubmit trade sentinel"
```

Expected: commit includes sentinel source, tests, and seed data only.

---

## Implementation Notes

- Keep Alpaca calls in Node only.
- Keep browser UI read-only.
- Do not add UI controls that can bypass the risk governor.
- Do not introduce a live endpoint constant except inside a test that proves it is rejected.
- Use dependency injection for `fetch` in Alpaca tests.
- Use append-only JSONL for tickets and ledger events.
- Keep existing leaderboard rows and CODEX snapshots intact.
- Do not remove, prune, hide, or zero any strategies.

## Self-Review Checklist

- Spec coverage: paper auto-submit, no manual approval, UI, promotion lab, risk governor, Alpaca paper adapter, ledger, reconciliation, and smoke verification are covered.
- Secret safety: credentials remain local environment values and are not visible to browser code.
- Type consistency: ticket fields use `ticket_id`, `source_signal_id`, `notional_usd`, `broker`, and `risk_status` consistently.
- Execution safety: every paper order goes through schema validation and risk evaluation before Alpaca submission.
