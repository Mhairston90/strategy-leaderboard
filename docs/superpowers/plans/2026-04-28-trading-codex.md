# Trading Codex Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `trading-codex`, a paper-only crypto tournament agent, and add `CODEX v0` to the existing Strategy Leaderboard.

**Architecture:** `trading-codex` owns paper state, strategy sleeves, validation, and export scripts. `strategy-leaderboard` consumes exported markdown snapshots from `strategy-leaderboard/data/codex/` and renders `CODEX v0` with the same metrics used for BULL. `memory/trade_log.md` is the source of truth; `memory/portfolio.md` is always rebuilt.

**Tech Stack:** Python 3.11 standard library, `pytest`, Node ES modules, `node:test`, existing Strategy Leaderboard modules.

---

## File Structure

### New Repo: `C:\Users\Mhair\OneDrive\Desktop\trading-codex`

- Create `README.md`: usage, paper-only boundary, test commands.
- Create `CODEX.md`: identity, mandate, hard safety rules.
- Create `memory/guardrails.md`: exposure caps, daily hard stop, validation requirements.
- Create `memory/strategy.md`: tournament sleeve definitions, fill model, allocator rules.
- Create `memory/trade_log.md`: append-only source-of-truth table.
- Create `memory/portfolio.md`: derived snapshot rebuilt from trade log.
- Create `memory/research_log.md`: routine decisions and validation failures.
- Create `memory/sleeve_scores.md`: derived sleeve scoreboard.
- Create `routines/*.md`: operational routine docs.
- Create `scripts/state.py`: parse trade logs, model trades, rebuild account state.
- Create `scripts/rebuild_portfolio.py`: CLI that writes `memory/portfolio.md` and `memory/sleeve_scores.md`.
- Create `scripts/validate_state.py`: CLI that blocks bad state.
- Create `scripts/export_leaderboard.py`: copies sanitized markdown snapshots into the leaderboard repo.
- Create `scripts/market_data.py`: public Kraken-only data helper, no credentials.
- Create `strategies/common.py`: candle, candidate, indicator, and allocator helpers.
- Create `strategies/trend.py`, `breakout.py`, `mean_revert.py`, `relative_strength.py`, `cash_defense.py`: strategy sleeves.
- Create `tests/`: pytest coverage for rebuild, validation, sleeves, export.

### Existing Repo: `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard`

- Create `adapters/adapter_codex.js`: parse Codex exported markdown and return a StrategyRow.
- Modify `lib/fetch.js`: add local markdown fetch helper.
- Modify `app.js`: support `source.type === "codex-local"`.
- Modify `registry.js`: add `CODEX v0`.
- Create `data/codex/portfolio.md` and `data/codex/trade_log.md`: exported snapshots.
- Create `fixtures/codex-portfolio.md` and `fixtures/codex-trade-log.md`.
- Modify `adapters/adapters.test.js`: add Codex adapter tests.
- Modify `scripts/smoke.js`: include Codex and keep visible error behavior.

---

## Task 1: Create `trading-codex` Skeleton And Initial State

**Files:**
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\README.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\CODEX.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\.gitignore`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\memory\guardrails.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\memory\strategy.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\memory\trade_log.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\memory\portfolio.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\memory\research_log.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\memory\sleeve_scores.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\routines\01-market-scan.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\routines\02-risk-check.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\routines\03-eod.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\routines\04-tournament-review.md`

- [ ] **Step 1: Create repo directories**

Run:

```powershell
New-Item -ItemType Directory -Force -Path `
  'C:\Users\Mhair\OneDrive\Desktop\trading-codex\memory',`
  'C:\Users\Mhair\OneDrive\Desktop\trading-codex\routines',`
  'C:\Users\Mhair\OneDrive\Desktop\trading-codex\scripts',`
  'C:\Users\Mhair\OneDrive\Desktop\trading-codex\strategies',`
  'C:\Users\Mhair\OneDrive\Desktop\trading-codex\tests'
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' init
```

Expected: directories exist and Git initializes on `main` or `master`. If Git initializes on `master`, rename it:

```powershell
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' branch -M main
```

- [ ] **Step 2: Add identity and safety docs**

Use `apply_patch` to add `README.md`, `CODEX.md`, `memory/guardrails.md`, and `memory/strategy.md`.

Minimum `CODEX.md` content:

```markdown
# CODEX v0 - Identity And Mandate

You are CODEX v0, a paper-only crypto tournament agent.

## Mandate

- Starting paper equity: $10,000.
- Market: crypto only.
- Execution: local simulation only.
- Objective: maximize ending paper equity on the Strategy Leaderboard.
- No real orders, no exchange credentials, no money movement.

