# Strategy Leaderboard

Single-page static dashboard ranking 6 trading strategies on the same view. Read-only — pulls from Google Sheets `doGet()` API + GitHub raw. No backend.

## Strategies

| Strategy | Asset | TF | Status | Source |
|---|---|---|---|---|
| HY v4 Tuned | BTC + SOL | 4H | live | Sheets `Signals` tab (notes="v4") |
| HY v7-Best BTC TG | BTC | 4H | research | Sheets `V7-BTC Trend Gated Signals` |
| Basket Breakout v1 | 8-pair basket | 1H | live | Sheets `Basket Breakout Signals` |
| Aggro Leader Cont v1 | DOGE | 1H | canary | Sheets `Aggro Leader Continuation Signals` |
| Analyst HY v1 | SOL | 4H | live | Sheets `Analyst HY v1` |
| BULL v0 | Kraken top-15 | 15m–1H | live | GitHub raw (`Mhairston90/trading-bull`) |

## Run

Open `index.html` in any modern browser (Chrome, Edge, Firefox). Auto-refreshes every 5 min. Click any column header to re-sort.

For chromeless app feel:
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --app=file:///C:/Users/Mhair/OneDrive/Desktop/strategy-leaderboard/index.html
```

## Test

```bash
npm test       # 48 unit tests (metrics, pairing, parsers, all 6 adapters)
npm run smoke  # end-to-end smoke against live endpoints
```

Requires Node 20+ (built-in `node:test`, native `fetch`).

## Add a new strategy

1. Capture fixture: `curl ... > fixtures/<name>.json`
2. Create `adapters/adapter_<name>.js` — default-export `(rawOrResp, opts) => StrategyRow`
3. Add a test entry in `adapters/adapters.test.js`
4. Append to `STRATEGIES` array in `registry.js`

A new row appears on next refresh.

## Refresh fixtures

If a strategy's tab schema changes, re-run the curl commands documented in `fixtures/README.md`.

## Architecture

- `index.html` + `app.js` — entry point, 5-min refresh loop, localStorage cache
- `registry.js` — STRATEGIES array (source + adapter + virtual capital + kill-switch)
- `lib/` — pure logic: `metrics`, `pairing`, `parse_bull_md`, `fetch`, `render`, `strategy_row`
- `adapters/` — one per strategy, normalize raw source → `StrategyRow`
- `fixtures/` — captured snapshots used by tests (committed)
- `scripts/smoke.js` — end-to-end live check
- `docs/superpowers/specs/2026-04-28-strategy-leaderboard-design.md` — design rationale
- `docs/superpowers/plans/2026-04-28-strategy-leaderboard.md` — implementation plan

## Caveats

Sharpe / PF / Max DD are computed client-side from raw signal logs and marked "best-effort" in tooltips. Sanity-check vs source data after a v1.x deployment; if any strategy's row is off by >10% on a metric, the adapter's parsing has a bug.
