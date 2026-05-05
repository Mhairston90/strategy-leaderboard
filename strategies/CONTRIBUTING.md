# Contributing a strategy

This guide walks you from "I have a trading idea" to "my strategy is on the leaderboard."

## Before you start

1. **Read [../COMPETITION.md](../COMPETITION.md).** Understand the windowed-return ranking, kill switches, and anti-rules.
2. **Have a frozen idea.** Don't open a PR while you're still tuning. The whole point of the leaderboard is that v1's parameters are locked at submission and tested in forward time.

## What you need to submit

A complete PR contains:

1. **Spec markdown** — `strategies/<your-strategy>-spec.md`, structured per the template below.
2. **Trade log + portfolio snapshot** — markdown files under `data/<your-handle>/<your-strategy>_*.md`, in the schema below.
3. **Adapter** — JS file under `adapters/`. For most cases you can reuse `adapter_codex.js` directly (it parses BULL-style trade-log markdown).
4. **Registry entry** — append to `STRATEGIES` array in `registry.js`.
5. **Test** — append a fixture-based test in `adapters/adapters.test.js`.

CI runs `npm test && npm run smoke`. If either fails, the PR cannot merge.

---

## Step 1 — Spec

Copy [templates/strategy-spec-template.md](templates/strategy-spec-template.md) to `strategies/<your-strategy>-spec.md` and fill it in. Required sections:

- **Status** — DRAFT / PAPER / LIVE / ARCHIVED
- **Edge thesis** — one paragraph; what's the inefficiency you're capturing?
- **Universe** — exact symbols, frozen at spec time
- **Timeframe & direction** — bar size, long/short
- **Entry rules** — pseudocode or natural language; must be deterministic
- **Exit rules** — stop, target, trail, time stop, etc.
- **Position sizing** — risk per trade, capital base, leverage if any
- **Risk controls** — max concurrent, daily loss circuit, correlation cap, etc.
- **Capital** — starting virtual capital ($10k default; declare if different)
- **Kill switch** — DD threshold and reason
- **Expected behavior** — trades/week, win rate, PF, DD ranges
- **Known limitations** — at least 2-3 honest disclosures of what could fail

Strategies without a complete spec are NOT mergeable. The spec is the contract; the trade log is the evidence.

## Step 2 — Trade log + portfolio snapshot

The leaderboard reads markdown trade logs in **BULL/CODEX format**. Copy [templates/trade-log-template.md](templates/trade-log-template.md) and [templates/portfolio-template.md](templates/portfolio-template.md) into `data/<your-handle>/`.

### Trade log schema

```
| Timestamp (UTC)      | Event  | Pair    | Side | Size  | Price   | Stop    | Target | R at exit | Realized PnL | Reason tag |
|----------------------|--------|---------|------|-------|---------|---------|--------|-----------|--------------|------------|
| 2026-05-01T14:00:00Z | OPEN   | BTC/USD | long | 0.012 | 78400.5 | 77900.0 | —      | —         | —            | breakout-strong-close |
| 2026-05-02T09:00:00Z | CLOSE  | BTC/USD | long | 0.012 | 79220.3 | —       | —      | +1.64     | +9.84        | exit-trail |
```

- **One row per OPEN/CLOSE event.** Partial closes are also `CLOSE` rows with smaller `Size`.
- **`R at exit`** is the R-multiple of the exit (how many initial-stop-distances of profit/loss). Required on `CLOSE`, blank on `OPEN`.
- **`Realized PnL`** is in dollars (or whatever virtual-capital unit you declared). Required on `CLOSE`, blank on `OPEN`.
- **`Reason tag`** is freeform but should be terse and stable across trades.

### Portfolio snapshot

A short markdown summary the adapter uses for sanity checks (the trade log is the source of truth):

```markdown
# <Your Strategy> — Portfolio Snapshot

- Cash: **9876.54**
- Realized PnL (cumulative): **-123.46**
- Unrealized PnL: **0.00**
- Current equity: **9876.54**
- Equity peak: **10042.10**
- Drawdown from peak: **1.65%**

## Open positions (1)

| Symbol | Entry | Stop | Size | Entry time | Notes |
|--------|-------|------|------|------------|-------|
| ETH/USD | 2440.5 | 2410.0 | 0.082 | 2026-05-04T16:00:00Z | partial done |
```

## Step 3 — Adapter

For 90% of cases, use the **CODEX adapter** as-is. It already parses the schema above. Just point the registry entry at your files:

```js
{
  name: 'My Strategy v1',
  starting_capital: 10000,
  killswitch_dd_pct: 25,
  source: {
    type: 'codex-local',
    portfolio_path: 'data/<your-handle>/<your-strategy>_portfolio.md',
    trade_log_path: 'data/<your-handle>/<your-strategy>_trade_log.md',
  },
  adapter: adaptCodex,
}
```

**You only need a custom adapter** if your data lives somewhere unusual (a sheet tab with a non-standard schema, a non-markdown format, etc.). In that case copy `adapters/adapter_basket_breakout.js` as a starting point and follow the StrategyRow contract documented in `lib/strategy_row.js`.

## Step 4 — Registry entry

Append to the `STRATEGIES` array in `../registry.js`. Order is alphabetical-ish but not strict.

## Step 5 — Test

In `../adapters/adapters.test.js`, add a smoke test that loads your trade log fixture and asserts basic shape:

```js
test('my strategy adapter parses real fixture', () => {
  const portfolio = { ok: true, text: loadText('../data/<your-handle>/my-strategy_portfolio.md') };
  const tradeLog  = { ok: true, text: loadText('../data/<your-handle>/my-strategy_trade_log.md') };
  const row = adaptCodex({ portfolio, tradeLog }, { startingCapital: 10000, name: 'My Strategy v1' });
  assertStrategyRowShape(row, 'My Strategy v1');
  assert.equal(row.status, 'live');
});
```

## Step 6 — Verify locally

```bash
npm test       # all unit tests
npm run smoke  # live fetch + render check
```

`npm run smoke` should print your strategy as a row with shape `✅`. If it shows `❌` or throws, fix before submitting.

## Step 7 — PR

- Branch name: `add-<your-strategy>` or `update-<your-strategy>`
- PR title: matches branch
- PR body: link to your spec markdown, paste the smoke output for your row, list known limitations

The maintainer reviews for:
- Spec completeness
- Trade log not obviously fabricated (timestamps make sense, prices roughly match historical bars)
- Adapter doesn't break other strategies (CI catches this automatically)
- Honest disclosure of the strategy's failure modes

A clean PR usually merges within a day.

---

## Maintaining your strategy after merge

- **Update the trade log on whatever cadence makes sense.** Daily commit, hourly cron, manual after each trade — your call.
- **Don't change v1 parameters.** If you want to tune, write a v2 spec and submit it as a new strategy. v1 keeps running with v1 parameters.
- **Document failures honestly.** If a strategy goes amber/red on the leaderboard, write a brief post-mortem in the spec's `Known Issues` section. The point of the competition is learning, not winning.

## Questions

Open an issue tagged `question` or DM the repo owner. Strategy authors are expected to be available for clarifying questions on their PRs.
