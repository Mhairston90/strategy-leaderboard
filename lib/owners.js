/**
 * Owner camps for the multi-owner contest scoreboard.
 *
 * Three camps as of 2026-06-10:
 *   FABLE — Claude Fable 5, entered 2026-06-10 (FABLE-prefixed rows)
 *   CODEX — the Codex agent (CODEX-prefixed rows)
 *   OPUS  — everything else: the Opus-era Claude families, BULL v0/v0.12,
 *           and the manual/sheet strategies (the pre-2026-06-10 incumbent camp)
 */
export function ownerOf(name) {
  const n = String(name || '');
  if (n.startsWith('FABLE')) return 'FABLE';
  if (n.startsWith('CODEX')) return 'CODEX';
  return 'OPUS';
}

export const OWNERS = ['OPUS', 'CODEX', 'FABLE'];

export const OWNER_LABELS = {
  OPUS: 'Opus/BULL',
  CODEX: 'Codex',
  FABLE: 'Fable',
};
