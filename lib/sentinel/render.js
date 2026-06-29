const EMPTY_DASH = '-';

export function renderSentinelHtml(model = {}) {
  const config = objectOrEmpty(model.config);
  const allocationRows = allocationStrategies(model.allocation);
  const promotionRows = asArray(model.promotion?.strategies);
  const tickets = recentRows(model.tickets, 20);
  const ledger = recentRows(model.ledger, 20);
  const riskState = objectOrEmpty(model.riskState);
  const reconciliation = objectOrEmpty(model.reconciliation);
  const differences = asArray(reconciliation.differences);
  const statusText = String(model.statusText ?? '').trim();
  const loadErrors = asArray(model.loadErrors);

  const autoSubmitOn = config.paper_auto_submit_enabled === true;
  const frozen = riskState.frozen === true;
  const mode = valueOrDash(config.mode);
  const reconciliationStatus = valueOrDash(reconciliation.status);
  const submitted = statusValue(statusText, 'submitted');
  const blocked = statusValue(statusText, 'blocked');
  const brokerRejected = statusValue(statusText, 'broker_rejected');
  const processedTickets = statusValue(statusText, 'processed_tickets');

  return `
    <section class="sentinel-hero" aria-label="Trade Sentinel summary">
      <div class="sentinel-hero-head">
        <div>
          <div class="section-kicker">Sentinel</div>
          <h1>Trade Sentinel</h1>
        </div>
        <div class="sentinel-state-row">
          <span class="sentinel-pill ${autoSubmitOn ? 'sentinel-pill-ok' : 'sentinel-pill-muted'}">Paper Auto-Submit ${autoSubmitOn ? 'ON' : 'OFF'}</span>
          <span class="sentinel-pill ${frozen ? 'sentinel-pill-danger' : 'sentinel-pill-ok'}">${frozen ? 'FROZEN' : 'READY'}</span>
        </div>
      </div>

      <div class="sentinel-summary-grid">
        ${summaryMetricHtml('Mode', mode, 'neutral')}
        ${summaryMetricHtml('Reconciliation', reconciliationStatus, reconciliationStatus === 'ok' ? 'ok' : 'warn')}
        ${summaryMetricHtml('Differences', String(differences.length), differences.length ? 'warn' : 'ok')}
        ${summaryMetricHtml('Processed', processedTickets, 'neutral')}
        ${summaryMetricHtml('Submitted', submitted, Number(submitted) > 0 ? 'ok' : 'neutral')}
        ${summaryMetricHtml('Blocked', blocked, Number(blocked) > 0 ? 'warn' : 'neutral')}
        ${summaryMetricHtml('Broker Rejected', brokerRejected, Number(brokerRejected) > 0 ? 'warn' : 'neutral')}
        ${summaryMetricHtml('Ledger Events', String(asArray(model.ledger).length), 'neutral')}
      </div>

      ${riskBannerHtml(riskState, reconciliation)}
    </section>

    ${loadErrorsHtml(loadErrors)}

    <section class="sentinel-panel sentinel-status-text" aria-label="Status snapshot">
      <div class="sentinel-panel-head">
        <h2>Status Snapshot</h2>
        <span class="dim">${escapeHtml(latestTimestamp(model) || 'local snapshot')}</span>
      </div>
      <pre>${escapeHtml(statusText || 'No status snapshot')}</pre>
    </section>

    <section class="sentinel-panel" aria-label="Allocation">
      <div class="sentinel-panel-head">
        <h2>Allocation</h2>
        <span class="dim">${escapeHtml(allocationRows.length)} strategies</span>
      </div>
      <div class="sentinel-table-scroll">
        <table class="sentinel-table">
          <thead>
            <tr>
              <th class="left">Strategy</th>
              <th>Weight</th>
              <th class="left">Role</th>
              <th class="left">Status</th>
              <th class="left">Reason</th>
            </tr>
          </thead>
          <tbody>
            ${allocationTableRowsHtml(allocationRows)}
          </tbody>
        </table>
      </div>
    </section>

    <section class="sentinel-panel" aria-label="Promotion Lab">
      <div class="sentinel-panel-head">
        <h2>Promotion Lab</h2>
        <span class="dim">${escapeHtml(promotionRows.length)} strategies</span>
      </div>
      <div class="sentinel-table-scroll">
        <table class="sentinel-table">
          <thead>
            <tr>
              <th class="left">Strategy</th>
              <th class="left">Status</th>
              <th class="left">Reason</th>
              <th>Trades</th>
              <th>PF</th>
              <th>Max DD</th>
            </tr>
          </thead>
          <tbody>
            ${promotionTableRowsHtml(promotionRows)}
          </tbody>
        </table>
      </div>
    </section>

    <section class="sentinel-panel" aria-label="Reconciliation differences">
      <div class="sentinel-panel-head">
        <h2>Reconciliation</h2>
        <span class="sentinel-pill ${reconciliationStatus === 'ok' ? 'sentinel-pill-ok' : 'sentinel-pill-warn'}">${escapeHtml(reconciliationStatus)}</span>
      </div>
      <div class="sentinel-table-scroll">
        <table class="sentinel-table">
          <thead>
            <tr>
              <th class="left">Symbol</th>
              <th class="left">Type</th>
              <th>Qty Diff</th>
              <th>Value Diff</th>
              <th class="left">Freeze Reason</th>
            </tr>
          </thead>
          <tbody>
            ${reconciliationRowsHtml(differences, reconciliation)}
          </tbody>
        </table>
      </div>
    </section>

    <section class="sentinel-panel" aria-label="Trade Queue">
      <div class="sentinel-panel-head">
        <h2>Trade Queue</h2>
        <span class="dim">${escapeHtml(tickets.length)} recent decisions</span>
      </div>
      <div class="sentinel-table-scroll">
        <table class="sentinel-table sentinel-table-wide">
          <thead>
            <tr>
              <th class="left">Processed</th>
              <th class="left">Ticket</th>
              <th class="left">Decision</th>
              <th class="left">Strategy</th>
              <th class="left">Symbol</th>
              <th class="left">Side</th>
              <th>Notional</th>
              <th class="left">Reason</th>
            </tr>
          </thead>
          <tbody>
            ${ticketTableRowsHtml(tickets)}
          </tbody>
        </table>
      </div>
    </section>

    <section class="sentinel-panel" aria-label="Execution Ledger">
      <div class="sentinel-panel-head">
        <h2>Execution Ledger</h2>
        <span class="dim">${escapeHtml(ledger.length)} recent events</span>
      </div>
      <div class="sentinel-table-scroll">
        <table class="sentinel-table sentinel-table-wide">
          <thead>
            <tr>
              <th class="left">Time</th>
              <th class="left">Type</th>
              <th class="left">Strategy</th>
              <th class="left">Symbol</th>
              <th class="left">Side</th>
              <th>Notional</th>
              <th class="left">Broker Order</th>
              <th class="left">Reason</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerTableRowsHtml(ledger)}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function allocationStrategies(allocation) {
  const strategies = asArray(allocation?.strategies);
  if (strategies.length) return strategies;
  return asArray(allocation?.items);
}

function allocationTableRowsHtml(rows) {
  if (!rows.length) {
    return emptyRowHtml(5, 'No allocation rows');
  }

  return rows.map(row => `
    <tr>
      <td class="left name">${escapeHtml(valueOrDash(row?.name))}</td>
      <td>${escapeHtml(formatWeight(row?.target_weight))}</td>
      <td class="left">${escapeHtml(valueOrDash(row?.role))}</td>
      <td class="left">${statusPillHtml(row?.status || 'configured')}</td>
      <td class="left">${escapeHtml(valueOrDash(row?.reason))}</td>
    </tr>
  `).join('');
}

function promotionTableRowsHtml(rows) {
  if (!rows.length) {
    return emptyRowHtml(6, 'No promotion rows');
  }

  return rows.map(row => `
    <tr>
      <td class="left name">${escapeHtml(valueOrDash(row?.name))}</td>
      <td class="left">${statusPillHtml(row?.status)}</td>
      <td class="left">${escapeHtml(valueOrDash(row?.reason))}</td>
      <td>${escapeHtml(valueOrDash(row?.metrics?.trades_n))}</td>
      <td>${escapeHtml(formatNumber(row?.metrics?.pf, 2))}</td>
      <td>${escapeHtml(formatPercent(row?.metrics?.max_dd))}</td>
    </tr>
  `).join('');
}

function reconciliationRowsHtml(rows, reconciliation) {
  if (!rows.length) {
    return emptyRowHtml(5, reconciliation?.status === 'ok' ? 'No differences' : valueOrDash(reconciliation?.freeze_reason));
  }

  return rows.slice(0, 20).map(row => `
    <tr>
      <td class="left name">${escapeHtml(valueOrDash(row?.symbol))}</td>
      <td class="left">${escapeHtml(valueOrDash(row?.type))}</td>
      <td>${escapeHtml(formatNumber(row?.qty_difference, 6))}</td>
      <td>${escapeHtml(formatNumber(row?.market_value_difference, 2))}</td>
      <td class="left">${escapeHtml(valueOrDash(row?.reason || reconciliation?.freeze_reason))}</td>
    </tr>
  `).join('');
}

function ticketTableRowsHtml(rows) {
  if (!rows.length) {
    return emptyRowHtml(8, 'No recent ticket decisions');
  }

  return rows.map(row => {
    const reasons = asArray(row?.reasons).filter(Boolean).join('; ') || row?.reason || '';
    return `
      <tr>
        <td class="left">${escapeHtml(shortTimestamp(row?.processed_at || row?.at))}</td>
        <td class="left">${escapeHtml(valueOrDash(row?.ticket_id))}</td>
        <td class="left">${statusPillHtml(row?.decision || row?.risk_status)}</td>
        <td class="left">${escapeHtml(valueOrDash(row?.strategy))}</td>
        <td class="left name">${escapeHtml(valueOrDash(row?.symbol))}</td>
        <td class="left">${escapeHtml(valueOrDash(row?.side))}</td>
        <td>${escapeHtml(formatMoney(row?.notional_usd))}</td>
        <td class="left">${escapeHtml(valueOrDash(reasons))}</td>
      </tr>
    `;
  }).join('');
}

function ledgerTableRowsHtml(rows) {
  if (!rows.length) {
    return emptyRowHtml(8, 'No execution ledger events');
  }

  return rows.map(row => `
    <tr>
      <td class="left">${escapeHtml(shortTimestamp(row?.at || row?.processed_at))}</td>
      <td class="left">${statusPillHtml(row?.type)}</td>
      <td class="left">${escapeHtml(valueOrDash(row?.strategy))}</td>
      <td class="left name">${escapeHtml(valueOrDash(row?.symbol))}</td>
      <td class="left">${escapeHtml(valueOrDash(row?.side))}</td>
      <td>${escapeHtml(formatMoney(row?.notional_usd ?? row?.fill_value))}</td>
      <td class="left">${escapeHtml(valueOrDash(row?.broker_order_id ?? row?.order_id))}</td>
      <td class="left">${escapeHtml(valueOrDash(row?.reason))}</td>
    </tr>
  `).join('');
}

function loadErrorsHtml(errors) {
  if (!errors.length) return '';
  return `
    <section class="sentinel-panel sentinel-load-errors" aria-label="Load errors">
      <div class="sentinel-panel-head">
        <h2>Load Health</h2>
        <span class="sentinel-pill sentinel-pill-warn">${escapeHtml(errors.length)} warnings</span>
      </div>
      <div class="sentinel-error-list">
        ${errors.map(error => `
          <div class="sentinel-error-row">
            <strong>${escapeHtml(valueOrDash(error?.path))}</strong>
            <span>${escapeHtml(valueOrDash(error?.message))}</span>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function riskBannerHtml(riskState, reconciliation) {
  const frozen = riskState.frozen === true;
  const reconciliationError = reconciliation.status && reconciliation.status !== 'ok';
  const reason = riskState.freeze_reason || reconciliation.freeze_reason || '';
  if (!frozen && !reconciliationError && !reason) {
    return '';
  }

  return `
    <div class="sentinel-risk-banner ${frozen || reconciliationError ? 'sentinel-risk-banner-warn' : ''}">
      <strong>${frozen ? 'FROZEN' : 'Risk State'}</strong>
      <span>${escapeHtml(valueOrDash(reason || reconciliation.status))}</span>
      <span class="dim">${escapeHtml(valueOrDash(riskState.freeze_source))}</span>
    </div>
  `;
}

function summaryMetricHtml(label, value, state) {
  return `
    <div class="sentinel-metric sentinel-metric-${safeClassToken(state)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(valueOrDash(value))}</strong>
    </div>
  `;
}

function statusPillHtml(value) {
  const label = valueOrDash(value);
  return `<span class="sentinel-pill sentinel-pill-${safeClassToken(label)}">${escapeHtml(label)}</span>`;
}

function statusValue(statusText, key) {
  const pattern = new RegExp(`^\\s*-\\s*${escapeRegExp(key)}\\s*:\\s*(.*?)\\s*$`, 'im');
  const match = String(statusText || '').match(pattern);
  return match ? match[1] : '0';
}

function emptyRowHtml(colspan, text) {
  return `<tr><td colspan="${escapeHtml(colspan)}" class="sentinel-empty">${escapeHtml(text)}</td></tr>`;
}

function latestTimestamp(model) {
  return [
    model?.riskState?.generated_at,
    model?.reconciliation?.generated_at,
    model?.allocation?.generated_at,
    model?.promotion?.generated_at,
  ].filter(Boolean).sort().at(-1) || '';
}

function recentRows(rows, limit) {
  return asArray(rows).slice(-limit).reverse();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function valueOrDash(value) {
  if (value === null || value === undefined || value === '') {
    return EMPTY_DASH;
  }
  return String(value);
}

function formatWeight(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return EMPTY_DASH;
  return `${(number * 100).toFixed(1)}%`;
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return EMPTY_DASH;
  const sign = number < 0 ? '-' : '';
  return `${sign}$${Math.abs(number).toFixed(2)}`;
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return EMPTY_DASH;
  return `${number.toFixed(1)}%`;
}

function formatNumber(value, digits) {
  const number = Number(value);
  if (!Number.isFinite(number)) return EMPTY_DASH;
  return number.toFixed(digits).replace(/\.?0+$/, '');
}

function shortTimestamp(value) {
  const text = valueOrDash(value);
  if (text === EMPTY_DASH) return text;
  return text.replace('T', ' ').replace(/:00\.000Z$/, 'Z').replace(/:00Z$/, 'Z');
}

function safeClassToken(value) {
  const token = String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return token || 'unknown';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}
