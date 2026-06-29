const WEIGHT_TOLERANCE = 1e-9;

function roundWeight(value) {
  return Number(value.toFixed(10));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasErrorStatus(row) {
  return row?.status === 'error';
}

function copyMetrics(row) {
  return {
    leaderboard_status: row?.status ?? null,
    trades_n: row?.trades_n ?? null,
    returns: row?.returns ?? {},
    pf: row?.pf ?? null,
    sharpe: row?.sharpe ?? null,
    max_dd: row?.max_dd ?? null,
    errors: Array.isArray(row?.errors) ? row.errors : [],
  };
}

export function validateAllocationConfig(config) {
  const errors = [];

  if (!isPlainObject(config)) {
    return { ok: false, errors: ['allocation config must be an object'] };
  }

  if (!Array.isArray(config.strategies) || config.strategies.length === 0) {
    return { ok: false, errors: ['allocation config requires at least one strategy'] };
  }

  let totalWeight = 0;
  const seenNames = new Set();

  config.strategies.forEach((strategy, index) => {
    const label = `strategies[${index}]`;

    if (!isPlainObject(strategy)) {
      errors.push(`${label} must be an object`);
      return;
    }

    if (typeof strategy.name !== 'string' || strategy.name.trim() === '') {
      errors.push(`${label}.name is required`);
    } else if (seenNames.has(strategy.name)) {
      errors.push(`${label}.name duplicates ${strategy.name}`);
    } else {
      seenNames.add(strategy.name);
    }

    if (typeof strategy.target_weight !== 'number' || !Number.isFinite(strategy.target_weight)) {
      errors.push(`${label}.target_weight must be a number`);
    } else if (strategy.target_weight <= 0) {
      errors.push(`${label}.target_weight must be positive`);
    } else {
      totalWeight += strategy.target_weight;
    }
  });

  if (Math.abs(totalWeight - 1) > WEIGHT_TOLERANCE) {
    errors.push(`target weights must sum to 1, got ${roundWeight(totalWeight)}`);
  }

  return { ok: errors.length === 0, errors };
}

export function buildAllocationModel(config, leaderboardRows = []) {
  const rows = Array.isArray(leaderboardRows) ? leaderboardRows : [];
  const rowsByName = new Map(
    rows
      .filter((row) => typeof row?.name === 'string' && row.name.trim() !== '')
      .map((row) => [row.name, row]),
  );

  const strategies = Array.isArray(config?.strategies) ? config.strategies : [];
  const totalTargetWeight = roundWeight(
    strategies.reduce((sum, strategy) => sum + (Number.isFinite(strategy?.target_weight) ? strategy.target_weight : 0), 0),
  );

  return {
    generated_at: new Date().toISOString(),
    totalTargetWeight,
    items: strategies.map((strategy) => {
      const row = rowsByName.get(strategy.name);
      const base = {
        name: strategy.name,
        role: strategy.role ?? '',
        target_weight: strategy.target_weight,
        metrics: copyMetrics(row),
      };

      if (!row) {
        return {
          ...base,
          status: 'blocked',
          reason: 'missing leaderboard row',
        };
      }

      if (hasErrorStatus(row)) {
        return {
          ...base,
          status: 'blocked',
          reason: 'leaderboard row has error status',
        };
      }

      return {
        ...base,
        status: 'active',
        reason: 'leaderboard row usable',
      };
    }),
  };
}
