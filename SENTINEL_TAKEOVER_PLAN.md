# Sentinel Takeover — Full Implementation Plan (Handoff to Codex)

> **Status:** APPROVED DESIGN, ready to build. **Author:** Claude (paired with Mhair), 2026-06-30.
> **Audience:** Codex, executing with no prior conversation context — this document is self-contained.
> **Repo:** `C:\trading\strategy-leaderboard` (leaderboard) + broker adapters. Node ESM + PowerShell tick loop.
> **Golden rule:** TESTNET/PAPER ONLY until a human explicitly flips live. No real-money routing in any phase here.

---

## 1. Why we're rebuilding the sentinel

The existing Trade Sentinel (`lib/sentinel/*`, `scripts/sentinel_tick*.{js,ps1}`) is a paper-execution bridge that mirrors leaderboard signals to Alpaca paper. **It has processed 38 signals since 2026-06-29 and blocked 100% of them — zero submitted.** Two root causes, both fatal:

### 1a. The signal-timing model is architecturally broken (the blocker)
- `lib/sentinel/ticket_generator.js:~99` sets each ticket's `created_at = normalizeTimestamp(row.time)` — i.e., **the leaderboard trade's bar-close timestamp**, not when the ticket was generated.
- `lib/sentinel/risk_governor.js:~192-210` (`staleTicketReason`) computes staleness as `now − created_at` and blocks anything older than `stale_leaderboard_minutes` (config: **15**).
- Leaderboard trades fire on 1h/4h bars and are regenerated on a periodic schedule, so signals arrive **38–149 minutes old**. A 15-minute freshness guard can *never* pass them.
- **Deeper truth:** the leaderboard is a *periodic paper-simulation*, not a real-time feed. Trying to real-time-execute a non-real-time source with a freshness guard is a category error. You cannot tune your way out of it.

### 1b. Alpaca cannot short crypto (the feasibility wall)
- The top allocated strategy (`CODEX Regime Plus L/S v1`, 22% weight) currently holds **crypto shorts** (DOT, DOGE, LINK per its `data/codex/regime_plus_ls_portfolio.md` open-positions table). `CODEX Aggro Short Plus Quality v2` is short too.
- **Alpaca crypto is spot/long-only — it does not support shorting crypto.** So even with fresh signals, Alpaca physically cannot execute a large chunk of the target book.

**Conclusion:** don't patch the current sentinel. Replace the *signal/timing model* with **position-sync**, and add a **crypto-perps venue that can short**, keeping Codex's solid broker/risk/ledger/reconcile/dashboard modules.

---

## 2. Approved design decisions (do not re-litigate)

| Decision | Choice | Rationale |
|---|---|---|
| **Execution model** | **Position-sync** (not event-replay) | Sync target *state* each tick; staleness becomes irrelevant. |
| **Rebalance policy** | **Drift-band** | Trade a symbol only when its weight drifts past a band (or min $). Low churn, realistic fills. |
| **Venues** | **Two-venue split**: Alpaca (equities) + **Kraken Derivatives US perps** (crypto incl. shorts) | No single US-legal venue does both. See §3. |
| **Environment** | **Testnet/paper first**: Alpaca paper + Kraken `demo-futures.kraken.com` | Validate everything before any live discussion. |
| **DOT handling** | **Skip DOT positions**, record the intentional gap in the ledger | No US-legal perp venue lists DOT (Kraken & Kalshi both omit it). It's 1 of ~8 alts. |
| **Codebase** | **Keep** Codex's modules; **replace** only the signal layer; **add** a Kraken adapter | Broker/risk/ledger/reconcile/dashboard are reusable. |

---

## 3. Venue research (verified 2026-06-30; US-based retail algo trader)

