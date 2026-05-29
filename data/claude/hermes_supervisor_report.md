# Claude Hermes Supervisor Report

> Generated: 2026-05-29T15:00:02.175Z
> Review-only: no live routing, position-sizing, or spec files were changed.
> Watches: basket-breakout family (crypto + stocks) and Stocks Mean Reversion v1.

## Summary

- Queue items: 8
- Fading winners (P1): 1
- Collapsing (P1): 1
- Stable losing (P2): 4
- Recovering (P2 watch): 1
- Stable profitable (P3): 1
- Insufficient data (P3): 0

## Experiment Queue

| Priority | Type | Title | Source | Requested action |
|----------|------|-------|--------|------------------|
| 1 | experiment | Address regime collapse in Stocks Basket Breakout v1 | data/codex/basket_oos_audit.md | OOS PF 0.37 vs IS 2.01; OOS PnL $-210.46. Flags: PF collapse; OOS turned negative; win-rate drop >15pp. Decide within the week: review regime gate, fork v2.1 with halved risk, or archive per spec recovery rules. |
| 1 | experiment | Defend Stocks Mean Reversion v2 — leader but OOS bleeding | data/codex/basket_oos_audit.md | Cumulative +7.09% but OOS PnL +$233.35, OOS PF 1.83. Currently on the leaderboard top but losing the most recent window. Options: halve size on new entries, tighten exit, pause pending diagnosis. |
| 2 | sample_collection | Confirm Basket Breakout Aggressive v1 (crypto) recovery | data/codex/basket_oos_audit.md | Cumulative DD 18.7% but OOS PnL +$76.00, PF 1.06, win 64%. If next 2-week window holds PF >= 1.0, treat as recovered. If it slips below 0.8, escalate to experiment. |
| 2 | experiment | Diagnose persistent loss in Basket Breakout Aggressive v2 (crypto) | data/codex/basket_oos_audit.md | Losses in both IS and OOS, no acute collapse. Consider: review vs original expected_pf_range, reduce risk to 25% of current sizing, or archive if spec rules warrant. |
| 2 | experiment | Diagnose persistent loss in Basket Breakout Leveraged v1 (crypto) | data/codex/basket_oos_audit.md | Losses in both IS and OOS, no acute collapse. Consider: review vs original expected_pf_range, reduce risk to 25% of current sizing, or archive if spec rules warrant. |
| 2 | experiment | Diagnose persistent loss in Stocks Basket Breakout Aggressive v1 | data/codex/basket_oos_audit.md | Losses in both IS and OOS, no acute collapse. Consider: review vs original expected_pf_range, reduce risk to 25% of current sizing, or archive if spec rules warrant. |
| 2 | experiment | Diagnose persistent loss in Stocks Basket Breakout Diversified v1 | data/codex/basket_oos_audit.md | Losses in both IS and OOS, no acute collapse. Consider: review vs original expected_pf_range, reduce risk to 25% of current sizing, or archive if spec rules warrant. |
| 3 | sample_collection | Continue collecting on Stocks Mean Reversion v1 | data/codex/basket_oos_audit.md | Cumulative +1.61%, OOS PF 1.11, win 65%. Both halves profitable. Defend this strategy — it is the cohort's actual edge. |

## Guardrails

- Review-only: no live routing, position-sizing, or spec files were modified.
- Queue items are research and operational recommendations only.
- Claude Hermes Supervisor does not write trade logs, portfolios, or registry entries.