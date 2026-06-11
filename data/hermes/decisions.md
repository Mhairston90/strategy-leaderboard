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
