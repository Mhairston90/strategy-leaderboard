import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildSmokeSummary({
  config,
  allocation,
  riskState,
  promotion,
  reconciliation,
} = {}) {
  const errors = [];
  const allocationStrategies = Array.isArray(allocation?.strategies)
    ? allocation.strategies
    : [];
  const promotionStrategies = Array.isArray(promotion?.strategies)
    ? promotion.strategies
    : [];
  const reconciliationStatus = reconciliation?.status ?? null;

  if (config?.mode !== 'paper') {
    errors.push('config mode must be paper mode');
  }

  if (config?.paper_auto_submit_enabled !== true) {
    errors.push('paper auto-submit must be enabled');
  }

  if (allocationStrategies.length === 0) {
    errors.push('allocation strategies must be non-empty');
  }

  if (riskState?.frozen === true) {
    errors.push('risk state must not be frozen');
  }

  if (!Array.isArray(promotion?.strategies)) {
    errors.push('promotion strategies must be an array');
  }

  if (reconciliationStatus === 'error') {
    errors.push('reconciliation status must not be error');
  }

  return {
    ok: errors.length === 0,
    errors,
    mode: config?.mode ?? null,
    paper_auto_submit_enabled: config?.paper_auto_submit_enabled ?? false,
    allocation_count: allocationStrategies.length,
    promotion_count: promotionStrategies.length,
    reconciliation_status: reconciliationStatus,
  };
}

async function readJsonIfPresent(filePath) {
  try {
    return { value: JSON.parse(await readFile(filePath, 'utf8')) };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { value: undefined };
    }

    return {
      value: undefined,
      error: `failed to read ${path.basename(filePath)}: ${error.message}`,
    };
  }
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const sentinelDir = path.resolve(scriptDir, '..', 'data', 'sentinel');
  const files = {
    config: 'config.json',
    allocation: 'allocation.json',
    riskState: 'risk_state.json',
    promotion: 'promotion_status.json',
    reconciliation: 'reconciliation_report.json',
  };

  const entries = await Promise.all(
    Object.entries(files).map(async ([key, fileName]) => {
      const result = await readJsonIfPresent(path.join(sentinelDir, fileName));
      return [key, result];
    }),
  );
  const loaded = Object.fromEntries(entries);
  const summary = buildSmokeSummary({
    config: loaded.config.value,
    allocation: loaded.allocation.value,
    riskState: loaded.riskState.value,
    promotion: loaded.promotion.value,
    reconciliation: loaded.reconciliation.value,
  });

  for (const result of Object.values(loaded)) {
    if (result.error) {
      summary.errors.push(result.error);
    }
  }
  summary.ok = summary.errors.length === 0;

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
