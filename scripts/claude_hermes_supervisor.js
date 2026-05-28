#!/usr/bin/env node
// claude_hermes_supervisor.js
// Claude's research supervisor for Claude-owned strategies. Mirrors Codex's
// lib/hermes.js queue shape so the dashboard's existing parser will eat both.
// Watches: basket-breakout family (crypto + stocks) + Stocks Mean Reversion v1.
// Outputs: data/claude/hermes_experiment_queue.json and
//          data/claude/hermes_supervisor_report.md
// Usage:   node scripts/claude_hermes_supervisor.js

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

function parseTradeLog(text) {
  const events = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (line.includes("---")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 12) continue;
    const event = cells[2];
    if (event !== "OPEN" && event !== "CLOSE" && event !== "PARTIAL") continue;
    const pnlRaw = cells[10];
    const pnl = (pnlRaw === "-" || pnlRaw === "") ? null : parseFloat(pnlRaw.replace(/[,+\s]/g, ""));
    events.push({ ts: new Date(cells[1]), event, pnl: Number.isFinite(pnl) ? pnl : null });
  }
  return events;
}

function parsePortfolio(text) {
  const num = (s) => {
    if (s == null) return null;
    const v = parseFloat(String(s).replace(/[$,+\s]/g, ""));
    return Number.isFinite(v) ? v : null;
  };
  const grab = (re) => { const m = text.match(re); return m ? num(m[1]) : null; };
  const equity = grab(/Current equity\s*[:*]+\s*\*?\*?\s*\$?(-?[\d,.]+)/i);
  const starting = grab(/Starting equity\s*[:*]+\s*\*?\*?\s*\$?(-?[\d,.]+)/i) ?? 10000;
  const peak = grab(/Equity peak\s*[:*]+\s*\*?\*?\s*\$?(-?[\d,.]+)/i);
  const dd = grab(/Drawdown from peak\s*[:*]+\s*\*?\*?\s*(-?[\d.]+)%/i);
  return { equity, starting, peak, drawdownPct: dd, returnPct: equity != null ? ((equity - starting) / starting) * 100 : null };
}

function computeStats(exits) {
  if (exits.length === 0) return { count: 0, total: 0, winRate: null, pf: null };
  const wins = exits.filter((e) => e.pnl > 0);
  const losses = exits.filter((e) => e.pnl < 0);
  const winSum = wins.reduce((s, e) => s + e.pnl, 0);
  const lossSum = Math.abs(losses.reduce((s, e) => s + e.pnl, 0));
  return {
    count: exits.length,
    total: exits.reduce((s, e) => s + e.pnl, 0),
    winRate: wins.length / exits.length,
    pf: lossSum > 0 ? winSum / lossSum : (winSum > 0 ? Infinity : null),
  };
}

function detectDrift(isS, oosS) {
  if (isS.count < 5 || oosS.count < 5) return [];
  const flags = [];
  if (isS.pf != null && oosS.pf != null && Number.isFinite(isS.pf) && Number.isFinite(oosS.pf)) {
    if (isS.pf > 1.2 && oosS.pf < 0.8) flags.push("PF collapse");
    else if (oosS.pf < isS.pf * 0.5) flags.push("PF halved");
  }
  if (isS.total > 0 && oosS.total < 0) flags.push("OOS turned negative");
  if (isS.winRate != null && oosS.winRate != null && oosS.winRate < isS.winRate - 0.15) flags.push("win-rate drop >15pp");
  return flags;
}

