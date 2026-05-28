export function parseTradeForensicsText(text, options = {}) {
  if (!text) {
    return emptyReport(options.error || 'No trade forensics loaded');
  }

  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;

    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
      .map(cell => cell.trim());
    if (cells.length < 13) continue;
    if (cells[0] === 'Recorded (UTC)' || isSeparatorRow(cells)) continue;

    rows.push({
      recordedAt: stringOrEmpty(cells[0]),
      strategy: stringOrEmpty(cells[1]),
      cycleTime: stringOrEmpty(cells[2]),
      dataSource: stringOrEmpty(cells[3]),
      quality: normalizeQuality(cells[4]),
      symbols: splitItems(cells[5]),
      warnings: splitItems(cells[6]),
      blockers: splitItems(cells[7]),
      opened: numberOrDefault(cells[8], 0),
      closed: numberOrDefault(cells[9], 0),
      openReasonTags: splitItems(cells[10]),
      closeReasonTags: splitItems(cells[11]),
      candidates: numberOrDefault(cells[12], 0),
    });
  }

  return {
    rows,
    error: '',
  };
}

export function summarizeTradeForensics(report) {
  const rows = uniqueCycleRows(report?.rows || []);
  const latest = rows[rows.length - 1] || null;
  const currentRows = latestRowsByStrategy(rows);
  const blocked = rows.filter(row => row.quality === 'blocked' || row.blockers.length).length;
  const warnings = rows.filter(
    row => row.quality === 'warning' || (row.warnings.length && !row.blockers.length)
  ).length;
  const currentBlocked = currentRows.filter(
    row => row.quality === 'blocked' || row.blockers.length
  ).length;
  const currentWarnings = currentRows.filter(
    row => row.quality === 'warning' || (row.warnings.length && !row.blockers.length)
  ).length;
  const totalOpened = rows.reduce((sum, row) => sum + row.opened, 0);
  const totalClosed = rows.reduce((sum, row) => sum + row.closed, 0);

  return {
    total: rows.length,
    blocked,
    warnings,
    currentBlocked,
    currentWarnings,
    latest,
    totalOpened,
    totalClosed,
    error: report?.error || '',
  };
}

export function renderTradeForensicsHtml(report) {
  const summary = summarizeTradeForensics(report);
  const recentRows = uniqueCycleRows(report?.rows || []).slice(-8).reverse();

  return `
    <div class="forensics-head">
      <div>
        <div class="section-kicker">Quality</div>
        <h2>Data Quality</h2>
      </div>
      <div class="forensics-meta">
        ${qualityBadge(summary.latest?.quality || (summary.error ? 'missing' : 'empty'))}
        <span class="dim">${summary.latest ? escapeHtml(summary.latest.recordedAt) : 'No cycles yet'}</span>
      </div>
    </div>
    <div class="forensics-stats">
      ${statHtml('Cycles', summary.total)}
      ${statHtml('Current Blocked', summary.currentBlocked)}
      ${statHtml('Current Warnings', summary.currentWarnings)}
      ${statHtml('Historical Warnings', summary.warnings)}
      ${statHtml('Trades', `${summary.totalOpened}/${summary.totalClosed}`)}
    </div>
    ${summary.error ? emptyStateHtml('No forensic cycles loaded', summary.error) : ''}
    ${!summary.error && recentRows.length === 0 ? emptyStateHtml('No forensic cycles loaded', 'Waiting for the next paper cycle') : ''}
    ${recentRows.length ? rowsTableHtml(recentRows) : ''}
  `;
}