## Hard Rules

- Never place real trades.
- Never request, store, echo, or use exchange secrets.
- Never modify `C:\Users\Mhair\OneDrive\Desktop\trading-bull` as part of normal operation.
- `memory/trade_log.md` is append-only.
- `memory/portfolio.md` and `memory/sleeve_scores.md` are derived from the trade log.
- Run `python scripts/validate_state.py` before and after any routine that changes state.
```

Minimum `memory/guardrails.md` content:

```markdown
# CODEX v0 Guardrails

## Account

- Starting equity: $10,000.
- Paper trading only.
- Crypto spot-style long positions only in v0.
- No leverage, margin, perps, options, lending, or real execution.

## Exposure Caps

- Max gross exposure: 100% of equity.
- Max one asset exposure: 35% of equity.
- Max one sleeve exposure: 60% of equity.
- Minimum cash defense reserve: 20% until 20 closed trades exist.

## Daily Hard Stop

If current equity drops 8% or more from the prior UTC day close:

1. Close all paper positions at the current modeled price.
2. Freeze new entries until the next UTC day.
3. Append the event to `memory/research_log.md`.

## Validation

Validation failure blocks new entries. The next routine may only rebuild state, export state, or append a correction row.
```

Minimum `memory/strategy.md` content:

```markdown
# CODEX v0 Strategy

CODEX v0 is a tournament manager. It allocates one paper account across internal sleeves:

- `trend`
- `breakout`
- `mean_revert`
- `relative_strength`
- `cash_defense`

## Fill Model

- Long entry fill: signal close * 1.0005.
- Long exit fill: signal close * 0.9995.
- Fee model: 0.26% per side.
- Realized PnL includes entry and exit fees.

## Allocator

- Before 20 closed trades: reserve 20% cash, split the remaining 80% equally across risk sleeves with valid candidates.
- At and after 20 closed trades: score sleeves by realized PnL, average R, hit rate, and drawdown.
- Never allocate above the guardrail caps.
- If no risk sleeve has a positive score, cash defense receives all unallocated capital.
```

- [ ] **Step 3: Add initial empty state files**

Use `apply_patch` to add:

```markdown
# CODEX v0 Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries
```

Use this exact initial `memory/portfolio.md` content:

```markdown
# CODEX v0 Portfolio State

> Rebuilt from `memory/trade_log.md`.
> Last rebuild: initial.

## Account

- Starting equity: **$10,000.00**
- Cash: **$10,000.00**
- Realized PnL (all-time): **$0.00**
- Unrealized PnL: **$0.00**
- Position values (MTM): **$0.00**
- Current equity: **$10,000.00**
- Equity peak: **$10,000.00**
- Drawdown from peak: **0.00%**

## Open positions

| Pair | Sleeve | Side | Size | Entry | Stop | MTM price | Unrealized PnL | Exposure |
|------|--------|------|------|-------|------|-----------|----------------|----------|

No open positions.

## Sleeve allocation

| Sleeve | Equity allocated | Exposure | Realized PnL | Closed trades | Score |
|--------|------------------|----------|--------------|---------------|-------|
| trend | $0.00 | $0.00 | $0.00 | 0 | 0.00 |
| breakout | $0.00 | $0.00 | $0.00 | 0 | 0.00 |
| mean_revert | $0.00 | $0.00 | $0.00 | 0 | 0.00 |
| relative_strength | $0.00 | $0.00 | $0.00 | 0 | 0.00 |
| cash_defense | $10,000.00 | $0.00 | $0.00 | 0 | 0.00 |

## Active guardrail state

- Gross exposure: **0.00%** (cap 100%)
- Largest asset exposure: **0.00%** (cap 35%)
- Largest sleeve exposure: **0.00%** (cap 60%)
- Daily hard stop: **clear**
- Validation: **not yet run**
```

- [ ] **Step 4: Add routine docs**

Each routine file must say paper-only and must require validation before and after state changes.

Use this template for all four routine files, changing the title and job section:

```markdown
# Routine NN - Name

## Safety

- Paper only.
- No real orders.
- No exchange credentials.
- Run `python scripts/validate_state.py` before state changes.
- Run `python scripts/rebuild_portfolio.py` after trade-log changes.
- Run `python scripts/validate_state.py` again after rebuild.
- Run `python scripts/export_leaderboard.py` after successful validation.

## Job

