# Hermes Decisions Ledger

> The recommendation -> outcome loop. When a queue item gets a human (or
> human-approved) decision, append a row here. The Hermes Monitor joins rows
> to live queue items by Strategy + Title-match substring and shows decision
> state on the Decision Desk; items without a row show as UNDECIDED and age.
>
> Decision values: `ack` (seen, working on it) | `done` (action taken) |
> `dismissed` (won't act, with reason) | `deferred` (revisit date in notes).
> Fill the Outcome column AFTER results are known — that is the whole point.

| Decided (UTC) | Owner | Strategy | Title match | Decision | Action taken | Outcome |
|---------------|-------|----------|-------------|----------|--------------|---------|
| 2026-06-10T23:30:00Z | claude | Stocks Basket Breakout v1 | regime collapse | deferred | No mid-month parameter changes. Fill-realism study (reports/fill_realism_2026-06-10.md) shows continuation styles degrade LEAST from realistic fills, so the OOS collapse is likely a real dead edge, not a sim artifact. Criteria set: archive per COMPETITION.md on July 1 if OOS PF still < 0.8. | |
| 2026-06-10T23:30:00Z | claude | Stocks Mean Reversion v1 | leader but OOS bleeding | ack | Specs frozen; fading != broken on a 2-week window. Protective action taken via registration instead: v1 not in the OPUS June five (mechanical rule selected v2 family). Re-evaluate at July registration: if trailing-14d PnL still negative, sits out July. | |
| 2026-06-10T23:30:00Z | claude | Stocks Mean Reversion v2 | leader but OOS bleeding | ack | Registered for June on cumulative forward strength (top of OPUS ranking, +383.60 fwd on RSI<15 variant). Criteria: negative trailing-14d at July registration = sits out July. No parameter changes. | |
| 2026-06-10T23:35:00Z | fable | (registration act) | OPUS + CODEX June fives | done | Registered both camps by stated mechanical rule (top-5 auditable forward PnL, twins and collapsing-flagged rows excluded) under delegated authority; conflict of interest neutralized by removing discretion. Camps may propose their own July 5 before July 1. | |
| 2026-06-12T21:20:00Z | claude | Basket Breakout Aggressive v1 (crypto) | recovery | ack | Recovery-confirmation window cannot accrue while signal-gated: 2026-06-12 diagnosis + gate_telemetry show zero qualifying breakout bars basket-wide since 5/22 (nearest re-arm BTC +1.1%). OOS PF 1.05 evidence stands unchanged. Re-evaluate on first post-re-arm trades or at July-1 registration. | |
| 2026-06-12T21:20:00Z | claude | Basket Breakout Aggressive v2 (crypto) | persistent loss | ack | 2026-06-12 diagnosis: all losses predate the 5/22 signal drought; long-only breakout in a -20-25% tape is the loss mechanism, not a sim artifact. No new evidence accrues while gated. Criteria: archive per COMPETITION.md at July-1 if OOS PF still < 0.8; no mid-month parameter changes. | |
| 2026-06-12T21:20:00Z | claude | Basket Breakout Leveraged v1 (crypto) | persistent loss | ack | Same diagnosis as Aggressive v2 — 5x perp leverage compounds the same edge in the same dead tape. Same July-1 archive criteria; no mid-month changes. | |
| 2026-06-12T21:20:00Z | claude | Stocks Basket Breakout Aggressive v1 | persistent loss | deferred | Mirrors the 06-10 parent deferral (Stocks BB v1 regime collapse): fill-realism study showed continuation styles degrade least from realistic fills, so persistent loss is likely a real dead edge. Decide with the parent at July-1: archive if OOS PF still < 0.8. | |
| 2026-06-12T21:20:00Z | claude | Stocks Basket Breakout Diversified v1 | persistent loss | deferred | Same basis as Stocks BB Aggressive v1 — decide with the family at July-1 registration; archive if OOS PF still < 0.8. | |
