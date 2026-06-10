# Hermes Missed Trade Auditor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a review-only Hermes Missed Trade Auditor that replays high-risk Regime Plus paper-cycle expectations, checks recorded paper evidence, and reports missed opens/closes.

**Architecture:** Add a Python auditor in `C:\trading\trading-codex` that reuses the existing stale sentinel replay contract and high-risk strategy list. The auditor reads high-risk evidence from the Regime Plus worktree trade logs and worktree `memory\routine_status.md`, optionally reads `memory\trade_forensics.md` from the worktree or main root when available, writes JSON/Markdown artifacts in main memory, exports them to the leaderboard, and renders a new Hermes Monitor panel below Stale Trade Sentinel.

**Tech Stack:** Python 3, pytest, existing Codex routine-status helper, Node.js ES modules, node:test, Codex automation tools.

---

## File Structure

- Create `C:\trading\trading-codex\scripts\missed_trade_auditor.py`
  - Own the audit model, trade-log parser, evidence parser, expected-vs-recorded matching, Markdown rendering, atomic artifact writes, routine-status update, and CLI.
- Create `C:\trading\trading-codex\tests\test_missed_trade_auditor.py`
  - Cover missed close errors, missed open warnings, matched actions, replay/data warnings, routine/forensics blockers, artifact writes, and CLI behavior.
- Modify `C:\trading\trading-codex\scripts\export_leaderboard.py`
  - Add `hermes_missed_trade_auditor.md` and `hermes_missed_trade_auditor.json` to optional exported snapshots.
- Modify `C:\trading\trading-codex\tests\test_export_leaderboard.py`
  - Cover export of the auditor JSON/Markdown artifacts.
- Modify `C:\trading\strategy-leaderboard\hermes_app.js`
  - Fetch the auditor JSON and pass it into the Hermes monitor model.
- Modify `C:\trading\strategy-leaderboard\lib\hermes_monitor.js`
  - Parse the auditor artifact and render a Missed Trade Auditor panel below Stale Trade Sentinel.
- Modify `C:\trading\strategy-leaderboard\lib\hermes_monitor.test.js`
  - Cover parser/model output and rendered panel output.
- Update Codex automation `codex-hermes-research-supervisor`
  - Add `python scripts\missed_trade_auditor.py` after `python scripts\stale_trade_sentinel.py` and before `python scripts\hermes_review_cycle.py`.

## Task 1: Build The Auditor Core

**Files:**
- Create: `C:\trading\trading-codex\scripts\missed_trade_auditor.py`
- Test: `C:\trading\trading-codex\tests\test_missed_trade_auditor.py`

- [ ] **Step 1: Write the failing auditor tests**

Create `C:\trading\trading-codex\tests\test_missed_trade_auditor.py` with this content:

```python
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import scripts.missed_trade_auditor as auditor
from scripts.missed_trade_auditor import (
    build_missed_trade_auditor_report,
    main,
    write_missed_trade_auditor_report,
)


STRATEGY_NAMES = {
    "regime_plus": "CODEX Regime Plus v1",
    "regime_short_plus": "CODEX Regime Short Plus v1",
    "regime_plus_ls": "CODEX Regime Plus L/S v1",
}


TRADE_LOG_FILES = {
    "regime_plus": "regime_plus_trade_log.md",
    "regime_short_plus": "regime_short_plus_trade_log.md",
    "regime_plus_ls": "regime_plus_ls_trade_log.md",
}


def replay_payload(strategy, *, closes=(), opens=(), data_status="ok", trade_log_missing=False):
    return {
        "strategy": strategy,
        "strategy_name": STRATEGY_NAMES[strategy],
        "cycle_time": "2026-06-10T16:00:00Z",
        "data_source": "provided",
        "data_status": data_status,
        "fetch_errors": [],
        "expected_close_actions": list(closes),
        "expected_open_actions": list(opens),
        "expected_close_rows": [],
        "expected_open_rows": [],
        "skipped_reason": None,
        "trade_log_missing": trade_log_missing,
    }


def expected_action(action, pair="ADA/USD", sleeve="regime_short_plus_trend", reason="time-stop"):
    return {
        "action": action,
        "pair": pair,
        "sleeve": sleeve,
        "reason": reason,
        "time": "2026-06-10T16:00:00Z",
    }


def trade_row(timestamp, event, pair="ADA/USD", sleeve="regime_short_plus_trend", reason="time-stop"):
    return (
        f"| {timestamp} | {event} | {pair} | short | 1.000000 | 100.0000 | - | - | - | - | "
        f"{reason} | {sleeve} |\n"
    )


def write_trade_logs(worktree_root, rows_by_strategy=None):
    memory = worktree_root / "memory"
    memory.mkdir(parents=True)
    rows_by_strategy = rows_by_strategy or {}
    for strategy, filename in TRADE_LOG_FILES.items():
        rows = rows_by_strategy.get(strategy, "")
        (memory / filename).write_text(
            f"# {STRATEGY_NAMES[strategy]} Trade Log\n\n"
            "## Entries\n\n"
            "| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |\n"
            "|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|\n"
            f"{rows}",
            encoding="utf-8",
        )


def write_routine_status(root, message="cycle complete"):
    memory = root / "memory"
    memory.mkdir(parents=True)
    rows = "\n".join(
        f"| live-paper | {name} | 2026-06-10T16:01:00Z | ok | local | {message} |"
        for name in STRATEGY_NAMES.values()
    )
    (memory / "routine_status.md").write_text(
        "# CODEX Routine Status\n\n"
        "| Routine | Strategy | Timestamp UTC | Status | Data source | Message |\n"
        "|---------|----------|---------------|--------|-------------|---------|\n"
        f"{rows}\n",
        encoding="utf-8",
    )


def write_trade_forensics(root, *, quality="ok", blockers="-", warnings="-"):
    memory = root / "memory"
    memory.mkdir(parents=True)
    rows = "\n".join(
        "| 2026-06-10T16:01:00Z | {name} | 2026-06-10T16:00:00Z | local | {quality} | ADA/USD | {warnings} | {blockers} | 0 | 0 | - | - | 0 |".format(
            name=name,
            quality=quality,
            warnings=warnings,
            blockers=blockers,
        )
        for name in STRATEGY_NAMES.values()
    )
    (memory / "trade_forensics.md").write_text(
        "# Trade Forensics\n\n"
        "| Recorded (UTC) | Strategy | Cycle time | Data source | Quality | Symbols checked | Warnings | Blockers | Opened | Closed | Open reason tags | Close reason tags | Candidates |\n"
        "|----------------|----------|------------|-------------|---------|-----------------|----------|----------|--------|--------|------------------|-------------------|------------|\n"
        f"{rows}\n",
        encoding="utf-8",
    )


def clean_replay_runner(strategy, **_kwargs):
    return replay_payload(strategy)


def prepare_clean_evidence(tmp_path):
    worktree_root = tmp_path / ".worktrees" / "codex-regime-plus"
    write_trade_logs(worktree_root)
    write_routine_status(worktree_root)
    write_trade_forensics(worktree_root)
    return worktree_root


def test_expected_close_without_matching_log_row_becomes_error(tmp_path):
    worktree_root = prepare_clean_evidence(tmp_path)

    def replay_runner(strategy, **_kwargs):
        if strategy == "regime_short_plus":
            return replay_payload(strategy, closes=[expected_action("CLOSE")])
        return replay_payload(strategy)

    report = build_missed_trade_auditor_report(
        root=tmp_path,
        worktree_root=worktree_root,
        now=datetime(2026, 6, 10, 16, 5, tzinfo=timezone.utc),
        replay_runner=replay_runner,
    )

    assert report.status == "error"
    assert report.errors == 1
    assert report.warnings == 0
    assert report.audits[1].expected_closes == 1
    assert report.audits[1].matched_closes == 0
    assert report.findings[0].severity == "error"
    assert report.findings[0].action == "CLOSE"
    assert report.findings[0].pair == "ADA/USD"


def test_expected_open_without_matching_log_row_becomes_warning(tmp_path):
    worktree_root = prepare_clean_evidence(tmp_path)

    def replay_runner(strategy, **_kwargs):
        if strategy == "regime_plus_ls":
            return replay_payload(
                strategy,
                opens=[
                    expected_action(
                        "OPEN",
                        pair="LTC/USD",
                        sleeve="regime_plus_ls_short_trend",
                        reason="entry-signal",
                    )
                ],
            )
        return replay_payload(strategy)

    report = build_missed_trade_auditor_report(
        root=tmp_path,
        worktree_root=worktree_root,
        now=datetime(2026, 6, 10, 16, 5, tzinfo=timezone.utc),
        replay_runner=replay_runner,
    )

    assert report.status == "warn"
    assert report.errors == 0
    assert report.warnings == 1
    assert report.audits[2].expected_opens == 1
    assert report.audits[2].matched_opens == 0
    assert report.findings[0].severity == "warn"
    assert report.findings[0].action == "OPEN"
    assert report.findings[0].pair == "LTC/USD"


def test_matching_open_and_close_rows_produce_no_missed_action_findings(tmp_path):
    worktree_root = tmp_path / ".worktrees" / "codex-regime-plus"
    write_trade_logs(
        worktree_root,
        rows_by_strategy={
            "regime_short_plus": (
                trade_row("2026-06-10T16:00:00Z", "CLOSE")
                + trade_row("2026-06-10T16:00:00Z", "OPEN", reason="entry-signal")
            )
        },
    )
    write_routine_status(worktree_root)
    write_trade_forensics(worktree_root)

    def replay_runner(strategy, **_kwargs):
        if strategy == "regime_short_plus":
            return replay_payload(
                strategy,
                closes=[expected_action("CLOSE")],
                opens=[expected_action("OPEN", reason="entry-signal")],
            )
        return replay_payload(strategy)

    report = build_missed_trade_auditor_report(
        root=tmp_path,
        worktree_root=worktree_root,
        now=datetime(2026, 6, 10, 16, 5, tzinfo=timezone.utc),
        replay_runner=replay_runner,
    )

    assert report.status == "ok"
    assert report.errors == 0
    assert report.warnings == 0
    assert report.findings == []
    assert report.audits[1].matched_opens == 1
    assert report.audits[1].matched_closes == 1


def test_replay_failure_and_data_unavailable_become_warning_findings(tmp_path):
    worktree_root = prepare_clean_evidence(tmp_path)

    def replay_runner(strategy, **_kwargs):
        if strategy == "regime_plus":
            raise RuntimeError("simulated replay failure")
        if strategy == "regime_short_plus":
            return replay_payload(strategy, data_status="data-unavailable")
        return replay_payload(strategy)

    report = build_missed_trade_auditor_report(
        root=tmp_path,
        worktree_root=worktree_root,
        now=datetime(2026, 6, 10, 16, 5, tzinfo=timezone.utc),
        replay_runner=replay_runner,
    )

    assert report.status == "warn"
    assert report.errors == 0
    assert report.warnings == 2
    assert {finding.action for finding in report.findings} == {"REPLAY", "DATA"}
    assert report.audits[0].replay_status == "error"
    assert report.audits[1].replay_status == "data-unavailable"


def test_routine_and_forensics_blocker_is_supporting_warning(tmp_path):
    worktree_root = tmp_path / ".worktrees" / "codex-regime-plus"
    write_trade_logs(
        worktree_root,
        rows_by_strategy={"regime_short_plus": trade_row("2026-06-10T16:00:00Z", "OPEN", reason="entry-signal")},
    )
    write_routine_status(worktree_root, message="cycle already recorded")
    write_trade_forensics(worktree_root, quality="skipped", blockers="cycle already recorded")

    def replay_runner(strategy, **_kwargs):
        if strategy == "regime_short_plus":
            return replay_payload(strategy, opens=[expected_action("OPEN", reason="entry-signal")])
        return replay_payload(strategy)

    report = build_missed_trade_auditor_report(
        root=tmp_path,
        worktree_root=worktree_root,
        now=datetime(2026, 6, 10, 16, 5, tzinfo=timezone.utc),
        replay_runner=replay_runner,
    )

    assert report.status == "warn"
    assert report.errors == 0
    assert report.warnings == 1
    assert report.findings[0].action == "EVIDENCE"
    assert "cycle already recorded" in report.findings[0].evidence
    assert report.audits[1].routine_status == "ok"
    assert report.audits[1].forensics_quality == "skipped"


def test_writing_report_creates_json_markdown_and_routine_status_row(tmp_path):
    worktree_root = prepare_clean_evidence(tmp_path)
    report = build_missed_trade_auditor_report(
        root=tmp_path,
        worktree_root=worktree_root,
        now=datetime(2026, 6, 10, 16, 5, tzinfo=timezone.utc),
        replay_runner=clean_replay_runner,
    )

    write_missed_trade_auditor_report(tmp_path, report=report)

    report_json = tmp_path / "memory" / "hermes_missed_trade_auditor.json"
    report_md = tmp_path / "memory" / "hermes_missed_trade_auditor.md"
    routine_status = tmp_path / "memory" / "routine_status.md"

    payload = json.loads(report_json.read_text(encoding="utf-8"))
    assert payload["status"] == "ok"
    assert payload["scanned"] == 3
    assert len(payload["audits"]) == 3
    assert "# Hermes Missed Trade Auditor" in report_md.read_text(encoding="utf-8")
    assert (
        "| hermes-missed-trade-auditor | Hermes Missed Trade Auditor | "
        "2026-06-10T16:05:00Z | ok | local | scanned=3 errors=0 warnings=0 |"
    ) in routine_status.read_text(encoding="utf-8")


def test_cli_help_runs_when_script_is_executed_directly_from_repo_root():
    result = subprocess.run(
        [sys.executable, "scripts/missed_trade_auditor.py", "--help"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    assert "Hermes missed trade auditor" in result.stdout


def test_fail_on_error_returns_one(monkeypatch):
    report = auditor.MissedTradeReport(
        version=1,
        generated_at="2026-06-10T16:05:00Z",
        status="error",
        scanned=3,
        errors=1,
        warnings=0,
        audits=[],
        findings=[],
    )
    monkeypatch.setattr(auditor, "write_missed_trade_auditor_report", lambda **_kwargs: report)

    assert main(["--fail-on-error"]) == 1
```