Describe the routine-specific scan, risk check, EOD journal, or tournament review work.
```

- [ ] **Step 5: Commit skeleton**

Run:

```powershell
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' add .
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' commit -m "chore: scaffold codex paper trader"
```

Expected: commit succeeds and only `trading-codex` files are included.

---

## Task 2: Implement Trade Parsing And Portfolio Rebuild

**Files:**
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\scripts\state.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\scripts\rebuild_portfolio.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\tests\test_rebuild_portfolio.py`

- [ ] **Step 1: Write failing rebuild tests**

Create `tests/test_rebuild_portfolio.py` with tests covering:

```python
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.state import parse_trade_log, rebuild_account


def test_empty_log_rebuilds_starting_equity():
    md = """# Log
## Entries
"""
    rows = parse_trade_log(md)
    account = rebuild_account(rows, mark_prices={})
    assert account.cash == 10000.0
    assert account.equity == 10000.0
    assert account.realized_pnl == 0.0
    assert account.open_positions == []


def test_open_then_close_rebuilds_cash_and_realized_pnl():
    md = """# Log
## Entries
| 2026-04-28T18:00:00Z | OPEN | BTC/USD | long | 0.1 | 100000 | 98000 | - | - | - | entry-test | trend |
| 2026-04-28T19:00:00Z | CLOSE | BTC/USD | long | 0.1 | 102000 | - | - | +0.74 | +147.48 | exit-test | trend |
"""
    rows = parse_trade_log(md)
    account = rebuild_account(rows, mark_prices={})
    assert round(account.cash, 2) == 10147.48
    assert round(account.equity, 2) == 10147.48
    assert round(account.realized_pnl, 2) == 147.48
    assert len(account.open_positions) == 0


def test_open_position_uses_mark_price_for_equity():
    md = """# Log
## Entries
| 2026-04-28T18:00:00Z | OPEN | SOL/USD | long | 10 | 100 | 95 | - | - | - | entry-test | breakout |
"""
    rows = parse_trade_log(md)
    account = rebuild_account(rows, mark_prices={"SOL/USD": 110})
    assert round(account.cash, 2) == 9000.0
    assert round(account.position_value, 2) == 1100.0
    assert round(account.unrealized_pnl, 2) == 100.0
    assert round(account.equity, 2) == 10100.0
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
pytest -q
```

Expected: fail with `ModuleNotFoundError` for `scripts.state`.

- [ ] **Step 3: Implement `scripts/state.py`**

Implement these public dataclasses and functions:

```python
STARTING_EQUITY = 10000.0
FEE_RATE = 0.0026

@dataclass
class TradeEvent:
    time: str
    action: str
    pair: str
    side: str
    size: float
    price: float
    stop: float | None
    target: float | None
    r: float | None
    pnl: float | None
    reason: str
    sleeve: str

@dataclass
class OpenPosition:
    pair: str
    sleeve: str
    side: str
    size: float
    entry: float
    stop: float | None
    mark: float
    unrealized_pnl: float

@dataclass
class AccountState:
    cash: float
    realized_pnl: float
    unrealized_pnl: float
    position_value: float
    equity: float
    peak: float
    drawdown_pct: float
    open_positions: list[OpenPosition]
    closed_trades: int
```

Parsing requirements:

- Split markdown table rows by `|`.
- Ignore header and separator rows.
- Accept both `-` and em dash as null cells.
- Require at least 12 cells for Codex rows.
- Return rows sorted in file order; do not sort in the parser.

Rebuild requirements:

- On `OPEN`, subtract `size * price` from cash and store one open position by `(pair, sleeve)`.
- On `CLOSE`, find the matching open by `(pair, sleeve)`, add the original open notional plus logged PnL back to cash, add logged PnL to realized PnL, and remove the position.
- For open positions, mark at `mark_prices[pair]` when present, otherwise mark at entry.
- Equity is `cash + position_value`.
- Peak is `max(STARTING_EQUITY, equity)`.
- Drawdown is `(peak - equity) / peak * 100`.

- [ ] **Step 4: Implement `scripts/rebuild_portfolio.py`**

CLI behavior:

```powershell
python scripts/rebuild_portfolio.py
```

Required behavior:

- Read `memory/trade_log.md`.
- Rebuild account using no external market data for v0 baseline.
- Write `memory/portfolio.md`.
- Write `memory/sleeve_scores.md`.
- Print `OK: rebuilt portfolio`.

Use this output shape for portfolio fields so the leaderboard parser can read them:

```markdown
- Cash: **$10,000.00**
- Realized PnL (all-time): **$0.00**
- Unrealized PnL: **$0.00**
- Position values (MTM): **$0.00**
- Current equity: **$10,000.00**
- Equity peak: **$10,000.00**
- Drawdown from peak: **0.00%**
```

