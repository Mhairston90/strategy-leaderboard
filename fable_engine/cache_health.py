"""Cache Health Sentinel — OHLC data-integrity checks for the shared caches.

The layer below source-health and routine-status: those confirm the
machinery ran; this confirms the FUEL is fresh. Built after the
CryptoCompare incident, where nightly regenerations kept exiting cleanly for
days while the underlying bars had silently stopped advancing.

Checks per cached CSV:
  1. STALENESS — last bar age vs expectation:
       equities (1h/1d): last bar date >= most recent weekday before today
                         (weekend-aware; rare holiday false-warns accepted)
       crypto 1h: warn > 26h (a missed nightly refresh), error > 50h
       crypto 4h: warn > 30h, error > 54h
  2. SHRINKAGE — row count vs previous run (state in cache_health_state.json);
       error if a file lost > 5% of its rows.
  3. GAPS — max gap between consecutive bars in the last 200:
       crypto: warn > 6x interval; equities 1h: warn > 100h (holiday-weekend-aware).

Output: strategy-leaderboard/data/health/cache_health.md in the
routine-status table format, one line per FABLE strategy (named exactly as
its registry row so adapter warnings light up) plus one summary line per
cache. Any other camp's row can opt in by setting
source.status_path = 'data/health/cache_health.md' and emitting its name
here. Exit code 1 on any error-severity finding so schedulers notice.
"""
from __future__ import annotations
import datetime as dt
import json
import sys
from pathlib import Path

import pandas as pd

STOCKS_DATA = Path(r"C:\trading\Claude\Trading Strategy\basket_breakout_stocks\data")
CRYPTO_DATA = Path(r"C:\trading\Claude\Trading Strategy\basket_breakout\data")
LEADERBOARD = Path(r"C:\trading\strategy-leaderboard")
OUT = LEADERBOARD / "data" / "health" / "cache_health.md"
STATE = Path(r"C:\trading\Fable\cache_health_state.json")

WIDE15 = ["NVDA", "AMD", "AVGO", "AAPL", "PLTR", "META", "NFLX", "DIS",
          "TSLA", "NKE", "OXY", "JPM", "LLY", "CAT", "FCX"]
CRYPTO8 = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "DOT", "LINK"]

SEV = {"ok": 0, "warn": 1, "error": 2}


def worse(a: str, b: str) -> str:
    return a if SEV[a] >= SEV[b] else b


def last_weekday_before(d: dt.date) -> dt.date:
    d -= dt.timedelta(days=1)
    while d.weekday() >= 5:
        d -= dt.timedelta(days=1)
    return d


def check_file(path: Path, kind: str, prev_rows: int | None, now: dt.datetime):
    """Returns (severity, n_rows, message)."""
    if not path.exists():
        return "error", 0, "file missing"
    try:
        df = pd.read_csv(path, usecols=["time"])
    except Exception as e:
        return "error", 0, f"unreadable: {e}"
    n = len(df)
    if n == 0:
        return "error", 0, "empty file"
    sev, msgs = "ok", []

    last = dt.datetime.fromtimestamp(int(df["time"].iloc[-1]), dt.timezone.utc)
    age_h = (now - last).total_seconds() / 3600.0

    if kind in ("eq_1h", "eq_1d"):
        required = last_weekday_before(now.date())
        if last.date() < required:
            sev = worse(sev, "warn" if (required - last.date()).days <= 2 else "error")
            msgs.append(f"stale: last bar {last.date()} < required {required}")
    elif kind == "cr_1h":
        if age_h > 50: sev, _ = worse(sev, "error"), msgs.append(f"stale {age_h:.1f}h")
        elif age_h > 26: sev, _ = worse(sev, "warn"), msgs.append(f"stale {age_h:.1f}h")
    elif kind == "cr_4h":
        if age_h > 54: sev, _ = worse(sev, "error"), msgs.append(f"stale {age_h:.1f}h")
        elif age_h > 30: sev, _ = worse(sev, "warn"), msgs.append(f"stale {age_h:.1f}h")

    if prev_rows is not None and n < prev_rows * 0.95:
        sev = worse(sev, "error")
        msgs.append(f"shrank {prev_rows}->{n}")

    tail = df["time"].tail(200).diff().dropna()
    if len(tail):
        mx = float(tail.max()) / 3600.0
        # eq_1h 100h covers 3-day holiday weekends (e.g. Memorial Day = 90h)
        limit = {"eq_1h": 100.0, "eq_1d": 110.0, "cr_1h": 6.0, "cr_4h": 24.0}[kind]
        if mx > limit:
            sev = worse(sev, "warn")
            msgs.append(f"gap {mx:.0f}h in last 200 bars")

    return sev, n, "; ".join(msgs) if msgs else f"fresh, {n} rows, last {last.strftime('%m-%d %H:%MZ')}"


