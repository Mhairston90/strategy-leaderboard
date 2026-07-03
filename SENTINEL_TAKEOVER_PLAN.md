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

> **⚠️ SUPERSEDED IN PART — read the Addendum (§11, dated 2026-07-01) before acting on this section.** Follow-up verification found the Kraken Derivatives US product has **no retail API** and does not run on the `futures.kraken.com` platform that `demo-futures` mirrors. The crypto venue decision changed to **CME micro futures via NinjaTrader sim**. §3's facts are kept for history only.

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

### 3b. ⚠️ Kraken demo-futures is currently unreliable — build broker-agnostic
As of 2026-06-30, `demo-futures.kraken.com/derivatives/api/v3/instruments` returns **HTTP 503** (sandbox down), while production `futures.kraken.com` returns 200. **Do NOT block the build on Kraken's testnet.**

**Mandatory approach: a broker-abstraction interface + a mock adapter.** All broker adapters (`alpaca_paper`, `kraken_perps`, and a new `mock_broker`) implement the SAME interface: `getAccount()`, `getPositions()`, `submitOrder()`, `cancelOrder()`. The entire position-sync system is built and validated against `mock_broker.js` (simulates fills at live mark prices, tracks positions, **supports shorts**). The real Kraken/Coinbase adapter is a drop-in swap behind that interface — **zero logic changes**. This makes the flaky demo a non-issue and gives a fully working paper system immediately.

**Real crypto-short venue options (for the eventual live/real-testnet integration; verify when reached, not a blocker):**
- **Kraken demo-futures** — retry (503 likely transient); or Kraken production API micro-size for a gated final check.
- **Coinbase US perps** — the other US-legal venue (Coinbase launched US perps); verify alt coverage + sandbox availability.
- **Kalshi** — US-regulated perps but BTC/ETH/SOL/XRP only; **misses the target alts** — likely not viable.
- All non-US venues (Hyperliquid/dYdX/GMX/Bybit/OKX/Binance/Deribit) remain ruled out for US persons.

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
    "crypto":    { "adapter": "mock_broker", "env": "testnet",
                   "base_url": "https://demo-futures.kraken.com" }
    // crypto.adapter starts as "mock_broker" (Kraken demo is 503); swap to
    // "kraken_perps" once Phase 1b's integration smoke passes. Same interface.
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

### Phase 1 — Broker abstraction + mock adapter (unblocks everything; NO venue testnet needed)
**Goal:** a common broker interface with a working mock adapter, so the whole system builds and runs in paper with zero dependency on any venue's (currently flaky) testnet. This replaces the old "prove Kraken first" plan because `demo-futures` is 503 (see §3b).
- [ ] **1.1** Define the broker interface contract (`lib/sentinel/broker.js` or JSDoc): `getAccount()`, `getPositions()`, `submitOrder({symbol, side, size|notional, type})`, `cancelOrder(id)`. Align existing `alpaca_paper.js` to it.
- [ ] **1.2** `lib/sentinel/mock_broker.js` + tests: in-memory positions, fills at a supplied live **mark price**, supports **LONG and SHORT**, tracks realized/unrealized PnL, persists to `data/sentinel/mock_broker_state.json`. This is the permanent test harness.
- [ ] **1.3** `assertTestnetEnv()` guard: `environment==="testnet"` refuses any live/production base URL.
- [ ] **1.4** **Acceptance:** mock broker opens+closes a SHORT and a LONG; positions read back correctly. Commit. **No external venue needed to pass this phase.**

### Phase 1b — Real Kraken (or Coinbase) perps adapter (parallel / deferred; NOT on the critical path)
**Goal:** the real crypto-short adapter, a drop-in swap behind the Phase-1 interface. Do this when a working sandbox exists (retry Kraken `demo-futures` once the 503 clears, or Coinbase sandbox, or a gated production micro-size check).
- [ ] **1b.1** Confirm §3 MUST-VERIFY items (eligibility, fees/funding, contract symbols); document in `docs/kraken-perps-notes.md`. If Kraken demo stays down, evaluate Coinbase US perps as the real venue.
- [ ] **1b.2** `lib/sentinel/kraken_perps.js` implementing the interface: `Authent` HMAC signing (see `docs.kraken.com/api/docs/guides/futures-introduction`), `getAccount/getPositions/submitOrder/cancelOrder`, symbol map for SOL/XRP/ADA/LINK/DOGE/LTC/AVAX (+BTC/ETH). Env creds; redaction (mirror `alpaca_paper.js`).
- [ ] **1b.3** Unit tests (`kraken_perps.test.js`, mocked HTTP): signing, request shaping, parsing, redaction.
- [ ] **1b.4** Integration smoke (`scripts/kraken_perps_smoke.js`) against whichever sandbox is live: open a tiny SHORT, read back, close. **Acceptance: a real short opens and closes.** Until this passes, the system runs on `mock_broker` for crypto.