- [ ] **Step 5: Run rebuild tests**

Run:

```powershell
pytest -q tests/test_rebuild_portfolio.py
```

Expected: `3 passed`.

- [ ] **Step 6: Run rebuild CLI on initial state**

Run:

```powershell
python scripts/rebuild_portfolio.py
```

Expected: prints `OK: rebuilt portfolio` and keeps current equity at `$10,000.00`.

- [ ] **Step 7: Commit rebuild implementation**

Run:

```powershell
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' add scripts/state.py scripts/rebuild_portfolio.py tests/test_rebuild_portfolio.py memory/portfolio.md memory/sleeve_scores.md
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' commit -m "feat: rebuild codex paper portfolio"
```

---

## Task 3: Implement State Validation

**Files:**
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\scripts\validate_state.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\tests\test_validate_state.py`
- Modify: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\scripts\state.py`

- [ ] **Step 1: Write failing validation tests**

Create `tests/test_validate_state.py` with:

```python
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.state import parse_trade_log
from scripts.validate_state import validate_events


def errors_for(md):
    return validate_events(parse_trade_log(md))


def test_valid_log_has_no_errors():
    md = """# Log
| 2026-04-28T18:00:00Z | OPEN | BTC/USD | long | 0.1 | 100000 | 98000 | - | - | - | entry-test | trend |
| 2026-04-28T19:00:00Z | CLOSE | BTC/USD | long | 0.1 | 102000 | - | - | +0.74 | +147.48 | exit-test | trend |
"""
    assert errors_for(md) == []


def test_non_chronological_log_is_error():
    md = """# Log
| 2026-04-28T19:00:00Z | OPEN | BTC/USD | long | 0.1 | 100000 | 98000 | - | - | - | entry-test | trend |
| 2026-04-28T18:00:00Z | CLOSE | BTC/USD | long | 0.1 | 102000 | - | - | +0.74 | +147.48 | exit-test | trend |
"""
    assert any("chronological" in e for e in errors_for(md))


def test_orphan_close_is_error():
    md = """# Log
| 2026-04-28T19:00:00Z | CLOSE | BTC/USD | long | 0.1 | 102000 | - | - | +0.74 | +147.48 | exit-test | trend |
"""
    assert any("orphan close" in e for e in errors_for(md))


def test_duplicate_open_is_error():
    md = """# Log
| 2026-04-28T18:00:00Z | OPEN | BTC/USD | long | 0.1 | 100000 | 98000 | - | - | - | entry-test | trend |
| 2026-04-28T18:10:00Z | OPEN | BTC/USD | long | 0.1 | 100100 | 98100 | - | - | - | entry-test | trend |
"""
    assert any("duplicate open" in e for e in errors_for(md))
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
pytest -q tests/test_validate_state.py
```

Expected: fail because `scripts.validate_state` does not exist.

- [ ] **Step 3: Implement validator**

Implement:

```python
def validate_events(events: list[TradeEvent]) -> list[str]:
    errors = []
    open_keys = set()
    previous_time = None
    for event in events:
        current_time = datetime.fromisoformat(event.time.replace("Z", "+00:00"))
        if previous_time and current_time < previous_time:
            errors.append(f"non-chronological row: {event.time}")
        previous_time = current_time

        key = (event.pair, event.sleeve)
        if event.action == "OPEN":
            if key in open_keys:
                errors.append(f"duplicate open: {event.pair} {event.sleeve}")
            open_keys.add(key)
            if event.stop is None:
                errors.append(f"open missing stop: {event.pair} {event.sleeve}")
        elif event.action == "CLOSE":
            if key not in open_keys:
                errors.append(f"orphan close: {event.pair} {event.sleeve}")
            else:
                open_keys.remove(key)
            if event.pnl is None:
                errors.append(f"close missing pnl: {event.pair} {event.sleeve}")
            if event.r is None:
                errors.append(f"close missing r: {event.pair} {event.sleeve}")
        else:
            errors.append(f"unknown action: {event.action}")
    return errors
```

CLI behavior:

```powershell
python scripts/validate_state.py
```

Expected on valid initial state:

```text
OK: state valid
```

Expected on invalid state: print one `ERROR: ...` line per error and exit code `1`.

- [ ] **Step 4: Add exposure validation**

Extend `validate_state.py` to rebuild the account and enforce:

- `position_value <= equity`
- largest asset exposure `<= 35%`
- largest sleeve exposure `<= 60%`
- if `equity <= 0`, return error `equity is non-positive`

Add one test with a single open position whose notional is above 35% of equity and assert the error contains `asset exposure`.

- [ ] **Step 5: Run validator tests**

