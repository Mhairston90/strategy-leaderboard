const TYPE_LABELS = {
  repair: 'Repairs',
  experiment: 'Experiments',
  sample_collection: 'Sample Watches',
};

const TYPE_ORDER = ['repair', 'experiment', 'sample_collection'];
const TYPE_ORDER_MAP = { repair: 0, experiment: 1, sample_collection: 2 };

export function parseHermesHypothesisLedgerText(text) {
  return parseMarkdownTable(text)
    .map(row => ({
      generatedAt: row.generated_at || '',
      source: row.source || '',
      family: row.family || '',
      variable: row.variable || '',
      currentSignal: row.current_signal || '',
      proposedChange: row.proposed_change || '',
      expectedEffect: row.expected_effect || '',
      status: row.status || '',
      key: row.key || '',
    }))
    .filter(row => row.key || row.family || row.proposedChange);
}

export function parseHermesQueueText(text, options = {}) {
  if (!text) {
    return emptyQueue(options.error || 'No Hermes queue loaded');
  }
  try {
    const raw = JSON.parse(text);
    const items = Array.isArray(raw.items) ? raw.items.map(normalizeItem) : [];
    return {
      version: Number(raw.version || 1),
      generated_at: stringOrEmpty(raw.generated_at),
      mode: stringOrEmpty(raw.mode || 'paper-only'),
      sources: Array.isArray(raw.sources) ? raw.sources.map(stringOrEmpty) : [],
      items,
      error: '',
    };
  } catch (error) {
    return emptyQueue(error.message || 'Could not parse Hermes queue');
  }
}

// Merge multiple parsed queues into one renderable queue, tagging each item
// with its source owner. Inputs: Array<{queue, owner}>. Sort order: type
// (repair > experiment > sample_collection), then priority asc, then title.
export function mergeHermesQueues(inputs, options = {}) {
  const items = [];
  let latestGenerated = '';
  const sources = [];
  const errors = [];

  for (const input of inputs || []) {
    if (!input || !input.queue) continue;
    const { queue, owner } = input;
    if (queue.generated_at && queue.generated_at > latestGenerated) {
      latestGenerated = queue.generated_at;
    }
    if (Array.isArray(queue.sources)) sources.push(...queue.sources);
    if (queue.error) errors.push(owner ? `${owner}: ${queue.error}` : queue.error);
    for (const item of (queue.items || [])) {
      items.push({ ...item, owner: owner || item.owner || '' });
    }
  }

  items.sort((a, b) => {
    const ta = TYPE_ORDER_MAP[a.type] ?? 1;
    const tb = TYPE_ORDER_MAP[b.type] ?? 1;
    if (ta !== tb) return ta - tb;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return String(a.title).localeCompare(String(b.title));
  });

  return {
    version: 1,
    generated_at: latestGenerated,
    mode: options.mode || 'paper-only',
    sources,
    items,
    // Only surface errors when no items were loaded at all.
    error: items.length > 0 ? '' : errors.join('; '),
  };
}

export function summarizeHermesQueue(queue) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  return {
    total: items.length,
    repairs: countType(items, 'repair'),
    experiments: countType(items, 'experiment'),
    sampleCollection: countType(items, 'sample_collection'),
    generatedAt: queue?.generated_at || '',
    mode: queue?.mode || 'paper-only',
    error: queue?.error || '',
  };
}

export function renderHermesCockpitHtml(queue, options = {}) {
  const summary = summarizeHermesQueue(queue);
  const groups = groupByType(queue?.items || []);
  const hypotheses = Array.isArray(options.hypotheses)
    ? options.hypotheses
    : parseHermesHypothesisLedgerText(options.ledgerText || '');
  const freshness = summarizeFreshness(summary.generatedAt, options.now);
  const context = { hypotheses };

  return `
    <div class="hermes-head">
      <div>
        <div class="section-kicker">Hermes</div>
        <h2>Hermes Cockpit</h2>
      </div>
      <div class="hermes-meta">
        <span class="badge badge-research">Paper-only</span>
        <span class="badge badge-${escapeHtml(freshness.level)}">${escapeHtml(freshness.label)}</span>
        <span class="dim">${summary.generatedAt ? `${escapeHtml(summary.generatedAt)} (${escapeHtml(freshness.ageLabel)})` : 'No run yet'}</span>
      </div>
    </div>
    <div class="hermes-note">Hermes is review-only: proposals are logged, not executed automatically.</div>
    <div class="hermes-stats">
      ${statHtml('Queue', summary.total)}
      ${statHtml('Repairs', summary.repairs)}
      ${statHtml('Experiments', summary.experiments)}
      ${statHtml('Samples', summary.sampleCollection)}
    </div>
    ${summary.error ? emptyStateHtml(summary.error) : ''}
    <div class="hermes-columns">
      ${TYPE_ORDER.map(type => groupHtml(type, groups[type], context)).join('')}
    </div>
  `;
}

function normalizeItem(item) {
  return {
    id: stringOrEmpty(item?.id),
    type: TYPE_LABELS[item?.type] ? item.type : 'experiment',
    priority: numberOrDefault(item?.priority, 3),
    title: stringOrEmpty(item?.title || 'Untitled Hermes item'),
    source: stringOrEmpty(item?.source),
    rationale: stringOrEmpty(item?.rationale),
    requested_action: stringOrEmpty(item?.requested_action),
    guardrail: stringOrEmpty(item?.guardrail || 'paper-only; no live routing changes'),
    owner: stringOrEmpty(item?.owner),
  };
}

function emptyQueue(error) {
  return {
    version: 1,
    generated_at: '',
    mode: 'paper-only',
    sources: [],
    items: [],
    error,
  };
}

