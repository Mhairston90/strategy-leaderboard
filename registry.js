import adaptHYv4         from './adapters/adapter_hy_v4.js';
import adaptV7BtcTG      from './adapters/adapter_v7_btc_tg.js';
import adaptBasket       from './adapters/adapter_basket_breakout.js';
import adaptAggroDoge    from './adapters/adapter_aggro_doge.js';
import adaptAnalystHY    from './adapters/adapter_analyst_hy.js';
import adaptBull         from './adapters/adapter_bull.js';
import adaptCodex        from './adapters/adapter_codex.js';

/**
 * STRATEGIES registry: defines source, adapter, and per-strategy capital + kill-switch.
 *
 * source.type: 'sheets' | 'bull-github' | 'codex-local'
 *   - 'sheets':       single-tab fetch, source.tab = tab name
 *   - 'bull-github':  dual-fetch portfolio.md + trade_log.md
 *   - 'codex-local':  dual-fetch local markdown snapshots
 *
 * starting_capital: paper-account size used for % return normalization.
 *   For strategies without an explicit declared capital (Basket, Aggro), this is
 *   a *virtual* capital. Document the assumption next to the value.
 *
 * killswitch_dd_pct: max drawdown threshold (positive %); the row tints amber
 *   at 90% of this value.
 */
export const STRATEGIES = [
  {
    name: 'HY v4 Tuned',
    starting_capital: 2000,
    killswitch_dd_pct: 25,
    // Confirmed 2026-04-28: v4 logs to the legacy 'Signals' tab with notes="v4".
    // The adapter filters to BTCUSD/SOLUSD or notes containing "v4".
    source: { type: 'sheets', tab: 'Signals' },
    adapter: adaptHYv4,
  },
  {
    name: 'HY v7-Best BTC TG',
    starting_capital: 2000,
    killswitch_dd_pct: 25,
    // Tab does not exist server-side as of 2026-04-28; adapter returns empty
    // 'research' row instead of an error.
    source: { type: 'sheets', tab: 'V7-BTC Trend Gated Signals' },
    adapter: adaptV7BtcTG,
  },
  {
    name: 'Basket Breakout v1',
    // Virtual capital: Basket sizes by 0.5% risk-per-trade with no fixed account
    // size declared. $10k chosen to mirror BULL's account for visual symmetry.
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    source: { type: 'sheets', tab: 'Basket Breakout Signals' },
    adapter: adaptBasket,
  },
  {
    name: 'Aggro Leader Continuation v1',
    // Virtual capital: $5k chosen as plausible canary account size.
    starting_capital: 5000,
    killswitch_dd_pct: 12,
    source: { type: 'sheets', tab: 'Aggro Leader Continuation Signals' },
    adapter: adaptAggroDoge,
  },
  {
    name: 'Analyst HY v1',
    starting_capital: 2000,
    killswitch_dd_pct: 25,
    source: { type: 'sheets', tab: 'Analyst HY v1' },
    adapter: adaptAnalystHY,
  },
  {
    name: 'BULL v0',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    source: {
      type: 'bull-github',
      portfolio_path: 'memory/portfolio.md',
      trade_log_path: 'memory/trade_log.md',
    },
    adapter: adaptBull,
  },
  {
    name: 'CODEX v0',
    starting_capital: 10000,
    killswitch_dd_pct: 35,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/portfolio.md',
      trade_log_path: 'data/codex/trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Aggro v0',
    starting_capital: 10000,
    killswitch_dd_pct: 45,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/aggro_portfolio.md',
      trade_log_path: 'data/codex/aggro_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Pulse v0',
    starting_capital: 10000,
    killswitch_dd_pct: 35,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/pulse_portfolio.md',
      trade_log_path: 'data/codex/pulse_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Regime v0',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/regime_portfolio.md',
      trade_log_path: 'data/codex/regime_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Apex v0',
    starting_capital: 10000,
    killswitch_dd_pct: 50,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/apex_portfolio.md',
      trade_log_path: 'data/codex/apex_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Regime WFO v1',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/regime_wfo_portfolio.md',
      trade_log_path: 'data/codex/regime_wfo_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Apex WFO v1',
    starting_capital: 10000,
    killswitch_dd_pct: 50,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/apex_wfo_portfolio.md',
      trade_log_path: 'data/codex/apex_wfo_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // Basket Breakout variants — paper-traded offline by the nightly
  // `basket_breakout.generate_variant_logs` routine. Specs in
  // `Claude/Trading Strategy/basket-breakout-{leveraged,aggressive}-vN-spec.md`.
  {
    name: 'Basket Breakout Leveraged v1',
    starting_capital: 10000,
    killswitch_dd_pct: 30,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/basket_variants/leveraged_v1_portfolio.md',
      trade_log_path: 'data/basket_variants/leveraged_v1_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'Basket Breakout Aggressive v1',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/basket_variants/aggressive_v1_portfolio.md',
      trade_log_path: 'data/basket_variants/aggressive_v1_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'Basket Breakout Aggressive v2',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/basket_variants/aggressive_v2_portfolio.md',
      trade_log_path: 'data/basket_variants/aggressive_v2_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // Stocks Basket Breakout family — 1H breakouts on 8 high-vol large-caps
  // (NVDA, TSLA, AMD, PLTR, META, NFLX, AVGO, AAPL). Spec freeze 2026-05-06,
  // backfilled paper-trade from 2026-04-16 for leaderboard parity. Live
  // execution earliest 2026-06-08 (post-PDT-rule effective date).
  // Specs: strategies/stocks-basket-breakout-*-spec.md
  {
    name: 'Stocks Basket Breakout v1',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_v1_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_v1_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'Stocks Basket Breakout Aggressive v1',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_aggressive_v1_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_aggressive_v1_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'Stocks Basket Breakout Aggressive v2',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_aggressive_v2_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_aggressive_v2_trade_log.md',
    },
    adapter: adaptCodex,
  },
];
