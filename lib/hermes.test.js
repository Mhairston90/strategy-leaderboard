import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseHermesQueueText,
  summarizeHermesQueue,
  renderHermesCockpitHtml,
  mergeHermesQueues,
} from './hermes.js';

const queueText = JSON.stringify({
  generated_at: '2026-05-15T14:36:14Z',
  mode: 'paper-only',
  items: [
    {
      id: 'repair-source',
      type: 'repair',
      priority: 1,
      title: 'Repair data source',
      source: 'memory/leaderboard_smoke_latest.txt',
      requested_action: 'Restore adapter visibility.',
      rationale: 'source unavailable',
      guardrail: 'paper-only; no live routing changes',
    },
    {
      id: 'experiment-breakout',
      type: 'experiment',
      priority: 2,
      title: 'Refine CODEX Equities Breakout <script>',
      source: 'memory/overnight_foundry_report.md',
      requested_action: 'Lift PF above 1.20.',
      rationale: 'PF 0.90',
      guardrail: 'paper-only; no live routing changes',
    },
    {
      id: 'sample-regime',
      type: 'sample_collection',
      priority: 3,
      title: 'Keep collecting sample for CODEX Regime v0',
      source: 'memory/goal_status.md',
      requested_action: 'Avoid promotion decisions until sample gates are met.',
      rationale: '6 trades',
      guardrail: 'paper-only; no live routing changes',
    },
  ],
});

test('parseHermesQueueText normalizes queue items and counts types', () => {
  const queue = parseHermesQueueText(queueText);
  const summary = summarizeHermesQueue(queue);

  assert.equal(queue.mode, 'paper-only');
  assert.equal(queue.items.length, 3);
  assert.equal(summary.total, 3);
  assert.equal(summary.repairs, 1);
  assert.equal(summary.experiments, 1);
  assert.equal(summary.sampleCollection, 1);
});