### Phase 2 — Position-sync engine (the brain)
**Goal:** compute the target portfolio and drift-band-rebalance both venues in the tick.
- [ ] **2.1** `target_portfolio.js` + tests: parse both portfolio-table schemas (§5b), name→path registry, weight×capital scaling, per-symbol netting, `skip_symbols`, `skipped[]` output. Test with fixtures from real `*_portfolio.md` files.
- [ ] **2.2** `venue_router.js` + tests: route by asset_class, enforce skips, emit divergence ledger entries.
- [ ] **2.3** `rebalancer.js` + tests: drift-band math, min-order threshold, buy/sell delta generation, no-op when within band. Edge cases: target flips sign (close+reopen), symbol newly zero (full close), currently-held-but-no-longer-target (close).
- [ ] **2.4** Neutralize `risk_governor` staleness; keep exposure caps; run rebalance orders through it before submit.
- [ ] **2.5** Rewrite `scripts/sentinel_tick.js` to the new flow: read target → read both venues' positions → rebalance → risk-gate → route/submit → ledger → reconcile → write `sentinel_status.md` + `heartbeat.json`. Keep `tick_lock`.
- [ ] **2.6** End-to-end dry-run mode (`--dry-run`): compute and log intended orders without submitting. Verify against a hand-computed target for one tick.
- [ ] **2.7** Integration run: one real tick against Alpaca paper + `mock_broker` (crypto). **Acceptance: the accounts move toward the target portfolio; blocked-rate is ~0; crypto shorts fill in the mock at live marks.** (Re-run against `kraken_perps` once Phase 1b lands — no logic changes, just the config adapter swap.)
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

## 11. ADDENDUM — 2026-07-01: corrected venue facts + crypto-venue decision (supersedes parts of §3, §5c, §6 Phase 1b)

