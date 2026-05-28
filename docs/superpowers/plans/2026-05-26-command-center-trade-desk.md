# Command Center Trade Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Command Center summary cards with a two-section trade desk for open-trade P/L and closed-trade review scores.

**Architecture:** Keep `lib/command_center.js` as the model and rendering boundary. Add enriched `openTrades` and `closedTrades` arrays to the existing Command Center model, then render them as two expanded stacked sections. Keep data fetching unchanged because portfolio and trade-log snapshots are already loaded.

**Tech Stack:** Browser JavaScript modules, Node test runner, existing markdown parsers, CSS in `css/style.css`.

---

## File Structure

- Modify `lib/command_center.js`: enrich open positions, build closed trade review rows, compute analyst scores, and render the two trade desk sections.
- Modify `lib/command_center.test.js`: add red-green coverage for open-trade enrichment, closed-trade scoring, and trade desk rendering.
- Modify `css/style.css`: replace four-card Command Center grid styling with stacked trade desk tables/cards that work on mobile.

## Task 1: Open Trade Monitor Model

**Files:**
- Modify: `lib/command_center.test.js`
- Modify: `lib/command_center.js`

- [ ] **Step 1: Write the failing test**

Add a test that builds the existing fixture model and expects `model.openTrades[0]` to include `pnlPct`, `distanceToStopPct`, `ageHours`, and a status.

```js
test('buildCommandCenterModel enriches open trades for the trade desk', () => {
  const model = buildCommandCenterModel({
    rows,
    registry,
    snapshots,
    selectedNames: ['Strategy A'],
  });

  assert.equal(model.openTrades.length, 1);
  assert.equal(model.openTrades[0].strategy, 'Strategy A');
  assert.equal(model.openTrades[0].pair, 'ETH/USD');
  assert.equal(model.openTrades[0].unrealizedPnl, 10);
  assert.equal(model.openTrades[0].pnlPct, 10);
  assert.equal(Math.round(model.openTrades[0].distanceToStopPct * 10) / 10, 14.5);
  assert.equal(model.openTrades[0].ageHours, 24);
  assert.equal(model.openTrades[0].status, 'Clean');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/command_center.test.js`

Expected: FAIL because `model.openTrades` is undefined.

- [ ] **Step 3: Implement open-trade enrichment**

In `buildCommandCenterModel`, add an `openTrades` field built from `strategies.flatMap(item => item.positions.map(...))`.

Add helpers in `lib/command_center.js`:

```js
function buildOpenTradeRows(strategies) {
  return strategies
    .flatMap(item => item.positions.map(position => enrichOpenPosition(position, item.events)))
    .sort((a, b) => openTradeRank(a.status) - openTradeRank(b.status)
      || Math.abs(b.unrealizedPnl ?? 0) - Math.abs(a.unrealizedPnl ?? 0));
}

function enrichOpenPosition(position, events) {
  const openEvent = [...events]
    .filter(event => event.action === 'OPEN' && event.symbol === position.pair && event.sleeve === position.sleeve)
    .sort((a, b) => compareTimeDesc(a.time, b.time))[0];
  const pnlPct = position.entry && position.mark
    ? ((position.mark - position.entry) / position.entry) * (position.side === 'short' ? -100 : 100)
    : null;
  const distanceToStopPct = distanceToStop(position);
  const ageHours = openEvent?.time ? hoursBetween(openEvent.time, position.asOf || new Date().toISOString()) : null;
  const status = openPositionStatus({ ...position, pnlPct, distanceToStopPct });
  return { ...position, openedAt: openEvent?.time || '', pnlPct, distanceToStopPct, ageHours, status };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/command_center.test.js`

Expected: PASS for the new open-trade test and existing Command Center tests.

## Task 2: Closed Trade Analyst Score Model

**Files:**
- Modify: `lib/command_center.test.js`
- Modify: `lib/command_center.js`

- [ ] **Step 1: Write the failing test**

Add a test that expects closed trades to include an analyst score, score label, hold time, and reason.

```js
test('buildCommandCenterModel builds closed trade analyst scores', () => {
  const model = buildCommandCenterModel({
    rows,
    registry,
    snapshots,
    selectedNames: ['Strategy A'],
  });

  const closed = model.closedTrades.find(trade => trade.strategy === 'Strategy A');
  assert.equal(closed.symbol, 'BTC/USD');
  assert.equal(closed.pnl, 100);
  assert.equal(closed.r, 2);
  assert.equal(closed.holdHours, 24);
  assert.equal(closed.analystScore >= 80, true);
  assert.equal(closed.scoreLabel, 'Strong');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/command_center.test.js`