function groupByType(items) {
  const groups = Object.fromEntries(TYPE_ORDER.map(type => [type, []]));
  for (const item of items) {
    const type = TYPE_LABELS[item.type] ? item.type : 'experiment';
    groups[type].push(item);
  }
  for (const type of TYPE_ORDER) {
    groups[type].sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
  }
  return groups;
}

function groupHtml(type, items, context) {
  const label = TYPE_LABELS[type];
  const rows = items.length
    ? items.map(item => itemHtml(item, context)).join('')
    : '<div class="hermes-empty">No items</div>';
  return `
    <section class="hermes-group" aria-label="${escapeHtml(label)}">
      <div class="hermes-group-title">
        <span>${escapeHtml(label)}</span>
        <span class="dim">${items.length}</span>
      </div>
      <div class="hermes-list">${rows}</div>
    </section>
  `;
}

function itemHtml(item, context) {
  const owner = item.owner
    ? `<span class="owner owner-${escapeHtml(item.owner)}">${escapeHtml(item.owner)}</span>`
    : '';
  const state = itemState(item, context?.hypotheses || []);
  return `
    <article class="hermes-item priority-${escapeHtml(item.priority)}">
      <div class="hermes-item-top">
        <span class="priority">P${escapeHtml(item.priority)}</span>
        ${owner}
        <span class="lifecycle lifecycle-${escapeHtml(state.level)}">${escapeHtml(state.label)}</span>
        <span class="source">${escapeHtml(shortSource(item.source))}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.requested_action)}</p>
      ${state.hypothesis ? proposalHtml(state.hypothesis) : ''}
      <div class="rationale">${escapeHtml(item.rationale)}</div>
    </article>
  `;
}

function itemState(item, hypotheses) {
  if (item.type === 'repair') {
    return { label: 'Needs repair', level: 'repair', hypothesis: null };
  }
  if (item.type === 'sample_collection') {
    return { label: 'Collecting sample', level: 'sample', hypothesis: null };
  }
  const hypothesis = findMatchingHypothesis(item, hypotheses);
  if (hypothesis) {
    return {
      label: `Hypothesis ${humanizeStatus(hypothesis.status || 'logged')}`,
      level: 'proposed',
      hypothesis,
    };
  }
  return { label: 'Needs review', level: 'queued', hypothesis: null };
}

function proposalHtml(hypothesis) {
  const variable = hypothesis.variable ? `<span>${escapeHtml(hypothesis.variable)}</span>` : '';
  return `
    <div class="hermes-proposal">
      ${variable}
      <p>${escapeHtml(hypothesis.proposedChange)}</p>
    </div>
  `;
}

function emptyStateHtml(error) {
  return `
    <div class="hermes-empty-state">
      <strong>No Hermes queue loaded</strong>
      <span>${escapeHtml(error)}</span>
    </div>
  `;
}

function statHtml(label, value) {
  return `
    <div class="hermes-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function countType(items, type) {
  return items.filter(item => item.type === type).length;
}

function summarizeFreshness(generatedAt, nowValue) {
  if (!generatedAt) {
    return { label: 'No run', level: 'missing', ageLabel: '' };
  }
  const generated = new Date(generatedAt);
  const now = nowValue ? new Date(nowValue) : new Date();
  if (!Number.isFinite(generated.getTime()) || !Number.isFinite(now.getTime())) {
    return { label: 'Unknown age', level: 'missing', ageLabel: 'unknown age' };
  }
  const hours = Math.max(0, (now.getTime() - generated.getTime()) / 36e5);
  const level = hours <= 24 ? 'fresh' : hours <= 48 ? 'aging' : 'stale';
  const label = level === 'fresh' ? 'Fresh' : level === 'aging' ? 'Aging' : 'Stale';
  return { label, level, ageLabel: formatAge(hours) };
}

function formatAge(hours) {
  if (hours < 1) return 'just now';
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function findMatchingHypothesis(item, hypotheses) {
  const itemFamily = normalizeMatchText(familyFromTitle(item.title, item.type));
  const itemSource = normalizeSource(item.source);
  return hypotheses.find(row => {
    const rowFamily = normalizeMatchText(row.family);
    const rowSource = normalizeSource(row.source);
    if (!rowFamily || !itemFamily || rowFamily !== itemFamily) return false;
    return !rowSource || !itemSource || rowSource === itemSource;
  }) || null;
}

function familyFromTitle(title, type) {
  let value = String(title || '').trim();
  if (type === 'experiment') value = value.replace(/^Refine\s+/i, '');
  if (type === 'sample_collection') value = value.replace(/^Keep collecting sample for\s+/i, '');
  if (type === 'repair') value = value.replace(/^Repair\s+/i, '');
  return value.trim();
}

function normalizeMatchText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeSource(source) {
  return shortSource(String(source || '')).toLowerCase();
}

function humanizeStatus(status) {
  return String(status || '').replace(/[_-]+/g, ' ').trim().toLowerCase();
}

function parseMarkdownTable(text) {
  const lines = String(text || '').split(/\r?\n/).filter(line => line.trim().startsWith('|'));
  let headers = null;
  const rows = [];
  for (const line of lines) {
    const cells = markdownCells(line);
    if (!headers) {
      headers = cells.map(cell => cell.toLowerCase());
      continue;
    }
    if (cells.every(cell => /^:?-{3,}:?$/.test(cell))) continue;
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || '';
    });
    rows.push(row);
  }
  return rows;
}

function markdownCells(line) {
  return line.trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

function shortSource(source) {
  return source.replace(/^memory\//, '');
}

function stringOrEmpty(value) {
  return value == null ? '' : String(value);
}

function numberOrDefault(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
