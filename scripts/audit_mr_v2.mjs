import { readFileSync, existsSync } from "node:fs";
import { parseTradeLog } from "./basket_oos_audit.js";

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
const fmtPF = (n) => n == null ? "n/a" : !isFinite(n) ? "inf" : n.toFixed(2);
const fmtPct = (n) => n == null ? "n/a" : (n*100).toFixed(0) + "%";
const fmtP = (n) => (n == null ? "n/a" : (n >= 0 ? "+" : "") + "$" + n.toFixed(2));

const collapseStart = new Date("2026-05-08T00:00:00Z");
const collapseEnd = new Date("2026-05-15T23:59:59Z");
const variants = [
  { key: "stocks_mean_reversion_v1", label: "MR v1 (tech)",       path: "data/stock_variants/stocks_mean_reversion_v1_trade_log.md" },
  { key: "stocks_mean_reversion_v2", label: "MR v2 (diversified)", path: "data/stock_variants/stocks_mean_reversion_v2_trade_log.md" },
];

console.log("| Variant              | n  | Cumulative | Full PF | IS PF | OOS PF | OOS PnL   | Win % | Collapse n | Collapse PnL  | Collapse PF |");
console.log("|----------------------|----|------------|---------|-------|--------|-----------|-------|------------|---------------|-------------|");
const rows = [];
for (const v of variants) {
  if (!existsSync(v.path)) { console.log(`SKIP ${v.key}`); continue; }
  const events = parseTradeLog(readFileSync(v.path, "utf8"));
  const exits = events.filter(e => (e.event === "CLOSE" || e.event === "PARTIAL") && e.pnl !== null).sort((a,b) => a.ts - b.ts);
  const all = computeStats(exits);
  const split = Math.floor(exits.length / 2);
  const isS = computeStats(exits.slice(0, split));
  const oosS = computeStats(exits.slice(split));
  const collapse = computeStats(exits.filter(e => e.ts >= collapseStart && e.ts <= collapseEnd));
  console.log(`| ${v.label.padEnd(20)} | ${String(exits.length).padStart(2)} | ${fmtP(all.total).padStart(10)} | ${fmtPF(all.pf).padStart(7)} | ${fmtPF(isS.pf).padStart(5)} | ${fmtPF(oosS.pf).padStart(6)} | ${fmtP(oosS.total).padStart(9)} | ${fmtPct(all.winRate).padStart(5)} | ${String(collapse.count).padStart(10)} | ${fmtP(collapse.total).padStart(13)} | ${fmtPF(collapse.pf).padStart(11)} |`);
  rows.push({ ...v, all, isS, oosS, collapse, n: exits.length });
}

console.log("\n=== MR v2 acceptance check vs registration criteria ===");
const v2 = rows.find(r => r.key.endsWith("v2"));
if (v2) {
  const cumPositive = v2.all.total > 0;
  const fullPf12 = v2.all.pf > 1.20;
  const oosPositive = v2.oosS.total > 0;
  const oosPfOk = v2.oosS.pf > 1.0;
  const sampleOk = v2.n >= 15;
  const collapseOk = v2.collapse.count === 0 || v2.collapse.total >= 0 || v2.collapse.pf >= 0.8;
  console.log(`[${cumPositive ? "PASS" : "FAIL"}] Cumulative profitable: ${fmtP(v2.all.total)}`);
  console.log(`[${fullPf12 ? "PASS" : "FAIL"}] Full-window PF > 1.20: ${fmtPF(v2.all.pf)}`);
  console.log(`[${oosPositive ? "PASS" : "FAIL"}] OOS half profitable: ${fmtP(v2.oosS.total)}`);
  console.log(`[${oosPfOk ? "PASS" : "FAIL"}] OOS PF > 1.0: ${fmtPF(v2.oosS.pf)}`);
  console.log(`[${sampleOk ? "PASS" : "FAIL"}] Sample >= 15: ${v2.n}`);
  console.log(`[${collapseOk ? "PASS" : "FAIL"}] Collapse window survived: n=${v2.collapse.count}, PnL ${fmtP(v2.collapse.total)}, PF ${fmtPF(v2.collapse.pf)}`);
  const allPass = cumPositive && fullPf12 && oosPositive && oosPfOk && sampleOk && collapseOk;
  console.log(`\n→ Overall verdict: ${allPass ? "PASS — register on leaderboard" : "FAIL — needs more analysis"}`);
}