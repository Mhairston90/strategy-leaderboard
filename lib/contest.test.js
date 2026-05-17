import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProvenance } from './provenance.js';
import { buildContestScoreboard } from './contest.js';

const LOG = (rows) => ({
  ok: true,
  text: [
    '| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n'),
});

// Two trades: one entered pre-cutoff (backtest), one post (forward).
const tlMixed = LOG([
  '| 2026-05-01T00:00:00Z | OPEN | AAA | long | 1 | 100 | 95 | — | — | — | entry |',
  '| 2026-05-02T00:00:00Z | CLOSE | AAA | long | 1 | 110 | — | — | 2.0 | +50 | exit |',
  '| 2026-05-20T00:00:00Z | OPEN | BBB | long | 1 | 100 | 95 | — | — | — | entry |',
  '| 2026-05-21T00:00:00Z | CLOSE | BBB | long | 1 | 120 | — | — | 4.0 | +200 | exit |',
]);

function snap(name, live_start_iso, tradeLog) {
  return { strategy: { name, live_start_iso, source: { type: 'codex-local' } }, tradeLog };
}

test('provenance splits forward vs backtest by entry time', () => {
  // cutoff = later of live_start (2026-05-15) and contest start (2026-05-04) = 2026-05-15
  const [p] = computeProvenance([snap('Stocks X', '2026-05-15T00:00:00Z', tlMixed)]);
  assert.equal(p.total, 2);
  assert.equal(p.forward, 1);          // only the 2026-05-20 entry
  assert.equal(p.backtest, 1);
  assert.equal(p.fwdPnl, 200);
  assert.equal(p.btPnl, 50);
  assert.ok(p.legitimacy > 0.49 && p.legitimacy < 0.51);
});

test('sheet source flagged as not auditable', () => {
  const [p] = computeProvenance([
    { strategy: { name: 'HY v4', source: { type: 'sheets' } }, row: { trades_n: 5 } },
  ]);
  assert.equal(p.legitimacy, null);
  assert.match(p.note, /not entry-time-auditable/);
});

test('scoreboard dedups exact-twin codex strategies', () => {
  const twin = LOG([
    '| 2026-05-20T00:00:00Z | OPEN | T | long | 1 | 100 | 95 | — | — | — | e |',
    '| 2026-05-21T00:00:00Z | CLOSE | T | long | 1 | 110 | — | — | 2 | +90 | x |',
  ]);
  const m = buildContestScoreboard([
    snap('CODEX Apex v0', '2026-05-04T00:00:00Z', twin),
    snap('CODEX Apex WFO v1', '2026-05-04T00:00:00Z', twin),
    snap('BULL v0', '2026-05-04T00:00:00Z', tlMixed),
  ], new Date('2026-05-22T00:00:00Z').getTime());
  assert.deepEqual(m.codexTwinsDropped, ['CODEX Apex WFO v1']);
  assert.equal(m.cxTop5.length, 1);            // twin removed
  assert.equal(m.daysLeft, 15);                // 05-22 -> 06-06
  assert.equal(m.leader, 'BULL');              // BULL +200 fwd > Codex +90
});