const STRATEGIES = [
  { id: "basket-aggressive-v1-crypto",   name: "Basket Breakout Aggressive v1 (crypto)", log: "data/basket_variants/aggressive_v1_trade_log.md",  portfolio: "data/basket_variants/aggressive_v1_portfolio.md" },
  { id: "basket-aggressive-v2-crypto",   name: "Basket Breakout Aggressive v2 (crypto)", log: "data/basket_variants/aggressive_v2_trade_log.md",  portfolio: "data/basket_variants/aggressive_v2_portfolio.md" },
  { id: "basket-leveraged-v1-crypto",    name: "Basket Breakout Leveraged v1 (crypto)",  log: "data/basket_variants/leveraged_v1_trade_log.md",   portfolio: "data/basket_variants/leveraged_v1_portfolio.md" },
  { id: "stocks-basket-v1",              name: "Stocks Basket Breakout v1",              log: "data/stock_variants/stocks_v1_trade_log.md",                portfolio: "data/stock_variants/stocks_v1_portfolio.md" },
  { id: "stocks-basket-aggressive-v1",   name: "Stocks Basket Breakout Aggressive v1",   log: "data/stock_variants/stocks_aggressive_v1_trade_log.md",     portfolio: "data/stock_variants/stocks_aggressive_v1_portfolio.md" },
  { id: "stocks-basket-diversified-v1",  name: "Stocks Basket Breakout Diversified v1",  log: "data/stock_variants/stocks_diversified_v1_trade_log.md",    portfolio: "data/stock_variants/stocks_diversified_v1_portfolio.md" },
  { id: "stocks-mean-reversion-v1",      name: "Stocks Mean Reversion v1",               log: "data/stock_variants/stocks_mean_reversion_v1_trade_log.md", portfolio: "data/stock_variants/stocks_mean_reversion_v1_portfolio.md" },
  { id: "stocks-mean-reversion-v2",      name: "Stocks Mean Reversion v2",               log: "data/stock_variants/stocks_mean_reversion_v2_trade_log.md", portfolio: "data/stock_variants/stocks_mean_reversion_v2_portfolio.md" },
];
function classify({ exits, oosStats, portfolio, driftFlags }) {
  if (exits.length < 10) return "insufficient_data";
  const severe = driftFlags.some((f) => f === "PF collapse" || f === "PF halved" || f === "OOS turned negative");
  if (severe) {
    if (portfolio && portfolio.returnPct != null && portfolio.returnPct > 0) return "fading_winner";
    return "collapsing";
  }
  if (portfolio && portfolio.returnPct != null && portfolio.returnPct < 0 && oosStats.total > 0) return "recovering";
  if (portfolio && portfolio.returnPct != null && portfolio.returnPct > 0 && oosStats.total > 0) return "stable_profitable";
  if (portfolio && portfolio.returnPct != null && portfolio.returnPct > 0 && oosStats.total < 0) return "fading_winner";
  return "stable_losing";
}

function buildItem(strategy, klass, stats) {
  const fmtPF = (n) => (n == null ? "n/a" : Number.isFinite(n) ? n.toFixed(2) : "inf");
  const fmtPct = (n) => (n == null ? "n/a" : (n * 100).toFixed(0) + "%");
  const fmtPnl = (n) => (n == null ? "n/a" : (n > 0 ? "+" : "") + "$" + n.toFixed(2));
  const base = { owner: "claude", strategy: strategy.name, strategy_id: strategy.id };
  switch (klass) {
    case "collapsing":
      return { ...base, priority: 1, type: "experiment",
        title: `Address regime collapse in ${strategy.name}`,
        source: "data/codex/basket_oos_audit.md",
        requested_action: `OOS PF ${fmtPF(stats.oosStats.pf)} vs IS ${fmtPF(stats.isStats.pf)}; OOS PnL ${fmtPnl(stats.oosStats.total)}. Flags: ${stats.driftFlags.join("; ")}. Decide within the week: review regime gate, fork v2.1 with halved risk, or archive per spec recovery rules.` };
    case "fading_winner":
      return { ...base, priority: 1, type: "experiment",
        title: `Defend ${strategy.name} — leader but OOS bleeding`,
        source: "data/codex/basket_oos_audit.md",
        requested_action: `Cumulative +${stats.portfolio.returnPct?.toFixed(2)}% but OOS PnL ${fmtPnl(stats.oosStats.total)}, OOS PF ${fmtPF(stats.oosStats.pf)}. Currently on the leaderboard top but losing the most recent window. Options: halve size on new entries, tighten exit, pause pending diagnosis.` };
    case "recovering":
      return { ...base, priority: 2, type: "sample_collection",
        title: `Confirm ${strategy.name} recovery`,
        source: "data/codex/basket_oos_audit.md",
        requested_action: `Cumulative DD ${stats.portfolio.drawdownPct?.toFixed(1)}% but OOS PnL ${fmtPnl(stats.oosStats.total)}, PF ${fmtPF(stats.oosStats.pf)}, win ${fmtPct(stats.oosStats.winRate)}. If next 2-week window holds PF >= 1.0, treat as recovered. If it slips below 0.8, escalate to experiment.` };
    case "stable_profitable":
      return { ...base, priority: 3, type: "sample_collection",
        title: `Continue collecting on ${strategy.name}`,
        source: "data/codex/basket_oos_audit.md",
        requested_action: `Cumulative +${stats.portfolio.returnPct?.toFixed(2)}%, OOS PF ${fmtPF(stats.oosStats.pf)}, win ${fmtPct(stats.oosStats.winRate)}. Both halves profitable. Defend this strategy — it is the cohort's actual edge.` };
    case "stable_losing":
      return { ...base, priority: 2, type: "experiment",
        title: `Diagnose persistent loss in ${strategy.name}`,
        source: "data/codex/basket_oos_audit.md",
        requested_action: `Losses in both IS and OOS, no acute collapse. Consider: review vs original expected_pf_range, reduce risk to 25% of current sizing, or archive if spec rules warrant.` };
    case "insufficient_data":
    default:
      return { ...base, priority: 3, type: "sample_collection",
        title: `Keep collecting sample for ${strategy.name}`,
        source: "data/codex/basket_oos_audit.md",
        requested_action: `Only ${stats.exits.length} exits. Continue paper rotation; re-audit when count >= 20.` };
  }
}

