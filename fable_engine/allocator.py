"""FABLE Meta-Allocator v1 — the fund-of-strategies layer.

Allocates one $10k paper account across the FABLE strategy book using only
information available the day before each allocation (no look-ahead):

  Eligibility:  strategy has >= 10 closed trades to date AND positive
                trailing-30d realized PnL.
  Weights:      inverse-volatility (sigma = std of trailing-20d daily PnL,
                floored at $5/day), normalized over eligible strategies,
                capped at 40% per strategy (re-normalized after capping
                may leave residual cash — that is intentional).
  Deadband:     re-allocate only when some target weight drifts > 0.15
                absolute from the held weight (avoids churn).
  Cash:         if nothing is eligible, the book sits 100% cash.

Daily settle: allocator PnL on day D = sum_i w_i * pnl_i(D), where pnl_i is
strategy i's realized PnL that UTC day on its own $10k account (all FABLE
strategies share the $10k normalization, so weights map 1:1).

Inputs are the PUBLIC trade-log markdown files in data/fable/ — the same
files every competitor can audit — parsed for CLOSE rows. The engine is
generic over (name, path) pairs, so a v2 spanning the whole board is a
config change, not a rewrite.

Output: data/fable/fable_meta_allocator_trade_log.md + portfolio.md, with
one OPEN/CLOSE "BOOK" pair per UTC day that had underlying activity
(R convention: 1R = $100 = 1% of capital). live_start 2026-06-10 (honest);
pre-live days are backtest, excluded by the adapter.
"""
from __future__ import annotations
import argparse
import datetime as dt
import re
import statistics
import subprocess
from pathlib import Path

LEADERBOARD = Path(r"C:\trading\strategy-leaderboard")
OUT_DIR = LEADERBOARD / "data" / "fable"
LIVE_START_ISO = "2026-06-10T00:00:00Z"
STARTING_CAPITAL = 10000.0

BOOK = [
    ("FABLE Equities Snapback L/S v1", OUT_DIR / "fable_snapback_ls_trade_log.md"),
    ("FABLE Equities Snapback Turbo",  OUT_DIR / "fable_snapback_turbo_trade_log.md"),
    ("FABLE Equities Afterburner v1",  OUT_DIR / "fable_afterburner_trade_log.md"),
    ("FABLE Equities Fader v1",        OUT_DIR / "fable_fader_trade_log.md"),
    ("FABLE Equities Gap Snap v1",     OUT_DIR / "fable_gap_snap_trade_log.md"),
    ("FABLE Crypto Pulse L/S v1",      OUT_DIR / "fable_crypto_pulse_trade_log.md"),
    ("FABLE Crypto Drift v1",          OUT_DIR / "fable_crypto_drift_trade_log.md"),
]

MIN_TRADES = 10
MOM_DAYS = 30
VOL_DAYS = 20
VOL_FLOOR = 5.0
WEIGHT_CAP = 0.40
DEADBAND = 0.15

ROW_RE = re.compile(r"^\|\s*(\d{4}-\d{2}-\d{2})T[\d:]+Z\s*\|\s*CLOSE\s*\|")


def parse_daily_pnl(path: Path) -> dict:
    """UTC date -> (realized PnL that day, closes that day)."""
    out: dict = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        m = ROW_RE.match(line)
        if not m:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        # | ts | CLOSE | pair | side | size | price | stop | target | r | pnl | reason |
        if len(cells) < 10:
            continue
        try:
            pnl = float(cells[9].replace("+", "").replace("\u2014", "nan"))
        except ValueError:
            continue
        if pnl != pnl:   # NaN
            continue
        d = dt.date.fromisoformat(m.group(1))
        cur = out.get(d, (0.0, 0))
        out[d] = (cur[0] + pnl, cur[1] + 1)
    return out


def run(start: dt.date, end: dt.date):
    series = {name: parse_daily_pnl(p) for name, p in BOOK}
    names = [n for n, _ in BOOK]

    held = {n: 0.0 for n in names}
    nav = STARTING_CAPITAL
    days = []          # (date, pnl, weights snapshot, rebalanced?)
    cum_trades = {n: 0 for n in names}

    d = start
    one = dt.timedelta(days=1)
    while d <= end:
        # ---- compute targets from data strictly BEFORE d ----
        targets = {}
        for n in names:
            s = series[n]
            hist_trades = cum_trades[n]
            mom = sum(s.get(d - dt.timedelta(days=k), (0.0, 0))[0] for k in range(1, MOM_DAYS + 1))
            vols = [s.get(d - dt.timedelta(days=k), (0.0, 0))[0] for k in range(1, VOL_DAYS + 1)]
            sigma = max(statistics.pstdev(vols) if len(vols) > 1 else VOL_FLOOR, VOL_FLOOR)
            eligible = hist_trades >= MIN_TRADES and mom > 0
            # inverse-vol won the pre-freeze 3-way (equal / inv-vol / Sharpe-
            # weighted) on the backfill: +35 vs -141 vs -167. Frozen.
            targets[n] = (1.0 / sigma) if eligible else 0.0
        total = sum(targets.values())
        if total > 0:
            targets = {n: min(v / total, WEIGHT_CAP) for n, v in targets.items()}
        else:
            targets = {n: 0.0 for n in names}

        # ---- deadband rebalance ----
        rebalanced = False
        if any(abs(targets[n] - held[n]) > DEADBAND for n in names):
            held = dict(targets)
            rebalanced = True

        # ---- settle the day with held weights ----
        day_pnl = 0.0
        activity = 0
        for n in names:
            pnl, k = series[n].get(d, (0.0, 0))
            day_pnl += held[n] * pnl
            activity += k
            cum_trades[n] += k
        if activity > 0 or rebalanced:
            days.append((d, day_pnl, dict(held), rebalanced))
            nav += day_pnl
        d += one

    return days, nav, held


