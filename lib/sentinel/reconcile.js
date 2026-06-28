import { replayLedgerEvents } from './ledger.js';

const QTY_TOLERANCE = 0.000001;
const MARKET_VALUE_TOLERANCE = 0.01;
const PENDING_NOTIONAL_ABS_TOLERANCE = 1;
const PENDING_NOTIONAL_PCT_TOLERANCE = 0.1;
const RECONCILIATION_FREEZE_SOURCE = 'reconciliation';

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
  const normalizedSymbol = normalizeSymbol(position?.symbol ?? fallbackSymbol);
  const symbol = normalizedSymbol ?? missingSymbol;
  if (!symbol) {
    return null;
  }

  const marketValue = toFiniteNumber(position?.market_value);
  const fillValue = toFiniteNumber(position?.fill_value);

  return {
    symbol,
    malformed_symbol: !normalizedSymbol,
    qty: toFiniteNumber(position?.qty),
    market_value: marketValue,
    fill_value: fillValue ?? marketValue,
  };
}

function malformedContainerDifference(source, expected) {
  return {
    symbol: null,
    type: 'malformed_container',
    source,
    reason: `${source} must be ${expected}`,
    ledger: null,
    broker: null,
    qty_difference: null,
    market_value_difference: null,
  };
}

function ledgerPositionMap(ledgerPositions, provided) {
  const normalized = new Map();

  if (!(ledgerPositions instanceof Map)) {
    return {
      positions: normalized,
      differences: provided
        ? [malformedContainerDifference('ledgerPositions', 'a Map')]
        : [],
    };
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

  return { positions: normalized, differences: [] };
}

function brokerPositionMap(brokerPositions, provided) {
  const normalized = new Map();

  if (!Array.isArray(brokerPositions)) {
    return {
      positions: normalized,
      differences: provided
        ? [malformedContainerDifference('brokerPositions', 'an array')]
        : [],
    };
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

  return { positions: normalized, differences: [] };
}

function positionSnapshot(position) {
  if (!position) {
    return null;
  }

  return {
    qty: position.qty,
    market_value: position.market_value,
    fill_value: position.fill_value,
  };
}

function isFlatPosition(position) {
  if (!position || position.malformed_symbol) {
    return false;
  }

  return (
    position.qty !== null &&
    position.market_value !== null &&
    Math.abs(position.qty) <= QTY_TOLERANCE &&
    Math.abs(position.market_value) <= MARKET_VALUE_TOLERANCE
  );
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

  return Math.abs(ledgerPosition.qty - brokerPosition.qty) <= QTY_TOLERANCE;
}

function pendingSubmittedExposure(submittedOrders) {
  const exposure = new Map();
  if (!(submittedOrders instanceof Map)) {
    return exposure;
  }

  for (const order of submittedOrders.values()) {
    const symbol = normalizeSymbol(order?.symbol);
    const side = String(order?.side ?? '').trim().toLowerCase();
    const notional = toFiniteNumber(order?.notional_usd);
    if (order?.status !== 'submitted' || !symbol || notional === null || notional <= 0) {
      continue;
    }

    const existing = exposure.get(symbol) ?? { buy: 0, sell: 0 };
    if (side === 'buy') {
      existing.buy += notional;
    } else if (side === 'sell') {
      existing.sell += notional;
    }
    exposure.set(symbol, existing);
  }

  return exposure;
}

function nonZeroSign(value) {
  if (value === null || value === undefined || Math.abs(value) <= QTY_TOLERANCE) {
    return 0;
  }

  return Math.sign(value);
}

function brokerPositionDirection(position) {
  const qtySign = nonZeroSign(position?.qty);
  const valueSign = nonZeroSign(position?.market_value);

  if (qtySign !== 0 && valueSign !== 0 && qtySign !== valueSign) {
    return 0;
  }

  return qtySign || valueSign;
}

function isExpectedSubmittedPosition(position, pendingExposure) {
  if (position?.qty === null || position?.market_value === null) {
    return false;
  }

  const expected = pendingExposure.get(position.symbol);
  if (!expected) {
    return false;
  }

  const direction = brokerPositionDirection(position);
  const pendingNotional = direction > 0 ? expected.buy : direction < 0 ? expected.sell : 0;
  if (pendingNotional <= 0) {
    return false;
  }

  const tolerance = Math.max(
    PENDING_NOTIONAL_ABS_TOLERANCE,
    pendingNotional * PENDING_NOTIONAL_PCT_TOLERANCE,
  );
  return Math.abs(position.market_value) <= pendingNotional + tolerance;
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

export function compareLedgerToBroker({ ledgerPositions, brokerPositions, submittedOrders } = {}) {
  const input = arguments.length > 0 && arguments[0] ? arguments[0] : {};
  const ledgerResult = ledgerPositionMap(ledgerPositions, Object.hasOwn(input, 'ledgerPositions'));
  const brokerResult = brokerPositionMap(brokerPositions, Object.hasOwn(input, 'brokerPositions'));
  const ledger = ledgerResult.positions;
  const broker = brokerResult.positions;
  const pendingExposure = pendingSubmittedExposure(submittedOrders);
  const differences = [...ledgerResult.differences, ...brokerResult.differences];
  const symbols = new Set([...ledger.keys(), ...broker.keys()]);

  for (const symbol of symbols) {
    const ledgerPosition = ledger.get(symbol);
    const brokerPosition = broker.get(symbol);

    if (!ledgerPosition) {
      if (
        !isFlatPosition(brokerPosition) &&
        !isExpectedSubmittedPosition(brokerPosition, pendingExposure)
      ) {
        differences.push(positionDifference(symbol, 'broker_only', null, brokerPosition));
      }
    } else if (!brokerPosition) {
      if (!isFlatPosition(ledgerPosition)) {
        differences.push(positionDifference(symbol, 'ledger_only', ledgerPosition, null));
      }
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

function reconciliationFreezeReason(comparison, anomalies) {
  if (comparison.status === 'error' && anomalies.length > 0) {
    return `${comparison.freeze_reason}; ledger anomalies detected during reconciliation`;
  }

  if (comparison.status === 'error') {
    return comparison.freeze_reason;
  }

  if (anomalies.length > 0) {
    return 'ledger anomalies detected during reconciliation';
  }

  return '';
}

function cloneRiskState(riskState) {
  if (!riskState || typeof riskState !== 'object' || Array.isArray(riskState)) {
    return {};
  }

  return { ...riskState };
}

export function buildReconciliationUpdate({
  ledgerEvents,
  brokerPositions,
  riskState = {},
  config = {},
  generatedAt = '',
} = {}) {
  const replay = replayLedgerEvents(ledgerEvents);
  const comparisonInput = { ledgerPositions: replay.positions, submittedOrders: replay.orders };

  if (Object.hasOwn(arguments.length > 0 && arguments[0] ? arguments[0] : {}, 'brokerPositions')) {
    comparisonInput.brokerPositions = brokerPositions;
  }

  const comparison = compareLedgerToBroker(comparisonInput);
  const anomalies = replay.anomalies ?? [];
  const status = comparison.status === 'error' || anomalies.length > 0 ? 'error' : 'ok';
  const freezeReason = reconciliationFreezeReason(comparison, anomalies);
  const report = {
    generated_at: generatedAt,
    status,
    freeze_reason: freezeReason,
    differences: comparison.differences,
  };

  if (anomalies.length > 0) {
    report.ledger_anomalies = anomalies;
  }

  let nextRiskState = cloneRiskState(riskState);
  if (status === 'error' && config?.reconciliation_freeze_enabled !== false) {
    nextRiskState = {
      ...nextRiskState,
      frozen: true,
      freeze_reason: report.freeze_reason,
      freeze_source: RECONCILIATION_FREEZE_SOURCE,
    };
  } else if (
    status === 'ok' &&
    nextRiskState.frozen === true &&
    nextRiskState.freeze_source === RECONCILIATION_FREEZE_SOURCE
  ) {
    nextRiskState = {
      ...nextRiskState,
      frozen: false,
      freeze_reason: '',
      freeze_source: '',
    };
  }

  return {
    report,
    riskState: nextRiskState,
  };
}
