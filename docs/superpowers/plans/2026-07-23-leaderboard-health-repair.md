# Leaderboard Health Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all registered strategies with truthful current, stale, or fatal source state; recover safe local refreshes; and prevent stale upstream data from hiding histories or entering scoring and execution consumers.

**Architecture:** Keep trade logs as the metric source of truth and classify only readable portfolio recency as `stale`. Propagate the new state through rendering, source health, contest scoring, command-center readiness, Sentinel allocation, and promotion. Separately fix FABLE cache-family reporting and add a bounded cache-ready guard before FABLE generation.

**Tech Stack:** Node.js ESM with `node:test`, static HTML/CSS, Python 3.11 with `unittest`, Windows batch and Task Scheduler.

---

## File Structure

### Strategy Leaderboard (`C:\trading\strategy-leaderboard`)

- Modify `adapters/adapters.test.js`: stale snapshot adapter expectations.
- Modify `adapters/adapter_bull.js`: emit `stale` for readable old BULL snapshots.
- Modify `adapters/adapter_codex.js`: emit `stale` for readable old local snapshots.
- Modify `lib/strategy_row.js`: document `stale` in the normalized row contract.
- Modify `lib/source_health.test.js`: stale source-health regression.
- Modify `lib/source_health.js`: map stale rows to warning health.
- Modify `lib/render.test.js`: current/stale/error ordering and badge-style contract.
- Modify `lib/render.js`: sort by row usability rank.
- Modify `css/style.css`: amber stale badge.
- Modify `lib/contest.test.js`: stale rows are not scored.
- Modify `lib/contest.js`: exclude stale and fatal rows from scoring.
- Modify `lib/command_center.test.js`: stale rows pause readiness.
- Modify `lib/command_center.js`: block stale data from promotion readiness.
- Modify `lib/sentinel/allocator.test.js`: stale allocations are blocked.
- Modify `lib/sentinel/allocator.js`: block stale rows from allocation.
- Modify `lib/sentinel/promotion_engine.test.js`: stale promotion rows are blocked.
- Modify `lib/sentinel/promotion_engine.js`: block stale rows from promotion.
- Modify `scripts/codex_snapshot_integrity.test.js`: protect registry size and named CODEX histories.
- Modify `docs/superpowers/specs/2026-07-23-leaderboard-health-repair-design.md`: record cache-family message isolation discovered during planning.

### FABLE (`C:\trading\Fable`)

- Create `tests/test_cache_health.py`: cache-family message isolation tests.
- Modify `fable_engine/cache_health.py`: keep equity and crypto findings separate.
- Create `tests/test_nightly_guard.py`: bounded cache-wait behavior and launcher wiring.
- Create `fable_engine/nightly_guard.py`: condition-based cache readiness loop.
- Modify `run-fable-nightly.bat`: invoke the bounded readiness loop before generation.

The FABLE directory is not a Git repository. Its changes must remain local and
must be reported explicitly; do not invent a commit for that directory.

### Dirty-worktree rule

The leaderboard checkout already contains extensive user and automation changes,
including uncommitted freshness work in the exact adapter files this repair must
finish. Do not reset, stash, overwrite, or broadly commit those changes. Use
scoped patches and scoped diffs. Do not push.

---

### Task 1: Classify readable old snapshots as stale

**Files:**

- Modify: `C:\trading\strategy-leaderboard\adapters\adapters.test.js`
- Modify: `C:\trading\strategy-leaderboard\adapters\adapter_bull.js`
- Modify: `C:\trading\strategy-leaderboard\adapters\adapter_codex.js`
- Modify: `C:\trading\strategy-leaderboard\lib\strategy_row.js`

- [ ] **Step 1: Change the existing stale-snapshot tests to the desired state**

In `adapters/adapters.test.js`, rename the two tests and change only the status
assertions:

```js
test('bull adapter marks an over-age portfolio snapshot as stale without dropping history', () => {
  const portfolio = { ok: true, text: '> **Last rebuild:** 2026-07-10T04:11Z routine-03-eod' };
  const row = adaptBull(
    { portfolio, tradeLog: { ok: true, text: fxBullLog } },
    {
      startingCapital: 10000,
      maxSnapshotAgeHours: 80,
      nowMs: Date.parse('2026-07-18T06:00:00Z'),
    }
  );

  assert.equal(row.status, 'stale');
  assert.ok(row.trades_n > 0, 'historical trades must remain visible');
  assert.ok(row.errors.some(error => error.includes('stale portfolio snapshot')));
});

test('codex adapter marks a stale generated snapshot stale without dropping trade history', () => {
  const portfolio = {
    ok: true,
    text: '> Auto-generated. Last regenerated: 2026-07-15T00:00:00Z',
  };
  const row = adaptCodex(
    { portfolio, tradeLog: { ok: true, text: loadText('../data/codex/markov_gate_trade_log.md') } },
    {
      startingCapital: 10000,
      name: 'Generated test strategy',
      maxSnapshotAgeHours: 36,
      nowMs: Date.parse('2026-07-18T00:00:00Z'),
    }
  );

  assert.equal(row.status, 'stale');
  assert.ok(row.trades_n > 0);
  assert.ok(row.errors.some(error => error.includes('stale portfolio snapshot')));
});
```

- [ ] **Step 2: Run the two tests and verify RED**

Run:

```powershell
node --test --test-name-pattern="over-age portfolio snapshot|stale generated snapshot" adapters/adapters.test.js
```

Expected: two assertion failures showing actual `error` versus expected `stale`.

- [ ] **Step 3: Implement the minimal adapter state change**

In `adapter_bull.js`, change the `buildStrategyRow` status expression to:

```js
status: staleSnapshot ? 'stale' : (opts?.status || 'live'),
```

In `adapter_codex.js`, change it to:

```js
status: staleSnapshot ? 'stale' : 'live',
```

Update the `StrategyRow` typedef in `lib/strategy_row.js`:

```js
 * @property {'live'|'canary'|'research'|'paused'|'stale'|'error'} status
```

- [ ] **Step 4: Run the adapter tests and verify GREEN**

Run:

```powershell
node --test adapters/adapters.test.js
```

Expected: all adapter tests pass.

---

### Task 2: Render and report stale state honestly

**Files:**

- Modify: `C:\trading\strategy-leaderboard\lib\source_health.test.js`
- Modify: `C:\trading\strategy-leaderboard\lib\source_health.js`
- Modify: `C:\trading\strategy-leaderboard\lib\render.test.js`
- Modify: `C:\trading\strategy-leaderboard\lib\render.js`
- Modify: `C:\trading\strategy-leaderboard\css\style.css`

- [ ] **Step 1: Add failing source-health and ordering tests**

Append to `lib/source_health.test.js`:

```js
test('stale readable rows degrade file health to warn instead of error', () => {
  assert.equal(
    healthSeverityForRow(
      { status: 'stale', errors: [] },
      'codex-local',
    ),
    'warn',
  );
});
```

Replace `lib/render.test.js` with:

```js
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sortRows } from './render.js';

test('metric sorting keeps current rows above stale rows above fatal errors', () => {
  const rows = [
    { name: 'fatal winner', status: 'error', returns: { '90d': 60 } },
    { name: 'stale winner', status: 'stale', returns: { '90d': 40 } },
    { name: 'healthy runner-up', status: 'live', returns: { '90d': 20 } },
  ];

  assert.deepEqual(
    sortRows(rows, 'r90', false).map(row => row.name),
    ['healthy runner-up', 'stale winner', 'fatal winner'],
  );
});

test('stylesheet defines an amber stale badge', async () => {
  const css = await readFile(new URL('../css/style.css', import.meta.url), 'utf8');

  assert.match(css, /\.badge-stale\s*\{/);
  assert.match(css, /\.badge-stale[^}]*#fbbf24/s);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --test lib/source_health.test.js lib/render.test.js
```