Expected: FAIL because `model.closedTrades` is undefined.

- [ ] **Step 3: Implement closed-trade scoring**

Add `closedTrades: buildClosedTradeRows(strategies)` to the model return value.

Add helpers:

```js
function buildClosedTradeRows(strategies) {
  return strategies
    .flatMap(item => item.trips.map(trip => scoreClosedTrade({ ...trip, strategy: item.name })))
    .filter(trade => trade.exit_time)
    .sort((a, b) => compareTimeDesc(a.exit_time, b.exit_time))
    .slice(0, 25);
}

function scoreClosedTrade(trip) {
  const holdHours = trip.entry_time && trip.exit_time ? hoursBetween(trip.entry_time, trip.exit_time) : null;
  const analystScore = tradeAnalystScore({ ...trip, holdHours });
  return {
    ...trip,
    holdHours,
    analystScore,
    scoreLabel: analystScoreLabel(analystScore),
  };
}
```

Use a simple 0-100 score with neutral starts and clamped additions:

```js
function tradeAnalystScore(trade) {
  let score = 50;
  const r = trade.r;
  if (r != null) score += Math.max(-25, Math.min(25, r * 12));
  if ((trade.pnl ?? 0) > 0) score += 8;
  if ((trade.pnl ?? 0) < 0) score -= 6;
  const reason = String(trade.reason || '').toLowerCase();
  if (reason) score += 8;
  if (/(target|trail|time-stop|stop|momentum|breakout|regime|risk)/.test(reason)) score += 6;
  if (trade.holdHours != null && trade.holdHours >= 0) score += 3;
  if (r != null && r <= -1.5) score -= 12;
  return Math.max(0, Math.min(100, Math.round(score)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/command_center.test.js`

Expected: PASS for both model tests.

## Task 3: Trade Desk Rendering

**Files:**
- Modify: `lib/command_center.test.js`
- Modify: `lib/command_center.js`

- [ ] **Step 1: Write the failing rendering test**

Update the existing rendering test so it expects the trade desk sections and rejects the old card labels.

```js
assert.match(commandHtml, /Open Trade Monitor/);
assert.match(commandHtml, /Closed Trade Review/);
assert.match(commandHtml, /Trade Analyst Score/);
assert.doesNotMatch(commandHtml, /Portfolio Heat/);
assert.doesNotMatch(commandHtml, /Promotion Readiness/);
assert.doesNotMatch(commandHtml, /Ensemble View/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/command_center.test.js`

Expected: FAIL because the old cards still render.

- [ ] **Step 3: Replace Command Center HTML**

Change `renderCommandCenterHtml` to render:

```js
<div class="trade-desk">
  ${openTradeMonitorHtml(model.openTrades)}
  ${closedTradeReviewHtml(model.closedTrades)}
</div>
```

Keep the header but change metadata to show open-trade and closed-trade counts.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/command_center.test.js`

Expected: PASS.

## Task 4: Mobile-Friendly Styling

**Files:**
- Modify: `css/style.css`
- Test: `lib/command_center.test.js`

- [ ] **Step 1: Add trade desk CSS**

Add CSS for:

```css
.trade-desk { display: grid; gap: 10px; }
.trade-desk-card { border: 1px solid #242424; background: #101010; border-radius: 6px; padding: 10px; }
.trade-table { display: grid; gap: 6px; }
.trade-table-row { display: grid; align-items: center; gap: 8px; }
.open-trade-row { grid-template-columns: minmax(120px, 1.3fr) repeat(5, minmax(70px, .7fr)); }
.closed-trade-row { grid-template-columns: minmax(120px, 1.3fr) repeat(5, minmax(70px, .7fr)); }
.trade-pill { border: 1px solid #333; border-radius: 999px; padding: 2px 7px; font-size: 10px; }
```

Add a mobile media rule that collapses rows into two-column cards at `max-width: 700px`.

- [ ] **Step 2: Run focused tests**

Run: `node --test lib/command_center.test.js`

Expected: PASS.

## Task 5: Full Verification

**Files:**
- Verify only

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all Node tests pass.

- [ ] **Step 2: Run smoke**

Run: `npm run smoke`

Expected: all 45 strategy rows have valid `StrategyRow` shape.

- [ ] **Step 3: Run CODEX snapshot integrity**

Run: `node --test scripts\codex_snapshot_integrity.test.js`

Expected: active CODEX snapshots keep non-empty forward trade history.

- [ ] **Step 4: Confirm protected strategy count**

Run:

```powershell
node -e "import('./registry.js').then(m=>console.log(m.STRATEGIES.length))"
```

Expected: `45`.