**Winner: Kraken Derivatives US (CFTC-regulated perpetual futures).** Launched ~2026-06-15 via NinjaTrader Clearing LLC (d/b/a Kraken Derivatives US, a CFTC-registered FCM, NFA ID 0309379), contracts on the Bitnomial DCM. Legally accessible to ordinary US retail on the **regulated perps product**.
- **Covers 7 of 8 target alts:** SOL, XRP, ADA, LINK, DOGE, LTC, AVAX (+ BTC, ETH). **DOT NOT covered.**
- **Real testnet:** `https://demo-futures.kraken.com/` — Kraken states the WebSocket/REST endpoints, feeds, and response structures are **identical to production; only the base URL differs.** No KYC to sign up for the demo.
- Trader already has a Kraken integration (`kraken_mcp.py` in the trading toolchain).
- Source: `https://blog.kraken.com/product/kraken-derivatives/announcing-cftc-regulated-us-perps`, `https://support.kraken.com/articles/360024809011-api-testing-environment-derivatives`, `https://docs.kraken.com/api/docs/guides/futures-introduction/`.

**Ruled out for US persons:**
- **Hyperliquid, dYdX, GMX** — geo-block US persons in their own ToS (US IPs blocked). Best tech (esp. Hyperliquid SDK) but not compliant.
- **Bybit / OKX / Binance Futures** — not accessible to US retail.
- **Deribit** (trader's other integration) — blocks US residents; alt coverage unconfirmed. Out.
- **Kraken SPOT margin** — gated behind Eligible Contract Participant standard (**>$10M** discretionary assets). Not retail-accessible. **Use the regulated perps, NOT spot margin.**

**MUST-VERIFY before sizing (research could not confirm — treat as Phase-1 tasks):**
1. Exact **eligibility criteria** for "eligible clients" on Kraken Derivatives US regulated perps — confirm there is no hidden net-worth gate for ordinary retail.
2. **Fees + funding-cost mechanics** for shorts on the US perps product (research only verified Hyperliquid's funding, which is NOT US-legal — do NOT extrapolate).
3. Exact **contract symbols** for each alt on the US perps product / demo-futures (e.g., naming like `PF_XXXUSD` vs the US-regulated contract tickers). Needed for order routing.

---

## 4. Target architecture

```
                     ┌──────── target_portfolio.js ────────┐
 data/sentinel/      │  For each allocated strategy:        │
   allocation.json ─▶│   parse its portfolio.md OPEN        │──▶ net signed target
 leaderboard         │   positions, scale by weight×capital │     $ exposure per symbol
   */*_portfolio.md ▶│   aggregate/net per symbol           │            │
                     └──────────────────────────────────────┘            ▼
                                                              rebalancer.js (drift-band)
                                                                 │                 │
                                              venue_router.js ───┤                 │
                                              equities ──────────┘                 └── crypto
                                                  ▼                                      ▼
                                          alpaca_paper.js                        kraken_perps.js
                                          (Alpaca paper:                         (Kraken Derivatives US
                                           stock long/short)                     perps testnet: long + SHORT)
                                                  │                                      │
                                                  └──────────▶ ledger.js ◀───────────────┘
                                                     reconcile.js  →  render.js (dashboard)
```

### Keep (reuse as-is or light touch)
`lib/sentinel/`: `config.js`, `jsonl.js`, `ledger.js`, `reconcile.js`, `render.js`, `ticket_schema.js`, `tick_lock.js`, `allocator.js` (weight math), `promotion_engine.js`, `alpaca_paper.js`.
- `risk_governor.js`: **remove/neutralize** `staleTicketReason` (staleness is meaningless in sync mode). **Keep** exposure caps (`max_gross_exposure_pct`, `max_symbol_exposure_pct`, `max_daily_loss_pct`, `max_open_orders`, `max_orders_per_symbol_per_hour`) and the `live_trading_enabled=false` guard.

### Replace / retire
- `ticket_generator.js` — event-based, stale-by-design. Retire in favor of `target_portfolio.js` + `rebalancer.js`. (Keep the file until Phase 2 cutover; delete when the new path is proven.)

### Build new (`lib/sentinel/`)
1. **`kraken_perps.js`** — Kraken Derivatives US perps adapter (testnet). Mirrors `alpaca_paper.js`'s shape: `getPositions()`, `submitOrder(order)`, `cancelOrder(id)`, `getAccount()`. Auth via API key/secret from env; base URL from config (`demo-futures.kraken.com` in testnet). Supports **short** orders. Symbol mapping crypto pair → Kraken perp contract.
2. **`target_portfolio.js`** — reads `allocation.json`; for each allocated strategy, locates its `*_portfolio.md`, parses the **Open positions** table, computes each position's signed $ exposure, scales the strategy's book to `weight × total_capital`, then **nets across strategies per symbol** → `{ symbol, asset_class, target_notional_usd (signed) }[]`. Skips symbols in `skip_symbols` (DOT) and emits a `skipped[]` list for the ledger.
3. **`rebalancer.js`** — inputs: target list + current positions (from both venues). For each symbol, `drift = target − current`. Emit a rebalance order (buy/sell delta) only when `abs(drift) > max(drift_band_pct × abs(target), min_order_usd)`. Output: venue-tagged orders that pass through `risk_governor` before submission.
4. **`venue_router.js`** — routes by `asset_class`: `crypto → kraken_perps`, `us_equity → alpaca_paper`. Enforces `skip_symbols`. Records the DOT (and any skipped) gap as a ledger `divergence` entry so the missing exposure is visible, not silent.

---

## 5. Data contracts

### 5a. `allocation.json` (already exists — `data/sentinel/allocation.json`)
6 strategies with `target_weight` (sum = 1.0):
| Strategy | Weight | Asset class |
|---|---|---|
| CODEX Regime Plus L/S v1 | 0.22 | crypto (long+short) |
| Basket Breakout Aggressive v1 | 0.20 | crypto |
| CODEX Aggro v0 | 0.18 | crypto |
| CODEX Aggro Short Plus Quality v2 | 0.15 | crypto (short) |
| Stocks Mean Reversion v2 (RSI<15) | 0.15 | us_equity |
| FABLE Equities Fader v1 | 0.10 | us_equity |

Map each strategy name → its `*_portfolio.md` path (crypto strategies live under `data/codex/`, `data/basket_variants/`; stock strategies under `data/stock_variants/`). Build a name→path registry (mirror `registry.js` / the existing sentinel strategy list in `claude_hermes_supervisor.js`).

### 5b. Portfolio open-positions tables (source of the target)
Schemas differ by family — parse both:
- **Crypto (codex):** `| Pair | Sleeve | Side | Size | Entry | Stop | MTM price | Unrealized PnL | Exposure |` → signed exposure = `(side==short? -1:+1) × Exposure$`. Note a symbol can appear on multiple rows (sleeves) → sum them.
- **Stocks:** `| Symbol | Entry | Stop | Size | Mark | PnL | Entry time | Bars held |` → signed exposure = `(side==short? -1:+1) × Size × Mark`. (Stocks MR is long-only, but keep sign handling general.)
- Header line above the table is `## Open positions (N)` or `## Open positions`; `_No open positions._` when flat.

### 5c. Config additions (`data/sentinel/config.json` + `lib/sentinel/config.js` defaults)
```jsonc
{
  "mode": "paper",                     // existing
  "environment": "testnet",            // NEW: testnet | live  (hard guard; testnet only for now)
  "live_trading_enabled": false,       // existing — keep false
  "total_capital_usd": 10000,          // NEW: notional size of the synced account (confirm with Mhair)
  "drift_band_pct": 0.20,              // NEW: rebalance when |drift| > 20% of target
  "min_order_usd": 25,                 // NEW: and only if the delta is at least $25
  "skip_symbols": ["DOT"],             // NEW: no US-legal perp venue for DOT
  "venues": {                          // NEW
    "us_equity": { "adapter": "alpaca_paper", "env": "paper" },
    "crypto":    { "adapter": "kraken_perps", "env": "testnet",
                   "base_url": "https://demo-futures.kraken.com" }
  },
  "max_gross_exposure_pct": 100,       // existing risk caps — keep
  "max_strategy_weight_pct": 25,
  "max_symbol_exposure_pct": 20,
  "max_daily_loss_pct": 2,
  "max_open_orders": 10,
  "max_orders_per_symbol_per_hour": 2,
  "reconciliation_freeze_enabled": true
  // REMOVE: stale_leaderboard_minutes (obsolete under position-sync)
}
```

### 5d. Ledger entries (`data/sentinel/execution_ledger.jsonl`)
Keep the existing schema; add a `divergence` event type for skipped symbols: `{ ts, type:"divergence", symbol, target_notional_usd, reason:"skipped:no_us_perp_venue" }`.

---

## 6. Phased implementation plan

Each phase is independently testable and gets its own commit series. **Do not start Phase 2 until Phase 1's testnet integration is proven.**

### Phase 1 — Kraken perps testnet adapter (de-risk the unknown)
**Goal:** prove we can auth, read positions, and place/cancel **long AND short** orders on `demo-futures.kraken.com`.
- [ ] **1.1** Confirm the MUST-VERIFY items in §3 (eligibility, fees/funding, contract symbols). Document findings in `docs/kraken-perps-notes.md`.
- [ ] **1.2** Create a Kraken **demo-futures** account; store API key/secret in env vars (`KRAKEN_FUTURES_KEY`, `KRAKEN_FUTURES_SECRET`); never commit secrets. Add `assertTestnetEnv()` guard like `alpaca_paper.assertPaperEnv`.
- [ ] **1.3** `lib/sentinel/kraken_perps.js`: implement auth signing (Kraken Futures uses a specific `Authent` HMAC scheme — see `docs.kraken.com/api/docs/guides/futures-introduction`), `getAccount()`, `getPositions()`, `submitOrder({symbol, side, size|notional, type})`, `cancelOrder(id)`. Symbol map for SOL/XRP/ADA/LINK/DOGE/LTC/AVAX (+BTC/ETH).
- [ ] **1.4** Unit tests (`kraken_perps.test.js`) with mocked HTTP: signing correctness, request shaping, response parsing, error/redaction (mirror `alpaca_paper.test.js`).
- [ ] **1.5** Live-testnet smoke script (`scripts/kraken_perps_smoke.js`): open a tiny SHORT on a testnet alt, read it back in `getPositions()`, then close it. Verify shorts actually work. **Acceptance: a short opens and closes on demo-futures.**
- [ ] **1.6** Commit. Do not proceed until 1.5 passes.

### Phase 2 — Position-sync engine (the brain)
**Goal:** compute the target portfolio and drift-band-rebalance both venues in the tick.
- [ ] **2.1** `target_portfolio.js` + tests: parse both portfolio-table schemas (§5b), name→path registry, weight×capital scaling, per-symbol netting, `skip_symbols`, `skipped[]` output. Test with fixtures from real `*_portfolio.md` files.
- [ ] **2.2** `venue_router.js` + tests: route by asset_class, enforce skips, emit divergence ledger entries.
- [ ] **2.3** `rebalancer.js` + tests: drift-band math, min-order threshold, buy/sell delta generation, no-op when within band. Edge cases: target flips sign (close+reopen), symbol newly zero (full close), currently-held-but-no-longer-target (close).
- [ ] **2.4** Neutralize `risk_governor` staleness; keep exposure caps; run rebalance orders through it before submit.
- [ ] **2.5** Rewrite `scripts/sentinel_tick.js` to the new flow: read target → read both venues' positions → rebalance → risk-gate → route/submit → ledger → reconcile → write `sentinel_status.md` + `heartbeat.json`. Keep `tick_lock`.
- [ ] **2.6** End-to-end dry-run mode (`--dry-run`): compute and log intended orders without submitting. Verify against a hand-computed target for one tick.
- [ ] **2.7** Live-testnet integration run: one real tick against Alpaca paper + Kraken demo. **Acceptance: the paper accounts move toward the target portfolio; blocked-rate is ~0; shorts execute on Kraken.**
- [ ] **2.8** Commit.

### Phase 3 — Hardening, reconciliation, dashboard, digest
- [ ] **3.1** Unified reconciliation across both venues (`reconcile.js`): internal ledger vs Alpaca + Kraken positions; freeze on mismatch (`reconciliation_freeze_enabled`).
- [ ] **3.2** Kill switch: a `data/sentinel/kill.flag` (or config `frozen:true`) that halts all submission next tick.
- [ ] **3.3** Dashboard (`render.js` + `sentinel.html`/`sentinel_app.js`): show target vs actual per symbol per venue, drift, skipped (DOT) gap, per-venue reconciliation status, blocked-rate (should be ~0 now).
- [ ] **3.4** DOT-gap reporting surfaced in `sentinel_status.md` and the daily routine digest (`C:\trading\Claude\Trading Strategy\routine_digest.ps1`).
- [ ] **3.5** Update `scripts/sentinel_tick_loop.ps1` interval if needed; confirm the existing "Trade Sentinel Watchdog" scheduled task (self-heal, every 15 min) still keeps the loop alive.
- [ ] **3.6** Commit + write a short `docs/sentinel-runbook.md` (how to start/stop, flip venues, read the dashboard, go-live checklist — which stays gated).

---

## 7. Safety requirements (non-negotiable)
- **Environment guard:** every adapter must refuse to run against a live/production base URL unless `environment==="live"` AND a separate explicit human confirmation. Default and all phases here = **testnet/paper**.
- **`live_trading_enabled: false`** stays false; the risk governor already blocks live routing when false — keep that.
- **Secrets** in env vars only; never commit; reuse `alpaca_paper.js` redaction patterns for Kraken.
- **Reconciliation freeze** on any broker-vs-internal mismatch.
- **Exposure caps** enforced on every order (gross, per-symbol, daily loss, order-rate).
- **Idempotency:** client order IDs derived from `{symbol, tick, target}` so a retried tick can't double-submit (mirror `clientOrderIdForTicket`).

---

## 8. Success criteria
1. Phase 1: a SHORT opens and closes on Kraken demo-futures via `kraken_perps.js`.
2. Phase 2: after one tick, Alpaca-paper + Kraken-testnet positions match the computed target within the drift band; **blocked-rate ≈ 0** (vs today's 100%); crypto shorts are live on testnet.
3. Phase 3: dashboard shows target-vs-actual per venue, DOT gap is explicit, reconciliation is green, kill switch works.
4. The whole thing runs unattended via the tick loop + watchdog, testnet-only, with no real-money path enabled.

## 9. Open questions to resolve during Phase 1 (owner: whoever builds)
- Kraken Derivatives US eligibility gate for ordinary retail? (confirm no net-worth requirement on the *perps* product)
- Kraken US perp fees + funding for shorts? (do not assume Hyperliquid's short-friendly funding)
- Exact Kraken US perp contract symbols per alt?
- `total_capital_usd` for the synced account — confirm with Mhair (default 10000).
- DOT: confirmed skipped for now; revisit if Kraken adds it.

## 10. Key files (map)
- Keep/modify: `lib/sentinel/{risk_governor,reconcile,ledger,render,config,allocator,ticket_schema,tick_lock,alpaca_paper}.js`, `scripts/sentinel_tick.js`, `scripts/sentinel_tick_loop.ps1`, `data/sentinel/{config,allocation}.json`.
- New: `lib/sentinel/{kraken_perps,target_portfolio,rebalancer,venue_router}.js` (+ `.test.js` each), `scripts/kraken_perps_smoke.js`, `docs/kraken-perps-notes.md`, `docs/sentinel-runbook.md`.
- Retire after cutover: `lib/sentinel/ticket_generator.js`.

---
*This plan supersedes the current event-replay sentinel. Build phases in order; keep everything testnet/paper; do not enable any live-money path without explicit human sign-off.*
