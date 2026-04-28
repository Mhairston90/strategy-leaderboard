# Strategy Leaderboard — Design Spec

**Date:** 2026-04-28
**Project:** `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\`
**Status:** Brainstormed and approved, awaiting implementation plan
**Author:** brainstorm session, validated with user

## 1. Purpose

A single-page static HTML dashboard that ranks every active trading strategy in the user's stack on the same view, with all stats sortable by any column. Auto-refreshes every 5 minutes. Replaces ad-hoc multi-tab Sheets browsing with one canonical leaderboard.

## 2. Strategies in scope

| # | Strategy | Asset(s) | TF | Status | Capital | Data source |
|---|---|---|---|---|---|---|
| 1 | High Yield v4 Tuned | BTC + SOL | 4H | Live paper | $2k | Sheets `Signals` / versioned tab |
| 2 | High Yield v7-Best BTC Trend Gated | BTC | 4H | Research only | — | Sheets `V7-BTC Trend Gated Signals` |
| 3 | Basket Breakout v1 | 8-pair Kraken USD basket | 1H | Live paper | (basket-internal) | Sheets `Basket Breakout Signals` + `Basket Breakout Open Positions` |
| 4 | Aggro Leader Continuation v1 | DOGE | 1H | Canary live | (canary-internal) | Sheets `Aggro Leader Continuation Signals` |
| 5 | Analyst HY v1 | SOL | 4H | Live paper | $2k | Sheets `Analyst HY v1` |
| 6 | BULL v0 | Kraken top-15 | 15m–1H | Live paper | $10k | GitHub raw `trading-bull/memory/portfolio.md` + `trade_log.md` |

New strategies added later require a new adapter file and a registry entry — see §10.

## 3. Architecture overview

- **Surface:** standalone HTML dashboard (`index.html` + `app.js`) opened directly in browser as `file://` URL or via Chrome `--app` flag for chromeless feel.
- **Stack:** vanilla JS, no framework, no build step, no backend, no npm.
- **Refresh model:** in-browser `setInterval(5 min)` plus manual refresh button.
- **Hosting:** local file. New folder `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\` initialized as its own git repo.
- **Boundary:** read-only. Never writes outside `strategy-leaderboard/`. Never touches BULL repo files, Apps Script source, the Google Sheet itself, the Obsidian wiki, or any strategy's Pine scripts.

## 4. Data flow

### 4.1 Sources

| Source | Endpoint | Returns | Pre-computed metrics? |
|---|---|---|---|
| Apps Script `doGet` | `https://script.google.com/macros/s/AKfycby.../exec?tab=<tab>&limit=200` | JSON: `{status, tab, total_rows, headers, rows}` | No — raw signal events |
| GitHub raw (BULL) | `https://raw.githubusercontent.com/Mhairston90/trading-bull/main/memory/portfolio.md` | Markdown | Yes — equity, realized PnL, DD, kill-switches |
| GitHub raw (BULL) | `https://raw.githubusercontent.com/Mhairston90/trading-bull/main/memory/trade_log.md` | Markdown table | Yes — per-trade R, PnL |

### 4.2 CORS

Verified 2026-04-28 with `curl -L -i -H "Origin: ..." <endpoint>`:
- Apps Script `doGet` returns `Access-Control-Allow-Origin: *` on the final hop (`script.googleusercontent.com`) — **safe for browser `fetch()`**.
- GitHub raw is CORS-permissive.
- No backend proxy needed.

### 4.3 Adapter pattern

One `adapter_<strategy>.js` file per strategy. Each adapter:
- Input: raw rows or markdown blob from its source.
- Output: a normalized `StrategyRow`:
  ```js
  {
    name: "Basket Breakout v1",
    status: "live", // live | canary | research | paused
    returns: { '7d': 0.4, '30d': 3.8, '90d': 12.1, all: 18.7 }, // percentages
    sharpe: 1.18,
    pf: 1.31,
    max_dd: -10.4,
    win_pct: 38,
    trades_n: 62,
    avg_r: 0.21,
    last_signal_at: "2026-04-28T05:00Z",
    confidence: { sharpe: 'best-effort', pf: 'best-effort', max_dd: 'best-effort' },
    errors: [] // any per-strategy parse errors surfaced in the row
  }
  ```
