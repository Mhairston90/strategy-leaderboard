#!/usr/bin/env node
// basket_oos_audit.js — in-sample vs out-of-sample analysis for the basket family.
// Sorts each strategy's realized exits (CLOSE + PARTIAL events) by timestamp,
// splits at the median, and compares the first half (IS) to the second half (OOS).
// A meaningful IS->OOS degradation indicates regime drift, overfit params, or
// genuine edge decay -- distinct from a healthy strategy in a drawdown.
//
// Usage: node scripts/basket_oos_audit.js [--md]

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// ---------- trade log parser ----------
// Handles 11-col (basket) and 12-col (CODEX with sleeve) markdown table formats.
// Cell indexing after split("|"): cells[1]=ts, cells[2]=event, cells[3]=pair,
// cells[4]=side, cells[5]=size, cells[6]=price, cells[10]=realized PnL.
export function parseTradeLog(text) {
  const events = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (line.includes("---")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 12) continue;  // header has fewer data cells than rows
    const event = cells[2];
    if (event !== "OPEN" && event !== "CLOSE" && event !== "PARTIAL") continue;
    const pnlRaw = cells[10];
    const pnl = (pnlRaw === "-" || pnlRaw === "") ? null : parseFloat(pnlRaw.replace(/[,+\s]/g, ""));
    events.push({
      ts: new Date(cells[1]),
      event,
      pair: cells[3],
      side: cells[4],
      pnl: Number.isFinite(pnl) ? pnl : null,
    });
  }
  return events;
}

// ---------- statistics ----------
function computeStats(exits) {
  if (exits.length === 0) {
    return { count: 0, totalPnl: 0, winRate: null, pf: null, avgPnl: 0 };
  }
  const wins = exits.filter((c) => c.pnl > 0);
  const losses = exits.filter((c) => c.pnl < 0);
  const winSum = wins.reduce((s, c) => s + c.pnl, 0);
  const lossSum = Math.abs(losses.reduce((s, c) => s + c.pnl, 0));
  const totalPnl = exits.reduce((s, c) => s + c.pnl, 0);
  return {
    count: exits.length,
    totalPnl,
    winRate: wins.length / exits.length,
    pf: lossSum > 0 ? winSum / lossSum : (winSum > 0 ? Infinity : null),
    avgPnl: totalPnl / exits.length,
  };
}

function assessDrift(is, oos) {
  if (is.count < 5 || oos.count < 5) return "sample too small";
  const flags = [];
  if (is.pf !== null && oos.pf !== null && Number.isFinite(is.pf) && Number.isFinite(oos.pf)) {
    if (is.pf > 1.2 && oos.pf < 0.8) flags.push("PF collapse");
    else if (oos.pf < is.pf * 0.5) flags.push("PF halved");
  }
  if (is.totalPnl > 0 && oos.totalPnl < 0) flags.push("OOS turned negative");
  if (is.winRate !== null && oos.winRate !== null && oos.winRate < is.winRate - 0.15) flags.push("win-rate drop >15pp");
  if (oos.totalPnl < is.totalPnl * 2 && is.totalPnl < 0 && oos.totalPnl < 0) flags.push("OOS losses accelerating");
  if (flags.length === 0) return "stable";
  return flags.join("; ");
}

// ---------- strategy list ----------
const STRATEGIES = [
  { name: "Basket Breakout Aggressive v1 (crypto)", log: "data/basket_variants/aggressive_v1_trade_log.md" },
  { name: "Basket Breakout Aggressive v2 (crypto)", log: "data/basket_variants/aggressive_v2_trade_log.md" },
  { name: "Basket Breakout Leveraged v1 (crypto)",  log: "data/basket_variants/leveraged_v1_trade_log.md" },
  { name: "Stocks Basket Breakout v1",              log: "data/stock_variants/stocks_v1_trade_log.md" },
  { name: "Stocks Basket Breakout Aggressive v1",   log: "data/stock_variants/stocks_aggressive_v1_trade_log.md" },
  { name: "Stocks Basket Breakout Aggressive v2",   log: "data/stock_variants/stocks_aggressive_v2_trade_log.md" },
  { name: "Stocks Basket Breakout Diversified v1",  log: "data/stock_variants/stocks_diversified_v1_trade_log.md" },
  { name: "Stocks Mean Reversion v1",               log: "data/stock_variants/stocks_mean_reversion_v1_trade_log.md" },
];

