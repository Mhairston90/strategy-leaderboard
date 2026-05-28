#!/usr/bin/env node
// parity_audit.js — compare backtest vs paper portfolio results.
// Usage: node scripts/parity_audit.js [--md]
//   --md   also write the report to data/codex/parity_audit.md

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// ---------- portfolio parser (handles both CODEX $-prefixed and basket bare-number formats) ----------
export function parsePortfolio(text) {
  const num = (s) => {
    if (s === undefined || s === null) return null;
    const cleaned = String(s).replace(/[$,+\s]/g, "");
    const v = parseFloat(cleaned);
    return Number.isFinite(v) ? v : null;
  };
  const grab = (re) => {
    const m = text.match(re);
    return m ? num(m[1]) : null;
  };
  const equity = grab(/Current equity\s*[:*]+\s*\*?\*?\s*\$?(-?[\d,.]+)/i);
  const startingEquity = grab(/Starting equity\s*[:*]+\s*\*?\*?\s*\$?(-?[\d,.]+)/i) ?? 10000;
  const realized = grab(/Realized PnL[^*]*?\*\*\s*\$?(-?[\d,.+]+)/i);
  const peak = grab(/Equity peak\s*[:*]+\s*\*?\*?\s*\$?(-?[\d,.]+)/i);
  const dd = grab(/Drawdown from peak\s*[:*]+\s*\*?\*?\s*(-?[\d.]+)%/i);

  let closedTrades = 0;
  const sleeveTableMatch = text.match(/## Sleeve allocation\s*\|[^]+?(?=\n##|\n#|$)/);
  if (sleeveTableMatch) {
    const lines = sleeveTableMatch[0].split("\n");
    for (const line of lines) {
      if (!line.startsWith("|")) continue;
      if (line.includes("---")) continue;
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 5) {
        const sleeve = cells[0].toLowerCase();
        if (sleeve === "sleeve" || sleeve.startsWith("cash")) continue;
        const n = parseInt(cells[4], 10);
        if (Number.isFinite(n)) closedTrades += n;
      }
    }
  }

  return {
    startingEquity,
    equity,
    realized,
    peak,
    drawdownPct: dd,
    returnPct: equity != null ? ((equity - startingEquity) / startingEquity) * 100 : null,
    closedTrades,
  };
}

// ---------- strategy map ----------
const STRATEGY_MAP = [
  { name: "CODEX v0",                          backtest: "data/codex/backtests/codex_4w_portfolio.md",            paper: "data/codex/portfolio.md" },
  { name: "CODEX Aggro v0",                    backtest: "data/codex/backtests/aggro_4w_portfolio.md",            paper: "data/codex/aggro_portfolio.md" },
  { name: "CODEX Apex v0",                     backtest: "data/codex/backtests/apex_4w_portfolio.md",             paper: "data/codex/apex_portfolio.md" },
  { name: "CODEX Apex WFO v1",                 backtest: "data/codex/backtests/apex_wfo_4w_portfolio.md",         paper: "data/codex/apex_wfo_portfolio.md" },
  { name: "CODEX Pulse v0",                    backtest: "data/codex/backtests/pulse_4w_portfolio.md",            paper: "data/codex/pulse_portfolio.md" },
  { name: "CODEX Regime v0",                   backtest: "data/codex/backtests/regime_4w_portfolio.md",           paper: "data/codex/regime_portfolio.md" },
  { name: "CODEX Regime WFO v1",               backtest: "data/codex/backtests/regime_wfo_4w_portfolio.md",       paper: "data/codex/regime_wfo_portfolio.md" },
  { name: "CODEX Equities Breakout Runner v1", backtest: "data/codex/backtests/equities_breakout_4w_portfolio.md", paper: "data/codex/equities_breakout_portfolio.md" },
  { name: "CODEX Equities Gap Fade v0",        backtest: "data/codex/backtests/equities_gap_4w_portfolio.md",      paper: "data/codex/equities_gap_portfolio.md" },
  { name: "CODEX Equities Regime Hedge v1",    backtest: null,                                                     paper: "data/codex/equities_hedge_portfolio.md" },
];

const ORPHAN_BACKTESTS = [
  "data/codex/backtests/donchian_ensemble_4w_portfolio.md",
  "data/codex/backtests/donchian_iqr_4w_portfolio.md",
  "data/codex/backtests/equities_gap_v1_4w_portfolio.md",
  "data/codex/backtests/equities_orb_4w_portfolio.md",
  "data/codex/backtests/equities_rs_4w_portfolio.md",
];