- [ ] **Step 2: Run the new tests and verify the expected failure**

Run:

```powershell
cd C:\trading\trading-codex
python -m pytest tests\test_missed_trade_auditor.py -q
```

Expected: fail during import with `ModuleNotFoundError: No module named 'scripts.missed_trade_auditor'`.

- [ ] **Step 3: Create the auditor module with the public model and parsers**

Create `C:\trading\trading-codex\scripts\missed_trade_auditor.py` with this structure and these exported names:

```python
from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.routine_status import update_routine_status
from scripts.stale_trade_sentinel import (
    HIGH_RISK_STRATEGIES,
    _default_worktree_root,
    _iso_z,
    _run_worktree_replay,
    _write_atomic_text,
)

REPORT_VERSION = 1
DEFAULT_TOLERANCE = timedelta(hours=4)
DATA_WARNING_STATUSES = {"data-unavailable", "none"}
BLOCKER_WORDS = ("data-blocked", "data-unavailable", "cache", "skipped", "cycle already recorded")
TRADE_LOG_FILES = {
    "regime_plus": "regime_plus_trade_log.md",
    "regime_short_plus": "regime_short_plus_trade_log.md",
    "regime_plus_ls": "regime_plus_ls_trade_log.md",
}


@dataclass(frozen=True)
class TradeEvidence:
    timestamp: str
    action: str
    pair: str
    side: str
    reason: str
    sleeve: str


@dataclass(frozen=True)
class EvidenceRow:
    status: str
    message: str
    timestamp: str = ""
    quality: str = ""


@dataclass(frozen=True)
class MissedTradeFinding:
    severity: str
    strategy: str
    strategy_name: str
    action: str
    pair: str
    sleeve: str
    reason: str
    cycle_time: str
    evidence: str
    message: str


@dataclass(frozen=True)
class StrategyAudit:
    strategy: str
    strategy_name: str
    cycle_time: str
    replay_status: str
    expected_opens: int
    expected_closes: int
    matched_opens: int
    matched_closes: int
    routine_status: str
    routine_message: str
    forensics_quality: str
    forensics_message: str


@dataclass(frozen=True)
class MissedTradeReport:
    version: int
    generated_at: str
    status: str
    scanned: int
    errors: int
    warnings: int
    audits: list[StrategyAudit]
    findings: list[MissedTradeFinding]

    def to_jsonable(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "generated_at": self.generated_at,
            "status": self.status,
            "scanned": self.scanned,
            "errors": self.errors,
            "warnings": self.warnings,
            "audits": [asdict(audit) for audit in self.audits],
            "findings": [asdict(finding) for finding in self.findings],
        }


ReplayRunner = Callable[..., dict[str, Any]]
```

Add these parsing helpers under the dataclasses:

```python
def _cells(line: str) -> list[str]:
    if not line.strip().startswith("|"):
        return []
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    if not cells or cells[0].lower().startswith("timestamp") or set(cells[0].replace(" ", "")) <= {"-"}:
        return []
    return cells


def _parse_trade_log(path: Path) -> tuple[list[TradeEvidence], str | None]:
    if not path.exists():
        return [], f"trade log missing: {path.name}"
    rows: list[TradeEvidence] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        cells = _cells(line)
        if len(cells) < 12:
            continue
        rows.append(
            TradeEvidence(
                timestamp=cells[0],
                action=cells[1].upper(),
                pair=cells[2],
                side=cells[3],
                reason=cells[10],
                sleeve=cells[11],
            )
        )
    return rows, None


def _parse_markdown_table(text: str) -> list[dict[str, str]]:
    headers: list[str] | None = None
    rows: list[dict[str, str]] = []
    for line in text.splitlines():
        cells = _cells(line)
        if not cells:
            continue
        if headers is None:
            headers = [cell.lower().replace(" ", "_") for cell in cells]
            continue
        if len(cells) != len(headers):
            continue
        rows.append(dict(zip(headers, cells)))
    return rows


def _latest_routine_evidence(evidence_root: Path, strategy_name: str) -> EvidenceRow:
    path = evidence_root / "memory" / "routine_status.md"
    if not path.exists():
        return EvidenceRow(status="missing", message="routine_status.md missing")
    rows = [
        row
        for row in _parse_markdown_table(path.read_text(encoding="utf-8"))
        if row.get("strategy") == strategy_name
    ]
    if not rows:
        return EvidenceRow(status="missing", message=f"routine_status.md has no row for {strategy_name}")
    row = rows[-1]
    return EvidenceRow(
        status=row.get("status", ""),
        message=row.get("message", ""),
        timestamp=row.get("timestamp_utc", ""),
    )


def _latest_forensics_evidence(evidence_roots: list[Path], strategy_name: str) -> EvidenceRow:
    for evidence_root in evidence_roots:
        path = evidence_root / "memory" / "trade_forensics.md"
        if not path.exists():
            continue
        rows = [
            row
            for row in _parse_markdown_table(path.read_text(encoding="utf-8"))
            if row.get("strategy") == strategy_name
        ]
        if not rows:
            continue
        row = rows[-1]
        message = "; ".join(
            part
            for part in (row.get("warnings", ""), row.get("blockers", ""))
            if part and part != "-"
        )
        return EvidenceRow(
            status=row.get("data_source", ""),
            quality=row.get("quality", ""),
            message=message or "-",
            timestamp=row.get("recorded_(utc)", ""),
        )
    return EvidenceRow(status="missing", quality="missing", message="trade_forensics.md missing or no row for strategy")


def _parse_iso(value: str) -> datetime | None:
    if not value or value == "-":
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None
```