Expected: sorting places the high-return stale row first, and the stylesheet
lacks `.badge-stale`.

- [ ] **Step 3: Implement stale warning health and health-ranked sorting**

In `lib/source_health.js`, add before the `error` branch:

```js
if (row.status === 'stale') {
  return 'warn';
}
```

In `lib/render.js`, replace the error-only ordering with:

```js
function rowHealthRank(row) {
  if (row?.status === 'error') return 2;
  if (row?.status === 'stale') return 1;
  return 0;
}

export function sortRows(rows, sortKey, asc) {
  const getVal = SORT_KEY_TO_VALUE[sortKey] || (() => null);
  return [...rows].sort((a, b) => {
    const healthOrder = rowHealthRank(a) - rowHealthRank(b);
    if (healthOrder !== 0) return healthOrder;
    return compareNullable(getVal(a), getVal(b), asc);
  });
}
```

In `css/style.css`, add beside the existing badge styles:

```css
.badge-stale   { background: #3a2b0f; color: #fbbf24; }
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
node --test lib/source_health.test.js lib/render.test.js
```

Expected: all focused tests pass.

---

### Task 3: Block stale rows from scoring and downstream execution decisions

**Files:**

- Modify: `C:\trading\strategy-leaderboard\lib\contest.test.js`
- Modify: `C:\trading\strategy-leaderboard\lib\contest.js`
- Modify: `C:\trading\strategy-leaderboard\lib\command_center.test.js`
- Modify: `C:\trading\strategy-leaderboard\lib\command_center.js`
- Modify: `C:\trading\strategy-leaderboard\lib\sentinel\allocator.test.js`
- Modify: `C:\trading\strategy-leaderboard\lib\sentinel\allocator.js`
- Modify: `C:\trading\strategy-leaderboard\lib\sentinel\promotion_engine.test.js`
- Modify: `C:\trading\strategy-leaderboard\lib\sentinel\promotion_engine.js`

- [ ] **Step 1: Make the contest regression represent stale state**

Replace the stale-source contest test with:

```js
test('scoreboard excludes stale readable sources from top-five scoring', () => {
  const m = buildContestScoreboard([
    snapWithStatus('BULL v0', '2026-05-04T00:00:00Z', tlMixed, 'stale'),
    snapWithStatus('CODEX Pulse v0', '2026-05-04T00:00:00Z', tlMixed, 'live'),
  ], new Date('2026-07-18T00:00:00Z').getTime());

  const opus = m.owners.find(o => o.owner === 'OPUS');
  const codex = m.owners.find(o => o.owner === 'CODEX');
  assert.equal(opus.sum, 0);
  assert.equal(opus.list.length, 0);
  assert.equal(codex.sum, 200);
});
```

Append to `lib/sentinel/allocator.test.js`:

```js
test('buildAllocationModel blocks stale leaderboard rows', () => {
  const rows = [{
    name: 'CODEX Regime Plus L/S v1',
    status: 'stale',
    trades_n: 57,
    returns: { '90d': 21.7 },
    max_dd: -5.4,
    errors: ['stale portfolio snapshot'],
  }];

  const model = buildAllocationModel(allocationConfig, rows);

  assert.equal(model.items[0].status, 'blocked');
  assert.match(model.items[0].reason, /stale/i);
});
```

Append to `lib/sentinel/promotion_engine.test.js`:

```js
test('classifyStrategy blocks stale rows even when configured as core', () => {
  const result = classifyStrategy({
    name: 'Stale Core',
    status: 'stale',
    trades_n: 50,
    returns: { '90d': 12, '30d': 4 },
    pf: 2,
    max_dd: -2,
    errors: ['stale portfolio snapshot'],
  }, { coreNames: new Set(['Stale Core']) });

  assert.equal(result.status, 'blocked');
  assert.match(result.reason, /stale/i);
});
```

