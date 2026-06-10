# Hermes Stale Trade Sentinel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a review-only Hermes Stale Trade Sentinel that replays high-risk Regime Plus paper cycles and reports missed expected opens/closes.

**Architecture:** Add a replay-preview API to the Regime Plus worktree paper-cycle runner, then add a main `trading-codex` sentinel that consumes those replay previews and writes JSON/Markdown artifacts. Export those artifacts to `strategy-leaderboard`, parse them in Hermes Monitor, and update the Hermes automation to run the sentinel before export.

**Tech Stack:** Python 3, pytest, Node.js ES modules, node:test, existing Codex automation config.

---

## File Structure

- Modify `C:\trading\trading-codex\.worktrees\codex-regime-plus\scripts\paper_cycle.py`
  - Expose a non-mutating `preview_cycle_actions(...)` API and a `--replay-json` CLI path for Regime Plus high-risk strategy replay.
- Modify `C:\trading\trading-codex\.worktrees\codex-regime-plus\tests\test_paper_cycle.py`
  - Cover replay close/open output and prove replay does not write trade logs.
- Create `C:\trading\trading-codex\scripts\stale_trade_sentinel.py`
  - Run high-risk replay previews, classify findings, write `memory\hermes_stale_trade_sentinel.json` and `.md`, and update routine status.
- Create `C:\trading\trading-codex\tests\test_stale_trade_sentinel.py`
  - Cover close errors, open warnings, clean reports, unavailable data, artifact writes, and no trade-log mutation.
- Modify `C:\trading\trading-codex\scripts\export_leaderboard.py`
  - Export the sentinel JSON/Markdown artifacts.
- Modify `C:\trading\trading-codex\tests\test_export_leaderboard.py`
  - Cover export of sentinel artifacts.
- Modify `C:\trading\strategy-leaderboard\hermes_app.js`
  - Fetch sentinel JSON and Markdown.
- Modify `C:\trading\strategy-leaderboard\lib\hermes_monitor.js`
  - Parse sentinel artifacts and render a Stale Trade Sentinel panel.
- Modify `C:\trading\strategy-leaderboard\lib\hermes_monitor.test.js`
  - Cover parser, model summary, and rendered panel.
- Update Codex automation `codex-hermes-research-supervisor`
  - Add `python scripts\stale_trade_sentinel.py` before `python scripts\export_leaderboard.py`.

## Task 1: Add Regime Plus Replay Preview

**Files:**
- Modify: `C:\trading\trading-codex\.worktrees\codex-regime-plus\scripts\paper_cycle.py`
- Test: `C:\trading\trading-codex\.worktrees\codex-regime-plus\tests\test_paper_cycle.py`

- [ ] **Step 1: Write failing tests for non-mutating replay preview**

Append these tests to `C:\trading\trading-codex\.worktrees\codex-regime-plus\tests\test_paper_cycle.py`:

```python
def test_preview_cycle_actions_reports_expected_close_without_mutating_trade_log(tmp_path):
    from scripts.paper_cycle import preview_cycle_actions

    root = tmp_path / "codex"
    memory = root / "memory"
    memory.mkdir(parents=True)
    trade_log = memory / "regime_short_plus_trade_log.md"
    trade_log.write_text(
        "# CODEX Regime Short Plus v1 Trade Log\n\n"
        "## Entries\n"
        "| 2026-06-09T00:00:00Z | OPEN | ADA/USD | short | 10 | 100 | 106 | 88 | - | - | entry | regime_short_plus_trend |\n",
        encoding="utf-8",
    )
    before = trade_log.read_text(encoding="utf-8")

    replay = preview_cycle_actions(
        root=root,
        strategy="regime_short_plus",
        candles_by_pair={"ADA/USD": [candle("2026-06-10T04:00:00Z", 99)] * 40},
        candidates=[],
        time_stop_as_of="2026-06-10T04:00:00Z",
    )

    assert replay.strategy == "regime_short_plus"
    assert replay.strategy_name == "CODEX Regime Short Plus v1"
    assert replay.cycle_time == "2026-06-10T04:00:00Z"
    assert replay.data_status == "ok"
    assert len(replay.expected_close_rows) == 1
    assert replay.expected_close_actions[0]["action"] == "CLOSE"
    assert replay.expected_close_actions[0]["pair"] == "ADA/USD"
    assert replay.expected_close_actions[0]["sleeve"] == "regime_short_plus_trend"
    assert replay.expected_close_actions[0]["reason"] == "time-stop"
    assert replay.expected_open_rows == ()
    assert trade_log.read_text(encoding="utf-8") == before


def test_preview_cycle_actions_reports_expected_open_without_mutating_trade_log(tmp_path):
    from scripts.paper_cycle import preview_cycle_actions

    root = tmp_path / "codex"
    memory = root / "memory"
    memory.mkdir(parents=True)
    trade_log = memory / "regime_plus_ls_trade_log.md"
    trade_log.write_text("# CODEX Regime Plus L/S v1 Trade Log\n\n## Entries\n", encoding="utf-8")
    before = trade_log.read_text(encoding="utf-8")

    replay = preview_cycle_actions(
        root=root,
        strategy="regime_plus_ls",
        candles_by_pair={"LTC/USD": [candle("2026-06-10T04:00:00Z", 100)] * 40},
        candidates=[candidate("LTC/USD", "regime_plus_ls_trend", side="long")],
    )

    assert replay.strategy == "regime_plus_ls"
    assert replay.strategy_name == "CODEX Regime Plus L/S v1"
    assert replay.data_status == "ok"
    assert replay.expected_close_rows == ()
    assert len(replay.expected_open_rows) == 1
    assert replay.expected_open_actions[0]["action"] == "OPEN"
    assert replay.expected_open_actions[0]["pair"] == "LTC/USD"
    assert replay.expected_open_actions[0]["sleeve"] == "regime_plus_ls_trend"
    assert trade_log.read_text(encoding="utf-8") == before
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```powershell
cd C:\trading\trading-codex\.worktrees\codex-regime-plus
python -m pytest tests\test_paper_cycle.py::test_preview_cycle_actions_reports_expected_close_without_mutating_trade_log tests\test_paper_cycle.py::test_preview_cycle_actions_reports_expected_open_without_mutating_trade_log -q
```

Expected: both fail with `ImportError` or `AttributeError` because `preview_cycle_actions` does not exist.

- [ ] **Step 3: Add replay result data structure and action normalization**

In `C:\trading\trading-codex\.worktrees\codex-regime-plus\scripts\paper_cycle.py`, add this dataclass after `CycleResult`:

```python
@dataclass(frozen=True)
class CycleReplay:
    strategy: str
    strategy_name: str
    cycle_time: str
    data_source: str
    data_status: str
    fetch_errors: tuple[str, ...]
    expected_close_rows: tuple[str, ...]
    expected_open_rows: tuple[str, ...]
    expected_close_actions: tuple[dict[str, str], ...]
    expected_open_actions: tuple[dict[str, str], ...]
    skipped_reason: str | None = None
    trade_log_missing: bool = False

    def to_jsonable(self) -> dict[str, object]:
        return {
            "strategy": self.strategy,
            "strategy_name": self.strategy_name,
            "cycle_time": self.cycle_time,
            "data_source": self.data_source,
            "data_status": self.data_status,
            "fetch_errors": list(self.fetch_errors),
            "expected_close_rows": list(self.expected_close_rows),
            "expected_open_rows": list(self.expected_open_rows),
            "expected_close_actions": list(self.expected_close_actions),
            "expected_open_actions": list(self.expected_open_actions),
            "skipped_reason": self.skipped_reason,
            "trade_log_missing": self.trade_log_missing,
        }
