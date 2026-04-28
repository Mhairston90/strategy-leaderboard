# BULL Portfolio State

> **Rebuilt each wake** from `trade_log.md` by whichever routine is running.
> `trade_log.md` is the source of truth; this file is a derived snapshot.
> **Last rebuild:** 2026-04-28T17:00:00Z (routine-01-overnight — 1 OPEN TAO/USD on rule-v0-momentum, all kill switches clear).

## Account

- Starting equity: **$10,000.00**
- Cash: **$7,325.59**
- Realized PnL (all-time): **−$222.89**
  - BTC −$9.14 (exit-ema-cross 2026-04-24T04:00Z)
  - TRX −$26.69 (exit-stop-hit 2026-04-24T20:00Z)
  - LTC +$39.40 (exit-ema-cross 2026-04-25T17:00Z, +1.32R)
  - ADA −$38.77 (exit-ema-cross 2026-04-25T17:00Z, −1.21R)
  - AVAX −$34.04 (exit-ema-cross 2026-04-25T17:00Z, −0.99R)
  - ETH −$34.68 (exit-stop-hit 2026-04-27T05:00Z, −1.06R)
  - BTC −$28.77 (exit-stop-hit 2026-04-27T05:00Z, −1.08R)
  - SOL −$33.82 (exit-stop-hit 2026-04-27T05:00Z, −1.06R)
  - TAO −$56.38 (exit-stop-hit 2026-04-27T05:00Z, −1.03R)
- Unrealized PnL: **−$7.62** (entry slippage + 0.26% commission on TAO)
- Position values (MTM): **$2,443.87**
- Current equity (cash + positions MTM): **$9,769.46**
- Equity peak: **$10,027.55** (set 2026-04-24 midday)
- Drawdown from peak: **2.57%**

## Open positions

| Pair | Side | Size | Entry | Stop | MTM price | Unrealized PnL | R-distance |
|------|------|------|-------|------|-----------|----------------|------------|
| TAO/USD | long | 9.4 | 260.12 | 254.74 | 259.9863 | −$7.62 | −0.24R (slip+comm) |

Portfolio risk-at-moment: **0.52%** (cap 4%) — TAO stop-dist 5.38 × size 9.4 = $50.57.
Open positions: **1 / 8** (strategy v0 max-concurrent 4 → 1/4 used).

## Active kill-switch state

- Daily realized: **0.00%** today (cap 5%) — yesterday's −1.54% does not carry
- Consecutive losing days: tracking — 2026-04-27 was a losing day; today TBD
- Max drawdown: 2.57% (cap 25%, warn 12.5%)
- Equity floor: $9,769.46 > $7,500 floor — OK
- **All clear. Trading authorized.**

## Rolling performance

| Window | BULL return | BTC-hold return | Delta | Result |
|--------|-------------|-----------------|-------|--------|
| 7d | — | — | — | — |
| 30d | — | — | — | — |
| 90d | — | — | — | — |

(Populated once a 7-day window has closed.)