Append to `lib/command_center.test.js`:

```js
test('buildCommandCenterModel pauses stale strategy readiness', () => {
  const staleRows = rows.map(row => (
    row.name === 'Strategy A'
      ? { ...row, status: 'stale', errors: ['stale portfolio snapshot'] }
      : row
  ));
  const staleSnapshots = snapshots.map(snapshot => (
    snapshot.strategy.name === 'Strategy A'
      ? { ...snapshot, row: staleRows[0] }
      : snapshot
  ));

  const model = buildCommandCenterModel({
    rows: staleRows,
    registry,
    snapshots: staleSnapshots,
  });

  assert.equal(model.readiness.byName.get('Strategy A').status, 'Pause');
  assert.match(model.readiness.byName.get('Strategy A').reason, /source/i);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test lib/contest.test.js lib/command_center.test.js lib/sentinel/allocator.test.js lib/sentinel/promotion_engine.test.js
```

Expected: stale BULL still scores; stale allocation, promotion, and readiness
remain active or promotable.

- [ ] **Step 3: Implement unusable-row checks**

In `lib/contest.js`, set:

```js
eligible: !['error', 'stale'].includes(snap?.row?.status),
```

In `lib/command_center.js`, change the readiness guard to:

```js
if (['error', 'stale'].includes(row.status) || qualityBlocked || (ddLimit != null && drawdown >= ddLimit)) {
  return { status: 'Pause', reason: qualityBlocked ? 'data quality blocker' : 'risk or source issue' };
}
```

In `lib/sentinel/allocator.js`, replace `hasErrorStatus` with:

```js
function hasUnusableStatus(row) {
  return row?.status === 'error' || row?.status === 'stale';
}
```

Use it in `buildAllocationModel`, returning a status-specific reason:

```js
if (hasUnusableStatus(row)) {
  return {
    ...base,
    status: 'blocked',
    reason: row.status === 'stale'
      ? 'leaderboard row is stale'
      : 'leaderboard row has error status',
  };
}
```

In `lib/sentinel/promotion_engine.js`, replace `hasErrorStatus` with:

```js
function hasUnusableStatus(row) {
  return row?.status === 'error' || row?.status === 'stale';
}
```

Use:

```js
if (hasUnusableStatus(row)) {
  return {
    status: 'blocked',
    reason: row.status === 'stale'
      ? 'strategy row is stale'
      : 'strategy row has error status',
  };
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
node --test lib/contest.test.js lib/command_center.test.js lib/sentinel/allocator.test.js lib/sentinel/promotion_engine.test.js
```

Expected: all focused tests pass.

---

### Task 4: Correct FABLE cache-family error messages

**Files:**

- Create: `C:\trading\Fable\tests\test_cache_health.py`
- Modify: `C:\trading\Fable\fable_engine\cache_health.py`
- Modify: `C:\trading\strategy-leaderboard\docs\superpowers\specs\2026-07-23-leaderboard-health-repair-design.md`

- [ ] **Step 1: Write a failing cache-family isolation test**

Create `tests/test_cache_health.py`:

```python
import unittest

from fable_engine.cache_health import cache_message


class CacheMessageTests(unittest.TestCase):
    def setUp(self):
        self.findings = [
            ("NVDA_1h.csv", "error", "stale equities"),
            ("BTC_1h.csv", "error", "stale crypto"),
        ]
        self.severity = {"equities": "error", "crypto": "error", "both": "error"}

    def test_equities_message_excludes_crypto_findings(self):
        message = cache_message("equities", self.severity, self.findings)

        self.assertIn("NVDA_1h.csv", message)
        self.assertNotIn("BTC_1h.csv", message)
        self.assertTrue(message.startswith("1 issue(s):"))

    def test_crypto_message_excludes_equities_findings(self):
        message = cache_message("crypto", self.severity, self.findings)

        self.assertIn("BTC_1h.csv", message)
        self.assertNotIn("NVDA_1h.csv", message)
        self.assertTrue(message.startswith("1 issue(s):"))

    def test_both_message_includes_both_families(self):
        message = cache_message("both", self.severity, self.findings)

        self.assertIn("NVDA_1h.csv", message)
        self.assertIn("BTC_1h.csv", message)
        self.assertTrue(message.startswith("2 issue(s):"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m unittest discover -s tests -p "test_cache_health.py" -v
```

Expected: import failure because `cache_message` is currently nested inside
`main` and incorrectly returns all findings for each cache.

- [ ] **Step 3: Extract a pure family-aware message function**

Add above `main()` in `fable_engine/cache_health.py`:

```python
def cache_family(filename: str) -> str | None:
    symbol = filename.split("_", 1)[0]
    if symbol in WIDE15:
        return "equities"
    if symbol in CRYPTO8:
        return "crypto"
    return None


def cache_message(which: str, cache_severity: dict[str, str], findings) -> str:
    problems = [finding for finding in findings if finding[1] != "ok"]
    if cache_severity[which] == "ok":
        return "all files fresh"
    if which != "both":
        problems = [
            finding
            for finding in problems
            if cache_family(finding[0]) == which
        ]
    rendered = [f"{name} ({message})" for name, _severity, message in problems]
    return f"{len(rendered)} issue(s): " + "; ".join(rendered[:3])
```

Delete the nested `cache_msg` function. Replace the two summary rows with:

```python
f"| cache-health | EQUITIES CACHE (wide-15 1h/1d) | {ts} | {eq_sev} | local | {cache_message('equities', cache_sev, findings)} |",
f"| cache-health | CRYPTO CACHE (Kraken-8 1h/4h) | {ts} | {cr_sev} | local | {cache_message('crypto', cache_sev, findings)} |",
```

Replace the FABLE dependency message assignment with:

```python
msg = (
    "all data dependencies fresh"
    if sev == "ok"
    else f"{dep} cache: {cache_message(dep, cache_sev, findings)}"
)
```

- [ ] **Step 4: Update the design diagnosis**

Add this sentence to the Diagnosis section of the approved design:

```markdown
The FABLE cache-health renderer also mixed equity findings into crypto summary
messages, so each cache family must filter its own diagnostics.
```

- [ ] **Step 5: Run the FABLE test and verify GREEN**

Run:

```powershell
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m unittest discover -s tests -p "test_cache_health.py" -v
```

Expected: three tests pass.

---

### Task 5: Prevent FABLE from racing Stock Nightly after missed schedules

**Files:**

- Create: `C:\trading\Fable\tests\test_nightly_guard.py`
- Create: `C:\trading\Fable\fable_engine\nightly_guard.py`
- Modify: `C:\trading\Fable\run-fable-nightly.bat`

- [ ] **Step 1: Write a failing existence and behavior test**

Create `tests/test_nightly_guard.py`:

```python
import importlib
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "fable_engine" / "nightly_guard.py"


class NightlyGuardExistenceTests(unittest.TestCase):
    def test_module_exists(self):
        self.assertTrue(MODULE_PATH.exists(), "nightly_guard.py must exist")


@unittest.skipUnless(MODULE_PATH.exists(), "nightly_guard.py not implemented yet")
class NightlyGuardBehaviorTests(unittest.TestCase):
    def setUp(self):
        self.module = importlib.import_module("fable_engine.nightly_guard")

    def test_wait_retries_until_cache_is_ready(self):
        results = iter([1, 1, 0])
        sleeps = []

        code = self.module.wait_for_cache(
            check=lambda: next(results),
            sleeper=sleeps.append,
            attempts=3,
            interval_seconds=5,
        )

        self.assertEqual(code, 0)
        self.assertEqual(sleeps, [5, 5])

    def test_wait_fails_after_bounded_attempts(self):
        sleeps = []

        code = self.module.wait_for_cache(
            check=lambda: 1,
            sleeper=sleeps.append,
            attempts=3,
            interval_seconds=5,
        )

        self.assertEqual(code, 1)
        self.assertEqual(sleeps, [5, 5])


class NightlyGuardLauncherTests(unittest.TestCase):
    def test_batch_uses_nightly_guard(self):
        batch = (ROOT / "run-fable-nightly.bat").read_text(encoding="utf-8")

        self.assertIn("-m fable_engine.nightly_guard", batch)
        self.assertNotIn("-m fable_engine.cache_health >>", batch)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m unittest discover -s tests -p "test_nightly_guard.py" -v
```

Expected: `test_module_exists` and launcher wiring fail.

- [ ] **Step 3: Implement the bounded readiness guard**

Create `fable_engine/nightly_guard.py`:

```python
"""Wait for shared OHLC caches to become healthy before FABLE generation."""
from __future__ import annotations

import argparse
import sys
import time
from collections.abc import Callable

from . import cache_health


def wait_for_cache(
    *,
    check: Callable[[], int],
    sleeper: Callable[[float], None],
    attempts: int,
    interval_seconds: float,
) -> int:
    attempts = max(1, int(attempts))
    interval_seconds = max(0.0, float(interval_seconds))
    for attempt in range(1, attempts + 1):
        result = int(check())
        if result == 0:
            print(f"[nightly-guard] cache ready on attempt {attempt}", flush=True)
            return 0
        if attempt < attempts:
            print(
                f"[nightly-guard] cache not ready; retry {attempt + 1}/{attempts} "
                f"in {interval_seconds:g}s",
                flush=True,
            )
            sleeper(interval_seconds)
    print(f"[nightly-guard] cache still unhealthy after {attempts} attempts", flush=True)
    return 1


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--attempts", type=int, default=12)
    parser.add_argument("--interval-seconds", type=float, default=60)
    args = parser.parse_args(argv)
    return wait_for_cache(
        check=cache_health.main,
        sleeper=time.sleep,
        attempts=args.attempts,
        interval_seconds=args.interval_seconds,
    )


if __name__ == "__main__":
    sys.exit(main())
```

In `run-fable-nightly.bat`, replace the direct cache-health invocation with:

```bat
REM Missed Task Scheduler starts can launch Stock Nightly and FABLE together.
REM Wait on the actual cache-health condition so FABLE never races the upstream
REM refresh or generates from stale data. The wait is bounded at 12 minutes.
"%PY%" -m fable_engine.nightly_guard --attempts 12 --interval-seconds 60 >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [%date% %time%] CACHE HEALTH ERROR - refusing to generate from suspect data >> "%LOGFILE%"
    exit /b 1
)
```

- [ ] **Step 4: Run the nightly-guard tests and verify GREEN**

Run:

```powershell
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m unittest discover -s tests -p "test_nightly_guard.py" -v
```

Expected: four tests pass without sleeping because tests inject a fake sleeper.

---

### Task 6: Add non-truncation integrity coverage

**Files:**

- Modify: `C:\trading\strategy-leaderboard\scripts\codex_snapshot_integrity.test.js`

- [ ] **Step 1: Add the registry and protected-history contract**

Add this test beside the existing protected-CODEX history test:

```js
const MIN_STRATEGY_COUNT = 80;

test('leaderboard registry never shrinks below the captured 80-row baseline', () => {
  assert.ok(
    STRATEGIES.length >= MIN_STRATEGY_COUNT,
    `expected at least ${MIN_STRATEGY_COUNT} strategies, found ${STRATEGIES.length}`,
  );
  const names = STRATEGIES.map(strategy => strategy.name);
  assert.equal(new Set(names).size, names.length, 'strategy names must remain unique');
});
```