- [ ] **Step 4: Add matching, report building, rendering, writing, and CLI**

Continue `C:\trading\trading-codex\scripts\missed_trade_auditor.py` with these functions:

```python
def _action_field(action: Any, field: str, fallback: str = "-") -> str:
    if isinstance(action, dict):
        return str(action.get(field) or fallback)
    return fallback


def _expected_time(action: Any, cycle_time: str) -> str:
    return _action_field(action, "time", cycle_time)


def _matches_expected(
    expected: Any,
    actual: TradeEvidence,
    *,
    expected_action: str,
    cycle_time: str,
    tolerance: timedelta,
) -> bool:
    if actual.action != expected_action:
        return False
    if actual.pair != _action_field(expected, "pair"):
        return False
    if actual.sleeve != _action_field(expected, "sleeve"):
        return False
    expected_dt = _parse_iso(_expected_time(expected, cycle_time))
    actual_dt = _parse_iso(actual.timestamp)
    if expected_dt is None or actual_dt is None:
        return actual.timestamp >= _expected_time(expected, cycle_time)
    return actual_dt >= expected_dt - tolerance


def _match_expected_actions(
    expected_actions: list[Any],
    evidence_rows: list[TradeEvidence],
    *,
    action: str,
    cycle_time: str,
    tolerance: timedelta,
) -> tuple[int, list[Any]]:
    matched = 0
    unmatched: list[Any] = []
    remaining = list(evidence_rows)
    for expected in expected_actions:
        match_index: int | None = None
        for index, actual in enumerate(remaining):
            if _matches_expected(expected, actual, expected_action=action, cycle_time=cycle_time, tolerance=tolerance):
                match_index = index
                break
        if match_index is None:
            unmatched.append(expected)
        else:
            matched += 1
            remaining.pop(match_index)
    return matched, unmatched


def _blocker_text(routine: EvidenceRow, forensics: EvidenceRow) -> str:
    text = " ".join([routine.status, routine.message, forensics.status, forensics.quality, forensics.message]).lower()
    if any(word in text for word in BLOCKER_WORDS):
        return "routine/forensics evidence: " + "; ".join(
            part
            for part in (routine.message, forensics.quality, forensics.message)
            if part and part != "-"
        )
    return ""


def _missed_action_finding(
    *,
    severity: str,
    strategy: str,
    strategy_name: str,
    action: Any,
    action_name: str,
    cycle_time: str,
    message: str,
) -> MissedTradeFinding:
    return MissedTradeFinding(
        severity=severity,
        strategy=strategy,
        strategy_name=strategy_name,
        action=action_name,
        pair=_action_field(action, "pair"),
        sleeve=_action_field(action, "sleeve"),
        reason=_action_field(action, "reason"),
        cycle_time=_expected_time(action, cycle_time),
        evidence="no matching trade-log row",
        message=message,
    )


def build_missed_trade_auditor_report(
    root: Path = ROOT,
    worktree_root: Path | None = None,
    now: datetime | None = None,
    replay_runner: ReplayRunner | None = None,
    tolerance: timedelta = DEFAULT_TOLERANCE,
) -> MissedTradeReport:
    root = Path(root)
    worktree_root = Path(worktree_root) if worktree_root is not None else _default_worktree_root(root)
    generated_at = _iso_z(now or datetime.now(timezone.utc))
    runner = replay_runner or _run_worktree_replay
    audits: list[StrategyAudit] = []
    findings: list[MissedTradeFinding] = []
    evaluated_count = 0

    for strategy_info in HIGH_RISK_STRATEGIES:
        strategy = strategy_info["strategy"]
        strategy_name = strategy_info["strategy_name"]
        routine = _latest_routine_evidence(worktree_root, strategy_name)
        forensics = _latest_forensics_evidence([worktree_root, root], strategy_name)
        trade_rows, trade_log_error = _parse_trade_log(worktree_root / "memory" / TRADE_LOG_FILES[strategy])
        expected_opens: list[Any] = []
        expected_closes: list[Any] = []
        replay_status = "error"
        cycle_time = generated_at

        try:
            result = dict(runner(strategy, root=root, worktree_root=worktree_root, now_iso=generated_at))
            evaluated_count += 1
            cycle_time = str(result.get("cycle_time") or generated_at)
            replay_status = str(result.get("data_status") or "ok")
            expected_opens = list(result.get("expected_open_actions") or [])
            expected_closes = list(result.get("expected_close_actions") or [])
            if replay_status in DATA_WARNING_STATUSES:
                findings.append(
                    MissedTradeFinding("warn", strategy, strategy_name, "DATA", "-", "-", replay_status, cycle_time, "-", "paper-cycle replay data was unavailable")
                )
            if result.get("trade_log_missing"):
                findings.append(
                    MissedTradeFinding("warn", strategy, strategy_name, "LOG", "-", "-", "trade-log-missing", cycle_time, "-", "paper-cycle replay reported a missing trade log")
                )
        except Exception as exc:
            findings.append(
                MissedTradeFinding("warn", strategy, strategy_name, "REPLAY", "-", "-", "replay-failed", generated_at, str(exc), f"paper-cycle replay could not be evaluated: {exc}")
            )

        if trade_log_error:
            findings.append(
                MissedTradeFinding("warn", strategy, strategy_name, "LOG", "-", "-", "trade-log-missing", cycle_time, trade_log_error, "trade log could not be read")
            )

        if routine.status == "missing":
            findings.append(
                MissedTradeFinding("warn", strategy, strategy_name, "ROUTINE", "-", "-", "routine-status-missing", cycle_time, routine.message, "routine status evidence was missing")
            )

        matched_closes, unmatched_closes = _match_expected_actions(expected_closes, trade_rows, action="CLOSE", cycle_time=cycle_time, tolerance=tolerance)
        matched_opens, unmatched_opens = _match_expected_actions(expected_opens, trade_rows, action="OPEN", cycle_time=cycle_time, tolerance=tolerance)

        for action in unmatched_closes:
            findings.append(
                _missed_action_finding(
                    severity="error",
                    strategy=strategy,
                    strategy_name=strategy_name,
                    action=action,
                    action_name="CLOSE",
                    cycle_time=cycle_time,
                    message="paper-cycle replay expected a close but no matching close was recorded",
                )
            )
        for action in unmatched_opens:
            findings.append(
                _missed_action_finding(
                    severity="warn",
                    strategy=strategy,
                    strategy_name=strategy_name,
                    action=action,
                    action_name="OPEN",
                    cycle_time=cycle_time,
                    message="paper-cycle replay expected an open but no matching open was recorded",
                )
            )

        blocker = _blocker_text(routine, forensics)
        if blocker and (expected_opens or expected_closes):
            findings.append(
                MissedTradeFinding("warn", strategy, strategy_name, "EVIDENCE", "-", "-", "supporting-evidence-blocker", cycle_time, blocker, "routine or forensics evidence shows a blocker while replay expected action")
            )

        audits.append(
            StrategyAudit(
                strategy=strategy,
                strategy_name=strategy_name,
                cycle_time=cycle_time,
                replay_status=replay_status,
                expected_opens=len(expected_opens),
                expected_closes=len(expected_closes),
                matched_opens=matched_opens,
                matched_closes=matched_closes,
                routine_status=routine.status,
                routine_message=routine.message,
                forensics_quality=forensics.quality or forensics.status,
                forensics_message=forensics.message,
            )
        )

    errors = sum(1 for finding in findings if finding.severity == "error")
    warnings = sum(1 for finding in findings if finding.severity == "warn")
    status = "error" if errors or evaluated_count == 0 else "warn" if warnings else "ok"
    return MissedTradeReport(REPORT_VERSION, generated_at, status, len(audits), errors, warnings, audits, findings)


def render_markdown(report: MissedTradeReport) -> str:
    lines = [
        "# Hermes Missed Trade Auditor",
        "",
        "> Review-only paper evidence audit. No strategy state was changed.",
        "",
        f"- Generated: {report.generated_at}",
        f"- Status: {report.status}",
        f"- Scanned: {report.scanned}",
        f"- Errors: {report.errors}",
        f"- Warnings: {report.warnings}",
        "",
        "| Strategy | Replay | Expected opens | Matched opens | Expected closes | Matched closes | Routine | Forensics |",
        "|----------|--------|----------------|---------------|-----------------|----------------|---------|-----------|",
    ]
    for audit in report.audits:
        lines.append(
            f"| {audit.strategy_name} | {audit.replay_status} | {audit.expected_opens} | {audit.matched_opens} | "
            f"{audit.expected_closes} | {audit.matched_closes} | {audit.routine_status} | {audit.forensics_quality} |"
        )
    lines.extend(["", "## Findings", ""])
    if not report.findings:
        lines.append("No missed trade findings.")
    else:
        lines.extend(
            [
                "| Severity | Strategy | Action | Pair | Sleeve | Reason | Cycle time | Evidence | Message |",
                "|----------|----------|--------|------|--------|--------|------------|----------|---------|",
            ]
        )
        for finding in report.findings:
            lines.append(
                f"| {finding.severity} | {finding.strategy_name} | {finding.action} | {finding.pair} | "
                f"{finding.sleeve} | {finding.reason} | {finding.cycle_time} | {finding.evidence} | {finding.message} |"
            )
    return "\n".join(lines) + "\n"


def write_missed_trade_auditor_report(
    root: Path = ROOT,
    *,
    report: MissedTradeReport | None = None,
    worktree_root: Path | None = None,
    now: datetime | None = None,
    replay_runner: ReplayRunner | None = None,
) -> MissedTradeReport:
    root = Path(root)
    report = report or build_missed_trade_auditor_report(root=root, worktree_root=worktree_root, now=now, replay_runner=replay_runner)
    memory = root / "memory"
    _write_atomic_text(memory / "hermes_missed_trade_auditor.json", json.dumps(report.to_jsonable(), indent=2, sort_keys=True) + "\n")
    _write_atomic_text(memory / "hermes_missed_trade_auditor.md", render_markdown(report))
    update_routine_status(
        root,
        routine="hermes-missed-trade-auditor",
        strategy="Hermes Missed Trade Auditor",
        status=report.status,
        data_source="local",
        message=f"scanned={report.scanned} errors={report.errors} warnings={report.warnings}",
        timestamp=report.generated_at,
    )
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Review-only Hermes missed trade auditor.")
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--worktree-root", type=Path, default=None)
    parser.add_argument("--fail-on-error", action="store_true")
    args = parser.parse_args(argv)
    report = write_missed_trade_auditor_report(root=args.root, worktree_root=args.worktree_root)
    print(
        "OK: missed trade auditor status={status} errors={errors} warnings={warnings} scanned={scanned}".format(
            status=report.status,
            errors=report.errors,
            warnings=report.warnings,
            scanned=report.scanned,
        )
    )
    if args.fail_on_error and report.status == "error":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 5: Run auditor tests until green**

Run:

```powershell
cd C:\trading\trading-codex
python -m pytest tests\test_missed_trade_auditor.py -q
```

Expected: all tests in `tests\test_missed_trade_auditor.py` pass.

- [ ] **Step 6: Commit the auditor core**

Run:

```powershell
cd C:\trading\trading-codex
git add scripts\missed_trade_auditor.py tests\test_missed_trade_auditor.py
git commit -m "Add Hermes missed trade auditor"
```

Expected: one commit containing only the new auditor script and tests.

## Task 2: Export Auditor Artifacts

**Files:**
- Modify: `C:\trading\trading-codex\scripts\export_leaderboard.py`
- Test: `C:\trading\trading-codex\tests\test_export_leaderboard.py`

- [ ] **Step 1: Write the failing export test**

Append this test after `test_export_snapshots_copies_stale_trade_sentinel_outputs_when_present` in `C:\trading\trading-codex\tests\test_export_leaderboard.py`:

```python
def test_export_snapshots_copies_missed_trade_auditor_outputs_when_present(tmp_path):
    source = tmp_path / "codex"
    dest = tmp_path / "leaderboard" / "data" / "codex"
    memory = source / "memory"
    memory.mkdir(parents=True)
    (memory / "portfolio.md").write_text("# Portfolio\n", encoding="utf-8")
    (memory / "trade_log.md").write_text("# Trade Log\n", encoding="utf-8")
    (memory / "hermes_missed_trade_auditor.md").write_text("# Auditor\n", encoding="utf-8")
    (memory / "hermes_missed_trade_auditor.json").write_text('{"status":"ok"}\n', encoding="utf-8")

    export_snapshots(source, dest)

    assert (dest / "hermes_missed_trade_auditor.md").read_text(encoding="utf-8") == "# Auditor\n"
    assert (dest / "hermes_missed_trade_auditor.json").read_text(encoding="utf-8") == '{"status":"ok"}\n'
