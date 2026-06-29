export const DEFAULT_SENTINEL_CONFIG = Object.freeze({
  mode: 'paper',
  broker: 'alpaca-paper',
  paper_auto_submit_enabled: true,
  live_trading_enabled: false,
  max_gross_exposure_pct: 100,
  max_strategy_weight_pct: 25,
  max_symbol_exposure_pct: 20,
  max_daily_loss_pct: 2,
  max_open_orders: 10,
  max_orders_per_symbol_per_hour: 2,
  stale_leaderboard_minutes: 15,
  reconciliation_freeze_enabled: true,
});

export function assertPaperEnv(env = process.env) {
  if (env?.ALPACA_ENV !== 'paper') {
    throw new Error('ALPACA_ENV must be paper');
  }
}

export function loadSentinelConfigFromText(text) {
  const userConfig = text?.trim() ? JSON.parse(text) : {};
  const config = {
    ...DEFAULT_SENTINEL_CONFIG,
    ...userConfig,
  };

  if (config.mode !== 'paper') {
    throw new Error('sentinel config mode must be paper');
  }
  if (config.broker !== 'alpaca-paper') {
    throw new Error('sentinel broker must be alpaca-paper');
  }
  if (config.live_trading_enabled) {
    throw new Error('live_trading_enabled must be false in this implementation');
  }

  return config;
}

export function redactSecret(secret) {
  if (!secret || secret.length <= 8) {
    return '***';
  }

  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
