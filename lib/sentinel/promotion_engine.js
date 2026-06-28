function hasErrorStatus(row) {
  return row?.status === 'error';
}

function numberOrNull(value) {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}

function finiteMetricNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function returnFor(row, window) {
  return finiteMetricNumber(row?.returns?.[window], 0);
}

function isCoreName(row, options) {
  return options.coreNames instanceof Set && options.coreNames.has(row.name);
}

function buildMetrics(row) {
  return {
    source_status: row?.status ?? null,
    trades_n: finiteMetricNumber(row?.trades_n, 0),
    returns: row?.returns ?? {},
    pf: numberOrNull(row?.pf),
    sharpe: numberOrNull(row?.sharpe),
    max_dd: numberOrNull(row?.max_dd),
    errors: Array.isArray(row?.errors) ? row.errors : [],
  };
}

function hasAbsentProfitFactor(row) {
  return row?.pf === undefined || row?.pf === null;
}

function hasAcceptableProfitFactor(row) {
  if (hasAbsentProfitFactor(row)) {
    return true;
  }

  return typeof row.pf === 'number' && !Number.isNaN(row.pf) && row.pf >= 1.25;
}

function hasWeakProfitFactor(row) {
  return typeof row?.pf === 'number' && !Number.isNaN(row.pf) && row.pf < 1;
}

export function classifyStrategy(row, options = {}) {
  if (!row || typeof row.name !== 'string' || row.name.trim() === '') {
    return { status: 'blocked', reason: 'missing strategy row' };
  }

  if (hasErrorStatus(row)) {
    return { status: 'blocked', reason: 'strategy row has error status' };
  }

  if (isCoreName(row, options)) {
    return { status: 'core', reason: 'configured core strategy' };
  }

  const trades = finiteMetricNumber(row.trades_n, 0);
  const return90d = returnFor(row, '90d');
  const return30d = returnFor(row, '30d');
  const absDrawdown = Math.abs(finiteMetricNumber(row.max_dd, 0));

  if (trades === 0) {
    return { status: 'watch', reason: 'zero trades; collect forward sample' };
  }

  if (return90d < 0 || hasWeakProfitFactor(row)) {
    return { status: 'cooldown', reason: 'negative or weak forward profile' };
  }

  if (
    trades >= 20
    && return90d > 0
    && return30d >= 0
    && hasAcceptableProfitFactor(row)
    && absDrawdown <= 10
  ) {
    return { status: 'watch', reason: 'proven positive non-core candidate' };
  }

  if (
    trades >= 8
    && trades < 20
    && return90d > 0
    && return30d >= 0
    && hasAcceptableProfitFactor(row)
    && absDrawdown <= 10
  ) {
    return { status: 'satellite', reason: 'thin positive winner; keep as satellite' };
  }

  return { status: 'cooldown', reason: 'negative or weak forward profile' };
}

export function buildPromotionStatus(rows = [], options = {}) {
  const strategyRows = Array.isArray(rows) ? rows : [];

  return {
    generated_at: options.generatedAt ?? new Date().toISOString(),
    strategies: strategyRows.map((row) => {
      const classification = classifyStrategy(row, options);

      return {
        name: row?.name ?? '',
        status: classification.status,
        reason: classification.reason,
        metrics: buildMetrics(row),
      };
    }),
  };
}