function rowsTableHtml(rows) {
  return `
    <div class="forensics-table-scroll">
      <table class="forensics-table">
        <thead>
          <tr>
            <th class="left">Strategy</th>
            <th>Quality</th>
            <th>Source</th>
            <th>Open/Close</th>
            <th class="left">Issue</th>
            <th class="left">Reason tags</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(rowHtml).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function uniqueCycleRows(rows) {
  const byCycle = new Map();
  rows.forEach((row, index) => {
    const key = row.strategy && row.cycleTime
      ? `${row.strategy}\u0000${row.cycleTime}`
      : `row-${index}`;
    const existing = byCycle.get(key);
    if (existing && tradeCount(existing) > tradeCount(row)) {
      return;
    }
    byCycle.delete(key);
    byCycle.set(key, row);
  });
  return [...byCycle.values()];
}

function latestRowsByStrategy(rows) {
  const byStrategy = new Map();
  rows.forEach((row, index) => {
    const key = row.strategy || `row-${index}`;
    byStrategy.set(key, row);
  });
  return [...byStrategy.values()];
}

function tradeCount(row) {
  return (row.opened || 0) + (row.closed || 0);
}

function rowHtml(row) {
  return `
    <tr>
      <td class="left">
        <div class="forensics-strategy">${escapeHtml(row.strategy)}</div>
        <div class="dim">${escapeHtml(shortTime(row.cycleTime))}</div>
      </td>
      <td>${qualityBadge(row.quality)}</td>
      <td>${escapeHtml(row.dataSource || '-')}</td>
      <td>${escapeHtml(`${row.opened}/${row.closed}`)}</td>
      <td class="left">${escapeHtml(primaryIssue(row))}</td>
      <td class="left">${escapeHtml(reasonSummary(row))}</td>
    </tr>
  `;
}

function qualityBadge(quality) {
  const normalized = normalizeQuality(quality);
  return `<span class="quality-badge quality-${escapeHtml(normalized)}">${escapeHtml(labelForQuality(normalized))}</span>`;
}

function labelForQuality(quality) {
  if (quality === 'ok') return 'OK';
  if (quality === 'warning') return 'Warning';
  if (quality === 'blocked') return 'Blocked';
  if (quality === 'skipped') return 'Skipped';
  if (quality === 'missing') return 'Missing';
  return quality || 'Unknown';
}

function primaryIssue(row) {
  const items = row.blockers.length ? row.blockers : row.warnings;
  return items.length ? compactItems(items) : '-';
}

function reasonSummary(row) {
  const reasons = [...row.openReasonTags, ...row.closeReasonTags];
  return reasons.length ? compactItems(reasons) : '-';
}

function compactItems(items, limit = 2) {
  const visible = items.slice(0, limit).join('; ');
  const remaining = items.length - limit;
  return remaining > 0 ? `${visible}; +${remaining}` : visible;
}

function statHtml(label, value) {
  return `
    <div class="forensics-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function emptyStateHtml(title, detail) {
  return `
    <div class="forensics-empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

function splitItems(value) {
  const text = stringOrEmpty(value).trim();
  if (!text || text === '-') return [];
  return splitTopLevelSemicolons(text).map(item => item.trim()).filter(Boolean);
}

function splitTopLevelSemicolons(text) {
  const parts = [];
  let current = '';
  let parenDepth = 0;

  for (const char of text) {
    if (char === '(') parenDepth += 1;
    if (char === ')' && parenDepth > 0) parenDepth -= 1;
    if (char === ';' && parenDepth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  parts.push(current);
  return parts;
}

function normalizeQuality(value) {
  const text = stringOrEmpty(value).trim().toLowerCase();
  if (text === 'ok' || text === 'warning' || text === 'blocked' || text === 'skipped') {
    return text;
  }
  if (text === 'data-blocked') return 'blocked';
  if (text === 'data-unavailable') return 'blocked';
  if (text === 'missing' || text === 'empty') return text;
  return text || 'unknown';
}

function shortTime(value) {
  return stringOrEmpty(value).replace('T', ' ').replace(/:00Z$/, 'Z');
}

function emptyReport(error) {
  return {
    rows: [],
    error,
  };
}

function numberOrDefault(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function stringOrEmpty(value) {
  return value == null ? '' : String(value);
}

function isSeparatorRow(cells) {
  return cells.every(cell => /^[-:]+$/.test(cell));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}
