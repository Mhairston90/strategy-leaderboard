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
