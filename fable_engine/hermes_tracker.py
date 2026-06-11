"""Hermes Item Tracker — gives queue items a lifecycle (FABLE contribution,
spans all camps).

The three Hermes queues are regenerated from scratch every supervisor run,
so items carry no age and decisions can't be tracked against them. This
script diffs the current queues against a persistent tracker:

  data/hermes/item_tracker.json
    items[key] = { first_seen, last_seen, resolved_at, owner, strategy,
                   priority, type, title }

  key = owner|strategy|type|title (lowercased)

Lifecycle:
  - new key            -> first_seen = now
  - present again      -> last_seen = now (resolved_at cleared if it returns)
  - absent this run    -> resolved_at = now (supervisor stopped requesting it)

Review-only: reads queues, writes only the tracker file. Never modifies the
queues themselves or any strategy artifact.
"""
from __future__ import annotations
import datetime as dt
import json
from pathlib import Path

LEADERBOARD = Path(r"C:\trading\strategy-leaderboard")
QUEUES = [
    LEADERBOARD / "data" / "codex" / "hermes_experiment_queue.json",
    LEADERBOARD / "data" / "claude" / "hermes_experiment_queue.json",
    LEADERBOARD / "data" / "fable" / "hermes_experiment_queue.json",
]
OUT = LEADERBOARD / "data" / "hermes" / "item_tracker.json"


def item_key(it: dict) -> str:
    return "|".join(str(it.get(k, "")).strip().lower()
                    for k in ("owner", "strategy", "type", "title"))


def main() -> int:
    now = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    tracker = {"items": {}}
    if OUT.exists():
        try:
            tracker = json.loads(OUT.read_text(encoding="utf-8"))
        except Exception:
            pass
    items = tracker.setdefault("items", {})

    current = {}
    for qpath in QUEUES:
        if not qpath.exists():
            continue
        try:
            q = json.loads(qpath.read_text(encoding="utf-8"))
        except Exception:
            continue
        owner = q.get("owner", "")
        for it in q.get("items", []):
            it = dict(it)
            it.setdefault("owner", owner)
            current[item_key(it)] = it

    new, returned, resolved = 0, 0, 0
    for key, it in current.items():
        rec = items.get(key)
        if rec is None:
            items[key] = {
                "first_seen": now, "last_seen": now, "resolved_at": None,
                "owner": it.get("owner", ""), "strategy": it.get("strategy", ""),
                "priority": it.get("priority", 3), "type": it.get("type", ""),
                "title": it.get("title", ""),
            }
            new += 1
        else:
            rec["last_seen"] = now
            rec["priority"] = it.get("priority", rec.get("priority", 3))
            if rec.get("resolved_at"):
                rec["resolved_at"] = None
                returned += 1
    for key, rec in items.items():
        if key not in current and not rec.get("resolved_at"):
            rec["resolved_at"] = now
            resolved += 1

    tracker["generated_at"] = now
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(tracker, indent=2), encoding="utf-8")
    print(f"[hermes-tracker] tracked={len(items)} new={new} returned={returned} resolved={resolved}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