// ---------- formatting + explanation ----------
function fmtPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "n/a";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
function fmtDelta(b, p) {
  if (b === null || p === null) return "n/a";
  const d = p - b;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(2)}pp`;
}
function explainDelta(b, p) {
  const reasons = [];
  if (!b || !p) return "incomplete data (backtest or paper file missing)";
  if (p.closedTrades === 0 && b.closedTrades > 0) {
    reasons.push(`paper has 0 closed trades vs backtest ${b.closedTrades} — signal not firing in live data`);
  } else if (b.closedTrades > 0 && p.closedTrades > 0 && p.closedTrades / b.closedTrades < 0.25) {
    reasons.push(`paper trade volume ${p.closedTrades}/${b.closedTrades} (${Math.round(100 * p.closedTrades / b.closedTrades)}% of backtest) — paper under-sampling signal`);
  }
  if (b.returnPct != null && p.returnPct != null) {
    if (Math.sign(b.returnPct) !== Math.sign(p.returnPct) && p.returnPct !== 0 && b.returnPct !== 0) {
      reasons.push(`direction mismatch: BT ${fmtPct(b.returnPct)} vs paper ${fmtPct(p.returnPct)}`);
    }
  }
  if (b.drawdownPct != null && p.drawdownPct != null && p.drawdownPct > b.drawdownPct * 2 && p.drawdownPct > 5) {
    reasons.push(`paper DD ${p.drawdownPct.toFixed(2)}% > 2x BT DD ${b.drawdownPct.toFixed(2)}% — slippage or timing gap`);
  }
  if (reasons.length === 0) return "within sample noise";
  return reasons.join("; ");
}

// ---------- main ----------
function main() {
  const writeMd = process.argv.includes("--md");
  const rows = [];
  for (const s of STRATEGY_MAP) {
    let b = null, p = null;
    try { if (s.backtest) b = parsePortfolio(readFileSync(join(REPO_ROOT, s.backtest), "utf8")); } catch (_) {}
    try { if (s.paper)    p = parsePortfolio(readFileSync(join(REPO_ROOT, s.paper),    "utf8")); } catch (_) {}
    rows.push({ strategy: s.name, b, p });
  }

  const header = ["Strategy", "BT ret", "Paper ret", "Delta", "BT trades", "Paper trades", "BT DD", "Paper DD", "Explanation"];
  const tableRows = rows.map(({ strategy, b, p }) => [
    strategy,
    b ? fmtPct(b.returnPct) : "n/a",
    p ? fmtPct(p.returnPct) : "n/a",
    (b && p) ? fmtDelta(b.returnPct, p.returnPct) : "n/a",
    b ? String(b.closedTrades) : "n/a",
    p ? String(p.closedTrades) : "n/a",
    (b && b.drawdownPct != null) ? `${b.drawdownPct.toFixed(2)}%` : "n/a",
    (p && p.drawdownPct != null) ? `${p.drawdownPct.toFixed(2)}%` : "n/a",
    explainDelta(b, p),
  ]);

  const md = [
    "# Backtest vs Paper Parity Audit",
    "",
    `> Generated: ${new Date().toISOString()}`,
    "",
    "| " + header.join(" | ") + " |",
    "|" + header.map(() => "---").join("|") + "|",
    ...tableRows.map((r) => "| " + r.join(" | ") + " |"),
    "",
    "## Notes",
    "",
    "- **BT ret** = `(current_equity - starting_equity) / starting_equity` from `data/codex/backtests/*_4w_portfolio.md`",
    "- **Paper ret** = same metric from `data/codex/*.md` (live paper rotation)",
    "- **Delta** = paper - backtest (positive = paper outperformed BT)",
    "- **Trades** = sum of `Closed trades` across non-cash sleeves",
    "- Backtest period is the 4-week window per the BT file; paper period is whatever has accumulated since spec freeze (typically 1-2 weeks at this point)",
    "- Heuristic flags only; not statistical significance tests",
    "",
    "## Orphan backtests (no paper counterpart yet)",
    "",
  ];
  for (const path of ORPHAN_BACKTESTS) {
    try {
      const t = readFileSync(join(REPO_ROOT, path), "utf8");
      const r = parsePortfolio(t);
      md.push(`- \`${basename(path)}\` -> ${fmtPct(r.returnPct)} return, ${r.closedTrades} trades, DD ${r.drawdownPct != null ? r.drawdownPct.toFixed(2) + "%" : "n/a"}`);
    } catch (_) {}
  }

  const output = md.join("\n");
  console.log(output);

  if (writeMd) {
    const outPath = join(REPO_ROOT, "data/codex/parity_audit.md");
    writeFileSync(outPath, output);
    console.error(`\nWrote ${outPath}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
