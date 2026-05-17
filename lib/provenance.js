/**
 * Provenance & Legitimacy Ledger.
 *
 * For every strategy, splits its closed trades into FORWARD (entered on/after
 * its effective contest cutoff = real paper) vs BACKTEST (entered before =
 * simulation / backfill). Surfaces a legitimacy ratio so backdated configs and
 * backtest-shown-as-forward are impossible to hide — for either side.
 *
 * Sheet-sourced strategies are not entry-time-auditable from the browser
 * (their row format differs); they are flagged as such rather than silently
 * counted as forward.
 */
import { parseTradeLog, buildTripsWithEntryTime, filterTripsByLiveStart } from './parse_bull_md.js';
import { effectiveCutoff } from '../registry.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

/**
 * @param {Array<{strategy, tradeLog?, row?}>} snapshots  app.js snapshotsState
 * @returns {Array<object>} one provenance record per strategy
 */
export function computeProvenance(snapshots) {
  return (snapshots || []).map(s => {
    const name = s.strategy.name;
    const cutoff = effectiveCutoff(s.strategy.live_start_iso);
    const isCodex = name.startsWith('CODEX');

    if (s.strategy.source.type === 'sheets') {
      return {
        name, isCodex, cutoff, source: 'sheet',
        total: s.row?.trades_n ?? 0,
        forward: null, backtest: null,
        fwdPnl: null, btPnl: null, legitimacy: null,
        note: 'sheet source — not entry-time-auditable',
      };
    }

    const text = s.tradeLog?.text || '';
    const trips = buildTripsWithEntryTime(parseTradeLog(text));
    const closedAll = trips.filter(t => t.pnl != null);
    const { filtered } = filterTripsByLiveStart(trips, cutoff);
    const closedFwd = filtered.filter(t => t.pnl != null);

    const total = closedAll.length;
    const forward = closedFwd.length;
    const fwdPnl = closedFwd.reduce((a, t) => a + t.pnl, 0);
    const allPnl = closedAll.reduce((a, t) => a + t.pnl, 0);

    return {
      name, isCodex, cutoff, source: s.strategy.source.type,
      total, forward, backtest: total - forward,
      fwdPnl, btPnl: allPnl - fwdPnl,
      legitimacy: total ? forward / total : null,
    };
  });
}

function legitBar(p) {
  if (p.legitimacy == null) {
    return `<span class="prov-bar prov-bar--na" title="${esc(p.note || 'not auditable')}">n/a</span>`;
  }
  const pct = Math.round(p.legitimacy * 100);
  const cls = pct >= 80 ? 'good' : pct >= 40 ? 'warn' : 'bad';
  return `<span class="prov-bar prov-bar--${cls}" title="${p.forward}/${p.total} trades are forward">
    <span class="prov-fill" style="width:${pct}%"></span><span class="prov-pct">${pct}%</span></span>`;
}

const money = v => v == null ? '—' : (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(0);

export function renderProvenanceLedgerHtml(snapshots) {
  const list = computeProvenance(snapshots)
    .sort((a, b) => (b.legitimacy ?? -1) - (a.legitimacy ?? -1) || (b.forward ?? -1) - (a.forward ?? -1));
  const rows = list.map(p => `
    <tr class="${p.isCodex ? 'prov-codex' : 'prov-mine'}">
      <td class="left">${esc(p.name)}</td>
      <td>${legitBar(p)}</td>
      <td>${p.forward == null ? '—' : p.forward}</td>
      <td class="dim">${p.backtest == null ? '—' : p.backtest}</td>
      <td>${money(p.fwdPnl)}</td>
      <td class="dim">${money(p.btPnl)}</td>
      <td class="dim">${esc((p.cutoff || '').slice(0, 10))}</td>
    </tr>`).join('');
  return `
    <div class="section-kicker">Integrity</div>
    <h2>Provenance &amp; Legitimacy Ledger</h2>
    <p class="dim prov-note">Forward = trades entered on/after the contest cutoff (real paper). Backtest = pre-cutoff (simulation). A low bar means the headline number is mostly simulated.</p>
    <div class="table-scroll">
      <table class="prov-table">
        <thead><tr>
          <th class="left">Strategy</th><th>Legitimacy</th><th>Fwd trades</th>
          <th>Backtest</th><th>Fwd P&amp;L</th><th>Backtest P&amp;L</th><th>Cutoff</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="7" class="dim">No strategies loaded</td></tr>'}</tbody>
      </table>
    </div>`;
}
