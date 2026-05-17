/**
 * Shared trade collector for the "ENTRY_* / EXIT_* with pre-computed
 * pnl_dollar" Sheets schema (HY v4, Analyst HY, Aggro Leader Continuation).
 *
 * Pairs each EXIT row with its asset's most recent ENTRY row so the contest
 * cutoff can be applied by ENTRY time (the rigorous standard — a trade entered
 * before the cutoff does not count even if it exits after). Also returns a
 * provenance summary (total vs forward closed trades + P&L split) so the
 * Provenance Ledger can audit sheet strategies instead of flagging them
 * "not auditable".
 *
 * @param {Array<object>} rows           normalized sheet rows
 * @param {object} opts
 * @param {string|null} opts.liveStartIso effective contest cutoff (ISO) or null
 * @param {function} opts.parseTimestamp  strategy_row.parseTimestamp
 * @returns {{trips, rMultiples, allTimes, provenance}}
 */
export function collectExitRowTrips(rows, { liveStartIso, parseTimestamp }) {
  const trips = [];
  const rMultiples = [];
  const allTimes = [];
  const lastEntryByAsset = new Map(); // asset -> entry ISO time

  let total = 0, forward = 0, fwdPnl = 0, allPnl = 0;

  for (const r of rows) {
    const time = parseTimestamp(r.timestamp);
    if (time) allTimes.push(time);

    const sig = String(r.signal || r.action || '').toUpperCase();
    const asset = String(r.asset || r.symbol || '').toUpperCase();

    if (sig.startsWith('ENTRY')) {
      if (asset && time) lastEntryByAsset.set(asset, time);
      continue;
    }

    if (sig.startsWith('EXIT_') || sig === 'EXIT') {
      const pnl = Number(r.pnl_dollar);
      const hasPnl = !Number.isNaN(pnl) && r.pnl_dollar !== '' && r.pnl_dollar != null;
      if (!hasPnl) continue;

      const entryTime = asset ? lastEntryByAsset.get(asset) : null;
      total += 1;
      allPnl += pnl;

      // No cutoff active → no filtering (preserve original all-time behavior).
      // Cutoff active → a trip counts as forward only if its paired ENTRY is
      // visible AND on/after the cutoff. If the entry predates the log window
      // (no paired ENTRY), we cannot prove it is in-window → exclude it.
      // Conservative on purpose.
      const isForward = !liveStartIso
        ? true
        : (!!entryTime && entryTime >= liveStartIso);
      if (isForward) {
        forward += 1;
        fwdPnl += pnl;
        trips.push({ exit_time: time, pnl });
        const rMult = Number(r.r_multiple);
        if (!Number.isNaN(rMult) && r.r_multiple !== '' && r.r_multiple != null) {
          rMultiples.push(rMult);
        }
      }
      if (asset) lastEntryByAsset.delete(asset);
    }
  }

  return {
    trips,
    rMultiples,
    allTimes,
    provenance: {
      source: 'sheet-entry-time',
      total,
      forward,
      backtest: total - forward,
      fwdPnl,
      btPnl: allPnl - fwdPnl,
      legitimacy: total ? forward / total : null,
    },
  };
}
