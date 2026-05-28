const SORT_KEY_TO_VALUE = {
  name:           (r) => r.name,
  status:         (r) => r.status,
  r7:             (r) => r.returns?.['7d'],
  r30:            (r) => r.returns?.['30d'],
  r90:            (r) => r.returns?.['90d'],
  sharpe:         (r) => r.sharpe,
  pf:             (r) => r.pf,
  max_dd:         (r) => r.max_dd,
  trades_n:       (r) => r.trades_n,
  win_pct:        (r) => r.win_pct,
  avg_r:          (r) => r.avg_r,
  last_signal_at: (r) => r.last_signal_at,
};

function compareNullable(a, b, asc) {
  // null/undefined sort to bottom regardless of asc/desc
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a < b) return asc ? -1 : 1;
  if (a > b) return asc ? 1 : -1;
  return 0;
}

export function sortRows(rows, sortKey, asc) {
  const getVal = SORT_KEY_TO_VALUE[sortKey] || (() => null);
  return [...rows].sort((a, b) => compareNullable(getVal(a), getVal(b), asc));
}

function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return '<span class="dim">—</span>';
  const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : 'dim';
  const sign = v > 0 ? '+' : '';
  return `<span class="${cls}">${sign}${v.toFixed(1)}</span>`;
}
function fmtNum(v, digits = 2) {
  if (v == null || Number.isNaN(v) || v === Infinity) return '<span class="dim">—</span>';
  return v.toFixed(digits);
}
function fmtInt(v) {
  if (v == null) return '<span class="dim">—</span>';
  return String(v);
}
function fmtR(v) {
  if (v == null || Number.isNaN(v)) return '<span class="dim">—</span>';
  const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : 'dim';
  const sign = v > 0 ? '+' : '';
  return `<span class="${cls}">${sign}${v.toFixed(2)}</span>`;
}

function fmtRelTime(iso) {
  if (!iso) return '<span class="dim">—</span>';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '<span class="dim">—</span>';
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return '<span class="pos">just now</span>';
  if (mins < 60) return `<span class="${mins < 60 ? 'pos' : ''}">${mins}m</span>`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  return `<span class="dim">${days}d</span>`;
}

function statusBadge(status) {
  const cls = `badge badge-${status || 'paused'}`;
  return `<span class="${cls}">${status || '—'}</span>`;
}

function isWarnRow(row, killswitchDdPct) {
  if (row.max_dd == null || !killswitchDdPct) return false;
  return Math.abs(row.max_dd) >= killswitchDdPct * 0.9;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export function renderRows(rows, registry, sortKey, asc, options = {}) {
  const tbody = document.getElementById('rows');
  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="loading">No data yet…</td></tr>';
    return;
  }

  const sorted = sortRows(rows, sortKey, asc);
  tbody.innerHTML = sorted.map(r => {
    const reg = registry.find(s => s.name === r.name);
    const warn = isWarnRow(r, reg?.killswitch_dd_pct);
    const selected = options.selectedName === r.name;
    return `<tr class="${warn ? 'warn' : ''}${selected ? ' selected' : ''}" data-strategy="${escapeHtml(r.name)}">
      <td class="name">${escapeHtml(r.name)}</td>
      <td class="left">${statusBadge(r.status)}</td>
      <td>${fmtPct(r.returns?.['90d'])}</td>
      <td>${fmtPct(r.returns?.['30d'])}</td>
      <td>${fmtPct(r.returns?.['7d'])}</td>
      <td>${fmtNum(r.sharpe)}</td>
      <td>${fmtNum(r.pf)}</td>
      <td>${fmtPct(r.max_dd)}</td>
      <td>${fmtInt(r.trades_n)}</td>
      <td>${fmtInt(r.win_pct)}</td>
      <td>${fmtR(r.avg_r)}</td>
      <td>${fmtRelTime(r.last_signal_at)}</td>
    </tr>`;
  }).join('');
}

export function renderHealth(elementId, status, errorMsg) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.classList.remove('error', 'warn');
  if (status === 'error') el.classList.add('error');
  else if (status === 'warn') el.classList.add('warn');
  if (errorMsg) el.title = errorMsg; else el.removeAttribute('title');
}

export function renderUpdatedAt(timestamp) {
  const el = document.getElementById('updated');
  if (!el) return;
  if (!timestamp) {
    el.textContent = 'never';
    return;
  }
  const secs = Math.round((Date.now() - timestamp) / 1000);
  if (secs < 5) el.textContent = 'just now · auto-refresh 5m';
  else if (secs < 60) el.textContent = `Updated ${secs}s ago · auto-refresh 5m`;
  else el.textContent = `Updated ${Math.round(secs / 60)}m ago · auto-refresh 5m`;
}

/**
 * Set up click-to-sort handlers on table headers.
 *
 * @param {() => Array<StrategyRow>} getRows  — getter so we always sort the latest data
 * @param {Array} registry
 * @param {{key: string, asc: boolean}} currentSort
 */
export function setupSortHandlers(getRows, registry, currentSort) {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (currentSort.key === key) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort.key = key;
        currentSort.asc = false; // numeric default = desc
      }
      document.querySelectorAll('th').forEach(t => t.classList.remove('sorted', 'asc'));
      th.classList.add('sorted');
      if (currentSort.asc) th.classList.add('asc');
      renderRows(getRows(), registry, currentSort.key, currentSort.asc, {
        selectedName: currentSort.selectedName || '',
      });
    });
  });
}