Run:

```powershell
pytest -q tests/test_validate_state.py
```

Expected: all tests pass.

- [ ] **Step 6: Run full Python tests**

Run:

```powershell
pytest -q
```

Expected: all current tests pass.

- [ ] **Step 7: Commit validator**

Run:

```powershell
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' add scripts/validate_state.py scripts/state.py tests/test_validate_state.py
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' commit -m "feat: validate codex paper state"
```

---

## Task 4: Implement Strategy Sleeves And Allocator

**Files:**
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\strategies\__init__.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\strategies\common.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\strategies\trend.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\strategies\breakout.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\strategies\mean_revert.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\strategies\relative_strength.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\strategies\cash_defense.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\tests\test_sleeves.py`

- [ ] **Step 1: Write failing sleeve tests**

Create `tests/test_sleeves.py` with:

```python
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from strategies.common import Candle, allocate_candidates
from strategies.trend import generate as trend_generate
from strategies.breakout import generate as breakout_generate
from strategies.mean_revert import generate as mean_revert_generate
from strategies.relative_strength import generate as relative_strength_generate
from strategies.cash_defense import generate as cash_defense_generate


def candles(prices):
    out = []
    for i, close in enumerate(prices):
        out.append(Candle(time=f"2026-04-28T{i:02d}:00:00Z", open=close, high=close * 1.01, low=close * 0.99, close=close, volume=1000 + i))
    return out


def test_trend_generates_candidate_on_uptrend():
    data = {"SOL/USD": candles([100 + i for i in range(40)]), "BTC/USD": candles([100 + i * 0.2 for i in range(40)]), "ETH/USD": candles([100 + i * 0.2 for i in range(40)])}
    candidates = trend_generate(data)
    assert candidates
    assert candidates[0].sleeve == "trend"
    assert candidates[0].pair == "SOL/USD"


def test_breakout_generates_candidate_on_new_high():
    data = {"SOL/USD": candles([100] * 30 + [115])}
    candidates = breakout_generate(data)
    assert candidates
    assert candidates[0].sleeve == "breakout"


def test_mean_revert_generates_candidate_after_sharp_drop_and_bounce():
    data = {"SOL/USD": candles([100] * 25 + [82, 84, 86])}
    candidates = mean_revert_generate(data)
    assert candidates
    assert candidates[0].sleeve == "mean_revert"


def test_relative_strength_selects_best_pair():
    data = {"BTC/USD": candles([100, 101, 102, 103]), "SOL/USD": candles([100, 110, 120, 130]), "ETH/USD": candles([100, 101, 102, 103])}
    candidates = relative_strength_generate(data)
    assert candidates[0].pair == "SOL/USD"


def test_cash_defense_returns_no_trade_candidate():
    assert cash_defense_generate({}) == []


def test_allocator_respects_asset_cap():
    candidate = trend_generate({"SOL/USD": candles([100 + i for i in range(40)]), "BTC/USD": candles([100 + i for i in range(40)]), "ETH/USD": candles([100 + i for i in range(40)])})[0]
    fills = allocate_candidates([candidate], equity=10000.0, existing_exposure={})
    assert fills[0].notional <= 3500.0
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
pytest -q tests/test_sleeves.py
```

Expected: fail because `strategies.common` does not exist.

- [ ] **Step 3: Implement `strategies/common.py`**

Define:

```python
@dataclass
class Candle:
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float

@dataclass
class Candidate:
    pair: str
    sleeve: str
    side: str
    confidence: float
    entry: float
    stop: float
    target: float | None
    reason: str

@dataclass
class Allocation:
    candidate: Candidate
    notional: float
```

Implement helpers:

- `sma(values, period)`
- `pct_change(first, last)`
- `recent_high(candles, lookback)`
- `recent_low(candles, lookback)`
- `allocate_candidates(candidates, equity, existing_exposure)`

Allocator rules:

- Sort candidates by `confidence` descending.
- Max one asset notional is `equity * 0.35`.
- Max gross notional is `equity`.
- Return allocations until caps are reached.

- [ ] **Step 4: Implement sleeve modules**

Each module exports `generate(candles_by_pair)`.

Rules:

- `trend`: candidate when last close is above 20-period SMA and 30-bar return is positive; skip BTC and ETH risk-off check only if both BTC and ETH are present and both have negative 30-bar return.
- `breakout`: candidate when last close is greater than prior 30-bar high.
- `mean_revert`: candidate when a drop of at least 12% is followed by two rising closes.
- `relative_strength`: candidate for the non-BTC pair with strongest positive return over available candles.
- `cash_defense`: always returns `[]`.

All candidates must include:

- `side="long"`
- `entry=last_close * 1.0005`
- `stop` below entry
- `target` above entry except mean reversion may use a conservative target at midpoint toward prior range
- sleeve-specific reason tag

- [ ] **Step 5: Run sleeve tests**

Run:

```powershell
pytest -q tests/test_sleeves.py
```

Expected: all tests pass.

- [ ] **Step 6: Run full Python tests**

Run:

```powershell
pytest -q
```

Expected: all tests pass.

- [ ] **Step 7: Commit sleeves**

Run:

```powershell
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' add strategies tests/test_sleeves.py
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' commit -m "feat: add codex strategy sleeves"
```

---

## Task 5: Implement Export To Strategy Leaderboard

**Files:**
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\scripts\export_leaderboard.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\tests\test_export_leaderboard.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\data\codex\.gitkeep`