Keep the existing `active CODEX snapshots keep their non-empty forward trade
history` test unchanged.

- [ ] **Step 2: Run the integrity tests**

Run:

```powershell
node --test scripts/codex_snapshot_integrity.test.js
```

Expected: two tests pass, proving the current baseline is intact before any data
refresh.

---

### Task 7: Refresh safe local strategy artifacts without committing or pushing

**Files/data potentially regenerated:**

- `C:\trading\strategy-leaderboard\data\basket_variants\*.md`
- `C:\trading\strategy-leaderboard\data\crypto_variants\*.md`
- `C:\trading\strategy-leaderboard\data\fable\*.md`
- `C:\trading\strategy-leaderboard\data\health\cache_health.md`
- `C:\trading\strategy-leaderboard\data\hermes\*`

- [ ] **Step 1: Capture the pre-refresh live integrity baseline**

Run:

```powershell
node --test scripts/codex_snapshot_integrity.test.js
npm run smoke
```

Record: 80 strategies and the `trades_n` values for all protected CODEX names.

- [ ] **Step 2: Make a non-destructive temporary copy of generated families**

Resolve and inspect the backup root before copying:

```powershell
$backup = Join-Path $env:TEMP "leaderboard-health-repair-20260723"
$resolvedParent = [System.IO.Path]::GetFullPath((Split-Path $backup -Parent))
$resolvedBackup = [System.IO.Path]::GetFullPath($backup)
if (-not $resolvedBackup.StartsWith($resolvedParent, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Backup path escaped the intended temp parent"
}
New-Item -ItemType Directory -Force -Path $resolvedBackup | Out-Null
Copy-Item -Recurse -Force -LiteralPath "C:\trading\strategy-leaderboard\data\basket_variants" -Destination $resolvedBackup
Copy-Item -Recurse -Force -LiteralPath "C:\trading\strategy-leaderboard\data\crypto_variants" -Destination $resolvedBackup
Copy-Item -Recurse -Force -LiteralPath "C:\trading\strategy-leaderboard\data\fable" -Destination $resolvedBackup
```

- [ ] **Step 3: Confirm public source connectivity**

Run:

```powershell
Resolve-DnsName api.kraken.com
Invoke-RestMethod -Uri "https://api.kraken.com/0/public/Time" -Method Get
```

Expected: DNS answers and a Kraken public-time response. If either fails, skip
regeneration; stale display handling remains the truthful fix.

- [ ] **Step 4: Refresh crypto basket and crypto mean-reversion data without Git actions**

From `C:\trading\Claude\Trading Strategy`, run:

```powershell
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m basket_breakout.generate_variant_logs
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m crypto_mean_reversion.generate_log --variant v1
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m crypto_mean_reversion.generate_log --variant agg
```

Expected: each command exits zero and writes current local paper artifacts. Do
not pass `--git-commit`.

- [ ] **Step 5: Validate caches and regenerate FABLE without Git actions**

From `C:\trading\Fable`, run:

```powershell
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m fable_engine.nightly_guard --attempts 1 --interval-seconds 0
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m fable_engine.generate
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m fable_engine.allocator
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m fable_engine.hermes_feed
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m fable_engine.hermes_tracker
```

Expected: all commands exit zero; FABLE portfolio timestamps become current.

- [ ] **Step 6: Re-run integrity checks before accepting generated data**

Run:

```powershell
node --test scripts/codex_snapshot_integrity.test.js
npm run smoke
```

Expected:

- at least 80 strategies;
- all protected CODEX histories remain non-empty;
- no local basket or FABLE row is fatally truncated;
- fresh local rows return to `live`;
- unreadable sources are `error`;
- old but readable BULL rows are `stale`.

If a generated family unexpectedly loses its historical trade data, stop and
restore only that family from the inspected temporary backup with `Copy-Item`;
do not reset or restore unrelated working-tree files.

