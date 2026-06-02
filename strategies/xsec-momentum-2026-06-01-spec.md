# Stocks Cross-Sectional L/S Momentum v1 — Spec (2026-06-01)

**Status:** LIVE (forward paper from 2026-06-01)
**Author:** Claude (Opus 4.8), paired with Mhair
**Code:** `Trading Strategy/xsec_momentum/` (new long/short paper engine)

---

## 1. Purpose — the first market-neutral earner

Every prior Claude strategy is long-only and long-biased (Connors MR, Trend Momentum, BULL, basket breakouts), so **nothing profits when markets go down**, and the top-3 is concentrated in one mean-reversion edge. This is the deliberate fix: a **dollar-neutral, direction-immune** strategy that can be a top-3-profit leg when the long book is flat or bleeding.

## 2. Edge

Cross-sectional momentum: leaders keep leading, laggards keep lagging. Rank the universe by trailing return, **go long the top-K and short the bottom-K, dollar-neutral**, rebalance on a fixed cadence. P&L comes from **dispersion** (winners beating losers), independent of the market's level — it earns in up *or* down tape.

## 3. Parameters

| | |
|---|---|
| Universe | wide-15 US equities (`universe_wide.json`) |
| Momentum rank | trailing 10-day return (daily bars) |
| Rebalance | every 5 daily bars |
| Positions | long top-3 / short bottom-3 |
| Sizing | dollar-neutral, 100% gross (50% long + 50% short of equity) |
| Commission | 0.10% per leg |
| Kill switch | 20% DD |
| Capital | $10,000 |

## 4. How each leg is logged

Each held name is one round-trip: OPEN at rebalance → CLOSE at the next rebalance. Leg P&L = `notional × (+ret for longs, −ret for shorts) − commission`. The leaderboard's codex-local adapter pairs these per symbol. `live_start = 2026-06-01` (honest); pre-today is backtest, excluded from contest equity.

## 5. Backfill (informational — not contest equity)

54 closed legs, **+$649 (+6.5%)**, avg R +0.28 over 2026-04-16 → 2026-06-01. The window had strong cross-sectional dispersion (semis diverging hard), which is exactly this strategy's edge.

## 6. The pairs sibling that was shelved (honesty note)

A pairs / stat-arb strategy was built and tested the same day and **shelved**: the candidate semis pairs (NVDA/AMD, AMD/AVGO, …) **trended rather than mean-reverted** (half-life ∞, 45–59% ratio drift), so spread-reversion lost −43% on backfill. That's not a tuning bug — the spreads aren't cointegrated on this universe/window. The *same* dispersion that broke pairs is what this cross-sectional momentum strategy monetizes. Pairs code is kept (`pairs_trading/`) but unwired.

## 7. Known risks

1. **No forward history at launch** — flat until rebalances accrue post-06-01.
2. **Momentum-factor correlation** — it's market-direction-neutral, but it shares the momentum *factor* with the long-only Trend Momentum sleeve; they'd co-move when momentum works broadly. It still diversifies (earns in down markets, which the long sleeve can't).
3. **Thin universe** — 15 names is small for cross-sectional ranking; top-3/bottom-3 is concentrated.
4. **Reversal risk** — if leaders sharply mean-revert (factor crash), long-winners/short-losers reverses hard. No per-name stop; the rebalance cadence + 20% killswitch are the only brakes.
5. **Small backfill sample** — ~4–5 rebalance periods; treat +6.5% as suggestive, not proven.
