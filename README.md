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