```

Add this helper near `_open_row`:

```python
def _action_dict_from_row(row: str) -> dict[str, str]:
    event = parse_trade_log(row)[0]
    return {
        "time": event.time,
        "action": event.action,
        "pair": event.pair,
        "side": event.side,
        "sleeve": event.sleeve,
        "reason": event.reason,
    }
```

- [ ] **Step 4: Add the non-mutating preview function**

Add this function before `run_cycle(...)`:

```python
def preview_cycle_actions(
    *,
    root: Path = ROOT,
    strategy: str,
    candles_by_pair: dict[str, list[Candle]] | None = None,
    candidates: list[Candidate] | None = None,
    time_stop_as_of: str | None = None,
) -> CycleReplay:
    config = _config(strategy, root)
    memory = root / "memory"
    trade_log = memory / config["trade_log"]
    trade_log_missing = not trade_log.exists()
    events = parse_trade_log(trade_log.read_text(encoding="utf-8")) if trade_log.exists() else []

    fetch_errors: list[str] = []
    data_source = "provided"
    provided_candles = candles_by_pair is not None
    if candles_by_pair is None:
        candles_by_pair, fetch_errors, data_source = _fetch_candles_with_status(
            config["pairs"],
            root=root,
            interval=config["interval"],
        )

    cycle_time = _cycle_time(candles_by_pair)
    if not candles_by_pair:
        return CycleReplay(
            strategy=strategy,
            strategy_name=config["name"],
            cycle_time=cycle_time,
            data_source="none",
            data_status="data-unavailable",
            fetch_errors=tuple(fetch_errors),
            expected_close_rows=(),
            expected_open_rows=(),
            expected_close_actions=(),
            expected_open_actions=(),
            skipped_reason="market data unavailable",
            trade_log_missing=trade_log_missing,
        )

    close_rows = tuple(
        close_rows_for_open_positions(
            events,
            candles_by_pair,
            time_stop_hours=config["time_stop_hours"],
            time_stop_as_of=(
                time_stop_as_of
                if time_stop_as_of is not None
                else None if provided_candles else _utc_now_iso()
            ),
        )
    )
    mark_prices = {
        pair: candles[-1].close for pair, candles in candles_by_pair.items() if candles
    }
    cycle_already_recorded = _latest_event_time(events) >= cycle_time
    if cycle_already_recorded and not close_rows:
        return CycleReplay(
            strategy=strategy,
            strategy_name=config["name"],
            cycle_time=cycle_time,
            data_source=data_source,
            data_status="cache" if data_source == "cache" else "ok",
            fetch_errors=tuple(fetch_errors),
            expected_close_rows=(),
            expected_open_rows=(),
            expected_close_actions=(),
            expected_open_actions=(),
            skipped_reason="cycle already recorded",
            trade_log_missing=trade_log_missing,
        )

    events_after_closes = parse_trade_log(
        (trade_log.read_text(encoding="utf-8") if trade_log.exists() else "")
        + "\n".join(close_rows)
        + "\n"
    )
    if cycle_already_recorded:
        candidates = []
    elif candidates is None:
        candidates = config["candidate_fn"](candles_by_pair)

    allocations = config["allocator"](candidates, events_after_closes, mark_prices)
    open_rows = tuple(_open_row(cycle_time, allocation) for allocation in allocations)
    return CycleReplay(
        strategy=strategy,
        strategy_name=config["name"],
        cycle_time=cycle_time,
        data_source=data_source,
        data_status="cache" if data_source == "cache" else "ok",
        fetch_errors=tuple(fetch_errors),
        expected_close_rows=close_rows,
        expected_open_rows=open_rows,
        expected_close_actions=tuple(_action_dict_from_row(row) for row in close_rows),
        expected_open_actions=tuple(_action_dict_from_row(row) for row in open_rows),
        trade_log_missing=trade_log_missing,
    )
