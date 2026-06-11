"""FABLE Hermes feed — self-supervision for the FABLE book.

Emits data/fable/hermes_experiment_queue.json in the same schema as the
Claude/Codex Hermes queues, so the Hermes Monitor merges it with an owner
badge. Review-only by design: this script classifies and recommends; it
never modifies specs, registry entries, or trade logs.

Classification (per strategy, forward-paper trades only — entries on/after
live_start, same filter the contest uses):
  insufficient_data : < 10 forward closed trades. Sample collection.
  collapsing        : trailing-14d PF < 0.6 AND trailing PnL < -1% of cap.
  fading_winner     : full-history PF >= 1.2 but trailing-14d PF < 0.8.
  recovering        : full-history PF < 1.0 but trailing-14d PF >= 1.2.
  stable_profitable : trailing-14d PF >= 1.0 and full PF >= 1.0.
  stable_losing     : everything else.

Killswitch proximity check: if realized drawdown from peak exceeds 90% of
the row's killswitch_dd_pct, a priority-1 repair item is raised regardless
of classification (mirrors the leaderboard's amber tint).
"""
from __future__ import annotations
import datetime as dt
import json
import re
import subprocess
from pathlib import Path

LEADERBOARD = Path(r"C:\trading\strategy-leaderboard")
DATA = LEADERBOARD / "data" / "fable"
OUT = DATA / "hermes_experiment_queue.json"
LIVE_START = dt.datetime(2026, 6, 10, tzinfo=dt.timezone.utc)
CAPITAL = 10000.0
MIN_FORWARD = 10
TRAIL_DAYS = 14

BOOK = [
    ("FABLE Equities Snapback L/S v1", "fable_snapback_ls", 20),
    ("FABLE Equities Snapback Turbo", "fable_snapback_turbo", 40),
    ("FABLE Equities Afterburner v1", "fable_afterburner", 25),
    ("FABLE Equities Fader v1", "fable_fader", 20),
    ("FABLE Equities Gap Snap v1", "fable_gap_snap", 20),
    ("FABLE Crypto Pulse L/S v1", "fable_crypto_pulse", 25),
    ("FABLE Crypto Drift v1", "fable_crypto_drift", 40),
    ("FABLE Meta-Allocator v1", "fable_meta_allocator", 20),
]

ROW_RE = re.compile(r"^\|\s*(\d{4}-\d{2}-\d{2}T[\d:]+Z)\s*\|\s*(OPEN|CLOSE)\s*\|")


def parse_trips(path: Path):
    """Pair OPEN/CLOSE by symbol; return [(entry_dt, exit_dt, pnl)]."""
    trips, open_idx = [], {}
    if not path.exists():
        return trips
    for line in path.read_text(encoding="utf-8").splitlines():
        m = ROW_RE.match(line)
        if not m:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 10:
            continue
        ts = dt.datetime.fromisoformat(cells[0].replace("Z", "+00:00"))
        action, sym = cells[1], cells[2]
        if action == "OPEN":
            open_idx[sym] = ts
        else:
            entry = open_idx.pop(sym, None)
            if entry is None:
                continue
            try:
                pnl = float(cells[9].replace("+", ""))
            except ValueError:
                continue
            trips.append((entry, ts, pnl))
    return trips


def pf(pnls):
    gains = sum(p for p in pnls if p > 0)
    losses = -sum(p for p in pnls if p < 0)
    if losses == 0:
        return float("inf") if gains > 0 else 0.0
    return gains / losses


