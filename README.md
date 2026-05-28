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

### Basket Breakout family — Crypto (1H, 8-pair Kraken USD basket)

| Strategy | Variant axis | Status | Source |
|---|---|---|---|
| Basket Breakout v1 | parent — 0.5% risk, gate on, partial+trail | live | Sheets `Basket Breakout Signals` |
| Basket Breakout Leveraged v1 | 5x perp on Binance, same logic | paper (offline-simulated nightly) | `data/basket_variants/` |
| Basket Breakout Aggressive v1 | wider net — gate dropped, 1.5% risk, heat 8 | paper (offline-simulated nightly) | `data/basket_variants/` |
| Basket Breakout Aggressive v2 | runner — 2% risk, no partial, wider trail | paper (offline-simulated nightly) | `data/basket_variants/` |

### Basket Breakout family — Stocks (1H RTH, 8-symbol US equity basket)

Spec freeze 2026-05-06; live execution earliest 2026-06-08 (post-PDT-rule effective date). All three back-simulated from 2026-04-16 for leaderboard parity with the crypto family.

| Strategy | Variant axis | Status | Source |
|---|---|---|---|
| Stocks Basket Breakout v1 | parent port — daily EMA50/200 regime gate, 0.5% risk | paper (offline-simulated nightly) | `data/stock_variants/` |
| Stocks Basket Breakout Aggressive v1 | wider net — gate dropped, 1.5% risk, heat 8 | paper (offline-simulated nightly) | `data/stock_variants/` |
| Stocks Basket Breakout Diversified v1 | same params as v1, 8 GICS sectors (NVDA/OXY/JPM/LLY/CAT/FCX/NKE/DIS) | paper (offline-simulated nightly) | `data/stock_variants/` |

Universe (tech): NVDA, TSLA, AMD, PLTR, META, NFLX, AVGO, AAPL. Universe (diversified): NVDA, OXY, JPM, LLY, CAT, FCX, NKE, DIS. Variant specs in `strategies/stocks-basket-breakout-*-spec.md` (including `v3-spec.md` PARKED 2026-05-16). Nightly regenerator at `Claude/Trading Strategy/basket_breakout_stocks/generate_logs.py` (yfinance data source, gap-aware stop-fill simulator).

### Mean Reversion family — Stocks (1H RTH, anti-breakout test)

Connors-style RSI(2)<10 oversold-bounce, daily EMA50>EMA200 regime gate + close>EMA50 dip filter. Explicit test of whether the OPPOSITE signal type (mean reversion vs breakout) has edge on the same paper-trade infrastructure. Both variants currently OOS PF > 2, classified `stable_profitable` by the Hermes supervisor.

| Strategy | Variant axis | Status | Source |
|---|---|---|---|
| Stocks Mean Reversion v1 | RSI(2) oversold-bounce on tech basket | paper (offline-simulated nightly) | `data/stock_variants/` |
| Stocks Mean Reversion v2 | RSI(2) oversold-bounce on 8 GICS sectors | paper (offline-simulated nightly) | `data/stock_variants/` |

Specs: `strategies/stocks-mean-reversion-{v1,v2}-spec.md`. Nightly regenerator at `Claude/Trading Strategy/stocks_mean_reversion/generate_log.py` — multi-variant via `--variant {v1, v2, ...}`, shares yfinance data with basket_breakout_stocks.

**Opus 4.8 expansion (2026-05-28):** five diversified-8 grid-fill variants — `v2_fast` (Connors RSI>50 fast exit), `v2_heat8` (heat cap 8), `v2_bal` (the missing 1.5% mid-risk tier), `v2_rsi5_agg` (RSI<5 × 3% sizing), and `deep_div` (RSI<3 / 4% on diversified-8, A/B vs wide-15 `deep`). Pure config variants of the frozen signal engine. Spec: `strategies/stocks-mean-reversion-2026-05-28-opus48-expansion-design.md`.

### Mean Reversion family — Crypto (Kraken USD spot, 4H regime gate)

The same Connors recipe ported to crypto. **Transparent commission-challenged experiment** — the full backfill lost to Kraken's 0.52% round-trip taker fee (vs 0.10% for equities); wired in honestly as a forward test in a new asset class. Spec: `strategies/crypto-mean-reversion-v1-spec.md`. Generator: `Claude/Trading Strategy/crypto_mean_reversion/generate_log.py`.

| Strategy | Variant axis | Status | Source |
|---|---|---|---|
| Crypto Mean Reversion v1 | RSI(2)<10 oversold-bounce, 8 Kraken USD pairs | paper (offline-simulated nightly) | `data/crypto_variants/` |
| Crypto Mean Reversion Aggressive | RSI(2)<3 extreme-dip, 3% sizing (commission-drag fix hypothesis) | paper (offline-simulated nightly) | `data/crypto_variants/` |

### Trend Momentum sleeve — Stocks (1H, wide-15, the MR regime-diversifier)

The deliberate counterweight to the mean-reversion family: a **trend-follower** that earns when MR struggles (strong trends) and is gated out of chop by a daily ADX filter. Confirmed-trend continuation entry; rides with no partial + a wide ATR trailing stop activated at +1R (magnitude-heavy, built for the "total profit of top 3" scoring). Reuses the breakout family's trailing-stop engine. Spec: `strategies/stocks-trend-momentum-2026-05-28-spec.md`. Generator: `Claude/Trading Strategy/stocks_momentum/generate_log.py`.

| Strategy | Variant axis | Status | Source |
|---|---|---|---|
| Stocks Trend Momentum v1 | 1% risk, 3×ATR trail | paper (offline-simulated nightly) | `data/stock_variants/` |
| Stocks Trend Momentum Aggressive | 2.5% risk, 3.5×ATR trail (magnitude) | paper (offline-simulated nightly) | `data/stock_variants/` |

Variant specs (crypto family) live in `Claude/Trading Strategy/basket-breakout-*-spec.md` in the parent project; nightly regenerator at `Claude/Trading Strategy/basket_breakout/generate_variant_logs.py`.

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