> **Author:** Claude (paired with Mhair), 2026-07-01. Everything below was verified against primary sources today (Kraken support docs, Bitnomial API docs, CME product pages, live API probes, and Mhair's actual Alpaca paper account).

### 11a. Corrections to §3 (why Kraken perps is OFF the table)
1. **`demo-futures.kraken.com` mirrors the WRONG platform for a US trader.** It is the testnet of Kraken's *global* futures exchange (`futures.kraken.com`, `PF_*` contracts) — which US residents are not eligible to trade live, ever. Passing tests there validates an API we can never use with real money. (The demo is also still 503 as of today, second day.)
2. **Kraken Derivatives US is a different stack with NO retail API.** It is Bitnomial Exchange contracts (tickers like `PBTCUC`, `PDOTUH`, `PADAUK`) cleared by NinjaTrader Clearing, surfaced ONLY in the Kraken Pro UI. Verified zero of these symbols exist on the `futures.kraken.com` API (probed all 327 tickers). No Kraken support doc offers API trading for it.
3. **Bitnomial direct is not retail-reachable.** Its REST API order entry requires a connection provisioned via Bitnomial's clearing customer portal (we are a NinjaTrader Clearing retail customer, not a Bitnomial member); indirect access is via CQG (paid ISV). **Bitnomial has NO sandbox** — Production + DR only.
4. **Coinbase is a dead end for paper.** The Advanced Trade sandbox returns mocked stateless responses (orders don't create positions); the real perps API (`*-PERP-INTX`) is non-US only.
5. **Good news:** Kraken Derivatives US perps list 16 contracts **including DOT, ADA, LINK, DOGE, LTC, AVAX** — so §3's "DOT has no US venue" is wrong *long-term*. When Kraken exposes an API for this product, nearly the whole book becomes executable. Watch for that announcement.
6. **Alpaca ETF-short fallback (verified on Mhair's paper account, kept for reference):** IBIT (BTC), ETHA (ETH), BSOL (SOL) are `shortable + easy_to_borrow`; **no XRP instrument on Alpaca is shortable** (checked XRP, GXRP, XRPC, XRPZ, XXRP, UXRP, XRPI; inverse BITI/SETH also not shortable but those are long-inverse anyway). This path was offered and NOT chosen (market-hours-only execution; no XRP), but it remains the cheapest live-money-continuous fallback.

### 11b. DECISION (Mhair, 2026-07-01)
**Majors-and-covered-alts via CME micro futures, executed in NinjaTrader's free simulator.** Adjust later when a US-legal retail API venue for alt perps opens (most likely: Kraken Derivatives US adding API access).

**CME micro crypto coverage is broader than assumed — 7 of the 10 book symbols** (verified on CME product pages today):
| Symbol | CME Micro contract | Ticker |
|---|---|---|
| BTC | Micro Bitcoin | MBT (0.1 BTC) |
| ETH | Micro Ether | MET (0.1 ETH) |
| SOL | Micro SOL | MSL (25 SOL) |
| XRP | Micro XRP | MXP (2,500 XRP) |
| ADA | Micro ADA | MCA (size: verify) |
| LINK | Micro LINK | MLN (size: verify) |
| AVAX | Micro AVAX | MAV (size: verify) |

**Not on CME: DOGE, LTC, DOT** → longs route to Alpaca crypto spot (all three are listed there); **shorts in DOGE/LTC/DOT are skipped** with a `divergence` ledger entry (extend §5d's DOT mechanism).

### 11c. Revised venue routing (replaces §5c `venues` sketch)
```jsonc
"venues": {
  "us_equity":   { "adapter": "alpaca_paper",   "env": "paper" },
  "crypto_cme":  { "adapter": "ninjatrader_sim", "env": "sim" },   // BTC/ETH/SOL/XRP/ADA/LINK/AVAX, long+short
  "crypto_spot": { "adapter": "alpaca_paper",    "env": "paper" }  // DOGE/LTC/DOT LONGS only (Alpaca crypto spot)
},
"skip_symbols": []  // replaced by rule: crypto short with no CME micro → skip + divergence
```
Routing rule in `venue_router.js`: `us_equity → alpaca_paper`; `crypto` with a CME micro → `ninjatrader_sim` (either sign); `crypto` without one → long → `alpaca_paper` spot, short → skip + divergence.

**Phase 1 (mock_broker) is UNCHANGED and still the critical path.** `ninjatrader_sim` replaces `kraken_perps` as the Phase-1b real venue. `kraken_perps.js` + its smoke script are parked, not deleted — the interface work is reusable if/when Kraken US gets an API.

### 11d. NinjaTrader integration design (Phase 1b, revised)
- **Order entry — NO C# strategy rewrite needed:** NinjaTrader 8's **ATI File Interface (OIF)** accepts plain-text Order Instruction Files dropped into `Documents\NinjaTrader 8\incoming`; processed the instant they're written. The Node adapter (`ninjatrader_sim.js`) writes OIF lines (`PLACE;;Sim101;<instrument>;<BUY|SELL>;<qty>;MARKET;;;GTC;...`) — docs: ninjatrader.com/support/helpguides/nt8/order_instruction_files_oif.htm.
- **Position/fill feedback:** OIF is one-way. Two options, pick during build: (a) NT's DLL interface (`NtDirect.dll` — `MarketPosition()`, `AvgEntryPrice()`), or (b) a ~100-line NinjaScript AddOn that dumps Sim101 positions/fills to a JSON file on a timer, which Node polls. (b) is likely simpler and more debuggable.
- **Contract months + rollover:** unlike perps, CME futures expire (monthly). The adapter needs a front-month resolver (e.g. `MBT 08-26`) and a roll rule (roll N days before expiry, close old + open new, ledger both legs).
- **Market data / sim account:** free 14-day live-data sim trial at signup; after that verify the cheapest ongoing option (Market Replay is free; live sim data may need a funded NT brokerage account or data sub). **Verify during 1b.1.**
- **Trading hours:** CME crypto trades Sun 5pm–Fri 4pm CT (closed weekends + a daily ~60-min maintenance break). Crypto signals landing in the gap execute at next open — the rebalancer's position-sync model handles this naturally (it syncs *state*, staleness is irrelevant), but the ledger should tag delayed syncs.
- **Sizing granularity warning:** 1 MBT ≈ 0.1 BTC ≈ **$6,000 notional** at current prices. With the default `total_capital_usd: 10000`, one MBT contract is 60% gross — the drift-band math can't work. **Raise `total_capital_usd` to ≥ 100000 for the sim** (confirm with Mhair; it's paper, realism of *proportions* matters more than the absolute number).

### 11e. Revised open-questions list (replaces §9)
- MCA / MLN / MAV contract sizes + tick sizes (CME contract-spec pages).
- NinjaTrader ongoing sim data cost after the 14-day trial; whether new NT accounts are still opened normally post-Kraken-acquisition.
- Position-feedback mechanism choice: NtDirect.dll vs NinjaScript JSON exporter.
- `total_capital_usd` — propose 100000 given contract granularity (was 10000).
- **Standing watch:** Kraken Derivatives US API availability (would unlock DOGE/LTC/DOT + true perps; check blog/changelog) and `demo-futures.kraken.com` recovery (minor — wrong platform for US live, still useful for exercising the parked `kraken_perps.js`).

---
*This plan supersedes the current event-replay sentinel. Build phases in order; keep everything testnet/paper/sim; do not enable any live-money path without explicit human sign-off.*
