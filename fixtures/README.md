# Fixtures — captured 2026-04-28

| File | Source tab/path | Rows |
|---|---|---|
| basket-breakout-signals.json | Sheets tab "Basket Breakout Signals" | 5 |
| basket-breakout-open-positions.json | Sheets tab "Basket Breakout Open Positions" | 1 |
| analyst-hy-v1.json | Sheets tab "Analyst HY v1" | 3 |
| aggro-leader-cont.json | Sheets tab "Aggro Leader Continuation Signals" | 21 |
| v7-btc-tg.json | Sheets tab "V7-BTC Trend Gated Signals" — tab not found (strategy is research-only per spec; fixture contains error JSON) | N/A |
| hy-v4-signals.json | Sheets tab "Signals" | 26 |
| bull-portfolio.md | github.com/Mhairston90/trading-bull/main/memory/portfolio.md | N/A |
| bull-trade-log.md | github.com/Mhairston90/trading-bull/main/memory/trade_log.md | N/A |

## HY v4 Tab Decision

Three candidate tabs were inspected: `V6 Signals` (5 rows, version="v6"), `V5 Signals` (8 rows, version="v5"), and `Signals` (26 rows).

The `Signals` tab was selected as the HY v4 source because:
- It has the most rows (26) and the most recent timestamps (2026-04-05 to 2026-04-27, spanning 3+ weeks)
- It contains both BTCUSD and SOLUSD assets, matching the strategy's documented trading universe
- Rows carry `notes="v4"` explicitly identifying them as v4 signals
- V5/V6 tabs use their own `version` field with "v5"/"v6" strings and have fewer rows with older timestamps

## Aggro Tab Confirmation

The `Aggro Leader Continuation Signals` tab returned 21 rows (non-zero). The Breakout variant was not needed.

## V7-BTC Tab Note

The `V7-BTC Trend Gated Signals` tab does not exist in the Sheet (API returned `{"status":"error","message":"Tab not found: V7-BTC Trend Gated Signals"}`). Per spec, V7-BTC is research-only. The fixture file exists with the error JSON for documentation purposes.

## Refresh

Re-run the Task 2 curl commands to update fixtures from live endpoints.