- A central `STRATEGIES` registry maps strategy → adapter + source URL(s).

### 4.4 Metric formulas (all client-side)

- **% return (window):** sum of round-trip P&Ls within window ÷ starting capital.
- **Round-trip pairing:** entry rows paired with exit rows on the same symbol in chronological order. Partial fills (e.g., Basket's 50% at 2R) handled by tracking remaining position size per-symbol; a partial exit closes a fraction of the round-trip.
- **PF:** sum of positive round-trip P&Ls ÷ |sum of negative|.
- **Sharpe:** mean of daily-equity returns ÷ stdev × √365 (treating crypto as 24/7).
- **Max DD:** max peak-to-trough on running equity.
- **Win %:** count of round-trips with P&L > 0 ÷ total closed.
- **Avg R:** mean per-trade R-multiple, where R is computed from each trade's stop distance at entry. For strategies that don't log stop distance, Avg R falls back to `—`.

### 4.5 Capital normalization

Each strategy's PnL is divided by its own starting capital from the registry. The leaderboard ranks **% return**, not **$ return**, so $10k BULL and $2k Analyst HY compete on equal footing.

Strategies without an explicit declared starting capital (Basket Breakout v1, Aggro DOGE Cont — both use risk-per-trade sizing rather than fixed-equity sizing) declare a **virtual starting capital** in the registry equal to the assumed paper-account size for that strategy (Basket: $10k, Aggro: $5k — confirm with user during implementation). All round-trip P&Ls are computed in $ terms first (size × price-delta) and normalized against this virtual capital. Document the assumption next to the value in the registry so future-you knows what the % is anchored to.

## 5. Page layout & columns

### 5.1 Visual style

Dark Bloomberg-terminal aesthetic. SF Mono / Consolas / monospace. High-density rows. Sticky header on scroll. Approved via mockup.

### 5.2 Header bar

Title · source-health dots (one per source: Sheets, GitHub) · "updated Xs ago" · manual refresh button.

### 5.3 Columns (12, default sort: 90d % desc)

| # | Column | Type | Notes |
|---|---|---|---|
| 1 | Strategy | string | name + version |
| 2 | Status | enum | live / canary / research / paused |
| 3 | 90d % | number | default sort |
| 4 | 30d % | number | |
| 5 | 7d % | number | |
| 6 | Sharpe | number | best-effort badge in v1 |
| 7 | PF | number | best-effort badge in v1 |
| 8 | Max DD | number | best-effort badge in v1 |
| 9 | Trades | int | count of closed round-trips visible in source data (Sheets tab history depth or BULL trade_log) |
| 10 | Win % | number | of closed |
| 11 | Avg R | number | per-trade mean |
| 12 | Last sig | rel-time | most recent entry OR exit event in the tab/log; colored bright if <1h ago |

### 5.4 Row warning state

If a strategy's current Max DD ≥ 90% of its published kill-switch threshold, the row is tinted amber. Each strategy's threshold is declared in the registry (e.g., Aggro DOGE = 12%, BULL = 25%).

### 5.5 Sort UX

- Click any header → instant client-side re-rank, no fetch
- Click same header twice → flip asc / desc
- Sort is stable: ties preserve previous order
- No multi-column sort in v1

## 6. Refresh & error handling

### 6.1 Refresh loop

- Page-open: parallel fetch of all sources, render
- `setInterval(5 * 60 * 1000)`: re-fetch in place, no scroll-jump
- Manual button: same path, immediate
- Per-fetch timeout: 15 sec

### 6.2 Failure handling

| Failure | Behavior |
|---|---|
| Sheets returns 5xx or network error | Source dot red, last-good data stays on screen with stale-time badge per affected row |
| GitHub raw returns 4xx | BULL row shows `—` everywhere, source dot red, error in tooltip |
| One adapter throws | That strategy's row shows `error — see console` in suspect columns; other rows render normally |
| Sheets returns 200 but malformed JSON | Treat as fetch failure |
| First-load with no cached data | "Loading…" placeholder rows for ~2 sec |

### 6.3 Caching

- Last successful fetch persisted to `localStorage` so reopen instantly shows last-known state.
- Cache TTL: 24h — older than that → drop on read.

### 6.4 Health visibility

Two header dots:
- **Sheets** — green if last fetch succeeded, red if errored, amber if partial (some tabs ok, others failed)
- **GitHub** — green / red

Click dot → small panel listing failed source(s) and error message.

### 6.5 Explicitly NOT in v1

- No retry-with-backoff (the 5-min poll IS the retry)
- No Telegram alert on dashboard errors
- No service worker / offline mode

## 7. Testing strategy

### 7.1 Adapter unit tests (Node)

- Fixtures: `fixtures/<source>.json` captured once via `curl > fixtures/...` from real endpoints
- Each adapter has a `<adapter>.test.js` using `node --test`
- Tests verify: normalized `StrategyRow` shape, capital normalization, partial-fill pairing, error-row shape on malformed input
- Run: `node --test adapters/*.test.js`. Target: <30 sec total

### 7.2 Metrics formula tests

- Hand-computed reference cases for PF, Sharpe, Max DD, % return
- Example: trade series `[+1R, -1R, +2R, -1R]` → expected PF, Sharpe, Max DD documented in test
- Run as part of `node --test`

### 7.3 End-to-end smoke (manual, ~2 min)

- Open `index.html` in browser
- Verify: all 6 rows render, source dots green, every column header sortable, 5-min auto-refresh fires (visible in DevTools), wifi-off shows red dot + last-good data

### 7.4 Sanity-check vs ground truth

After v1 ships, eyeball best-effort metrics (Sharpe/PF/Max-DD) against the user's existing manual reads. >10% deviation on any metric → adapter pairing logic bug → fix adapter, ship v1.1.

## 8. Deployment

1. `git init` in `strategy-leaderboard/`
2. `.gitignore`: `.superpowers/`, `node_modules/`, `localStorage` debug dumps. **Fixtures are committed** — they're small (<50KB each) and tests must run on a fresh clone.
3. Push to `Mhairston90/strategy-leaderboard` (private OK)
4. Open `index.html` in browser, bookmark
5. (Optional) Desktop shortcut with Chrome `--app=file:///C:/Users/Mhair/OneDrive/Desktop/strategy-leaderboard/index.html` for chromeless app feel

## 9. Out of scope (v2 candidates)

- Equity sparkline per row
- Per-strategy drill-down page (click name → trade list)
- Multi-column sort (shift-click secondary)
- Filter bar (status, asset class)
- Custom date-range picker
- Telegram digest of leaderboard top-3 once/day
- Server-side metrics endpoint (Apps Script `?metrics=` query) if client-side computation gets too heavy
- BULL writing parallel to Sheets so all 6 strategies use one source

## 10. Adding a new strategy later

1. Create `adapters/adapter_<name>.js` exporting a single function `(rawData) => StrategyRow`
2. Add fixture `fixtures/<name>.json`
3. Add adapter test `adapters/adapter_<name>.test.js`
4. Append to `STRATEGIES` registry in `app.js`:
   ```js
   {
     name: 'New Strategy v1',
     status: 'canary',
     starting_capital: 5000,
     killswitch_dd_pct: 15,
     source: { type: 'sheets', tab: 'New Strategy v1' },
     adapter: adapterNewStrategy,
   }
   ```
5. New row appears on next refresh

## 11. Constraint preservation

This project lives entirely outside `trading-bull/`. The BULL session's mandate is honored:
- BULL never reads from this leaderboard
- BULL routines are unchanged
- This dashboard reads BULL's public GitHub repo as a remote source — same access any GitHub user has
- The UNLOCK granted in this session was for me to **read** the Obsidian wiki for understanding strategy architectures; it does not extend BULL's autonomous capabilities

## 12. Open questions (deferred to implementation)

- Final HY v4 Tuned Sheets tab name — `Signals` legacy vs versioned. Verify before coding adapter.
- Aggro DOGE Continuation: confirm the tab is `Aggro Leader Continuation Signals` (not `Aggro Leader Breakout Signals` which is a different lane).
- Whether to fetch all-time history or window-limit (`limit=200` may not cover 90d for high-frequency Basket Breakout). May need pagination or tab-export approach.
- Confidence thresholds for "best-effort" → "verified" badge promotion (e.g., 30+ trades + matched Sheet manual eyeball).
