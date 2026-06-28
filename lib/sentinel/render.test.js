import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderSentinelHtml } from './render.js';

test('renderSentinelHtml shows paper autosubmit and allocation', () => {
  const html = renderSentinelHtml({
    statusText: '# Trade Sentinel Status\n\n- submitted: 1\n- blocked: 0\n',
    config: { mode: 'paper', paper_auto_submit_enabled: true },
    allocation: {
      strategies: [{ name: 'CODEX Aggro v0', target_weight: 0.18, role: 'proven_crypto_momentum' }],
    },
    promotion: { strategies: [{ name: 'CODEX Aggro v0', status: 'core', reason: 'configured core' }] },
    riskState: { frozen: false },
    reconciliation: { status: 'ok', differences: [] },
    tickets: [{ ticket_id: 't1', decision: 'submitted', symbol: 'AAPL' }],
    ledger: [{ type: 'order_submitted', broker_order_id: 'o1', symbol: 'AAPL' }],
  });

  assert.match(html, /Trade Sentinel/);
  assert.match(html, /Paper Auto-Submit/);
  assert.match(html, /ON/);
  assert.match(html, /paper/);
  assert.match(html, /CODEX Aggro v0/);
  assert.match(html, /proven_crypto_momentum/);
  assert.match(html, /configured core/);
  assert.match(html, /submitted/);
  assert.match(html, /order_submitted/);
});

test('renderSentinelHtml escapes hostile strategy and ticket content', () => {
  const html = renderSentinelHtml({
    config: { mode: '<img src=x onerror=alert(1)>', paper_auto_submit_enabled: false },
    allocation: {
      strategies: [{
        name: '<script>alert("strategy")</script>',
        target_weight: 0.5,
        role: 'core & "danger"',
      }],
    },
    promotion: {
      strategies: [{
        name: '<b>bad</b>',
        status: 'watch',
        reason: 'reason <img src=x>',
      }],
    },
    riskState: { frozen: false },
    reconciliation: { status: 'ok', differences: [] },
    tickets: [{
      ticket_id: '<svg onload=alert(1)>',
      decision: 'blocked',
      strategy: 'ticket <script>',
      symbol: 'AAPL"><img src=x>',
      reasons: ['bad <reason>'],
    }],
    ledger: [{
      type: 'order_rejected',
      broker_order_id: 'o<1>',
      symbol: 'MSFT<script>',
      reason: 'broker <reject>',
    }],
  });

  assert.match(html, /&lt;script&gt;alert\(&quot;strategy&quot;\)&lt;\/script&gt;/);
  assert.match(html, /core &amp; &quot;danger&quot;/);
  assert.match(html, /AAPL&quot;&gt;&lt;img src=x&gt;/);
  assert.match(html, /bad &lt;reason&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<svg onload=/);
});

test('renderSentinelHtml shows frozen risk state and reconciliation error', () => {
  const html = renderSentinelHtml({
    statusText: '# Trade Sentinel Status\n\n- frozen: true\n',
    config: { mode: 'paper', paper_auto_submit_enabled: true },
    allocation: { strategies: [] },
    promotion: { strategies: [] },
    riskState: {
      frozen: true,
      freeze_reason: 'position mismatch between ledger and broker',
      freeze_source: 'reconciliation',
    },
    reconciliation: {
      status: 'error',
      freeze_reason: 'position mismatch between ledger and broker',
      differences: [{
        symbol: 'AAPL',
        type: 'value_mismatch',
        qty_difference: 2,
        market_value_difference: -125.5,
      }],
    },
    tickets: [],
    ledger: [],
  });

  assert.match(html, /FROZEN/);
  assert.match(html, /position mismatch between ledger and broker/);
  assert.match(html, /reconciliation/);
  assert.match(html, /error/);
  assert.match(html, /AAPL/);
  assert.match(html, /value_mismatch/);
});