```

- [ ] **Step 2: Run the new export test and verify the expected failure**

Run:

```powershell
cd C:\trading\trading-codex
python -m pytest tests\test_export_leaderboard.py::test_export_snapshots_copies_missed_trade_auditor_outputs_when_present -q
```

Expected: fail because `hermes_missed_trade_auditor.md` and `.json` are not copied.

- [ ] **Step 3: Add auditor files to optional snapshots**

In `C:\trading\trading-codex\scripts\export_leaderboard.py`, add these entries immediately after the stale sentinel entries in `OPTIONAL_SNAPSHOTS`:

```python
    "hermes_missed_trade_auditor.md": "hermes_missed_trade_auditor.md",
    "hermes_missed_trade_auditor.json": "hermes_missed_trade_auditor.json",
```

- [ ] **Step 4: Run export tests**

Run:

```powershell
cd C:\trading\trading-codex
python -m pytest tests\test_export_leaderboard.py::test_export_snapshots_copies_missed_trade_auditor_outputs_when_present tests\test_export_leaderboard.py::test_export_snapshots_copies_stale_trade_sentinel_outputs_when_present -q
```

Expected: both selected export tests pass.

- [ ] **Step 5: Commit export support**

Run:

```powershell
cd C:\trading\trading-codex
git add scripts\export_leaderboard.py tests\test_export_leaderboard.py
git commit -m "Export Hermes missed trade auditor artifacts"
```

Expected: one commit containing the export snapshot mapping and export test.

## Task 3: Render The Auditor In Hermes Monitor

**Files:**
- Modify: `C:\trading\strategy-leaderboard\hermes_app.js`
- Modify: `C:\trading\strategy-leaderboard\lib\hermes_monitor.js`
- Test: `C:\trading\strategy-leaderboard\lib\hermes_monitor.test.js`

- [ ] **Step 0: Record the leaderboard baseline count**

Run:

```powershell
cd C:\trading\strategy-leaderboard
node --input-type=module -e "import { STRATEGIES } from './registry.js'; console.log('baseline_strategy_count='+STRATEGIES.length)"
```

Expected: record the printed `baseline_strategy_count` value in the task notes for the final safety check.

- [ ] **Step 1: Add monitor tests for parsing and rendering**

Modify the import block in `C:\trading\strategy-leaderboard\lib\hermes_monitor.test.js` so it imports `parseMissedTradeAuditorText`:

```javascript
import {
  buildHermesMonitorModel,
  parseHypothesisLedgerText,
  parseMissedTradeAuditorText,
  parseRoutineStatusText,
  renderHermesMonitorHtml,
} from './hermes_monitor.js';
```

Append these tests:

```javascript
test('parseMissedTradeAuditorText extracts auditor summary and findings', () => {
  const auditor = parseMissedTradeAuditorText(JSON.stringify({
    version: 1,
    generated_at: '2026-06-10T16:05:00Z',
    status: 'error',
    scanned: 3,
    errors: 1,
    warnings: 1,
    audits: [
      {
        strategy: 'regime_short_plus',
        strategy_name: 'CODEX Regime Short Plus v1',
        cycle_time: '2026-06-10T16:00:00Z',
        replay_status: 'ok',
        expected_opens: 0,
        expected_closes: 1,
        matched_opens: 0,
        matched_closes: 0,
        routine_status: 'ok',
        routine_message: 'cycle complete',
        forensics_quality: 'ok',
        forensics_message: '-',
      },
    ],
    findings: [
      {
        severity: 'error',
        strategy: 'regime_short_plus',
        strategy_name: 'CODEX Regime Short Plus v1',
        action: 'CLOSE',
        pair: 'ADA/USD',
        sleeve: 'regime_short_plus_trend',
        reason: 'time-stop',
        cycle_time: '2026-06-10T16:00:00Z',
        evidence: 'no matching trade-log row',
        message: 'paper-cycle replay expected a close but no matching close was recorded',
      },
    ],
  }));

  assert.equal(auditor.exported, true);
  assert.equal(auditor.status, 'error');
  assert.equal(auditor.scanned, 3);
  assert.equal(auditor.audits[0].matchedCloses, 0);
  assert.equal(auditor.findings[0].pair, 'ADA/USD');
});