def classify(name, key, ks_pct, now):
    trips = parse_trips(DATA / f"{key}_trade_log.md")
    fwd = [(e, x, p) for e, x, p in trips if e >= LIVE_START]
    fwd_pnls = [p for _, _, p in fwd]
    trail_cut = now - dt.timedelta(days=TRAIL_DAYS)
    trail_pnls = [p for e, x, p in fwd if x >= trail_cut]

    # realized drawdown from peak over forward equity
    eq, peak, max_dd = 0.0, 0.0, 0.0
    for _, _, p in sorted(fwd, key=lambda t: t[1]):
        eq += p
        peak = max(peak, eq)
        max_dd = max(max_dd, peak - eq)
    dd_pct = max_dd / CAPITAL * 100.0

    item = {
        "owner": "fable",
        "strategy": name,
        "strategy_id": key.replace("_", "-"),
        "priority": 3,
        "type": "sample_collection",
        "title": "",
        "source": "data/fable/hermes_experiment_queue.json",
        "requested_action": "",
    }

    if dd_pct >= 0.9 * ks_pct:
        cls = "collapsing"
        item.update(priority=1, type="repair",
                    title=f"Killswitch proximity: {name}",
                    requested_action=(f"Forward realized DD {dd_pct:.1f}% vs killswitch {ks_pct}%. "
                                      "PAUSE/CONTINUE/KILL decision required per spec recovery rules."))
        return cls, item

    if len(fwd_pnls) < MIN_FORWARD:
        cls = "insufficient_data"
        item.update(title=f"Keep collecting forward sample for {name}",
                    requested_action=(f"{len(fwd_pnls)}/{MIN_FORWARD} forward closes since live_start "
                                      f"{LIVE_START.date()}. No classification until the sample gate is met; "
                                      "no promotion/repair decisions on backfill numbers."))
        return cls, item

    full_pf, trail_pf = pf(fwd_pnls), pf(trail_pnls)
    trail_pnl = sum(trail_pnls)

    if trail_pf < 0.6 and trail_pnl < -0.01 * CAPITAL:
        cls = "collapsing"
        item.update(priority=1, type="experiment",
                    title=f"Address collapse in {name}",
                    requested_action=(f"Trailing-{TRAIL_DAYS}d PF {trail_pf:.2f}, PnL {trail_pnl:+.0f}. "
                                      "Decide: halve risk on new entries, pause pending diagnosis, or archive."))
    elif full_pf >= 1.2 and trail_pf < 0.8:
        cls = "fading_winner"
        item.update(priority=1, type="experiment",
                    title=f"Defend {name} — winner fading in current window",
                    requested_action=(f"Full forward PF {full_pf:.2f} but trailing-{TRAIL_DAYS}d PF {trail_pf:.2f}. "
                                      "Diagnose regime fit before the edge decays further."))
    elif full_pf < 1.0 and trail_pf >= 1.2:
        cls = "recovering"
        item.update(priority=2,
                    title=f"Confirm recovery in {name}",
                    requested_action=(f"Trailing-{TRAIL_DAYS}d PF {trail_pf:.2f} vs full {full_pf:.2f}. "
                                      "Collect sample; no sizing changes until recovery is confirmed."))
    elif trail_pf >= 1.0 and full_pf >= 1.0:
        cls = "stable_profitable"
        item.update(title=f"Keep collecting sample for {name}",
                    requested_action=(f"Stable: forward PF {full_pf:.2f}, trailing {trail_pf:.2f}. "
                                      "Stay the course; review at month boundary for registration."))
    else:
        cls = "stable_losing"
        item.update(priority=2, type="experiment",
                    title=f"Repair weak edge in {name}",
                    requested_action=(f"Forward PF {full_pf:.2f}, trailing {trail_pf:.2f}. "
                                      "Design ONE one-variable repair experiment; no promotion evidence until PF > 1.2."))
    return cls, item


def main() -> int:
    now = dt.datetime.now(dt.timezone.utc)
    counts = {k: 0 for k in ("collapsing", "fading_winner", "recovering",
                             "stable_profitable", "stable_losing", "insufficient_data")}
    items = []
    for name, key, ks in BOOK:
        cls, item = classify(name, key, ks, now)
        counts[cls] += 1
        items.append(item)
    items.sort(key=lambda i: (i["priority"], i["strategy"]))
    payload = {
        "owner": "fable",
        "generated_at": now.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "guardrails": [
            "Review-only: no live routing, position-sizing, or spec files were modified.",
            "Queue items are research and operational recommendations only.",
            "FABLE Hermes feed does not write trade logs, portfolios, or registry entries.",
            "Classifications use forward-paper trades only (entries on/after live_start) — backfill is never classified.",
        ],
        "summary": {"queue_items": len(items), **counts},
        "items": items,
    }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[fable-hermes] items={len(items)} " +
          " ".join(f"{k}={v}" for k, v in counts.items() if v), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