# FABLE registry-row name -> which caches it depends on
FABLE_DEPS = {
    "FABLE Equities Snapback L/S v1": "equities",
    "FABLE Equities Snapback Turbo": "equities",
    "FABLE Equities Afterburner v1": "equities",
    "FABLE Equities Fader v1": "equities",
    "FABLE Equities Gap Snap v1": "equities",
    "FABLE Crypto Pulse L/S v1": "crypto",
    "FABLE Crypto Drift v1": "crypto",
    "FABLE Meta-Allocator v1": "both",
}


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


def main(*, require_ok: bool = False, now: dt.datetime | None = None) -> int:
    now = now or dt.datetime.now(dt.timezone.utc)
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    new_state, findings = {}, []

    def run_check(path: Path, kind: str):
        key = str(path)
        sev, n, msg = check_file(path, kind, state.get(key), now)
        new_state[key] = n
        findings.append((path.name, sev, msg))
        return sev

    eq_sev = "ok"
    for s in WIDE15:
        eq_sev = worse(eq_sev, run_check(STOCKS_DATA / f"{s}_1h.csv", "eq_1h"))
        eq_sev = worse(eq_sev, run_check(STOCKS_DATA / f"{s}_1d.csv", "eq_1d"))
    cr_sev = "ok"
    for s in CRYPTO8:
        cr_sev = worse(cr_sev, run_check(CRYPTO_DATA / f"{s}_1h.csv", "cr_1h"))
        cr_sev = worse(cr_sev, run_check(CRYPTO_DATA / f"{s}_4h.csv", "cr_4h"))

    cache_sev = {"equities": eq_sev, "crypto": cr_sev, "both": worse(eq_sev, cr_sev)}
    ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    problems = [f for f in findings if f[1] != "ok"]

    lines = [
        "# Cache Health \u2014 shared OHLC data-integrity sentinel",
        "",
        "> Auto-generated by `fable_engine.cache_health` (FABLE contribution, protects all camps).",
        f"> Last run: {ts}. Checks staleness, shrinkage, and gaps on the two shared caches.",
        "",
        "| Routine | Strategy | Timestamp UTC | Status | Data source | Message |",
        "|---------|----------|---------------|--------|-------------|---------|",
        f"| cache-health | EQUITIES CACHE (wide-15 1h/1d) | {ts} | {eq_sev} | local | {cache_message('equities', cache_sev, findings)} |",
        f"| cache-health | CRYPTO CACHE (Kraken-8 1h/4h) | {ts} | {cr_sev} | local | {cache_message('crypto', cache_sev, findings)} |",
    ]
    for name, dep in FABLE_DEPS.items():
        sev = cache_sev[dep]
        msg = (
            "all data dependencies fresh"
            if sev == "ok"
            else f"{dep} cache: {cache_message(dep, cache_sev, findings)}"
        )
        lines.append(f"| cache-health | {name} | {ts} | {sev} | local | {msg} |")

    lines += ["", "## Detail", ""]
    for n, sv, m in findings:
        if sv != "ok":
            lines.append(f"- **{sv.upper()}** `{n}` \u2014 {m}")
    if not problems:
        lines.append("_No issues. All " + str(len(findings)) + " cached files passed._")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    worst = worse(eq_sev, cr_sev)
    # Shrinkage compares against the last fully healthy cache set. Persisting
    # counts from a failed/warning run would let a retry normalize truncated
    # or stale inputs into a new baseline and incorrectly pass.
    if worst == "ok":
        STATE.write_text(json.dumps(new_state, indent=0), encoding="utf-8")
    print(f"[cache-health] equities={eq_sev} crypto={cr_sev} files={len(findings)} problems={len(problems)}", flush=True)
    if require_ok:
        return 0 if worst == "ok" else 1
    return 1 if worst == "error" else 0


if __name__ == "__main__":
    sys.exit(main())