test('buildHermesMonitorModel includes missed trade auditor artifact', () => {
  const model = buildHermesMonitorModel({
    codexQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    claudeQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    missedTradeAuditorText: JSON.stringify({
      generated_at: '2026-06-10T16:05:00Z',
      status: 'ok',
      scanned: 3,
      errors: 0,
      warnings: 0,
      audits: [],
      findings: [],
    }),
  });

  assert.equal(model.missedTradeAuditor.exported, true);
  assert.equal(model.missedTradeAuditor.status, 'ok');
  assert.equal(model.missedTradeAuditor.summary, 'ok errors=0 warnings=0');
});

test('renderHermesMonitorHtml renders missed trade auditor panel below sentinel', () => {
  const html = renderHermesMonitorHtml(buildHermesMonitorModel({
    codexQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    claudeQueue: { generated_at: '', mode: 'paper-only', items: [], error: '' },
    staleTradeSentinelText: JSON.stringify({
      generated_at: '2026-06-10T16:04:00Z',
      status: 'ok',
      scanned: 3,
      errors: 0,
      warnings: 0,
      findings: [],
    }),
    missedTradeAuditorText: JSON.stringify({
      generated_at: '2026-06-10T16:05:00Z',
      status: 'warn',
      scanned: 3,
      errors: 0,
      warnings: 1,
      audits: [],
      findings: [
        {
          severity: 'warn',
          strategy: 'regime_plus_ls',
          strategy_name: 'CODEX Regime Plus L/S v1',
          action: 'OPEN',
          pair: 'LTC/USD',
          sleeve: 'regime_plus_ls_short_trend',
          reason: 'entry-signal',
          cycle_time: '2026-06-10T16:00:00Z',
          evidence: 'no matching trade-log row',
          message: 'paper-cycle replay expected an open but no matching open was recorded',
        },
      ],
    }),
  }));

  assert.match(html, /Stale Trade Sentinel/);
  assert.match(html, /Missed Trade Auditor/);
  assert.ok(html.indexOf('Stale Trade Sentinel') < html.indexOf('Missed Trade Auditor'));
  assert.match(html, /CODEX Regime Plus L\/S v1/);
  assert.match(html, /LTC\/USD/);
  assert.match(html, /review-only/);
});
```

- [ ] **Step 2: Run the monitor tests and verify the expected failure**

Run:

```powershell
cd C:\trading\strategy-leaderboard
node --test lib\hermes_monitor.test.js
```

Expected: fail because `parseMissedTradeAuditorText` is not exported and the model does not contain `missedTradeAuditor`.

- [ ] **Step 3: Fetch auditor artifact in the app shell**

In `C:\trading\strategy-leaderboard\hermes_app.js`, add this path in `PATHS` after the stale sentinel paths:

```javascript
  missedTradeAuditor: 'data/codex/hermes_missed_trade_auditor.json',
