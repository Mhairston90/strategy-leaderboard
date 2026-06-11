"""Fill-Realism Parity Study — signal-close fills vs next-bar-open + slippage.

Question: how much of each edge survives realistic execution? Signal-close
fills are optimistic (you cannot trade the close of the bar that produced
the signal). This study reruns every FABLE strategy under
  REALISTIC = entry at next bar OPEN, plus adverse slippage on every fill
              (7.5 bps equities, 20 bps crypto)
and compares to the official signal-close baseline on the same backfill
window. Run once, results written to reports/; official logs unchanged
(June specs are frozen — fill model is part of the spec).
"""
from __future__ import annotations
import copy
import datetime as dt
from pathlib import Path

from .strategies import CONFIGS, PAPER_START_ISO
from .generate import build_signals, _to_unix
from .engine import simulate

OUT = Path(r"C:\trading\strategy-leaderboard\reports\fill_realism_2026-06-10.md")


def main() -> int:
    start = _to_unix(PAPER_START_ISO)
    rows = []
    for key, cfg in CONFIGS.items():
        signals = build_signals(cfg, start)
        base = simulate(signals, cfg, 10000.0)
        r = copy.deepcopy(cfg)
        r.fill_next_open = True
        r.slippage_bps = 20.0 if cfg.asset_class == "crypto" else 7.5
        real = simulate(signals, r, 10000.0)
        delta = real.realized_pnl_total - base.realized_pnl_total
        survival = (real.realized_pnl_total / base.realized_pnl_total * 100.0
                    if abs(base.realized_pnl_total) > 1e-9 else float("nan"))
        rows.append((cfg.display_name, len(base.closed_pnls), base.realized_pnl_total,
                     len(real.closed_pnls), real.realized_pnl_total, delta, survival))
        print(f"{cfg.display_name:38s} base {base.realized_pnl_total:+9.2f} -> real {real.realized_pnl_total:+9.2f}  (d {delta:+8.2f})", flush=True)

    gen = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    md = [
        "# Fill-Realism Parity Study \u2014 2026-06-10",
        "",
        f"> Generated {gen} by `fable_engine.fill_study`. Window: {PAPER_START_ISO} \u2192 today (backfill).",
        "> REALISTIC = next-bar-open entries + adverse slippage on every fill (7.5 bps equities, 20 bps crypto).",
        "> Official logs are UNCHANGED \u2014 June specs are frozen and fill model is part of the spec.",
        "",
        "| Strategy | Closes (base) | PnL signal-close | Closes (real) | PnL realistic | Delta | Survival |",
        "|---|---|---|---|---|---|---|",
    ]
    for name, nb, pb, nr, pr, d, s in rows:
        sv = f"{s:.0f}%" if s == s else "n/a"
        md.append(f"| {name} | {nb} | {pb:+.2f} | {nr} | {pr:+.2f} | {d:+.2f} | {sv} |")
    md += [
        "",
        "## Reading",
        "",
        "Survival = realistic PnL as a share of signal-close PnL on the same",
        "signals. Below ~60% means the paper edge leans heavily on fills you",
        "cannot get. Mean-reversion entries (limit-like, fading moves) are",
        "expected to degrade modestly; breakout/continuation entries (chasing",
        "moves) are expected to degrade most \u2014 the next bar opens further in",
        "the direction being chased.",
        "",
        "## Recommendation",
        "",
        "Adopt REALISTIC fills as the standard for all NEW specs from July",
        "(board-wide), and treat any strategy whose backfill edge does not",
        "survive realistic fills as unproven regardless of its paper numbers.",
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"report -> {OUT}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