function main() {
  const items = [];
  const summary = { collapsing: 0, fading_winner: 0, recovering: 0, stable_profitable: 0, stable_losing: 0, insufficient_data: 0 };
  for (const s of STRATEGIES) {
    let logText = ""; let portText = "";
    try { logText = readFileSync(join(REPO_ROOT, s.log), "utf8"); } catch (_) {}
    try { portText = readFileSync(join(REPO_ROOT, s.portfolio), "utf8"); } catch (_) {}
    const events = parseTradeLog(logText);
    const exits = events.filter((e) => (e.event === "CLOSE" || e.event === "PARTIAL") && e.pnl !== null).sort((a, b) => a.ts - b.ts);
    const split = Math.floor(exits.length / 2);
    const isStats = computeStats(exits.slice(0, split));
    const oosStats = computeStats(exits.slice(split));
    const driftFlags = detectDrift(isStats, oosStats);
    const portfolio = portText ? parsePortfolio(portText) : null;
    const stats = { exits, isStats, oosStats, driftFlags, portfolio };
    const klass = classify(stats);
    summary[klass] = (summary[klass] || 0) + 1;
    items.push(buildItem(s, klass, stats));
  }
  items.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
  const generated = new Date().toISOString();
  const queue = {
    owner: "claude",
    generated_at: generated,
    guardrails: [
      "Review-only: no live routing, position-sizing, or spec files were modified.",
      "Queue items are research and operational recommendations only.",
      "Claude Hermes Supervisor does not write trade logs, portfolios, or registry entries.",
    ],
    summary: { queue_items: items.length, ...summary },
    items,
  };
  writeFileSync(join(REPO_ROOT, "data/claude/hermes_experiment_queue.json"), JSON.stringify(queue, null, 2));
  const md = [
    "# Claude Hermes Supervisor Report",
    "",
    `> Generated: ${generated}`,
    "> Review-only: no live routing, position-sizing, or spec files were changed.",
    "> Watches: basket-breakout family (crypto + stocks) and Stocks Mean Reversion v1.",
    "",
    "## Summary",
    "",
    `- Queue items: ${items.length}`,
    `- Fading winners (P1): ${summary.fading_winner}`,
    `- Collapsing (P1): ${summary.collapsing}`,
    `- Stable losing (P2): ${summary.stable_losing}`,
    `- Recovering (P2 watch): ${summary.recovering}`,
    `- Stable profitable (P3): ${summary.stable_profitable}`,
    `- Insufficient data (P3): ${summary.insufficient_data}`,
    "",
    "## Experiment Queue",
    "",
    "| Priority | Type | Title | Source | Requested action |",
    "|----------|------|-------|--------|------------------|",
    ...items.map((i) => `| ${i.priority} | ${i.type} | ${i.title} | ${i.source} | ${i.requested_action} |`),
    "",
    "## Guardrails",
    "",
    ...queue.guardrails.map((g) => `- ${g}`),
  ].join("\n");
  writeFileSync(join(REPO_ROOT, "data/claude/hermes_supervisor_report.md"), md);
  console.log(md);
  console.error(`\nqueue=${items.length} fading=${summary.fading_winner} collapsing=${summary.collapsing} recovering=${summary.recovering} stable_profitable=${summary.stable_profitable} stable_losing=${summary.stable_losing} insufficient=${summary.insufficient_data}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}