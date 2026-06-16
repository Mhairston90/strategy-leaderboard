/**
 * Contest Scoreboard — the single honest "who is winning" view.
 *
 * Multi-owner: OPUS vs CODEX vs FABLE, scored ONLY on forward P&L (trades
 * entered on/after each strategy's live-start; backtested/pre-live-start
 * trades excluded).
 *
 * Scoring per owner (rule set by Marcus 2026-06-16): the score is the summed
 * forward P&L of the owner's top 5 strategies by forward P&L. EVERY
 * forward-trading strategy is eligible regardless of source (local,
 * bull-github/remote, sheet) — backtest is the only exclusion. The same rule
 * applies symmetrically to all three camps.
 *
 * (The 2026-06-10 pre-registration model — score a fixed pre-picked 5, exclude
 * remote/sheet sources — was repealed 2026-06-16; see scoring_registrations.js.
 * registrationFor() now returns null for everyone, so the fallback below is the
 * universal path.)
 *
 * Forward P&L comes from the provenance ledger so the scoreboard and the
 * legitimacy audit can never disagree. Exact-twin strategies (byte-identical
 * trade logs) are deduplicated within each owner so the same trades are not
 * counted twice.
 */
import { computeProvenance } from './provenance.js';
import { ownerOf, OWNERS, OWNER_LABELS } from './owners.js';
import { registrationFor, monthKey } from '../scoring_registrations.js';

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

  const enrich = prov.map(p => {
    const snap = (snapshots || []).find(s => s.strategy.name === p.name);
    let fwd = p.fwdPnl;
    let auditable = true;
    if (fwd == null) {
      // Sheet source: not entry-time-auditable. Best-effort all-time $.
      auditable = false;
      const r = snap?.row;
      const cap = snap?.strategy?.starting_capital || 10000;
      fwd = r && r.returns && r.returns.all != null ? (r.returns.all / 100) * cap : 0;
    }
    return {
      name: p.name,
      owner: ownerOf(p.name),
      fwd,
      auditable,
      twinKey: (snap?.tradeLog?.text || '').replace(/\s+/g, '').slice(0, 4000),
    };
  });

  // Dedup exact-twin strategies within each owner.
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

  const ownersOut = OWNERS.map(owner => {
    const all = enrich.filter(e => e.owner === owner);
    const { kept, twins } = dedup(all);
    const reg = registrationFor(owner, now);
    let list, sum, registered, missing = [];
    if (reg) {
      registered = true;
      const byName = new Map(kept.map(e => [e.name, e]));
      list = reg.map(name => byName.get(name) || { name, fwd: 0, auditable: true, missing: true });
      missing = list.filter(e => e.missing).map(e => e.name);
      list = [...list].sort((a, b) => b.fwd - a.fwd);
      sum = list.reduce((s, r) => s + r.fwd, 0);
    } else {
      registered = false;
      list = [...kept].sort((a, b) => b.fwd - a.fwd).slice(0, 5);
      sum = list.reduce((s, r) => s + r.fwd, 0);
    }
    return { owner, label: OWNER_LABELS[owner] || owner, list, sum, registered, twinsDropped: twins, missing };
  });

  const ranked = [...ownersOut].sort((a, b) => b.sum - a.sum);
  const leader = ranked.length && (ranked.length < 2 || ranked[0].sum !== ranked[1].sum)
    ? ranked[0].owner : 'TIE';
  const delta = ranked.length > 1 ? ranked[0].sum - ranked[1].sum : 0;

  return {
    owners: ownersOut,
    ranked,
    leader,
    delta,
    month: monthKey(now),
  };
}

const money = v => (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(2);

function col(o) {
  const tag = '<span class="cs-reg" title="top 5 by forward P&amp;L; backtested trades excluded; all sources eligible">top-5 forward</span>';
  const rows = o.list.map((r, i) =>
    `<li><span class="cs-rank">${i + 1}</span><span class="cs-name">${esc(r.name)}${r.auditable ? '' : ' <span class="cs-flag" title="sheet source: all-time $, not entry-time filtered">≈</span>'}${r.missing ? ' <span class="cs-flag" title="registered but missing/erroring — scores 0">!</span>' : ''}</span><span class="cs-pnl">${money(r.fwd)}</span></li>`
  ).join('');
  return `<div class="cs-col"><div class="cs-col-h">${esc(o.label)} · ${money(o.sum)} ${tag}</div><ol class="cs-list">${rows || '<li class="dim">none</li>'}</ol></div>`;
}

export function renderContestScoreboardHtml(model) {
  const leaderLabel = model.leader === 'TIE'
    ? `<span class="cs-tie">DEAD HEAT</span>`
    : `<span class="cs-leader">${esc(OWNER_LABELS[model.leader] || model.leader)} leads by ${money(Math.abs(model.delta))}</span>`;
  const twinNotes = model.owners
    .filter(o => o.twinsDropped.length)
    .map(o => `<p class="dim cs-twin">${esc(o.label)} exact-twins deduped: ${o.twinsDropped.map(esc).join(', ')}</p>`)
    .join('');
  const missingNotes = model.owners
    .filter(o => o.missing.length)
    .map(o => `<p class="dim cs-twin">${esc(o.label)} registered rows missing (score 0): ${o.missing.map(esc).join(', ')}</p>`)
    .join('');
  return `
    <div class="section-kicker">Contest</div>
    <h2>Scoreboard — ${esc(model.month)} (pre-registered scoring)</h2>
    <div class="cs-headline">${leaderLabel}</div>
    <div class="cs-cols">
      ${model.owners.map(col).join('')}
    </div>
    <p class="dim cs-note">Forward P&amp;L only — trades entered on/after each strategy's live-start; backtested / pre-live-start trades excluded. Every forward-trading strategy is eligible (any source); each camp scored on its top 5 by forward P&amp;L, exact-twins deduped. Pre-registration repealed 2026-06-16.</p>
    ${twinNotes}${missingNotes}`;
}
