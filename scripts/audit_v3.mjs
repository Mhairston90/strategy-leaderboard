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
const fmtP = (n) => (n >= 0 ? "+" : "") + "$" + n.toFixed(2);

const variants = [
  { key: "stocks_v1",        label: "v1 (baseline, no ADX)", path: "data/stock_variants/stocks_v1_trade_log.md" },
  { key: "stocks_v3",        label: "v3 (ADX>22)",            path: "data/stock_variants/stocks_v3_trade_log.md" },
  { key: "stocks_v3_adx25",  label: "v3 (ADX>25)",            path: "data/stock_variants/stocks_v3_adx25_trade_log.md" },
  { key: "stocks_v3_adx30",  label: "v3 (ADX>30)",            path: "data/stock_variants/stocks_v3_adx30_trade_log.md" },
  { key: "stocks_v3_adx35",  label: "v3 (ADX>35)",            path: "data/stock_variants/stocks_v3_adx35_trade_log.md" },
];

const collapseStart = new Date("2026-05-08T00:00:00Z");
const collapseEnd = new Date("2026-05-15T23:59:59Z");

console.log("\n| Variant            | n  | Cumulative | Full PF | IS PF | OOS PF | OOS PnL  | Collapse n | Collapse PnL |");
console.log("|--------------------|----|------------|---------|-------|--------|----------|------------|--------------|");
const rows = [];
for (const v of variants) {
  if (!existsSync(v.path)) { console.log(`SKIP ${v.key} (no file)`); continue; }
  const events = parseTradeLog(readFileSync(v.path, "utf8"));
  const exits = events.filter(e => (e.event === "CLOSE" || e.event === "PARTIAL") && e.pnl !== null).sort((a,b) => a.ts - b.ts);
  const all = computeStats(exits);
  const split = Math.floor(exits.length / 2);
  const isS = computeStats(exits.slice(0, split));
  const oosS = computeStats(exits.slice(split));
  const collapse = computeStats(exits.filter(e => e.ts >= collapseStart && e.ts <= collapseEnd));
  rows.push({ label: v.label, n: exits.length, all, isS, oosS, collapse });
  console.log(`| ${v.label.padEnd(18)} | ${String(exits.length).padStart(2)} | ${fmtP(all.total).padStart(10)} | ${fmtPF(all.pf).padStart(7)} | ${fmtPF(isS.pf).padStart(5)} | ${fmtPF(oosS.pf).padStart(6)} | ${fmtP(oosS.total).padStart(8)} | ${String(collapse.count).padStart(10)} | ${fmtP(collapse.total).padStart(12)} |`);
}

console.log("\n=== Verdict per threshold against v3 acceptance criteria ===");
for (const r of rows) {
  if (r.label.includes("baseline")) continue;
  const pf12 = r.all.pf > 1.20;
  const collOK = r.collapse.count >= 3 && r.collapse.pf > 1.0;
  const sampleOK = r.n >= 15;
  const all = pf12 && collOK && sampleOK;
  console.log(`${r.label.padEnd(20)} full-PF>1.20:${pf12?"PASS":"FAIL"}  collapse-PF>1.0:${collOK?"PASS":"FAIL"} (n=${r.collapse.count})  n>=15:${sampleOK?"PASS":"FAIL"} (n=${r.n})  → ${all?"PASS":"FAIL"}`);
}