```

- [ ] **Step 5: Add replay JSON CLI mode**

Modify `main()` in the same file:

```python
parser.add_argument("--replay-json", action="store_true")
parser.add_argument("--time-stop-as-of", default=None)
```

After parsing args and before acquiring the automation lock, add:

```python
if args.replay_json:
    replay = preview_cycle_actions(
        strategy=args.strategy,
        time_stop_as_of=args.time_stop_as_of,
    )
    print(json.dumps(replay.to_jsonable(), indent=2, sort_keys=True))
    return 0
```

- [ ] **Step 6: Run replay tests and commit**

Run:

```powershell
cd C:\trading\trading-codex\.worktrees\codex-regime-plus
python -m pytest tests\test_paper_cycle.py -q
```

Expected: all tests pass.

Commit only the worktree replay changes:

```powershell
git add scripts\paper_cycle.py tests\test_paper_cycle.py
git commit -m "Add Regime Plus paper-cycle replay preview"
```

## Task 2: Build Main Stale Trade Sentinel

**Files:**
- Create: `C:\trading\trading-codex\scripts\stale_trade_sentinel.py`
- Test: `C:\trading\trading-codex\tests\test_stale_trade_sentinel.py`

- [ ] **Step 1: Write failing sentinel tests**

Create `C:\trading\trading-codex\tests\test_stale_trade_sentinel.py`:

```python
from datetime import datetime, timezone
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.stale_trade_sentinel import (
    HIGH_RISK_STRATEGIES,
    build_stale_trade_sentinel_report,
    write_stale_trade_sentinel_report,
)


def replay_payload(strategy, *, closes=(), opens=(), data_status="ok", error=None):
    if error:
        raise RuntimeError(error)
    return {
        "strategy": strategy,
        "strategy_name": {
            "regime_plus": "CODEX Regime Plus v1",
            "regime_short_plus": "CODEX Regime Short Plus v1",
            "regime_plus_ls": "CODEX Regime Plus L/S v1",
        }[strategy],
        "cycle_time": "2026-06-10T16:00:00Z",
        "data_source": "provided",
        "data_status": data_status,
        "fetch_errors": [],
        "expected_close_actions": list(closes),
        "expected_open_actions": list(opens),
        "expected_close_rows": [],
        "expected_open_rows": [],
        "skipped_reason": None,
        "trade_log_missing": False,
    }


def test_high_risk_strategy_list_is_regime_plus_only():
    assert [item["strategy"] for item in HIGH_RISK_STRATEGIES] == [
        "regime_plus",
        "regime_short_plus",
        "regime_plus_ls",
    ]


def test_expected_close_is_error():
    def fake_runner(strategy, **kwargs):
        return replay_payload(
            strategy,
            closes=[
                {
                    "time": "2026-06-10T16:00:00Z",
                    "action": "CLOSE",
                    "pair": "ADA/USD",
                    "side": "short",
                    "sleeve": "regime_short_plus_trend",
                    "reason": "time-stop",
                }
            ] if strategy == "regime_short_plus" else (),
        )

    report = build_stale_trade_sentinel_report(
        Path("C:/unused"),
        now=datetime(2026, 6, 10, 16, 5, tzinfo=timezone.utc),
        replay_runner=fake_runner,
    )

    assert report.status == "error"
    assert report.errors == 1
    assert report.findings[0].severity == "error"
    assert report.findings[0].strategy == "CODEX Regime Short Plus v1"
    assert report.findings[0].action == "CLOSE"
    assert "expected close is still pending" in report.findings[0].message


def test_expected_open_is_warning():
    def fake_runner(strategy, **kwargs):
        return replay_payload(
            strategy,
            opens=[
                {
                    "time": "2026-06-10T16:00:00Z",
                    "action": "OPEN",
                    "pair": "LTC/USD",
                    "side": "long",
                    "sleeve": "regime_plus_ls_trend",
                    "reason": "test-candidate",
                }
            ] if strategy == "regime_plus_ls" else (),
        )

    report = build_stale_trade_sentinel_report(
        Path("C:/unused"),
        now=datetime(2026, 6, 10, 16, 5, tzinfo=timezone.utc),
        replay_runner=fake_runner,
    )

    assert report.status == "warn"
    assert report.warnings == 1
    assert report.findings[0].severity == "warn"
    assert report.findings[0].action == "OPEN"
    assert "expected open is still pending" in report.findings[0].message


def test_clean_replay_has_no_findings():
    report = build_stale_trade_sentinel_report(
        Path("C:/unused"),
        now=datetime(2026, 6, 10, 16, 5, tzinfo=timezone.utc),
        replay_runner=lambda strategy, **kwargs: replay_payload(strategy),
    )

    assert report.status == "ok"
    assert report.errors == 0
    assert report.warnings == 0
    assert report.findings == []
    assert report.scanned == 3