def render(days, nav, held, generated_at):
    closed = [p for _, p, _, _ in days]
    n = len(closed)
    wins = [p for p in closed if p > 0]
    win_pct = round(100.0 * len(wins) / n, 1) if n else 0.0
    realized = nav - STARTING_CAPITAL
    lines = [
        "# FABLE Meta-Allocator v1 \u2014 Trade Log",
        "",
        "> **Auto-generated by `fable_engine.allocator`. Do not edit by hand.**",
        f"> **Last regenerated:** {generated_at}",
        f"> **Live start (honest creation date):** {LIVE_START_ISO} _(pre-live days are backtest; excluded from contest equity by the adapter)_",
        "> **Owner:** FABLE (Claude Fable 5) \u2014 fund-of-strategies layer over the FABLE book",
        "> **Venue:** meta \u2014 allocates $10k across the 7 FABLE strategies, daily settle",
        "> **Edge:** momentum-gated inverse-vol weights (risk parity over earning legs), 0.15 deadband, 40% cap; sits in cash when nothing qualifies",
        "> **R convention:** 1R = $100 (1% of capital) per daily settle row",
        "",
        "## Summary",
        "",
        f"- Closed events: **{n}** (daily settles)",
        f"- Win rate: **{win_pct}%**",
        f"- Realized PnL (cumulative): **{'+' if realized >= 0 else ''}{realized:.2f}**",
        f"- Ending equity: **{nav:.2f}** (started {STARTING_CAPITAL:.2f})",
        "- Open at end: **0**",
        "",
        "## Schema",
        "",
        "| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag |",
        "|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|",
        "",
        "## Entries",
        "",
    ]
    run_nav = STARTING_CAPITAL
    for d, pnl, _, reb in days:
        o = f"{d}T00:00:00Z"
        c = f"{d}T23:00:00Z"
        r = pnl / 100.0
        tag = "alloc-daily-settle" + ("-rebalanced" if reb else "")
        lines.append(f"| {o} | OPEN | BOOK | long | 1 | {run_nav:.2f} | \u2014 | \u2014 | \u2014 | \u2014 | {tag} |")
        run_nav += pnl
        lines.append(f"| {c} | CLOSE | BOOK | long | 1 | {run_nav:.2f} | \u2014 | \u2014 | {'+' if r >= 0 else ''}{r:.3f} | {'+' if pnl >= 0 else ''}{pnl:.4f} | {tag} |")
    if not days:
        lines.append("_No settle days in window yet._")
    body = "\n".join(lines) + "\n"

    wrows = "\n".join(
        f"| {n} | {held[n]*100:.1f}% |" for n, _ in BOOK
    )
    cash = max(0.0, 1.0 - sum(held.values()))
    pf = (
        "# FABLE Meta-Allocator v1 \u2014 Portfolio Snapshot\n\n"
        f"> Auto-generated by `fable_engine.allocator`. Last regenerated: {generated_at}\n\n"
        f"- Cash: **{nav:.2f}**\n"
        f"- Realized PnL (cumulative): **{'+' if realized >= 0 else ''}{realized:.2f}**\n"
        "- Unrealized PnL: **0.00** _(daily-settled book)_\n"
        f"- Current equity: **{nav:.2f}**\n"
        f"- Equity peak: **{max(STARTING_CAPITAL, nav):.2f}**\n"
        f"- Drawdown from peak: **{max(0.0, (STARTING_CAPITAL - nav) / STARTING_CAPITAL * 100):.2f}%**\n\n"
        "## Current weights\n\n"
        "| Strategy | Weight |\n|---|---|\n"
        f"{wrows}\n"
        f"| _cash_ | {cash*100:.1f}% |\n\n"
        "## Open positions (0)\n\n_Daily-settled \u2014 no overnight open rows._\n"
    )
    return body, pf


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--git-commit", action="store_true")
    args = ap.parse_args()
    generated_at = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    start = dt.date(2026, 4, 16)
    end = dt.datetime.now(dt.timezone.utc).date()
    days, nav, held = run(start, end)
    log_md, pf_md = render(days, nav, held, generated_at)
    (OUT_DIR / "fable_meta_allocator_trade_log.md").write_text(log_md, encoding="utf-8")
    (OUT_DIR / "fable_meta_allocator_portfolio.md").write_text(pf_md, encoding="utf-8")
    realized = nav - STARTING_CAPITAL
    print(f"[fable-allocator] settles: {len(days)}  realized: {realized:+.2f}  nav: {nav:.2f}", flush=True)
    if args.git_commit:
        rels = ["data/fable/fable_meta_allocator_trade_log.md", "data/fable/fable_meta_allocator_portfolio.md"]
        subprocess.run(["git", "-C", str(LEADERBOARD), "add", "--", *rels], check=True)
        diff = subprocess.run(["git", "-C", str(LEADERBOARD), "diff", "--cached", "--quiet"], check=False)
        if diff.returncode != 0:
            subprocess.run(["git", "-C", str(LEADERBOARD), "commit", "-m", f"fable allocator: regenerated {generated_at}"], check=True)
            subprocess.run(["git", "-C", str(LEADERBOARD), "push"], check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())



