import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProvenance } from './provenance.js';
import { buildContestScoreboard } from './contest.js';
import { SCORING_REGISTRATIONS } from '../scoring_registrations.js';
import { STRATEGIES } from '../registry.js';
import { ownerOf } from './owners.js';

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
  const [p] = computeProvenance([snap('Stocks X', '2026-05-15T00:00:00Z', tlMixed)]);
  assert.equal(p.total, 2);
  assert.equal(p.forward, 1);
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

test('scoreboard dedups exact-twin strategies within an owner', () => {
  const twin = LOG([
    '| 2026-05-20T00:00:00Z | OPEN | T | long | 1 | 100 | 95 | — | — | — | e |',
    '| 2026-05-21T00:00:00Z | CLOSE | T | long | 1 | 110 | — | — | 2 | +90 | x |',
  ]);
  const m = buildContestScoreboard([
    snap('CODEX Apex v0', '2026-05-04T00:00:00Z', twin),
    snap('CODEX Apex WFO v1', '2026-05-04T00:00:00Z', twin),
    snap('BULL v0', '2026-05-04T00:00:00Z', tlMixed),
  ], new Date('2026-05-22T00:00:00Z').getTime());
  const codex = m.owners.find(o => o.owner === 'CODEX');
  const opus = m.owners.find(o => o.owner === 'OPUS');
  assert.deepEqual(codex.twinsDropped, ['CODEX Apex WFO v1']);
  assert.equal(codex.list.length, 1);
  assert.equal(opus.sum, 200);
  assert.equal(m.leader, 'OPUS');          // +200 fwd > Codex +90 (May = unregistered month)
});

test('registered owner is scored on exactly its pre-registered 5', () => {
  const big = LOG([
    '| 2026-06-11T00:00:00Z | OPEN | T | long | 1 | 100 | 95 | — | — | — | e |',
    '| 2026-06-12T00:00:00Z | CLOSE | T | long | 1 | 200 | — | — | 5 | +5000 | x |',
  ]);
  const small = LOG([
    '| 2026-06-11T00:00:00Z | OPEN | S | long | 1 | 100 | 95 | — | — | — | e |',
    '| 2026-06-12T00:00:00Z | CLOSE | S | long | 1 | 101 | — | — | 0.2 | +10 | x |',
  ]);
  // FABLE Fader is NOT in the June registration; even with a monster forward
  // P&L it must not count. Registered-but-absent rows score 0.
  const m = buildContestScoreboard([
    snap('FABLE Equities Fader v1', '2026-06-10T00:00:00Z', big),
    snap('FABLE Equities Snapback L/S v1', '2026-06-10T00:00:00Z', small),
  ], new Date('2026-06-15T00:00:00Z').getTime());
  const fable = m.owners.find(o => o.owner === 'FABLE');
  assert.equal(fable.registered, true);
  assert.equal(fable.sum, 10);                       // only Snapback counts
  assert.equal(fable.missing.length, 4);             // 4 registered rows absent in this fixture
  assert.ok(!fable.list.some(r => r.name.includes('Fader')));
});

test('unregistered owner falls back to flagged legacy top-5', () => {
  const m = buildContestScoreboard([
    snap('CODEX Pulse v0', '2026-05-04T00:00:00Z', tlMixed),
  ], new Date('2026-06-15T00:00:00Z').getTime());
  const codex = m.owners.find(o => o.owner === 'CODEX');
  assert.equal(codex.registered, false);
  assert.equal(codex.sum, 200);
});

test('every registered name exists in the registry and belongs to its owner', () => {
  const names = new Set(STRATEGIES.map(s => s.name));
  for (const [month, byOwner] of Object.entries(SCORING_REGISTRATIONS)) {
    for (const [owner, list] of Object.entries(byOwner)) {
      if (!list) continue;
      assert.equal(list.length, 5, `${owner} ${month} must register exactly 5`);
      for (const n of list) {
        assert.ok(names.has(n), `${n} (registered by ${owner} for ${month}) not in registry`);
        assert.equal(ownerOf(n), owner, `${n} does not belong to ${owner}`);
      }
      assert.equal(new Set(list).size, 5, `${owner} ${month} registration has duplicates`);
    }
  }
});