test('renderHermesCockpitHtml groups work and escapes item text', () => {
  const queue = parseHermesQueueText(queueText);
  const html = renderHermesCockpitHtml(queue);

  assert.match(html, /Hermes Cockpit/);
  assert.match(html, /Paper-only/);
  assert.match(html, /Repairs/);
  assert.match(html, /Experiments/);
  assert.match(html, /Sample Watches/);
  assert.match(html, /Refine CODEX Equities Breakout &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('renderHermesCockpitHtml shows an empty state for missing queue data', () => {
  const html = renderHermesCockpitHtml(parseHermesQueueText('', { error: 'missing' }));

  assert.match(html, /No Hermes queue loaded/);
  assert.match(html, /missing/);
});

test('mergeHermesQueues combines items from multiple sources and tags each with owner', () => {
  const codexQueue = parseHermesQueueText(JSON.stringify({
    generated_at: '2026-05-15T14:36:14Z',
    items: [
      { id: 'codex-exp', type: 'experiment', priority: 2, title: 'Codex experiment', source: 'memory/x.md', requested_action: 'do X' },
      { id: 'codex-sample', type: 'sample_collection', priority: 3, title: 'Codex sample', source: 'memory/y.md', requested_action: 'wait' },
    ],
  }));
  const claudeQueue = parseHermesQueueText(JSON.stringify({
    generated_at: '2026-05-16T13:57:00Z',
    items: [
      { id: 'claude-exp', type: 'experiment', priority: 1, title: 'Claude experiment', source: 'data/codex/basket_oos_audit.md', requested_action: 'do Y' },
    ],
  }));

  const merged = mergeHermesQueues([
    { queue: codexQueue, owner: 'codex' },
    { queue: claudeQueue, owner: 'claude' },
  ]);

  assert.equal(merged.items.length, 3);
  // latest generated_at wins
  assert.equal(merged.generated_at, '2026-05-16T13:57:00Z');
  // owner tagging
  const byTitle = Object.fromEntries(merged.items.map(i => [i.title, i.owner]));
  assert.equal(byTitle['Codex experiment'], 'codex');
  assert.equal(byTitle['Codex sample'], 'codex');
  assert.equal(byTitle['Claude experiment'], 'claude');
  // sort: experiments before sample_collection, P1 before P2 within type
  assert.equal(merged.items[0].title, 'Claude experiment');
  assert.equal(merged.items[1].title, 'Codex experiment');
  assert.equal(merged.items[2].title, 'Codex sample');
});

test('mergeHermesQueues tolerates a missing or empty queue alongside a populated one', () => {
  const populated = parseHermesQueueText(JSON.stringify({
    items: [{ id: 'c1', type: 'experiment', priority: 1, title: 'Solo', source: '', requested_action: 'go' }],
  }));
  const empty = parseHermesQueueText('', { error: 'codex queue missing' });

  const merged = mergeHermesQueues([
    { queue: empty, owner: 'codex' },
    { queue: populated, owner: 'claude' },
  ]);

  assert.equal(merged.items.length, 1);
  assert.equal(merged.items[0].owner, 'claude');
  // error suppressed when at least one queue had items
  assert.equal(merged.error, '');
});

test('mergeHermesQueues aggregates errors when no queue had items', () => {
  const codexEmpty = parseHermesQueueText('', { error: 'codex queue missing' });
  const claudeEmpty = parseHermesQueueText('', { error: 'claude queue missing' });

  const merged = mergeHermesQueues([
    { queue: codexEmpty, owner: 'codex' },
    { queue: claudeEmpty, owner: 'claude' },
  ]);

  assert.equal(merged.items.length, 0);
  assert.match(merged.error, /codex queue missing/);
  assert.match(merged.error, /claude queue missing/);
});

test('renderHermesCockpitHtml shows owner badges when items carry owner data', () => {
  const queue = parseHermesQueueText(JSON.stringify({
    items: [{ id: 'x', type: 'experiment', priority: 1, title: 'Owned', source: '', requested_action: 'do it', owner: 'claude' }],
  }));
  const html = renderHermesCockpitHtml(queue);
  assert.match(html, /owner-claude/);
  assert.match(html, /class="owner owner-claude"/);
});

test('renderHermesCockpitHtml shows queue freshness and review-only purpose', () => {
  const queue = parseHermesQueueText(JSON.stringify({
    generated_at: '2026-05-26T11:58:59Z',
    items: [],
  }));

  const html = renderHermesCockpitHtml(queue, { now: '2026-05-26T16:02:00Z' });

  assert.match(html, /Fresh/);
  assert.match(html, /4h ago/);
  assert.match(html, /proposals are logged, not executed automatically/);
});

test('renderHermesCockpitHtml marks experiments with existing proposed hypotheses', () => {
  const queue = parseHermesQueueText(JSON.stringify({
    generated_at: '2026-05-26T11:58:59Z',
    items: [
      {
        id: 'codex-aggro',
        type: 'experiment',
        priority: 2,
        title: 'Refine CODEX Aggro Foundry',
        source: 'memory/overnight_foundry_report.md',
        requested_action: 'Reduce drawdown.',
        rationale: 'PF 0.11',
      },
    ],
  }));
  const ledgerText = [
    '| generated_at | source | family | variable | current_signal | proposed_change | expected_effect | status | key |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| 2026-05-26T13:32:37Z | memory/overnight_foundry_report.md | CODEX Aggro Foundry | target_pct | PF 0.11 | Reduce target_pct by one notch and re-run the same paper window. | Lower drawdown. | proposed | aggro-key |',
  ].join('\n');

  const html = renderHermesCockpitHtml(queue, { ledgerText });

  assert.match(html, /Hypothesis proposed/);
  assert.match(html, /Reduce target_pct by one notch/);
});

test('renderHermesCockpitHtml labels sample watches as intentional collection gates', () => {
  const queue = parseHermesQueueText(JSON.stringify({
    generated_at: '2026-05-26T11:58:59Z',
    items: [
      {
        id: 'codex-regime-sample',
        type: 'sample_collection',
        priority: 3,
        title: 'Keep collecting sample for CODEX Regime v0',
        source: 'memory/goal_status.md',
        requested_action: 'Avoid promotion decisions until sample gates are met.',
        rationale: '6 trades and 2 observed weeks; gates require 30 trades and 6 weeks.',
      },
    ],
  }));

  const html = renderHermesCockpitHtml(queue);

  assert.match(html, /Collecting sample/);
  assert.match(html, /30 trades and 6 weeks/);
});