// ---------- formatting ----------
function fmtPF(n)  { if (n == null) return "n/a"; return Number.isFinite(n) ? n.toFixed(2) : "inf"; }
function fmtPnl(n) { if (n == null) return "n/a"; return (n > 0 ? "+" : "") + "$" + n.toFixed(2); }
function fmtPct(n) { if (n == null) return "n/a"; return (n * 100).toFixed(1) + "%"; }

// ---------- main ----------
function main() {
  const writeMd = process.argv.includes("--md");
  const rows = [];
  for (const s of STRATEGIES) {
    let events = [];
    try { events = parseTradeLog(readFileSync(join(REPO_ROOT, s.log), "utf8")); } catch (_) {}
    const exits = events
      .filter((e) => (e.event === "CLOSE" || e.event === "PARTIAL") && e.pnl !== null)
      .sort((a, b) => a.ts - b.ts);
    if (exits.length === 0) {
      rows.push({ strategy: s.name, total: 0, firstExit: "n/a", lastExit: "n/a", is: null, oos: null, drift: "no exits in trade log" });
      continue;
    }
    const split = Math.floor(exits.length / 2);
    const isExits = exits.slice(0, split);
    const oosExits = exits.slice(split);
    const isStats = computeStats(isExits);
    const oosStats = computeStats(oosExits);
    rows.push({
      strategy: s.name,
      total: exits.length,
      firstExit: exits[0].ts.toISOString().slice(0, 10),
      lastExit: exits[exits.length - 1].ts.toISOString().slice(0, 10),
      is: isStats,
      oos: oosStats,
      drift: assessDrift(isStats, oosStats),
    });
  }

  const header = ["Strategy", "Exits", "First→Last", "IS PnL", "OOS PnL", "IS PF", "OOS PF", "IS win", "OOS win", "Drift"];
  const tableRows = rows.map((r) => [
    r.strategy,
    String(r.total),
    `${r.firstExit}→${r.lastExit}`,
    r.is ? fmtPnl(r.is.totalPnl) : "n/a",
    r.oos ? fmtPnl(r.oos.totalPnl) : "n/a",
    r.is ? fmtPF(r.is.pf) : "n/a",
    r.oos ? fmtPF(r.oos.pf) : "n/a",
    r.is ? fmtPct(r.is.winRate) : "n/a",
    r.oos ? fmtPct(r.oos.winRate) : "n/a",
    r.drift,
  ]);

  const md = [
    "# Basket Family — In-Sample vs Out-of-Sample Audit",
    "",
    `> Generated: ${new Date().toISOString()}`,
    "",
    "Splits each strategy's realized exits (CLOSE + PARTIAL events) 50/50 by timestamp. First half = in-sample (IS), second half = out-of-sample (OOS). A meaningful IS->OOS degradation indicates regime drift, overfit parameters, or genuine edge decay — distinct from a healthy strategy in a drawdown.",
    "",
    "| " + header.join(" | ") + " |",
    "|" + header.map(() => "---").join("|") + "|",
    ...tableRows.map((r) => "| " + r.join(" | ") + " |"),
    "",
    "## Notes",
    "",
    "- **Exits** = total CLOSE and PARTIAL events in the trade log (PARTIAL exits realize some PnL on the partial-take)",
    "- **IS / OOS** are equal halves by exit count, split at the median exit timestamp. Coarse OOS proxy; a proper walk-forward with multiple folds gives cleaner signal.",
    "- **PnL** is sum of `Realized PnL` over the half's exits",
    "- **PF** = win-sum / |loss-sum| over the half; `inf` if there are no losses",
    "- **win** = fraction of exits with PnL > 0",
    "- **Drift flags**: `PF collapse` (IS > 1.2 and OOS < 0.8), `PF halved` (OOS < IS * 0.5), `OOS turned negative` (IS positive, OOS negative), `win-rate drop >15pp`, `OOS losses accelerating` (both halves negative and OOS more negative)",
    "- `sample too small` = either half has fewer than 5 exits — treat any flag as unreliable",
  ];

  const output = md.join("\n");
  console.log(output);

  if (writeMd) {
    const outPath = join(REPO_ROOT, "data/codex/basket_oos_audit.md");
    writeFileSync(outPath, output);
    console.error(`\nWrote ${outPath}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