- [ ] **Step 1: Write failing export test**

Create `tests/test_export_leaderboard.py`:

```python
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.export_leaderboard import export_snapshots


def test_export_snapshots_copies_portfolio_and_trade_log(tmp_path):
    source = tmp_path / "codex"
    dest = tmp_path / "leaderboard" / "data" / "codex"
    (source / "memory").mkdir(parents=True)
    (source / "memory" / "portfolio.md").write_text("# Portfolio\n", encoding="utf-8")
    (source / "memory" / "trade_log.md").write_text("# Trade Log\n", encoding="utf-8")

    export_snapshots(source, dest)

    assert (dest / "portfolio.md").read_text(encoding="utf-8") == "# Portfolio\n"
    assert (dest / "trade_log.md").read_text(encoding="utf-8") == "# Trade Log\n"
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
pytest -q tests/test_export_leaderboard.py
```

Expected: fail because `scripts.export_leaderboard` does not exist.

- [ ] **Step 3: Implement `export_leaderboard.py`**

Implement:

```python
DEFAULT_DEST = Path(r"C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\data\codex")

def export_snapshots(source_root: Path, dest_dir: Path = DEFAULT_DEST) -> None:
    memory = source_root / "memory"
    portfolio = memory / "portfolio.md"
    trade_log = memory / "trade_log.md"
    if not portfolio.exists():
        raise FileNotFoundError(portfolio)
    if not trade_log.exists():
        raise FileNotFoundError(trade_log)
    dest_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(portfolio, dest_dir / "portfolio.md")
    shutil.copyfile(trade_log, dest_dir / "trade_log.md")
```

CLI behavior:

```powershell
python scripts/export_leaderboard.py
```

Expected: copies files and prints `OK: exported leaderboard snapshots`.

- [ ] **Step 4: Run export tests**

Run:

```powershell
pytest -q tests/test_export_leaderboard.py
```

Expected: pass.

- [ ] **Step 5: Export initial snapshots**

Run:

```powershell
python scripts/export_leaderboard.py
```

Expected:

```text
OK: exported leaderboard snapshots
```

Files created:

- `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\data\codex\portfolio.md`
- `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\data\codex\trade_log.md`

- [ ] **Step 6: Commit trading-codex export script**

Run:

```powershell
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' add scripts/export_leaderboard.py tests/test_export_leaderboard.py
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' commit -m "feat: export codex leaderboard snapshots"
```

Do not commit leaderboard data files in this task; they are committed in the leaderboard integration task.

---

## Task 6: Add Public Kraken Market Data Helper

**Files:**
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\scripts\market_data.py`
- Create: `C:\Users\Mhair\OneDrive\Desktop\trading-codex\tests\test_market_data.py`

- [ ] **Step 1: Write failing market-data tests**

Create `tests/test_market_data.py`:

```python
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.market_data import kraken_pair_for, parse_ohlc


def test_kraken_pair_mapping_for_common_symbols():
    assert kraken_pair_for("BTC/USD") == "XXBTZUSD"
    assert kraken_pair_for("ETH/USD") == "XETHZUSD"
    assert kraken_pair_for("SOL/USD") == "SOLUSD"