---

### Task 8: Full verification and scoped review

**Files:**

- Verify all modified leaderboard and FABLE files.

- [ ] **Step 1: Run all FABLE tests**

Run:

```powershell
C:\Users\Mhair\AppData\Local\Programs\Python\Python311\python.exe -m unittest discover -s tests -v
```

Expected: all FABLE tests pass with no real sleeps.

- [ ] **Step 2: Run the complete leaderboard test suite**

Run:

```powershell
npm test
```

Expected: zero failures.

- [ ] **Step 3: Run the live smoke workflow**

Run:

```powershell
npm run smoke
```

Expected:

- all 80 rows have valid shape;
- zero fatal errors for readable sources;
- stale external BULL histories remain visible with non-zero trades;
- protected CODEX rows retain non-empty histories.

- [ ] **Step 4: Print the final preservation audit**

Run:

```powershell
@'
import { STRATEGIES, effectiveCutoff } from './registry.js';
import { fetchLocalText } from './lib/fetch.js';

const protectedNames = [
  'CODEX v0',
  'CODEX Aggro v0',
  'CODEX Pulse v0',
  'CODEX Regime v0',
  'CODEX Apex v0',
  'CODEX Regime WFO v1',
  'CODEX Apex WFO v1',
];
const rows = [];
for (const name of protectedNames) {
  const strategy = STRATEGIES.find(item => item.name === name);
  const [portfolio, tradeLog] = await Promise.all([
    fetchLocalText(strategy.source.portfolio_path),
    fetchLocalText(strategy.source.trade_log_path),
  ]);
  const row = strategy.adapter(
    { portfolio, tradeLog, status: { ok: true, text: '' } },
    {
      name,
      startingCapital: strategy.starting_capital,
      liveStartIso: effectiveCutoff(strategy.live_start_iso),
    },
  );
  rows.push({ name, status: row.status, trades: row.trades_n });
}
console.log(JSON.stringify({ strategyCount: STRATEGIES.length, protectedRows: rows }, null, 2));
'@ | node --input-type=module
```

Expected: `strategyCount` is at least 80 and every protected row has
`status: "live"` and `trades > 0`.

- [ ] **Step 5: Inspect only scoped diffs and whitespace**

Run:

```powershell
git diff --check -- adapters/adapter_bull.js adapters/adapter_codex.js adapters/adapters.test.js lib/strategy_row.js lib/source_health.js lib/source_health.test.js lib/render.js lib/render.test.js css/style.css lib/contest.js lib/contest.test.js lib/command_center.js lib/command_center.test.js lib/sentinel/allocator.js lib/sentinel/allocator.test.js lib/sentinel/promotion_engine.js lib/sentinel/promotion_engine.test.js scripts/codex_snapshot_integrity.test.js docs/superpowers/specs/2026-07-23-leaderboard-health-repair-design.md
git diff --stat -- adapters/adapter_bull.js adapters/adapter_codex.js adapters/adapters.test.js lib/strategy_row.js lib/source_health.js lib/source_health.test.js lib/render.js lib/render.test.js css/style.css lib/contest.js lib/contest.test.js lib/command_center.js lib/command_center.test.js lib/sentinel/allocator.js lib/sentinel/allocator.test.js lib/sentinel/promotion_engine.js lib/sentinel/promotion_engine.test.js scripts/codex_snapshot_integrity.test.js docs/superpowers/specs/2026-07-23-leaderboard-health-repair-design.md
```

Expected: no whitespace errors and no files outside the repair scope included.

- [ ] **Step 6: Do not commit or push overlapping dirty-worktree code**

The design spec already has its own isolated commit. Leave implementation
changes uncommitted because the touched adapter and application files contain
pre-existing user changes. Report the exact modified files, tests, smoke counts,
and the uncommitted state to the user.
