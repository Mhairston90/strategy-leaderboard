/**
 * Contest Scoreboard — the single honest "who is winning" view.
 *
 * BULL stable top-5 vs Codex stable top-5, scored ONLY on forward P&L
 * (trades entered on/after each strategy's effective contest cutoff), with
 * exact-twin Codex strategies deduplicated (identical trade logs counted
 * once), plus a days-to-deadline countdown.
 *
 * Forward P&L comes from the provenance ledger so the scoreboard and the
 * legitimacy audit can never disagree.
 */
import { computeProvenance } from './provenance.js';

export const CONTEST_DEADLINE_ISO = '2026-06-06T00:00:00Z';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

/**
 * @param {Array} snapshots app.js snapshotsState
 * @param {number} now epoch ms (injectable for tests)
 */
export function buildContestScoreboard(snapshots, now = Date.now()) {
  const prov = computeProvenance(snapshots);
  const byName = new Map(prov.map(p => [p.name, p]));

  const enrich = prov.map(p => {
    const snap = (snapshots || []).find(s => s.strategy.name === p.name);
    let fwd = p.fwdPnl;
    let auditable = true;
    if (fwd == null) {
      // Sheet source: not entry-time-auditable. Use the adapter's all-time
      // $ return as a best-effort and flag it so it's never mistaken for
      // a rigorously-filtered number.
      auditable = false;
      const r = snap?.row;
      const cap = snap?.strategy?.starting_capital || 10000;
      fwd = r && r.returns && r.returns.all != null ? (r.returns.all / 100) * cap : 0;
    }
    return {
      name: p.name,
      isCodex: p.isCodex,
      fwd,
      auditable,
      twinKey: (snap?.tradeLog?.text || '').replace(/\s+/g, '').slice(0, 4000),
    };
  });

  // Dedup exact-twin strategies (identical trade-log content) within each side.
  const dedup = (arr) => {
    const seen = new Set();
    const kept = [];
    const twins = [];
    for (const e of [...arr].sort((a, b) => b.fwd - a.fwd)) {
      const k = e.twinKey;
      if (k && k.length > 50 && seen.has(k)) { twins.push(e.name); continue; }
      if (k) seen.add(k);
      kept.push(e);
    }
    return { kept, twins };
  };

  const mineAll = enrich.filter(e => !e.isCodex);
  const cxAll = enrich.filter(e => e.isCodex);
  const mine = dedup(mineAll);
  const cx = dedup(cxAll);

  const top5 = a => [...a].sort((x, y) => y.fwd - x.fwd).slice(0, 5);
  const sum = a => a.reduce((s, r) => s + r.fwd, 0);

  const myTop5 = top5(mine.kept);
  const cxTop5 = top5(cx.kept);
  const mySum = sum(myTop5);
  const cxSum = sum(cxTop5);

  const msLeft = new Date(CONTEST_DEADLINE_ISO).getTime() - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));

  return {
    myTop5, cxTop5, mySum, cxSum,
    delta: mySum - cxSum,
    leader: mySum > cxSum ? 'BULL' : mySum < cxSum ? 'CODEX' : 'TIE',
    daysLeft,
    deadline: CONTEST_DEADLINE_ISO.slice(0, 10),
    codexTwinsDropped: cx.twins,
    myTwinsDropped: mine.twins,
  };
}

const money = v => (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(2);

function col(title, list) {
  const rows = list.map((r, i) =>
    `<li><span class="cs-rank">${i + 1}</span><span class="cs-name">${esc(r.name)}${r.auditable ? '' : ' <span class="cs-flag" title="sheet source: all-time $, not entry-time filtered">≈</span>'}</span><span class="cs-pnl">${money(r.fwd)}</span></li>`
  ).join('');
  return `<div class="cs-col"><div class="cs-col-h">${esc(title)}</div><ol class="cs-list">${rows || '<li class="dim">none</li>'}</ol></div>`;
}

export function renderContestScoreboardHtml(model) {
  const lead = model.leader === 'TIE'
    ? `<span class="cs-tie">DEAD HEAT</span>`
    : `<span class="cs-leader cs-leader--${model.leader === 'BULL' ? 'bull' : 'codex'}">${model.leader} leads by ${money(Math.abs(model.delta))}</span>`;
  const twinNote = model.codexTwinsDropped.length
    ? `<p class="dim cs-twin">Codex exact-twins deduped: ${model.codexTwinsDropped.map(esc).join(', ')}</p>` : '';
  return `
    <div class="section-kicker">Contest</div>
    <h2>Scoreboard — BULL vs Codex</h2>
    <div class="cs-headline">
      ${lead}
      <span class="cs-deadline">${model.daysLeft} days to ${esc(model.deadline)}</span>
    </div>
    <div class="cs-cols">
      ${col(`BULL top-5  ·  ${money(model.mySum)}`, model.myTop5)}
      ${col(`Codex top-5  ·  ${money(model.cxSum)}`, model.cxTop5)}
    </div>
    <p class="dim cs-note">Forward P&amp;L only (trades entered on/after each strategy's contest cutoff). “≈” = sheet source, all-time $ (not entry-time filtered).</p>
    ${twinNote}`;
}