```

In `loadMonitor()`, add `missedTradeAuditorResp` to the response destructuring after `staleTradeSentinelMarkdownResp`, add `fetchLocalText(PATHS.missedTradeAuditor)` to the `Promise.all`, and pass this field to `buildHermesMonitorModel`:

```javascript
    missedTradeAuditorText: missedTradeAuditorResp.ok ? missedTradeAuditorResp.text : '',
```

- [ ] **Step 4: Add parser and model fields**

In `C:\trading\strategy-leaderboard\lib\hermes_monitor.js`, add this exported parser after `parseStaleTradeSentinelText`:

```javascript
export function parseMissedTradeAuditorText(text) {
  if (!text || !text.trim()) {
    return {
      exported: false,
      generatedAt: '',
      status: 'pending',
      scanned: 0,
      errors: 0,
      warnings: 0,
      audits: [],
      findings: [],
      summary: 'missed trade auditor not exported',
    };
  }

  try {
    const data = JSON.parse(text);
    const audits = Array.isArray(data.audits)
      ? data.audits.map(audit => ({
          strategy: String(audit?.strategy || ''),
          strategyName: String(audit?.strategy_name || audit?.strategyName || ''),
          cycleTime: String(audit?.cycle_time || audit?.cycleTime || ''),
          replayStatus: String(audit?.replay_status || audit?.replayStatus || ''),
          expectedOpens: Number(audit?.expected_opens || audit?.expectedOpens || 0),
          expectedCloses: Number(audit?.expected_closes || audit?.expectedCloses || 0),
          matchedOpens: Number(audit?.matched_opens || audit?.matchedOpens || 0),
          matchedCloses: Number(audit?.matched_closes || audit?.matchedCloses || 0),
          routineStatus: String(audit?.routine_status || audit?.routineStatus || ''),
          routineMessage: String(audit?.routine_message || audit?.routineMessage || ''),
          forensicsQuality: String(audit?.forensics_quality || audit?.forensicsQuality || ''),
          forensicsMessage: String(audit?.forensics_message || audit?.forensicsMessage || ''),
        }))
      : [];
    const findings = Array.isArray(data.findings)
      ? data.findings.map(finding => ({
          severity: String(finding?.severity || 'warn'),
          strategy: String(finding?.strategy_name || finding?.strategy || 'Unknown strategy'),
          action: String(finding?.action || '-'),
          pair: String(finding?.pair || '-'),
          sleeve: String(finding?.sleeve || '-'),
          reason: String(finding?.reason || '-'),
          cycleTime: String(finding?.cycle_time || finding?.cycleTime || '-'),
          evidence: String(finding?.evidence || ''),
          message: String(finding?.message || ''),
        }))
      : [];
    const status = String(data.status || (findings.length ? 'warn' : 'ok'));
    const errors = Number(data.errors || findings.filter(finding => finding.severity === 'error').length);
    const warnings = Number(data.warnings || findings.filter(finding => finding.severity === 'warn').length);
    return {
      exported: true,
      generatedAt: String(data.generated_at || data.generatedAt || ''),
      status,
      scanned: Number(data.scanned || audits.length || 0),
      errors,
      warnings,
      audits,
      findings,
      summary: `${status} errors=${errors} warnings=${warnings}`,
    };
  } catch {
    return {
      exported: true,
      generatedAt: '',
      status: 'warn',
      scanned: 0,
      errors: 0,
      warnings: 1,
      audits: [],
      findings: [
        {
          severity: 'warn',
          strategy: 'Hermes Missed Trade Auditor',
          action: 'PARSE',
          pair: '-',
          sleeve: '-',
          reason: 'unreadable-json',
          cycleTime: '-',
          evidence: 'artifact parse failed',
          message: 'auditor artifact could not be parsed',
        },
      ],
      summary: 'auditor artifact could not be parsed',
    };
  }
}
```

In `buildHermesMonitorModel`, add:

```javascript
  const missedTradeAuditor = parseMissedTradeAuditorText(input.missedTradeAuditorText || '');
```

Then include it in the returned model:

```javascript
    missedTradeAuditor,
```

- [ ] **Step 5: Render the auditor panel below Stale Trade Sentinel**

In `renderHermesMonitorHtml`, place this line immediately after `${staleTradeSentinelHtml(model.staleTradeSentinel)}`:

```javascript
    ${missedTradeAuditorHtml(model.missedTradeAuditor)}
```

Add these render helpers after `staleTradeFindingListHtml`:

```javascript
function missedTradeAuditorHtml(auditor) {
  const statusClass = auditor.status === 'ok'
    ? 'ok'
    : auditor.status === 'pending'
      ? 'pending'
      : 'warn';
  const detail = auditor.exported
    ? `review-only evidence audit - scanned ${auditor.scanned} - errors ${auditor.errors} - warnings ${auditor.warnings}`
    : auditor.summary;
  return `
    <section class="monitor-panel full-width" aria-label="Missed Trade Auditor">
      <div class="panel-head">
        <h2>Missed Trade Auditor</h2>
        <span class="status-pill status-${escapeHtml(statusClass)}">${escapeHtml(auditor.status)}</span>
      </div>
      <p class="dim">${escapeHtml(detail)}${auditor.generatedAt ? ` - ${escapeHtml(auditor.generatedAt)}` : ''}</p>
      ${missedTradeFindingListHtml(auditor)}
    </section>
  `;
}

