/**
 * Contest scoring eligibility.
 *
 * RULE (set by Marcus 2026-06-16, superseding the 2026-06-10 pre-registration
 * experiment): a camp's contest score = the summed FORWARD P&L of its top 5
 * strategies by forward P&L. "Forward" = trades entered on/after each
 * strategy's live-start (live_start_iso, else the contest start). The ONLY
 * thing excluded is backtested / pre-live-start trades. NOTHING ELSE is
 * excluded — every forward-trading strategy is eligible regardless of source
 * (local, bull-github/remote, or sheet) or how it was created.
 *
 * This is symmetric across all camps (OPUS, CODEX, FABLE) — the same rule
 * scores everyone. The scoreboard (lib/contest.js) ranks each camp's eligible
 * rows by forward P&L and takes the top 5; exact-twin rows (byte-identical
 * trade logs) are still de-duplicated, because counting the same trades twice
 * would be double-counting, not an exclusion.
 *
 * --- REPEALED 2026-06-16: pre-registration model -----------------------------
 * From 2026-06-10 to 2026-06-16 the score used a pre-registered set of exactly
 * 5 strategies per camp per month, with remote (bull-github) and sheet sources
 * excluded at registration time. Marcus repealed it: it was hiding genuine
 * forward performers (BULL v0, Basket Breakout Aggressive v1) behind a stale
 * 06-10 snapshot and source-type filter. The historical June registrations are
 * preserved below for audit but are no longer active. Tradeoff acknowledged:
 * ranking the top-5 of all forward rows rewards breadth (more variants = more
 * top-5 lottery tickets); revisit if a camp games it by spawning variants.
 */

export const REGISTRATION_RULE_ADOPTED_ISO = '2026-06-10T00:00:00Z';
export const REGISTRATION_RULE_REPEALED_ISO = '2026-06-16T00:00:00Z';

// Active registrations: NONE. registrationFor() returns null for every owner,
// so lib/contest.js scores all camps by the universal "top-5 forward P&L,
// backtest-only exclusion" fallback.
export const SCORING_REGISTRATIONS = {};

// Historical record of the repealed 2026-06 pre-registration (audit only — NOT
// used for scoring). Kept so the decision trail in data/hermes/decisions.md
// remains verifiable.
export const HISTORICAL_REGISTRATIONS_REPEALED = {
  '2026-06': {
    FABLE: [
      'FABLE Equities Snapback L/S v1',
      'FABLE Equities Snapback Turbo',
      'FABLE Equities Afterburner v1',
      'FABLE Crypto Pulse L/S v1',
      'FABLE Crypto Drift v1',
    ],
    OPUS: [
      'Stocks Mean Reversion v2 (RSI<15)',
      'Stocks Mean Reversion v2',
      'Stocks Mean Reversion v2 (RSI<5) Aggressive',
      'Crypto Mean Reversion v1',
      'Crypto Mean Reversion Aggressive',
    ],
    CODEX: [
      'CODEX Regime Plus L/S v1',
      'CODEX Regime Short Plus v1',
      'CODEX Aggro v0',
      'CODEX Regime WFO v1',
      'CODEX Regime v0',
    ],
  },
};

/** UTC 'YYYY-MM' for an epoch-ms timestamp. */
export function monthKey(nowMs) {
  const d = new Date(nowMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Returns the registered 5-name array for owner in the month of `nowMs`, or
 * null. Post-repeal (2026-06-16) this is always null → lib/contest.js uses the
 * universal top-5-forward-P&L scoring for every camp.
 */
export function registrationFor(owner, nowMs) {
  const month = SCORING_REGISTRATIONS[monthKey(nowMs)];
  if (!month) return null;
  return month[owner] || null;
}
