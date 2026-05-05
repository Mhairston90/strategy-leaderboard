# Strategy Leaderboard

> **Open competition.** Several agents and humans paper-trade in parallel; this dashboard ranks them all on the same view, refreshed every 5 minutes.

Single-page static dashboard. Read-only — pulls from Google Sheets `doGet()` API, GitHub raw, and local markdown trade logs. No backend.

## Live competition

This repository hosts a multi-strategy paper-trading competition. Anyone can add a strategy via PR (see [Contributing a strategy](#contributing-a-strategy) below). All strategies run on the same window, are normalized to a virtual $10k starting capital where applicable, and surface the same metrics: 7d / 30d / 90d return, Sharpe (best-effort), PF, max drawdown, trade count, win %, and average R-multiple.

See **[COMPETITION.md](COMPETITION.md)** for rules, scoring, and the entry checklist.

> **New contributor?** Hand your AI [WELCOME.pdf](WELCOME.pdf) — an 8-page brief covering the competition, repo map, trade-log schema, registry template, and copy-paste examples. Reading it end-to-end takes ~5 minutes.

## Strategies tracked

### Live agents (autonomous)

| Strategy | Asset | TF | Status | Source |
|---|---|---|---|---|
| BULL v0 | Kraken top-15 | 15m–1H | live | GitHub raw (`Mhairston90/trading-bull`) |
| CODEX v0 / Aggro / Pulse / Regime / Apex / WFOs | varies | varies | live | local markdown (`data/codex/`) |

### Manual / signal-based

| Strategy | Asset | TF | Status | Source |
|---|---|---|---|---|
| HY v4 Tuned | BTC + SOL | 4H | live | Sheets `Signals` tab (notes="v4") |
| HY v7-Best BTC TG | BTC | 4H | research | Sheets `V7-BTC Trend Gated Signals` |
| Aggro Leader Cont v1 | DOGE | 1H | canary | Sheets `Aggro Leader Continuation Signals` |
| Analyst HY v1 | SOL | 4H | live | Sheets `Analyst HY v1` |

### Basket Breakout family (1H, 8-symbol crypto basket)

| Strategy | Variant axis | Status | Source |
|---|---|---|---|
| Basket Breakout v1 | parent — 0.5% risk, gate on, partial+trail | live | Sheets `Basket Breakout Signals` |
| Basket Breakout Leveraged v1 | 5x perp on Binance, same logic | paper (offline-simulated nightly) | local markdown (`data/basket_variants/`) |
| Basket Breakout Aggressive v1 | wider net — gate dropped, 1.5% risk, heat 8 | paper (offline-simulated nightly) | local markdown (`data/basket_variants/`) |
| Basket Breakout Aggressive v2 | runner — 2% risk, no partial, wider trail | paper (offline-simulated nightly) | local markdown (`data/basket_variants/`) |

Variant specs live in the `Claude/Trading Strategy/basket-breakout-*-spec.md` files in the parent project; nightly regenerator at `Claude/Trading Strategy/basket_breakout/generate_variant_logs.py` writes the trade logs this leaderboard reads.

## Run locally

**Easy mode (Windows):** double-click `Strategy Leaderboard` on your Desktop, or `Open Leaderboard.bat` in this folder. It starts a tiny Python HTTP server on `http://localhost:8123` and opens Chrome chromeless.

(The browser blocks `fetch()` from `file://` URLs for security, so the dashboard won't load if you double-click `index.html` directly. The launcher serves it over `http://localhost`, which the browser treats as a real origin.)

**Manual:**
```bash
cd path/to/strategy-leaderboard
python -m http.server 8123
# then open http://localhost:8123/ in your browser
```

Auto-refreshes every 5 min once loaded. Click any column header to re-sort.

## Test

```bash
npm test       # all adapter unit tests (metrics, pairing, parsers)
npm run smoke  # end-to-end smoke against live endpoints
```

Requires Node 20+ (built-in `node:test`, native `fetch`).

## Contributing a strategy

**TL;DR:** add a markdown trade-log file under `data/<your-handle>/`, write a 30-line adapter, register it. Open a PR.

See **[strategies/CONTRIBUTING.md](strategies/CONTRIBUTING.md)** for the full step-by-step guide with copy-pasteable templates.

The shortest path:
1. Fork & clone this repo.
2. Pick a `source.type`:
   - `sheets` — you log signals to a Google Sheet tab (need API access)
   - `bull-github` — you push trade-log markdown to a GitHub repo
   - `codex-local` — you commit trade-log markdown directly to this repo (recommended for new contributors)
3. Add `strategies/<your-strategy>-spec.md` describing your edge, parameters, exits, and risk controls.
4. Add `data/<your-handle>/<your-strategy>_trade_log.md` and `_portfolio.md` (templates in `strategies/templates/`).
5. Add an adapter in `adapters/` (or reuse `adapter_codex.js` — it parses BULL-style trade-log markdown).
6. Append your entry to `registry.js`.
7. Add a unit test in `adapters/adapters.test.js`.
8. Run `npm test && npm run smoke` to verify.
9. Open a PR.

CI will reject any PR that breaks the existing test suite.

## Refresh fixtures

If a strategy's tab schema changes, re-run the curl commands documented in `fixtures/README.md`.

## Architecture

- `index.html` + `app.js` — entry point, 5-min refresh loop, localStorage cache
- `registry.js` — STRATEGIES array (source + adapter + virtual capital + kill-switch)
- `lib/` — pure logic: `metrics`, `pairing`, `parse_bull_md`, `fetch`, `render`, `strategy_row`, `source_health`
- `adapters/` — one per strategy, normalize raw source → `StrategyRow`
- `fixtures/` — captured snapshots used by tests (committed)
- `data/` — local markdown trade logs (committed; refreshed by per-strategy nightly routines)
- `strategies/` — specs + contribution guide (humans write here, code reads `data/`)
- `scripts/smoke.js` — end-to-end live check
- `docs/` — design + plan markdowns

## Caveats

Sharpe / PF / max DD are computed client-side from raw signal logs and marked "best-effort" in tooltips. Sanity-check vs source data after any adapter change; if any strategy's row is off by >10% on a metric, the adapter's parsing has a bug.

Some strategies (the Basket Breakout variants) are *offline-simulated paper trades*, not live-executed. They use deterministic backtests against CryptoCompare OHLC data, regenerated nightly. The leaderboard does not distinguish these from live-traded strategies — read each strategy's spec to know which it is.
