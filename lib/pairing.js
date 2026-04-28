/**
 * Pair entry events with exit events into round-trips, FIFO per symbol.
 * Supports partial exits, pyramiding, and shorts. Orphan exits are silently skipped.
 *
 * @param {Array<{time, symbol, action, side, price, size}>} events
 *   action: 'ENTRY' | 'EXIT' | 'PARTIAL_EXIT'
 * @returns {Array<{entry_time, exit_time, symbol, side, entry_price, exit_price, size, pnl}>}
 */
export function pairRoundTrips(events) {
  const sorted = [...events].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const openBySymbol = new Map(); // symbol -> [{entry_time, entry_price, remaining_size, side}]
  const roundTrips = [];

  for (const ev of sorted) {
    if (ev.action === 'ENTRY') {
      if (!openBySymbol.has(ev.symbol)) openBySymbol.set(ev.symbol, []);
      openBySymbol.get(ev.symbol).push({
        entry_time: ev.time,
        entry_price: ev.price,
        remaining_size: ev.size,
        side: ev.side,
      });
    } else if (ev.action === 'EXIT' || ev.action === 'PARTIAL_EXIT') {
      const lots = openBySymbol.get(ev.symbol) || [];
      let toClose = ev.size;
      while (toClose > 1e-12 && lots.length > 0) {
        const lot = lots[0];
        const closeSize = Math.min(toClose, lot.remaining_size);
        const direction = lot.side === 'long' ? 1 : -1;
        const pnl = (ev.price - lot.entry_price) * closeSize * direction;
        roundTrips.push({
          entry_time: lot.entry_time,
          exit_time: ev.time,
          symbol: ev.symbol,
          side: lot.side,
          entry_price: lot.entry_price,
          exit_price: ev.price,
          size: closeSize,
          pnl,
        });
        lot.remaining_size -= closeSize;
        toClose -= closeSize;
        if (lot.remaining_size <= 1e-12) lots.shift();
      }
      // toClose > 0 here means orphan exit beyond available size — silently dropped
    }
  }
  return roundTrips;
}
