import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseTradeForensicsText,
  renderTradeForensicsHtml,
  summarizeTradeForensics,
} from './forensics.js';

const forensicText = `# Trade Forensics

| Recorded (UTC) | Strategy | Cycle time | Data source | Quality | Symbols checked | Warnings | Blockers | Opened | Closed | Open reason tags | Close reason tags | Candidates |
|----------------|----------|------------|-------------|---------|-----------------|----------|----------|--------|--------|------------------|-------------------|------------|
| 2026-05-16T13:01:00Z | CODEX v0 | 2026-05-16T12:00:00Z | live | ok | BTC/USD; ETH/USD | - | - | 1 | 0 | trend-entry | - | 3 |
| 2026-05-16T13:05:00Z | CODEX Pulse v0 | 2026-05-16T13:00:00Z | cache | warning | BTC/USD; SOL/USD | SOL/USD: live fetch failed; using cached market data | - | 0 | 1 | - | time-stop | 0 |
| 2026-05-16T13:10:00Z | CODEX Equities Gap <bad> | 2026-05-16T13:00:00Z | provided | blocked | NVDA | NVDA: only 1 candle(s), need 3 | NVDA: only 1 candle(s), need 3 | 0 | 0 | - | - | 0 |
`;

test('parseTradeForensicsText normalizes markdown rows', () => {
  const report = parseTradeForensicsText(forensicText);
  const summary = summarizeTradeForensics(report);

  assert.equal(report.rows.length, 3);
  assert.equal(report.rows[2].strategy, 'CODEX Equities Gap <bad>');
  assert.deepEqual(report.rows[1].warnings, [
    'SOL/USD: live fetch failed',
    'using cached market data',
  ]);
  assert.equal(report.rows[0].opened, 1);
  assert.equal(report.rows[1].closed, 1);
  assert.equal(summary.total, 3);
  assert.equal(summary.blocked, 1);
  assert.equal(summary.warnings, 1);
  assert.equal(summary.latest.quality, 'blocked');
});

test('parseTradeForensicsText keeps semicolons inside parenthesized warning details', () => {
  const report = parseTradeForensicsText(`# Trade Forensics

| Recorded (UTC) | Strategy | Cycle time | Data source | Quality | Symbols checked | Warnings | Blockers | Opened | Closed | Open reason tags | Close reason tags | Candidates |
|----------------|----------|------------|-------------|---------|-----------------|----------|----------|--------|--------|------------------|-------------------|------------|
| 2026-05-17T17:44:43Z | CODEX Apex WFO v1 | 2026-05-17T12:00:00Z | cache | warning | BTC/USD; ETH/USD; SOL/USD | Kraken OHLC degraded for 3 symbols (BTC/USD; ETH/USD; SOL/USD): recent Kraken failure cooldown active; using cached market data | - | 0 | 0 | - | - | 0 |
`);

  assert.deepEqual(report.rows[0].warnings, [
    'Kraken OHLC degraded for 3 symbols (BTC/USD; ETH/USD; SOL/USD): recent Kraken failure cooldown active',
    'using cached market data',
  ]);
});

test('summarizeTradeForensics counts duplicate strategy cycles once', () => {
  const report = parseTradeForensicsText(`# Trade Forensics

| Recorded (UTC) | Strategy | Cycle time | Data source | Quality | Symbols checked | Warnings | Blockers | Opened | Closed | Open reason tags | Close reason tags | Candidates |
|----------------|----------|------------|-------------|---------|-----------------|----------|----------|--------|--------|------------------|-------------------|------------|
| 2026-05-17T17:44:42Z | CODEX Regime WFO v1 | 2026-05-17T12:00:00Z | cache | warning | BTC/USD | using cached market data | - | 1 | 0 | entry | - | 1 |
| 2026-05-17T17:44:43Z | CODEX Regime WFO v1 | 2026-05-17T12:00:00Z | cache | warning | BTC/USD | using cached market data | - | 0 | 0 | - | - | 0 |
| 2026-05-17T17:44:44Z | CODEX Apex v0 | 2026-05-17T12:00:00Z | cache | warning | BTC/USD | using cached market data | - | 0 | 0 | - | - | 0 |
`);

  const summary = summarizeTradeForensics(report);

  assert.equal(summary.total, 2);
  assert.equal(summary.warnings, 2);
  assert.equal(summary.totalOpened, 1);
});

test('summarizeTradeForensics separates current warnings from historical warnings', () => {
  const report = parseTradeForensicsText(`# Trade Forensics

| Recorded (UTC) | Strategy | Cycle time | Data source | Quality | Symbols checked | Warnings | Blockers | Opened | Closed | Open reason tags | Close reason tags | Candidates |
|----------------|----------|------------|-------------|---------|-----------------|----------|----------|--------|--------|------------------|-------------------|------------|
| 2026-05-25T17:55:36Z | CODEX v0 | 2026-05-25T16:00:00Z | cache | warning | BTC/USD | Kraken OHLC degraded for 1 symbols (BTC/USD): using cached market data | - | 0 | 0 | - | - | 0 |
| 2026-05-26T14:09:23Z | CODEX v0 | 2026-05-26T12:00:00Z | live | ok | BTC/USD | - | - | 0 | 0 | - | - | 0 |
| 2026-05-26T14:08:33Z | CODEX Pulse v0 | 2026-05-26T14:00:00Z | cache | warning | DOGE/USD | Kraken OHLC degraded for 1 symbols (DOGE/USD): using cached market data | - | 1 | 0 | pulse | - | 1 |
`);

  const summary = summarizeTradeForensics(report);
  const html = renderTradeForensicsHtml(report);

  assert.equal(summary.warnings, 2);
  assert.equal(summary.currentWarnings, 1);
  assert.match(html, /Current Warnings/);
  assert.match(html, /Historical Warnings/);
});

test('renderTradeForensicsHtml summarizes quality and escapes text', () => {
  const html = renderTradeForensicsHtml(parseTradeForensicsText(forensicText));

  assert.match(html, /Data Quality/);
  assert.match(html, /Blocked/);
  assert.match(html, /CODEX Equities Gap &lt;bad&gt;/);
  assert.match(html, /NVDA: only 1 candle\(s\), need 3/);
  assert.doesNotMatch(html, /CODEX Equities Gap <bad>/);
});

test('renderTradeForensicsHtml handles missing ledger data', () => {
  const html = renderTradeForensicsHtml(
    parseTradeForensicsText('', { error: 'missing forensics' })
  );

  assert.match(html, /No forensic cycles loaded/);
  assert.match(html, /missing forensics/);
});
