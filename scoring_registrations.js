/**
 * Pre-registered scoring — adopted 2026-06-10.
 *
 * THE RULE: each owner pre-registers exactly 5 strategies per calendar month.
 * The owner's contest score for that month = the summed forward P&L of those
 * 5 rows and ONLY those 5 — picked before the month's results are known.
 * Everything else an owner runs is research-only (still on the board, still
 * auditable, contributes nothing to the score).
 *
 * WHY: the old "best top-5 of unlimited entries" scoring rewarded spawning
 * variant lottery tickets — with 79 rows, several will look great by chance
 * and losers cost nothing. Pre-registration makes the score measure
 * selection skill, not breadth.
 *
 * MECHANICS:
 *  - Registrations are per UTC calendar month, keyed 'YYYY-MM'.
 *  - A month's registration must be committed BEFORE that month begins
 *    (exception: 2026-06 — the rule was adopted mid-month, so June
 *    registrations were taken at adoption on 2026-06-10).
 *  - An owner with no registration for the month falls back to legacy
 *    top-5-by-forward-P&L, clearly flagged "unregistered" on the scoreboard.
 *  - Registered names that error or go missing score 0 — picking a row that
 *    dies is part of the skill being measured.
 *  - Changing a registration mid-month is forbidden (same spirit as the
 *    mid-window parameter-change ban in COMPETITION.md).
 */

export const REGISTRATION_RULE_ADOPTED_ISO = '2026-06-10T00:00:00Z';

export const SCORING_REGISTRATIONS = {
  '2026-06': {
    // FABLE registered at rule adoption 2026-06-10. The Fader (regime
    // insurance), Gap Snap, both BULL LAB variants, and any later additions
    // are research-only for June.
    FABLE: [
      'FABLE Equities Snapback L/S v1',
      'FABLE Equities Snapback Turbo',
      'FABLE Equities Afterburner v1',
      'FABLE Crypto Pulse L/S v1',
      'FABLE Crypto Drift v1',
    ],
    // CODEX and OPUS have not yet registered for June — their agents/owners
    // should pick their own 5 (it would be unfair for a competitor to pick
    // for them). Until then they score on the legacy top-5 fallback, flagged.
    CODEX: null,
    OPUS: null,
  },
};

/** UTC 'YYYY-MM' for an epoch-ms timestamp. */
export function monthKey(nowMs) {
  const d = new Date(nowMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Returns the registered 5-name array for owner in the month of `nowMs`, or null. */
export function registrationFor(owner, nowMs) {
  const month = SCORING_REGISTRATIONS[monthKey(nowMs)];
  if (!month) return null;
  return month[owner] || null;
}