def test_parse_ohlc_returns_candle_dicts():
    raw = [[1714320000, "100", "110", "90", "105", "101", "123.4", 12]]
    candles = parse_ohlc(raw)
    assert candles[0]["time"] == "2024-04-28T16:00:00Z"
    assert candles[0]["open"] == 100.0
    assert candles[0]["high"] == 110.0
    assert candles[0]["low"] == 90.0
    assert candles[0]["close"] == 105.0
    assert candles[0]["volume"] == 123.4
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
pytest -q tests/test_market_data.py
```

Expected: fail because `scripts.market_data` does not exist.

- [ ] **Step 3: Implement market-data helper**

Implement:

- `kraken_pair_for(pair: str) -> str`
- `parse_ohlc(raw_rows: list) -> list[dict]`
- `fetch_ohlc(pair: str, interval: int = 60) -> list[dict]`

Use only public Kraken REST:

```text
https://api.kraken.com/0/public/OHLC?pair=<PAIR>&interval=<INTERVAL>
```

No credentials, no account endpoints, no order endpoints.

- [ ] **Step 4: Run market-data tests**

Run:

```powershell
pytest -q tests/test_market_data.py
```

Expected: pass.

- [ ] **Step 5: Run full Python tests**

Run:

```powershell
pytest -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit market-data helper**

Run:

```powershell
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' add scripts/market_data.py tests/test_market_data.py
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' commit -m "feat: add public kraken market data helper"
```

---

## Task 7: Integrate CODEX v0 Into Strategy Leaderboard

**Files:**
- Create: `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\adapters\adapter_codex.js`
- Modify: `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\lib\fetch.js`
- Modify: `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\app.js`
- Modify: `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\registry.js`
- Modify: `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\adapters\adapters.test.js`
- Create: `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\fixtures\codex-portfolio.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\fixtures\codex-trade-log.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\data\codex\portfolio.md`
- Create: `C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\data\codex\trade_log.md`

- [ ] **Step 1: Copy exported snapshots into fixtures**

Run:

```powershell
Copy-Item -LiteralPath 'C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\data\codex\portfolio.md' -Destination 'C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\fixtures\codex-portfolio.md' -Force
Copy-Item -LiteralPath 'C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\data\codex\trade_log.md' -Destination 'C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard\fixtures\codex-trade-log.md' -Force
```

Expected: fixture files exist and show `$10,000.00` starting equity.

- [ ] **Step 2: Write failing Codex adapter test**

Append to `adapters/adapters.test.js`:

```js
import adaptCodex from './adapter_codex.js';

test('codex adapter returns normalized row from local markdown fixtures', async () => {
  const portfolio = readFixtureText('codex-portfolio.md');
  const tradeLog = readFixtureText('codex-trade-log.md');
  const row = adaptCodex(
    { portfolio: { ok: true, text: portfolio }, tradeLog: { ok: true, text: tradeLog } },
    { startingCapital: 10000 }
  );
  assert.equal(row.name, 'CODEX v0');
  assert.equal(row.status, 'live');
  assert.equal(row.trades_n, 0);
  assert.equal(row.returns['90d'], 0);
});
```

If `readFixtureText` does not exist, add this helper near existing fixture helpers:

```js
function readFixtureText(name) {
  return readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
}
```

- [ ] **Step 3: Run adapter test and verify failure**

Run:

```powershell
npm test -- adapters/adapters.test.js
```

Expected: fail because `adapter_codex.js` does not exist.

- [ ] **Step 4: Implement `adapter_codex.js`**

Use `adapter_bull.js` as the base. Differences:

- Name must be `CODEX v0`.
- Empty trade log should produce a live row with zero returns.
- Reuse `parseTradeLog`, `buildStrategyRow`, and `avgR`.

Implementation shape:

```js
import { parseTradeLog } from '../lib/parse_bull_md.js';
import { buildStrategyRow, makeErrorRow } from '../lib/strategy_row.js';
import { avgR } from '../lib/metrics.js';

export default function adaptCodex({ portfolio, tradeLog }, opts) {
  const errors = [];
  if (!portfolio || !portfolio.ok) errors.push('portfolio: ' + (portfolio?.error || 'missing'));
  if (!tradeLog || !tradeLog.ok) return makeErrorRow('CODEX v0', 'tradeLog: ' + (tradeLog?.error || 'missing'));

  const rows = parseTradeLog(tradeLog.text);
  const closes = rows.filter(r => r.action === 'CLOSE');
  const trips = closes.filter(r => r.pnl != null).map(r => ({ exit_time: r.time, pnl: r.pnl }));
  const rMultiples = closes.map(r => r.r).filter(r => r != null && !Number.isNaN(r));
  const lastSig = rows.length ? rows[rows.length - 1].time : null;
  const row = buildStrategyRow({
    name: 'CODEX v0',
    status: 'live',
    trips,
    rMultiples,
    startingCapital: opts.startingCapital,
    last_signal_at: lastSig,
    errors,
  });
  row.avg_r = avgR(rMultiples);
  return row;
}
```

- [ ] **Step 5: Add local fetch support**

In `lib/fetch.js`, add:

