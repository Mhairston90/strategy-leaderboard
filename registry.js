import adaptHYv4         from './adapters/adapter_hy_v4.js';
import adaptV7BtcTG      from './adapters/adapter_v7_btc_tg.js';
import adaptBasket       from './adapters/adapter_basket_breakout.js';
import adaptAggroDoge    from './adapters/adapter_aggro_doge.js';
import adaptAnalystHY    from './adapters/adapter_analyst_hy.js';
import adaptBull         from './adapters/adapter_bull.js';
import adaptCodex        from './adapters/adapter_codex.js';

/**
 * CONTEST_START_ISO — the BULL-vs-Codex contest measurement start.
 *
 * Codex's first trade across all its strategies was 2026-05-04T16:00Z. To make
 * the comparison fair, every strategy is scored only on trades ENTERED on/after
 * this date — this removes the 4–6 week head start BULL's strategies had
 * (BULL live 2026-04-20; stocks variants backfilled from 2026-04-16).
 *
 * Effective per-strategy cutoff = the LATER of (strategy.live_start_iso,
 * CONTEST_START_ISO). Codex strategies have no live_start_iso and their data
 * naturally starts 05-04, so they are unaffected. Stocks variants keep their
 * stricter 2026-05-06 spec-freeze cutoff (later than contest start).
 */
export const CONTEST_START_ISO = '2026-05-04T00:00:00Z';

/** Return the chronologically later of two ISO timestamps (either may be null). */
export function effectiveCutoff(liveStartIso) {
  if (!liveStartIso) return CONTEST_START_ISO;
  return liveStartIso > CONTEST_START_ISO ? liveStartIso : CONTEST_START_ISO;
}

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
    name: 'CODEX Equities Gap Fade v0',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/equities_gap_portfolio.md',
      trade_log_path: 'data/codex/equities_gap_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Equities Breakout Runner v1',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/equities_breakout_portfolio.md',
      trade_log_path: 'data/codex/equities_breakout_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Equities Regime Hedge v1',
    starting_capital: 10000,
    killswitch_dd_pct: 15,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/equities_hedge_portfolio.md',
      trade_log_path: 'data/codex/equities_hedge_trade_log.md',
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
  //
  // FAIR-CONTEST FILTERING (added 2026-05-14 per user direction): trades whose
  // OPEN happened before live_start_iso are paper-warmup (parameters were
  // still being tuned). Adapter excludes them from leaderboard equity so the
  // BULL-vs-Codex contest doesn't compare backtest-dilated numbers against
  // live-paper numbers. Pre-live trades remain in the raw trade_log.md for
  // history; only the leaderboard equity/return excludes them.
  {
    name: 'Stocks Basket Breakout v1',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-05-06T13:30:00Z',
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
    live_start_iso: '2026-05-06T13:30:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_aggressive_v1_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_aggressive_v1_trade_log.md',
    },
    adapter: adaptCodex,
  },

  // Stocks Mean Reversion v1 — Connors-style RSI(2) oversold-bounce on the
  // same 8-symbol universe as the breakout family. Explicit anti-breakout
  // test (does the OPPOSITE signal also have edge?).
  // Spec: strategies/stocks-mean-reversion-v1-spec.md
  // Spec freeze 18:30Z (rather than 13:30Z for breakout family) — separate
  // freeze ceremony, slightly later in the day.
  {
    name: 'Stocks Mean Reversion v1',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-05-06T18:30:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v1_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v1_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // Stocks Mean Reversion v2 — same parameters as v1, diversified GICS-sector
  // universe (NVDA/OXY/JPM/LLY/CAT/FCX/NKE/DIS). Direct A/B test of whether the
  // mean-reversion edge generalizes across sectors. Backfill 2026-05-16 showed
  // OOS PF 4.28 (vs IS 2.95) — OOS BETTER than IS. May 8-15 collapse window
  // (where breakout family died) booked +$235 PF 5.33.
  // Spec: strategies/stocks-mean-reversion-v2-spec.md
  {
    name: 'Stocks Mean Reversion v2',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-05-06T18:30:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v2_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v2_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // Stocks Mean Reversion v2 — RSI threshold sweep siblings. Config first
  // appeared 2026-05-16 (stocks_mean_reversion docstring "Variants added
  // 2026-05-16"). live_start_iso = 2026-05-16 (HONEST creation date): any
  // pre-05-16 P&L is backtest, NOT forward paper. Do not backdate to the
  // v1/v2 spec freeze — these configs did not exist then.
  {
    name: 'Stocks Mean Reversion v2 (RSI<15)',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-05-16T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v2_rsi15_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v2_rsi15_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'Stocks Mean Reversion v2 (RSI<5)',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-05-16T00:00:00Z',  // honest config-creation date; pre-05-16 is backtest
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v2_rsi5_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v2_rsi5_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // Stocks Mean Reversion v3 — widest universe (15 names / 8 GICS sectors).
  // CREATED 2026-05-17. live_start_iso = 2026-05-17 (HONEST). Everything
  // before today is backtest — this config did not exist until 2026-05-17,
  // so it has ZERO forward-paper trades and contributes ~$0 to the contest
  // until it trades forward. The +$301 "contest-window" figure was 100%
  // backtest and must NOT be claimed as competition gains.
  // Spec: stocks_mean_reversion/config.py "v3"; universe_wide.json
  {
    name: 'Stocks Mean Reversion v3 (Wide)',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-05-17T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v3_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v3_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // Stocks Mean Reversion Deep — AGGRESSIVE convex variant.
  // CREATED 2026-05-17. live_start_iso = 2026-05-17 (HONEST). The
  // +$1,278.89 / 86% "contest-window" figure was 100% BACKTEST — this
  // config did not exist before today, never traded a bar forward, and
  // contributes ~$0 to the contest until it earns forward-paper results.
  // It is a HYPOTHESIS entering forward paper now, not realized gains.
  // Spec: stocks_mean_reversion/config.py "deep".
  {
    name: 'Stocks Mean Reversion Deep (Aggressive)',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-05-17T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_deep_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_deep_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // Stocks Basket Breakout Diversified v1 — same parameters as Stocks v1, new
  // universe spanning 8 GICS sectors (NVDA, OXY, JPM, LLY, CAT, FCX, NKE, DIS).
  // Tests whether the breakout edge generalizes across sectors or is
  // tech-specific. Spec: strategies/stocks-basket-breakout-diversified-v1-spec.md
  {
    name: 'Stocks Basket Breakout Diversified v1',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-05-06T13:30:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_diversified_v1_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_diversified_v1_trade_log.md',
    },
    adapter: adaptCodex,
  },
];