def test_unavailable_data_creates_warning_not_trade_log_mutation(tmp_path):
    root = tmp_path / "codex"
    memory = root / "memory"
    memory.mkdir(parents=True)
    trade_log = memory / "regime_plus_ls_trade_log.md"
    trade_log.write_text("# unchanged\n", encoding="utf-8")

    report = build_stale_trade_sentinel_report(
        root,
        now=datetime(2026, 6, 10, 16, 5, tzinfo=timezone.utc),
        replay_runner=lambda strategy, **kwargs: replay_payload(strategy, data_status="data-unavailable"),
    )

    assert report.status == "warn"
    assert report.warnings == 3
    assert trade_log.read_text(encoding="utf-8") == "# unchanged\n"


def test_write_report_outputs_json_markdown_and_routine_status(tmp_path):
    root = tmp_path / "codex"
    report = write_stale_trade_sentinel_report(
        root,
        now=datetime(2026, 6, 10, 16, 5, tzinfo=timezone.utc),
        replay_runner=lambda strategy, **kwargs: replay_payload(strategy),
    )

    assert report.status == "ok"
    assert (root / "memory" / "hermes_stale_trade_sentinel.json").exists()
    markdown = (root / "memory" / "hermes_stale_trade_sentinel.md").read_text(encoding="utf-8")
    assert "# Hermes Stale Trade Sentinel" in markdown
    status = (root / "memory" / "routine_status.md").read_text(encoding="utf-8")
    assert "| hermes-stale-trade-sentinel | Hermes Stale Trade Sentinel | 2026-06-10T16:05:00Z | ok | local | scanned=3 errors=0 warnings=0 |" in status
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
cd C:\trading\trading-codex
python -m pytest tests\test_stale_trade_sentinel.py -q
```

Expected: fail with `ModuleNotFoundError: No module named 'scripts.stale_trade_sentinel'`.

- [ ] **Step 3: Implement sentinel data model and report builder**

Create `C:\trading\trading-codex\scripts\stale_trade_sentinel.py` with these top-level pieces:

```python
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import os

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.routine_status import update_routine_status


HIGH_RISK_STRATEGIES = (
    {"strategy": "regime_plus", "name": "CODEX Regime Plus v1"},
    {"strategy": "regime_short_plus", "name": "CODEX Regime Short Plus v1"},
    {"strategy": "regime_plus_ls", "name": "CODEX Regime Plus L/S v1"},
)


@dataclass(frozen=True)
class StaleTradeFinding:
    severity: str
    strategy: str
    action: str
    pair: str
    sleeve: str
    reason: str
    cycle_time: str
    message: str


@dataclass(frozen=True)
class StaleTradeReport:
    generated_at: str
    status: str
    scanned: int
    errors: int
    warnings: int
    findings: list[StaleTradeFinding]
    strategy_results: list[dict[str, object]]

    def to_jsonable(self) -> dict[str, object]:
        return {
            "version": 1,
            "generated_at": self.generated_at,
            "status": self.status,
            "scanned": self.scanned,
            "errors": self.errors,
            "warnings": self.warnings,
            "findings": [finding.__dict__ for finding in self.findings],
            "strategy_results": self.strategy_results,
        }
```

Add `_iso`, `_default_worktree_root`, `_run_worktree_replay`, `_finding_for_action`, `_strategy_result_findings`, `build_stale_trade_sentinel_report`, `render_markdown`, `_write_atomic_text`, `write_stale_trade_sentinel_report`, and `main` in the same file. Use these exact behavior rules:

```python
def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _default_worktree_root(root: Path) -> Path:
    return root / ".worktrees" / "codex-regime-plus"


def _run_worktree_replay(strategy: str, *, root: Path, worktree_root: Path, now_iso: str) -> dict[str, object]:
    command = [
        sys.executable,
        str(worktree_root / "scripts" / "paper_cycle.py"),
        "--strategy",
        strategy,
        "--replay-json",
        "--time-stop-as-of",
        now_iso,
    ]
    completed = subprocess.run(
        command,
        cwd=str(worktree_root),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip() or f"replay failed for {strategy}")
    return json.loads(completed.stdout)


def _finding_for_action(severity: str, strategy_name: str, action: dict[str, object], message: str) -> StaleTradeFinding:
    return StaleTradeFinding(
        severity=severity,
        strategy=strategy_name,
        action=str(action.get("action") or "-"),
        pair=str(action.get("pair") or "-"),
        sleeve=str(action.get("sleeve") or "-"),
        reason=str(action.get("reason") or "-"),
        cycle_time=str(action.get("time") or "-"),
        message=message,
    )
```

For `_strategy_result_findings`, implement:

```python
def _strategy_result_findings(result: dict[str, object]) -> list[StaleTradeFinding]:
    strategy_name = str(result.get("strategy_name") or result.get("strategy") or "unknown")
    cycle_time = str(result.get("cycle_time") or "-")
    findings: list[StaleTradeFinding] = []
    for action in result.get("expected_close_actions") or []:
        findings.append(
            _finding_for_action(
                "error",
                strategy_name,
                action,
                "paper-cycle replay expected close is still pending in the current paper state",
            )
        )
    for action in result.get("expected_open_actions") or []:
        findings.append(
            _finding_for_action(
                "warn",
                strategy_name,
                action,
                "paper-cycle replay expected open is still pending in the current paper state",
            )
        )
    if result.get("data_status") in {"data-unavailable", "none"}:
        findings.append(
            StaleTradeFinding(
                severity="warn",
                strategy=strategy_name,
                action="DATA",
                pair="-",
                sleeve="-",
                reason=str(result.get("skipped_reason") or "market data unavailable"),
                cycle_time=cycle_time,
                message="paper-cycle replay could not evaluate because market data was unavailable",
            )
        )
    if result.get("trade_log_missing"):
        findings.append(
            StaleTradeFinding(
                severity="warn",
                strategy=strategy_name,
                action="LOG",
                pair="-",
                sleeve="-",
                reason="trade log missing",
                cycle_time=cycle_time,
                message="paper-cycle replay could not read the expected trade log",
            )
        )
    return findings
