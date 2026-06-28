const QTY_TOLERANCE = 0.000001;
const MARKET_VALUE_TOLERANCE = 0.01;

function toFiniteNumber(value) {
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeSymbol(value) {
  const symbol = String(value ?? '').trim();
  return symbol || null;
}

function normalizePosition(position, fallbackSymbol, missingSymbol) {
  const symbol = normalizeSymbol(position?.symbol ?? fallbackSymbol) ?? missingSymbol;
  if (!symbol) {
    return null;
  }

  return {
    symbol,
    qty: toFiniteNumber(position?.qty),
    market_value: toFiniteNumber(position?.market_value),
  };
}

function ledgerPositionMap(ledgerPositions) {
  const normalized = new Map();

  if (!(ledgerPositions instanceof Map)) {
    return normalized;
  }

  let missingSymbolCount = 0;
  for (const [symbol, position] of ledgerPositions.entries()) {
    missingSymbolCount += 1;
    const normalizedPosition = normalizePosition(
      position,
      symbol,
      `__ledger_missing_symbol_${missingSymbolCount}`
    );
    if (normalizedPosition) {
      normalized.set(normalizedPosition.symbol, normalizedPosition);
    }
  }

  return normalized;
}

function brokerPositionMap(brokerPositions) {
  const normalized = new Map();

  if (!Array.isArray(brokerPositions)) {
    return normalized;
  }

  let missingSymbolCount = 0;
  for (const position of brokerPositions) {
    missingSymbolCount += 1;
    const normalizedPosition = normalizePosition(
      position,
      undefined,
      `__broker_missing_symbol_${missingSymbolCount}`
    );
    if (normalizedPosition) {
      normalized.set(normalizedPosition.symbol, normalizedPosition);
    }
  }

  return normalized;
}

function positionSnapshot(position) {
  if (!position) {
    return null;
  }

  return {
    qty: position.qty,
    market_value: position.market_value,
  };
}

function valuesMatch(ledgerPosition, brokerPosition) {
  if (
    ledgerPosition.qty === null ||
    ledgerPosition.market_value === null ||
    brokerPosition.qty === null ||
    brokerPosition.market_value === null
  ) {
    return false;
  }

  return (
    Math.abs(ledgerPosition.qty - brokerPosition.qty) <= QTY_TOLERANCE &&
    Math.abs(ledgerPosition.market_value - brokerPosition.market_value) <= MARKET_VALUE_TOLERANCE
  );
}

function positionDifference(symbol, type, ledgerPosition, brokerPosition) {
  return {
    symbol,
    type,
    ledger: positionSnapshot(ledgerPosition),
    broker: positionSnapshot(brokerPosition),
    qty_difference:
      ledgerPosition?.qty !== null &&
      ledgerPosition?.qty !== undefined &&
      brokerPosition?.qty !== null &&
      brokerPosition?.qty !== undefined
        ? ledgerPosition.qty - brokerPosition.qty
        : null,
    market_value_difference:
      ledgerPosition?.market_value !== null &&
      ledgerPosition?.market_value !== undefined &&
      brokerPosition?.market_value !== null &&
      brokerPosition?.market_value !== undefined
        ? ledgerPosition.market_value - brokerPosition.market_value
        : null,
  };
}

export function compareLedgerToBroker({ ledgerPositions, brokerPositions } = {}) {
  const ledger = ledgerPositionMap(ledgerPositions);
  const broker = brokerPositionMap(brokerPositions);
  const differences = [];
  const symbols = new Set([...ledger.keys(), ...broker.keys()]);

  for (const symbol of symbols) {
    const ledgerPosition = ledger.get(symbol);
    const brokerPosition = broker.get(symbol);

    if (!ledgerPosition) {
      differences.push(positionDifference(symbol, 'broker_only', null, brokerPosition));
    } else if (!brokerPosition) {
      differences.push(positionDifference(symbol, 'ledger_only', ledgerPosition, null));
    } else if (!valuesMatch(ledgerPosition, brokerPosition)) {
      differences.push(positionDifference(symbol, 'value_mismatch', ledgerPosition, brokerPosition));
    }
  }

  if (differences.length > 0) {
    return {
      status: 'error',
      freeze_reason: 'position mismatch between ledger and broker',
      differences,
    };
  }

  return {
    status: 'ok',
    freeze_reason: '',
    differences,
  };
}