function missedTradeFindingListHtml(auditor) {
  if (!auditor.exported) {
    return '<div class="empty-monitor">Missed trade auditor has not been exported yet.</div>';
  }
  if (!auditor.findings.length) {
    return '<div class="empty-monitor">No missed trade findings in the latest review-only evidence audit.</div>';
  }
  return `
    <div class="hypothesis-list">
      ${auditor.findings.slice(0, 8).map(finding => `
        <article class="hypothesis-row">
          <div>
            <strong>${escapeHtml(finding.strategy)}</strong>
            <span class="dim">${escapeHtml(finding.cycleTime)}</span>
          </div>
          <span class="status-pill status-${escapeHtml(finding.severity === 'error' ? 'warn' : finding.severity)}">${escapeHtml(finding.action)} ${escapeHtml(finding.pair)}</span>
          <p>${escapeHtml(finding.reason)} - ${escapeHtml(finding.evidence)} - ${escapeHtml(finding.message)}</p>
        </article>
      `).join('')}
    </div>
  `;
}
```

- [ ] **Step 6: Run monitor tests**

Run:

```powershell
cd C:\trading\strategy-leaderboard
node --test lib\hermes_monitor.test.js
```

Expected: all `lib\hermes_monitor.test.js` tests pass.

- [ ] **Step 7: Commit monitor support**

Run:

```powershell
cd C:\trading\strategy-leaderboard
git add hermes_app.js lib\hermes_monitor.js lib\hermes_monitor.test.js
git commit -m "Show Hermes missed trade auditor"
```

Expected: one commit containing the app fetch, monitor parser, monitor render helper, and tests.

## Task 4: Update Hermes Automation Sequence

**Files:**
- Automation: `codex-hermes-research-supervisor`

- [ ] **Step 1: Discover the automation update tool**

Use the Codex tool search with query `automation_update`.

Expected: the automation update tool is available for the next call.

- [ ] **Step 2: Update the automation sequence**

Use the automation update tool to modify `codex-hermes-research-supervisor` so its paper-only command sequence is:

```text
python scripts\hermes_supervisor.py
python scripts\stale_trade_sentinel.py
python scripts\missed_trade_auditor.py
python scripts\hermes_review_cycle.py
python scripts\export_leaderboard.py
```

Set the automation report instructions to include:

```text
Inspect memory\hermes_missed_trade_auditor.md and memory\hermes_missed_trade_auditor.json. Report missed-trade auditor status, scanned count, errors, warnings, and the top missed-action findings. Keep Hermes review-only and do not modify live routing, paper trade logs, portfolios, optimized WFO configs, foundry variant banks, broker/exchange settings, real order endpoints, leaderboard registry rows, exported CODEX snapshots outside export_leaderboard.py, or automation schedules beyond this approved sequence change.
```

- [ ] **Step 3: Confirm automation text**

Read the automation after updating it and verify it contains `python scripts\missed_trade_auditor.py` between `python scripts\stale_trade_sentinel.py` and `python scripts\hermes_review_cycle.py`.

Expected: the automation is enabled and the sequence is ordered exactly as listed in Step 2.

## Task 5: End-To-End Verification And Safety Check

**Files:**
- Runtime artifact: `C:\trading\trading-codex\memory\hermes_missed_trade_auditor.json`
- Runtime artifact: `C:\trading\trading-codex\memory\hermes_missed_trade_auditor.md`
- Exported artifact: `C:\trading\strategy-leaderboard\data\codex\hermes_missed_trade_auditor.json`
- Exported artifact: `C:\trading\strategy-leaderboard\data\codex\hermes_missed_trade_auditor.md`

- [ ] **Step 1: Run focused Python tests**

Run:

```powershell
cd C:\trading\trading-codex
python -m pytest tests\test_missed_trade_auditor.py tests\test_stale_trade_sentinel.py tests\test_export_leaderboard.py tests\test_automation_lock.py -q
```

Expected: all selected Python tests pass.

- [ ] **Step 2: Run Regime Plus replay guard tests**

Run:

```powershell
cd C:\trading\trading-codex\.worktrees\codex-regime-plus
python -m pytest tests\test_paper_cycle.py tests\test_open_trade_health.py -q
```

Expected: all selected Regime Plus worktree tests pass.

- [ ] **Step 3: Run the review-only Hermes sequence manually**

Run:

```powershell
cd C:\trading\trading-codex
python scripts\hermes_supervisor.py
python scripts\stale_trade_sentinel.py
python scripts\missed_trade_auditor.py
python scripts\hermes_review_cycle.py
python scripts\export_leaderboard.py
```

Expected:
- `scripts\missed_trade_auditor.py` prints `OK: missed trade auditor status=... errors=... warnings=... scanned=3`.
- `memory\hermes_missed_trade_auditor.json` exists.
- `memory\hermes_missed_trade_auditor.md` exists.
- `data\codex\hermes_missed_trade_auditor.json` exists in `C:\trading\strategy-leaderboard`.
- `data\codex\hermes_missed_trade_auditor.md` exists in `C:\trading\strategy-leaderboard`.

- [ ] **Step 4: Run leaderboard tests and smoke**

Run:

```powershell
cd C:\trading\strategy-leaderboard
npm test
npm run smoke
node --test scripts\codex_snapshot_integrity.test.js scripts\registry.test.js
```

Expected:
- `npm test` passes.
- `npm run smoke` validates all registered strategies.
- CODEX snapshot integrity and registry tests pass.

- [ ] **Step 5: Compare strategy count and protected CODEX forward histories**

Run this in `C:\trading\strategy-leaderboard`:

```powershell
node --input-type=module -e "import { STRATEGIES, effectiveCutoff } from './registry.js'; import { readFileSync } from 'node:fs'; const names=['CODEX v0','CODEX Aggro v0','CODEX Pulse v0','CODEX Regime v0','CODEX Apex v0','CODEX Regime WFO v1','CODEX Apex WFO v1']; console.log('strategy_count='+STRATEGIES.length); for (const name of names) { const strategy=STRATEGIES.find(s=>s.name===name); if (!strategy) throw new Error(name+' missing'); const portfolio=readFileSync(new URL(strategy.source.portfolio_path, import.meta.url),'utf8'); const tradeLog=readFileSync(new URL(strategy.source.trade_log_path, import.meta.url),'utf8'); const row=strategy.adapter({ portfolio:{ok:true,text:portfolio}, tradeLog:{ok:true,text:tradeLog} }, { startingCapital: strategy.starting_capital, name: strategy.name, status: strategy.status, liveStartIso: effectiveCutoff(strategy.live_start_iso) }); console.log(name+' trades='+row.trades_n); if (!row.trades_n) throw new Error(name+' has empty forward trade history'); }"
```

Expected:
- `strategy_count` matches the `baseline_strategy_count` recorded in Task 3 Step 0.
- Each protected CODEX row prints a non-zero `trades=` value.

- [ ] **Step 6: Inspect the auditor artifacts**

Run:

```powershell
cd C:\trading\trading-codex
Get-Content memory\hermes_missed_trade_auditor.md -TotalCount 80
Get-Content memory\hermes_missed_trade_auditor.json -TotalCount 80
```

Expected:
- Markdown starts with `# Hermes Missed Trade Auditor`.
- JSON has `status`, `scanned`, `errors`, `warnings`, `audits`, and `findings`.
- The report language remains review-only.

- [ ] **Step 7: Commit any final verified changes**

If manual export generated expected new leaderboard artifacts, commit only intentional source changes and the newly exported auditor artifacts:

```powershell
cd C:\trading\strategy-leaderboard
git add data\codex\hermes_missed_trade_auditor.json data\codex\hermes_missed_trade_auditor.md
git commit -m "Export Hermes missed trade auditor artifacts"
```

Expected: do not stage unrelated data snapshots, lock files, temp files, registry changes, or strategy rows.