```

- [ ] **Step 4: Implement report writes and CLI**

Complete the same file with:

```python
def build_stale_trade_sentinel_report(
    root: Path = ROOT,
    *,
    worktree_root: Path | None = None,
    now: datetime | None = None,
    replay_runner=None,
) -> StaleTradeReport:
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    now_iso = _iso(now)
    worktree_root = worktree_root or _default_worktree_root(root)
    replay_runner = replay_runner or _run_worktree_replay

    findings: list[StaleTradeFinding] = []
    strategy_results: list[dict[str, object]] = []
    for item in HIGH_RISK_STRATEGIES:
        strategy = item["strategy"]
        try:
            result = replay_runner(strategy, root=root, worktree_root=worktree_root, now_iso=now_iso)
            result.setdefault("strategy", strategy)
            result.setdefault("strategy_name", item["name"])
            result["evaluated"] = True
        except Exception as exc:
            result = {
                "strategy": strategy,
                "strategy_name": item["name"],
                "cycle_time": now_iso,
                "data_status": "replay-error",
                "evaluated": False,
                "error": str(exc),
            }
            findings.append(
                StaleTradeFinding(
                    severity="warn",
                    strategy=item["name"],
                    action="REPLAY",
                    pair="-",
                    sleeve="-",
                    reason="replay-error",
                    cycle_time=now_iso,
                    message=str(exc),
                )
            )
        findings.extend(_strategy_result_findings(result))
        strategy_results.append(result)

    errors = sum(1 for finding in findings if finding.severity == "error")
    warnings = sum(1 for finding in findings if finding.severity == "warn")
    evaluated = sum(1 for result in strategy_results if result.get("evaluated"))
    status = "error" if errors or evaluated == 0 else "warn" if warnings else "ok"
    return StaleTradeReport(
        generated_at=now_iso,
        status=status,
        scanned=len(HIGH_RISK_STRATEGIES),
        errors=errors,
        warnings=warnings,
        findings=findings,
        strategy_results=strategy_results,
    )


def render_markdown(report: StaleTradeReport) -> str:
    lines = [
        "# Hermes Stale Trade Sentinel",
        "",
        "> Review-only paper-cycle replay for high-risk Regime Plus strategies.",
        "",
        f"- Generated UTC: {report.generated_at}",
        f"- Status: {report.status}",
        f"- Strategies scanned: {report.scanned}",
        f"- Errors: {report.errors}",
        f"- Warnings: {report.warnings}",
        "",
        "| Severity | Strategy | Action | Pair | Sleeve | Reason | Cycle time | Finding |",
        "|----------|----------|--------|------|--------|--------|------------|---------|",
    ]
    if report.findings:
        for finding in report.findings:
            lines.append(
                f"| {finding.severity} | {finding.strategy} | {finding.action} | {finding.pair} | "
                f"{finding.sleeve} | {finding.reason} | {finding.cycle_time} | {finding.message} |"
            )
    else:
        lines.append("| ok | high-risk Regime Plus | - | - | - | - | - | replay and paper state agree |")
    return "\n".join(lines) + "\n"


def _write_atomic_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8", dir=path.parent) as handle:
        handle.write(text)
        temp_name = handle.name
    os.replace(temp_name, path)


def write_stale_trade_sentinel_report(
    root: Path = ROOT,
    *,
    worktree_root: Path | None = None,
    now: datetime | None = None,
    replay_runner=None,
) -> StaleTradeReport:
    report = build_stale_trade_sentinel_report(
        root,
        worktree_root=worktree_root,
        now=now,
        replay_runner=replay_runner,
    )
    memory = root / "memory"
    _write_atomic_text(
        memory / "hermes_stale_trade_sentinel.json",
        json.dumps(report.to_jsonable(), indent=2, sort_keys=True) + "\n",
    )
    _write_atomic_text(memory / "hermes_stale_trade_sentinel.md", render_markdown(report))
    update_routine_status(
        root,
        routine="hermes-stale-trade-sentinel",
        strategy="Hermes Stale Trade Sentinel",
        status=report.status,
        data_source="local",
        message=f"scanned={report.scanned} errors={report.errors} warnings={report.warnings}",
        timestamp=report.generated_at,
    )
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the Hermes stale trade sentinel.")
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--worktree-root", type=Path, default=None)
    parser.add_argument("--fail-on-error", action="store_true")
    args = parser.parse_args(argv)
    report = write_stale_trade_sentinel_report(args.root, worktree_root=args.worktree_root)
    print(
        f"OK: stale trade sentinel status={report.status} "
        f"errors={report.errors} warnings={report.warnings} scanned={report.scanned}"
    )
    if args.fail_on_error and report.errors:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 5: Run sentinel tests and commit**

Run:

```powershell
cd C:\trading\trading-codex
python -m pytest tests\test_stale_trade_sentinel.py -q
```

Expected: all tests pass.

Commit only sentinel files:

```powershell
git add scripts\stale_trade_sentinel.py tests\test_stale_trade_sentinel.py
git commit -m "Add Hermes stale trade sentinel"
```

## Task 3: Export Sentinel Artifacts