```js
export async function fetchLocalText(path) {
  try {
    const res = await fetchWithTimeout(path);
    const text = await res.text();
    return { ok: true, path, text };
  } catch (e) {
    return { ok: false, path, text: '', error: e.message };
  }
}
```

In `app.js`, import `fetchLocalText` and add a `codex-local` branch to `fetchOne`:

```js
if (strategy.source.type === 'codex-local') {
  const [portfolio, tradeLog] = await Promise.all([
    fetchLocalText(strategy.source.portfolio_path),
    fetchLocalText(strategy.source.trade_log_path),
  ]);
  return strategy.adapter({ portfolio, tradeLog }, { startingCapital: strategy.starting_capital });
}
```

- [ ] **Step 6: Add registry entry**

In `registry.js`, import `adaptCodex` and append:

```js
{
  name: 'CODEX v0',
  starting_capital: 10000,
  killswitch_dd_pct: 35,
  source: {
    type: 'codex-local',
    portfolio_path: 'data/codex/portfolio.md',
    trade_log_path: 'data/codex/trade_log.md',
  },
  adapter: adaptCodex,
}
```

- [ ] **Step 7: Run leaderboard tests**

Run:

```powershell
npm test
```

Expected: all tests pass, including the Codex adapter test.

- [ ] **Step 8: Commit leaderboard integration**

Run:

```powershell
git -C 'C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard' add adapters/adapter_codex.js lib/fetch.js app.js registry.js adapters/adapters.test.js fixtures/codex-portfolio.md fixtures/codex-trade-log.md data/codex/portfolio.md data/codex/trade_log.md
git -C 'C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard' commit -m "feat: add codex competitor row"
```

---

## Task 8: Verify End-To-End In Browser

**Files:**
- No planned source edits unless verification exposes a bug.

- [ ] **Step 1: Rebuild and export Codex state**

Run:

```powershell
python C:\Users\Mhair\OneDrive\Desktop\trading-codex\scripts\rebuild_portfolio.py
python C:\Users\Mhair\OneDrive\Desktop\trading-codex\scripts\validate_state.py
python C:\Users\Mhair\OneDrive\Desktop\trading-codex\scripts\export_leaderboard.py
```

Expected:

```text
OK: rebuilt portfolio
OK: state valid
OK: exported leaderboard snapshots
```

- [ ] **Step 2: Run all local tests**

Run:

```powershell
pytest -q
npm test
```

Expected:

- In `trading-codex`: all Python tests pass.
- In `strategy-leaderboard`: all Node tests pass.

- [ ] **Step 3: Open local dashboard**

Ensure server is running:

```powershell
python -m http.server 8123 --directory 'C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard'
```

Open:

```text
http://localhost:8123/
```

Expected:

- Dashboard loads without console errors.
- `CODEX v0` appears as a live row.
- `BULL v0` still appears.
- `CODEX v0` starts at `0.0` return with `0` trades.
- Sorting by `90d %`, `Trades`, and `Last sig` does not break.

- [ ] **Step 4: Capture verification notes**

Add one row to `C:\Users\Mhair\OneDrive\Desktop\trading-codex\memory\research_log.md`:

```markdown
| 2026-04-28T00:00:00Z | setup | validation | CODEX v0 scaffold exported to Strategy Leaderboard with tests passing | ready for paper competition |
```

Use the actual current UTC timestamp instead of the sample timestamp.

- [ ] **Step 5: Final commits**

Commit any verification-only Codex state update:

```powershell
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' add memory/research_log.md
git -C 'C:\Users\Mhair\OneDrive\Desktop\trading-codex' commit -m "chore: record codex setup verification"
```

If leaderboard data changed after export, commit it:

```powershell
git -C 'C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard' add data/codex/portfolio.md data/codex/trade_log.md
git -C 'C:\Users\Mhair\OneDrive\Desktop\strategy-leaderboard' commit -m "chore: refresh codex leaderboard snapshots"
```

Skip either commit only when `git status --short` shows no changes for that repo.

---

## Self-Review Checklist

- Spec coverage: Tasks create `trading-codex`, implement rebuild and validation scripts, implement sleeves and allocator, export snapshots, add `CODEX v0` to the leaderboard, and verify in browser.
- Safety coverage: No task uses exchange credentials, places real trades, moves money, or edits BULL files.
- Test coverage: Python tests cover rebuild, validation, sleeves, market data parsing, and export. Node tests cover the Codex adapter and existing leaderboard behavior.
- Integration coverage: Exported markdown snapshots feed a local `codex-local` leaderboard source.
- Acceptance coverage: End-to-end verification confirms `CODEX v0` appears next to BULL.