**Files:**
- Modify: `C:\trading\trading-codex\scripts\export_leaderboard.py`
- Test: `C:\trading\trading-codex\tests\test_export_leaderboard.py`

- [ ] **Step 1: Write failing export test**

Append to `C:\trading\trading-codex\tests\test_export_leaderboard.py`:

```python
def test_export_snapshots_copies_stale_trade_sentinel_outputs_when_present(tmp_path):
    source = tmp_path / "codex"
    dest = tmp_path / "leaderboard" / "data" / "codex"
    memory = source / "memory"
    memory.mkdir(parents=True)
    (memory / "portfolio.md").write_text("# Portfolio\n", encoding="utf-8")
    (memory / "trade_log.md").write_text("# Trade Log\n", encoding="utf-8")
    (memory / "hermes_stale_trade_sentinel.md").write_text("# Sentinel\n", encoding="utf-8")
    (memory / "hermes_stale_trade_sentinel.json").write_text('{"status":"ok"}\n', encoding="utf-8")

    export_snapshots(source, dest)

    assert (dest / "hermes_stale_trade_sentinel.md").read_text(encoding="utf-8") == "# Sentinel\n"
    assert (dest / "hermes_stale_trade_sentinel.json").read_text(encoding="utf-8") == '{"status":"ok"}\n'
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
cd C:\trading\trading-codex
python -m pytest tests\test_export_leaderboard.py::test_export_snapshots_copies_stale_trade_sentinel_outputs_when_present -q
```

Expected: fail because exported files are missing.

- [ ] **Step 3: Add optional snapshots**

In `C:\trading\trading-codex\scripts\export_leaderboard.py`, add to `OPTIONAL_SNAPSHOTS` next to the Hermes artifacts:

```python
"hermes_stale_trade_sentinel.md": "hermes_stale_trade_sentinel.md",
"hermes_stale_trade_sentinel.json": "hermes_stale_trade_sentinel.json",
```

- [ ] **Step 4: Run export tests and commit**

Run:

```powershell
cd C:\trading\trading-codex
python -m pytest tests\test_export_leaderboard.py -q
```

Expected: all export tests pass.

Commit:

```powershell
git add scripts\export_leaderboard.py tests\test_export_leaderboard.py
git commit -m "Export Hermes stale trade sentinel artifacts"
```

## Task 4: Render Sentinel In Hermes Monitor

**Files:**
- Modify: `C:\trading\strategy-leaderboard\hermes_app.js`
- Modify: `C:\trading\strategy-leaderboard\lib\hermes_monitor.js`
- Test: `C:\trading\strategy-leaderboard\lib\hermes_monitor.test.js`

- [ ] **Step 1: Write failing monitor tests**

Append to `C:\trading\strategy-leaderboard\lib\hermes_monitor.test.js`:

```javascript
test('buildHermesMonitorModel parses stale trade sentinel artifact', () => {
  const model = buildHermesMonitorModel({
    codexQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    claudeQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    modeText: '{"mode":"review_only"}',
    reviewText: '# Hermes review\n\n- safety: No strategy state was changed.\n',
    staleTradeSentinelText: JSON.stringify({
      version: 1,
      generated_at: '2026-06-10T16:05:00Z',
      status: 'error',
      scanned: 3,
      errors: 1,
      warnings: 1,
      findings: [
        {
          severity: 'error',
          strategy: 'CODEX Regime Short Plus v1',
          action: 'CLOSE',
          pair: 'ADA/USD',
          sleeve: 'regime_short_plus_trend',
          reason: 'time-stop',
          cycle_time: '2026-06-10T16:00:00Z',
          message: 'paper-cycle replay expected close is still pending in the current paper state',
        },
      ],
    }),
  });

  assert.equal(model.staleTradeSentinel.exported, true);
  assert.equal(model.staleTradeSentinel.status, 'error');
  assert.equal(model.staleTradeSentinel.scanned, 3);
  assert.equal(model.staleTradeSentinel.findings[0].pair, 'ADA/USD');
});


test('renderHermesMonitorHtml renders stale trade sentinel panel', () => {
  const html = renderHermesMonitorHtml(buildHermesMonitorModel({
    codexQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    claudeQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    modeText: '{"mode":"review_only"}',
    reviewText: '# Hermes review\n\n- safety: No strategy state was changed.\n',
    staleTradeSentinelText: JSON.stringify({
      generated_at: '2026-06-10T16:05:00Z',
      status: 'warn',
      scanned: 3,
      errors: 0,
      warnings: 1,
      findings: [
        {
          severity: 'warn',
          strategy: 'CODEX Regime Plus L/S v1',
          action: 'OPEN',
          pair: 'LTC/USD',
          sleeve: 'regime_plus_ls_trend',
          reason: 'test-candidate',
          cycle_time: '2026-06-10T16:00:00Z',
          message: 'paper-cycle replay expected open is still pending in the current paper state',
        },
      ],
    }),
  }));

  assert.match(html, /Stale Trade Sentinel/);
  assert.match(html, /CODEX Regime Plus L\/S v1/);
  assert.match(html, /LTC\/USD/);
  assert.match(html, /review-only/);
});
```

- [ ] **Step 2: Run monitor tests and verify failure**

Run:

```powershell
cd C:\trading\strategy-leaderboard
node --test lib\hermes_monitor.test.js
```

Expected: fail because `model.staleTradeSentinel` is undefined and the panel is not rendered.

- [ ] **Step 3: Fetch sentinel artifacts in the app**

In `C:\trading\strategy-leaderboard\hermes_app.js`, extend `PATHS`:

```javascript
staleTradeSentinel: 'data/codex/hermes_stale_trade_sentinel.json',
staleTradeSentinelMarkdown: 'data/codex/hermes_stale_trade_sentinel.md',
```

Add two fetches to the `Promise.all` list and pass into `buildHermesMonitorModel`:

```javascript
staleTradeSentinelText: staleTradeSentinelResp.ok ? staleTradeSentinelResp.text : '',
staleTradeSentinelMarkdownText: staleTradeSentinelMarkdownResp.ok ? staleTradeSentinelMarkdownResp.text : '',
```

- [ ] **Step 4: Add parser/model/rendering in Hermes monitor**

In `C:\trading\strategy-leaderboard\lib\hermes_monitor.js`, add:

```javascript
function parseStaleTradeSentinelText(text) {
  if (!text || !text.trim()) {
    return {
      exported: false,
      generatedAt: '',
      status: 'pending',
      scanned: 0,
      errors: 0,
      warnings: 0,
      findings: [],
      summary: 'stale trade sentinel not exported',
    };
  }
  try {
    const data = JSON.parse(text);
    const findings = Array.isArray(data.findings) ? data.findings.map(finding => ({
      severity: String(finding.severity || 'warn'),
      strategy: String(finding.strategy || 'Unknown strategy'),
      action: String(finding.action || '-'),
      pair: String(finding.pair || '-'),
      sleeve: String(finding.sleeve || '-'),
      reason: String(finding.reason || '-'),
      cycleTime: String(finding.cycle_time || finding.cycleTime || '-'),
      message: String(finding.message || ''),
    })) : [];
    const status = String(data.status || (findings.length ? 'warn' : 'ok'));
    return {
      exported: true,
      generatedAt: String(data.generated_at || data.generatedAt || ''),
      status,
      scanned: Number(data.scanned || 0),
      errors: Number(data.errors || findings.filter(finding => finding.severity === 'error').length),
      warnings: Number(data.warnings || findings.filter(finding => finding.severity === 'warn').length),
      findings,
      summary: `${status} errors=${Number(data.errors || 0)} warnings=${Number(data.warnings || 0)}`,
    };
  } catch {
    return {
      exported: true,
      generatedAt: '',
      status: 'warn',
      scanned: 0,
      errors: 0,
      warnings: 1,
      findings: [{
        severity: 'warn',
        strategy: 'Hermes Stale Trade Sentinel',
        action: 'PARSE',
        pair: '-',
        sleeve: '-',
        reason: 'unreadable-json',
        cycleTime: '-',
        message: 'sentinel artifact could not be parsed',
      }],
      summary: 'sentinel artifact could not be parsed',
    };
  }
}
```

Inside `buildHermesMonitorModel`, add:

```javascript
const staleTradeSentinel = parseStaleTradeSentinelText(input.staleTradeSentinelText || '');
```

Return it as:

```javascript
staleTradeSentinel,
```

Add this render helper:

```javascript
function staleTradeSentinelHtml(sentinel) {
  const rows = sentinel.findings.length
    ? sentinel.findings.slice(0, 8).map(finding => `
      <article class="hypothesis-row">
        <div>
          <strong>${escapeHtml(finding.strategy)}</strong>
          <span class="dim">${escapeHtml(finding.cycleTime)}</span>
        </div>
        <span class="status-pill status-${escapeHtml(finding.severity === 'error' ? 'warn' : finding.severity)}">${escapeHtml(finding.action)}</span>
        <p>${escapeHtml(`${finding.pair} ${finding.sleeve}: ${finding.message}`)}</p>
      </article>
    `).join('')
    : '<div class="empty-monitor">No high-risk Regime Plus replay findings.</div>';
  return `
    <section class="monitor-panel full-width" aria-label="Stale Trade Sentinel">
      <div class="panel-head">
        <h2>Stale Trade Sentinel</h2>
        <span class="status-pill status-${escapeHtml(sentinel.status === 'error' ? 'warn' : sentinel.status)}">${escapeHtml(sentinel.exported ? sentinel.status : 'pending')}</span>
      </div>
      <p class="dim">review-only replay · scanned ${escapeHtml(sentinel.scanned)} high-risk strategies · errors ${escapeHtml(sentinel.errors)} · warnings ${escapeHtml(sentinel.warnings)}</p>
      <div class="hypothesis-list">${rows}</div>
    </section>
  `;
}
```

Insert `${staleTradeSentinelHtml(model.staleTradeSentinel)}` after the Run Health/Queue/Railway block and before Hypotheses.

- [ ] **Step 5: Run leaderboard tests and commit**

Run:

```powershell
cd C:\trading\strategy-leaderboard
node --test lib\hermes_monitor.test.js
npm test
```

Expected: all tests pass.

Commit:

```powershell
git add hermes_app.js lib\hermes_monitor.js lib\hermes_monitor.test.js
git commit -m "Show Hermes stale trade sentinel"
```

## Task 5: Wire Automation And Verify End To End

**Files:**
- Automation: `codex-hermes-research-supervisor`
- Runtime artifacts: `C:\trading\trading-codex\memory\hermes_stale_trade_sentinel.*`
- Exported artifacts: `C:\trading\strategy-leaderboard\data\codex\hermes_stale_trade_sentinel.*`

- [ ] **Step 1: Run the sentinel manually**

Run:

```powershell
cd C:\trading\trading-codex
python scripts\stale_trade_sentinel.py
```

Expected output starts with:

```text
OK: stale trade sentinel status=
```

Confirm artifacts exist:

```powershell
Test-Path memory\hermes_stale_trade_sentinel.json
Test-Path memory\hermes_stale_trade_sentinel.md
```

Expected:

```text
True
True
```

- [ ] **Step 2: Export and verify leaderboard artifacts**

Run:

```powershell
cd C:\trading\trading-codex
python scripts\export_leaderboard.py
```

Expected:

```text
OK: exported leaderboard snapshots
```

Confirm exported files:

```powershell
Test-Path C:\trading\strategy-leaderboard\data\codex\hermes_stale_trade_sentinel.json
Test-Path C:\trading\strategy-leaderboard\data\codex\hermes_stale_trade_sentinel.md
```

Expected:

```text
True
True
```

- [ ] **Step 3: Update Hermes automation prompt**

Use `codex_app.automation_update` in update mode for `codex-hermes-research-supervisor`. Preserve the existing schedule, model, reasoning effort, status, execution environment, and `cwds`. Replace the prompt with:

```text
Run the paper-only Hermes Research Supervisor, stale trade sentinel, and review cycle. In C:\trading\trading-codex, run `python scripts\hermes_supervisor.py`, then `python scripts\stale_trade_sentinel.py`, then `python scripts\hermes_review_cycle.py`, then `python scripts\export_leaderboard.py`. Inspect `memory\hermes_supervisor_report.md`, `memory\hermes_experiment_queue.json`, `memory\hermes_stale_trade_sentinel.md`, `memory\hermes_stale_trade_sentinel.json`, `memory\hermes_review.md`, `memory\hypothesis_ledger.md`, and `memory\routine_status.md`, then report queue counts, new hypothesis count, stale trade sentinel status, top replay findings, top repair items, top experiment items, and any failures. Do not modify live routing, paper trade logs, portfolios, optimized WFO configs, foundry variant banks, broker/exchange settings, real order endpoints, or automation schedules.
```

- [ ] **Step 4: Run focused Python verification**

Run:

```powershell
cd C:\trading\trading-codex\.worktrees\codex-regime-plus
python -m pytest tests\test_paper_cycle.py tests\test_open_trade_health.py -q

cd C:\trading\trading-codex
python -m pytest tests\test_stale_trade_sentinel.py tests\test_export_leaderboard.py tests\test_automation_lock.py -q
```

Expected: both commands pass.

- [ ] **Step 5: Run leaderboard verification**

Run:

```powershell
cd C:\trading\strategy-leaderboard
npm test
npm run smoke
node --test scripts\codex_snapshot_integrity.test.js scripts\registry.test.js
```

Expected:

- `npm test` passes
- `npm run smoke` reports all strategy rows valid
- snapshot integrity and registry tests pass

- [ ] **Step 6: Confirm protected CODEX rows and strategy count**

Run:

```powershell
cd C:\trading\strategy-leaderboard
node --input-type=module -e "import { STRATEGIES, effectiveCutoff } from './registry.js'; import { readFileSync } from 'node:fs'; const protectedNames=['CODEX v0','CODEX Aggro v0','CODEX Pulse v0','CODEX Regime v0','CODEX Apex v0','CODEX Regime WFO v1','CODEX Apex WFO v1']; console.log('strategy_count='+STRATEGIES.length); for (const name of protectedNames) { const strategy=STRATEGIES.find(s=>s.name===name); if (!strategy) throw new Error(name+' missing'); const portfolio=readFileSync(strategy.source.portfolio_path,'utf8'); const tradeLog=readFileSync(strategy.source.trade_log_path,'utf8'); const row=strategy.adapter({portfolio:{ok:true,text:portfolio},tradeLog:{ok:true,text:tradeLog}},{startingCapital:strategy.starting_capital,name:strategy.name,status:strategy.status,liveStartIso:effectiveCutoff(strategy.live_start_iso)}); console.log(name+' trades='+row.trades_n); if (!row.trades_n) throw new Error(name+' has empty forward trade history'); }"
```

Expected: `strategy_count` matches the count before implementation work, and all protected CODEX rows print `trades=` with a non-zero value.

- [ ] **Step 7: Confirm no source/test work remains unstaged**

The previous tasks include commits for all source and test changes. The automation config update is stored by the Codex app and does not require a git commit. Confirm there are no remaining source/test diffs in either repo:

```powershell
cd C:\trading\trading-codex
git diff --name-only -- scripts tests

cd C:\trading\strategy-leaderboard
git diff --name-only -- hermes_app.js lib
```

Expected: no output from either command. If output appears, review those exact files before final response. Do not stage generated data snapshots, lock files, temporary folders, or unrelated dirty worktree changes.

## Self-Review Checklist

- Spec coverage:
  - High-risk strategies only: Task 2 `HIGH_RISK_STRATEGIES`.
  - Paper-cycle replay, not passive age check: Task 1 preview API and Task 2 sentinel.
  - Review-only: Task 2 writes reports only; Task 5 automation prompt forbids state mutation.
  - Export to leaderboard: Task 3.
  - Hermes Monitor panel: Task 4.
  - Protected leaderboard safety: Task 5 Step 6.
- Type consistency:
  - Replay JSON uses `expected_close_actions`, `expected_open_actions`, `data_status`, `strategy_name`, and `cycle_time`.
  - Sentinel JSON uses `generated_at`, `status`, `scanned`, `errors`, `warnings`, and `findings`.
  - Monitor parser accepts snake_case fields and normalizes `cycle_time` to `cycleTime`.
- Dirty worktree rule:
  - Stage exact files only.
  - Leave generated snapshots, lock files, and unrelated existing changes untouched.
