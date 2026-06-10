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
 *                    optional source.overlay_trade_log_path appends a local audit log
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
    // CONVERTED 2026-05-29 from sheets -> offline-simulated. The live
    // TradingView->Google Sheet feed died 2026-05-10 (only 9 signals ever,
    // last 05-10, all LINK/ETH), freezing this row at 1 stale contest trade
    // while its same-logic simulated twin (Leveraged v1) showed 21. Now
    // regenerated nightly from the frozen v1 spec by basket_breakout.VARIANTS["v1"],
    // exactly like its leveraged/aggressive siblings. Scored on the default
    // CONTEST_START cutoff (no live_start_iso) for parity with that family.
    source: {
      type: 'codex-local',
      portfolio_path: 'data/basket_variants/v1_portfolio.md',
      trade_log_path: 'data/basket_variants/v1_trade_log.md',
    },
    adapter: adaptCodex,
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
    // BULL v0.12-SBD — instrumented paper-paper twin of the live v0.3
    // synchronized-breakdown rules (Ring-2 W21-F, adopted 2026-05-19).
    // Tracks the SBD exit-tightening A/B vs the BULL v0 baseline.
    // live_start_iso = honest variant creation date (2026-05-19); any
    // earlier P&L would be backtest — it has zero forward trades until
    // routine #7 simulates it, so it contributes ~$0 until then.
    name: 'BULL v0.12-SBD (twin)',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    live_start_iso: '2026-05-19T00:00:00Z',
    source: {
      type: 'bull-github',
      portfolio_path: 'variants/v0.12-sbd-exit/portfolio.md',
      trade_log_path: 'variants/v0.12-sbd-exit/trade_log.md',
    },
    adapter: adaptBull,
  },
  {
    // BULL v0.14 — recovery-trend LAB variant (spun up 2026-06-09,
    // user-approved registry add 2026-06-09). Entry rule 3 uses the 4H
    // 20-EMA vs main's 50-EMA; tests post-crash recovery capture.
    // live_start_iso = spin-up date; contributes $0 until routine #7
    // simulates forward trades. No backtest seed data.
    name: 'FABLE BULL v0.14-Recovery (LAB)',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    live_start_iso: '2026-06-09T00:00:00Z',
    source: {
      type: 'bull-github',
      portfolio_path: 'variants/v0.14-recovery-trend/portfolio.md',
      trade_log_path: 'variants/v0.14-recovery-trend/trade_log.md',
    },
    adapter: adaptBull,
  },
  {
    // BULL v0.15 — mean-reversion with SBD knife-catch guard (spun up
    // 2026-06-09, user-approved registry add 2026-06-09). v0.8's RSI<30
    // floor + no entries during synchronized breakdowns; A/B isolates
    // the guard. live_start_iso = spin-up date; no backtest seed data.
    name: 'FABLE BULL v0.15-MR-Guarded (LAB)',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    live_start_iso: '2026-06-09T00:00:00Z',
    source: {
      type: 'bull-github',
      portfolio_path: 'variants/v0.15-meanrev-guarded/portfolio.md',
      trade_log_path: 'variants/v0.15-meanrev-guarded/trade_log.md',
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
    name: 'CODEX Convex Crypto Scout v1',
    starting_capital: 10000,
    killswitch_dd_pct: 35,
    live_start_iso: '2026-05-25T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/convex_crypto_scout_portfolio.md',
      trade_log_path: 'data/codex/convex_crypto_scout_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Markov Directional v1',
    starting_capital: 10000,
    killswitch_dd_pct: 30,
    live_start_iso: '2026-05-26T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/markov_directional_portfolio.md',
      trade_log_path: 'data/codex/markov_directional_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Markov Gate v1',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    live_start_iso: '2026-05-26T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/markov_gate_portfolio.md',
      trade_log_path: 'data/codex/markov_gate_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Crypto Sprint Momentum',
    starting_capital: 10000,
    killswitch_dd_pct: 35,
    live_start_iso: '2026-05-29T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/crypto_sprint_momentum_portfolio.md',
      trade_log_path: 'data/codex/crypto_sprint_momentum_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Crypto Sprint Reversal',
    starting_capital: 10000,
    killswitch_dd_pct: 30,
    live_start_iso: '2026-05-29T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/crypto_sprint_reversal_portfolio.md',
      trade_log_path: 'data/codex/crypto_sprint_reversal_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Aggro Quality v3',
    starting_capital: 10000,
    killswitch_dd_pct: 35,
    live_start_iso: '2026-05-25T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/aggro_quality_portfolio.md',
      trade_log_path: 'data/codex/aggro_quality_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Aggro Plus v1',
    starting_capital: 10000,
    killswitch_dd_pct: 50,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/aggro_plus_portfolio.md',
      trade_log_path: 'data/codex/aggro_plus_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Aggro Short Plus v1',
    starting_capital: 10000,
    killswitch_dd_pct: 50,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/aggro_short_plus_portfolio.md',
      trade_log_path: 'data/codex/aggro_short_plus_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Aggro Plus L/S v1',
    starting_capital: 10000,
    killswitch_dd_pct: 60,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/aggro_plus_ls_portfolio.md',
      trade_log_path: 'data/codex/aggro_plus_ls_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Aggro Short Plus Quality v2',
    starting_capital: 10000,
    killswitch_dd_pct: 50,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/aggro_short_plus_quality_portfolio.md',
      trade_log_path: 'data/codex/aggro_short_plus_quality_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Aggro Plus L/S Quality v2',
    starting_capital: 10000,
    killswitch_dd_pct: 60,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/aggro_plus_ls_quality_portfolio.md',
      trade_log_path: 'data/codex/aggro_plus_ls_quality_trade_log.md',
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
    name: 'CODEX Equities Opening Range v1',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    live_start_iso: '2026-05-28T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/equities_orb_portfolio.md',
      trade_log_path: 'data/codex/equities_orb_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Equities RS Pullback v1',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    live_start_iso: '2026-05-28T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/equities_rs_portfolio.md',
      trade_log_path: 'data/codex/equities_rs_trade_log.md',
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
    name: 'CODEX Equities VWAP Reversal v1',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    live_start_iso: '2026-05-28T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/equities_vwap_portfolio.md',
      trade_log_path: 'data/codex/equities_vwap_trade_log.md',
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
    name: 'CODEX Equities Mean Reversion v1',
    starting_capital: 10000,
    killswitch_dd_pct: 15,
    live_start_iso: '2026-05-17T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/equities_mean_reversion_portfolio.md',
      trade_log_path: 'data/codex/equities_mean_reversion_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Equities MR Sprint',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    live_start_iso: '2026-05-29T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/equities_mr_sprint_portfolio.md',
      trade_log_path: 'data/codex/equities_mr_sprint_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // CODEX Equities Connors MR v1 — Codex-owned diversified RSI(2)
  // oversold-bounce variant inspired by Claude's MR v2, but with explicit
  // cash/notional caps and a fresh forward start.
  // Spec: strategies/codex-equities-connors-mr-v1-spec.md
  {
    name: 'CODEX Equities Connors MR v1',
    starting_capital: 10000,
    killswitch_dd_pct: 15,
    live_start_iso: '2026-05-26T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/equities_connors_mr_portfolio.md',
      trade_log_path: 'data/codex/equities_connors_mr_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Equities MR Quality v2',
    starting_capital: 10000,
    killswitch_dd_pct: 15,
    live_start_iso: '2026-05-25T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/equities_mean_reversion_quality_portfolio.md',
      trade_log_path: 'data/codex/equities_mean_reversion_quality_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Equities Near-Breakout Pullback v1',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    live_start_iso: '2026-05-25T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/equities_near_breakout_pullback_portfolio.md',
      trade_log_path: 'data/codex/equities_near_breakout_pullback_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Equities Breakout Sprint',
    starting_capital: 10000,
    killswitch_dd_pct: 30,
    live_start_iso: '2026-05-29T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/equities_breakout_sprint_portfolio.md',
      trade_log_path: 'data/codex/equities_breakout_sprint_trade_log.md',
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
    name: 'CODEX Regime Plus v1',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/regime_plus_portfolio.md',
      trade_log_path: 'data/codex/regime_plus_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Regime Short Plus v1',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/regime_short_plus_portfolio.md',
      trade_log_path: 'data/codex/regime_short_plus_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'CODEX Regime Plus L/S v1',
    starting_capital: 10000,
    killswitch_dd_pct: 30,
    source: {
      type: 'codex-local',
      portfolio_path: 'data/codex/regime_plus_ls_portfolio.md',
      trade_log_path: 'data/codex/regime_plus_ls_trade_log.md',
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
    // CORRECTED 2026-05-17: v2's trade log was never git-committed before
    // today and its config was added 2026-05-16 (docstring). Unlike v1
    // (git-committed 2026-05-06, genuinely forward), v2 has NO pre-05-16
    // forward history — its earlier P&L is backtest. Honest date = 05-16.
    live_start_iso: '2026-05-16T00:00:00Z',
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
  // Stocks Mean Reversion Deep — extreme-oversold (RSI(2)<3) convex variant.
  // CREATED 2026-05-17. live_start_iso = 2026-05-17 (HONEST). The
  // +$1,278.89 / 86% "contest-window" figure was 100% BACKTEST — this
  // config did not exist before today, never traded a bar forward, and
  // contributes ~$0 to the contest until it earns forward-paper results.
  // It is a HYPOTHESIS entering forward paper now, not realized gains.
  // Spec: stocks_mean_reversion/config.py "deep".
  //
  // NAME 2026-05-27: renamed from "(Aggressive)" to "(RSI<3)" to match the
  // config's display_name. The (Aggressive) suffix described the sizing
  // (4% risk/trade, 8x base) but the trade RATE is dominated by the
  // RSI(2)<3 entry filter, which is extremely rare. RSI is what makes
  // this variant signal-quiet vs its siblings, not sizing.
  {
    name: 'Stocks Mean Reversion Deep (RSI<3)',
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
  // Stocks Mean Reversion Aggressive — concentrated high-risk sibling of
  // Deep. Same proven RSI(2)<10 entry trigger as v1/v2/v3 but with 3%
  // risk/trade (6x base), max_concurrent=2, RSI exit 85 (let winners run),
  // 2.5×ATR stops, 10% daily loss circuit. Designed for top-5-winners
  // contest scoring where right-tail magnitude matters more than win rate.
  // CREATED 2026-05-17 alongside Deep; live_start_iso = creation date
  // (HONEST): pre-05-17 P&L would be backtest, not forward paper.
  // Spec: stocks_mean_reversion/config.py "agg".
  {
    name: 'Stocks Mean Reversion Aggressive',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-05-17T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_agg_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_agg_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // ----- 2026-05-27 three-variant expansion -----
  // Spec: strategies/stocks-mean-reversion-2026-05-27-three-variants-design.md
  // live_start_iso = 2026-05-27 (HONEST creation date). Pre-today P&L is
  // backtest only and excluded from contest equity by the adapter; these
  // contribute ~$0 to the leaderboard contest until they accrue forward
  // trades. They are HYPOTHESES entering forward paper today.
  //
  // v2_agg, v2_rsi15_agg: User-requested. Mirror the proven `agg` template
  // (3% risk, max_concurrent=2, RSI exit 85, 2.5×ATR stop, 10% daily
  // circuit) onto the diversified-8 universe. Goal: scale typical winners
  // from ~$50 (0.5% risk) to ~$300 (3% risk). Direct A/B vs wide-15 `agg`.
  //
  // v3_rsi15: Research variant filling the open cell in universe×RSI grid.
  // wide-15 universe + RSI<15 entry, standard sizing. Tests whether breadth
  // and relaxed-entry advantages stack or cancel.
  {
    name: 'Stocks Mean Reversion v2 Aggressive',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-05-27T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v2_agg_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v2_agg_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'Stocks Mean Reversion v2 (RSI<15) Aggressive',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-05-27T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v2_rsi15_agg_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v2_rsi15_agg_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'Stocks Mean Reversion v3 (Wide RSI<15)',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-05-27T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v3_rsi15_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v3_rsi15_trade_log.md',
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
  // ============================================================
  // Opus 4.8 expansion — 2026-05-28
  // Five diversified-8 Stocks Mean Reversion grid-fill variants + the
  // previously-built-but-unwired Crypto Mean Reversion family. All built on
  // the leaderboard's strongest validated systematic edge (Connors RSI(2)
  // oversold-bounce; Stocks MR v2 carries PF 22 / Sharpe 16 / 71% win on the
  // contest window). live_start_iso = 2026-05-28 (HONEST creation date): every
  // pre-today trade in their logs is BACKTEST and is excluded from contest
  // equity by the adapter, so each contributes ~$0 until it accrues forward
  // paper trades. Generators auto-regenerate nightly via run-stock-nightly.bat.
  // Specs: strategies/stocks-mean-reversion-2026-05-28-opus48-expansion-design.md
  //        strategies/crypto-mean-reversion-v1-spec.md
  //
  // v2_fast — Connors fast exit (RSI>50): closes winners early, higher win
  // rate / more turnover. Occupies the exit-speed axis no variant held.
  {
    name: 'Stocks Mean Reversion v2 Fast-Exit',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-05-28T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v2_fast_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v2_fast_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // v2_heat8 — same proven 0.5%-risk v2 with heat cap 8 (not 4): captures more
  // simultaneous oversold dips in broad selloffs (MR's best regime).
  {
    name: 'Stocks Mean Reversion v2 Broad-Heat',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-05-28T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v2_heat8_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v2_heat8_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // v2_bal — the missing MIDDLE risk tier (1.5%, 2.25×ATR stop, 6% circuit)
  // between v2's 0.5% and agg's 3%. Best full-backfill PnL of the new set.
  {
    name: 'Stocks Mean Reversion v2 Balanced (1.5%)',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    live_start_iso: '2026-05-28T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v2_bal_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v2_bal_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // v2_rsi5_agg — extreme entry (RSI<5) × aggressive sizing (3%) on the best
  // universe. The open RSI5×aggressive cell; most convex single-cell bet.
  {
    name: 'Stocks Mean Reversion v2 (RSI<5) Aggressive',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-05-28T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v2_rsi5_agg_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v2_rsi5_agg_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // deep_div — A/B partner of `deep`: the identical RSI<3 / 4%-risk extreme
  // convex recipe, run on diversified-8 instead of wide-15.
  {
    name: 'Stocks Mean Reversion Deep Diversified (RSI<3)',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-05-28T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_deep_div_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_deep_div_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // Crypto Mean Reversion — the proven stocks Connors recipe ported to Kraken
  // USD spot (4H regime gate, 24/7). Built 2026-05-17, never wired into the
  // contest until now. HONEST NOTE: full backfill LOST to Kraken commission
  // drag (0.52% round-trip × many small trades); wired in as a transparent
  // forward experiment on whether a regime-gated oversold bounce clears spot
  // fees in a fresh forward regime. New asset class — uncorrelated with the
  // equity rows. Spec documents the backfill loss (no cherry-picking).
  {
    name: 'Crypto Mean Reversion v1',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-05-28T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/crypto_variants/crypto_mean_reversion_v1_portfolio.md',
      trade_log_path: 'data/crypto_variants/crypto_mean_reversion_v1_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // Crypto MR Aggressive — the commission-drag fix hypothesis: only RSI<3
  // extreme dips fire (far fewer trades), sized 6× larger, wider 3×ATR stop.
  {
    name: 'Crypto Mean Reversion Aggressive',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-05-28T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/crypto_variants/crypto_mean_reversion_agg_portfolio.md',
      trade_log_path: 'data/crypto_variants/crypto_mean_reversion_agg_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // ----- Trend Momentum sleeve — 2026-05-28 (Opus 4.8) -----
  // The deliberate REGIME-DIVERSIFIER to the mean-reversion family. MR earns in
  // chop and bleeds in trends; this earns in trends and is gated out of chop by
  // a daily ADX filter (the discriminator the failing breakout family lacks).
  // Entry: confirmed-trend continuation (daily EMA50>EMA200 + daily ADX>20 +
  // 1h EMA20>EMA50 + 40-bar close-momentum high). Exit: no partial, wide 3×ATR
  // trailing stop activated at +1R — ride the fat tail. Convex, magnitude-heavy:
  // built to be a strong TOP-3-PROFIT leg when a sustained trend appears, and
  // to bleed only slowly (ADX-gated) while waiting. Reuses the proven
  // basket_breakout_stocks trailing-stop engine. live_start = 2026-05-28
  // (honest); pre-today is backtest, excluded by the adapter.
  // HONEST NOTE: a trend-follower is EXPECTED to look flat/quiet in the current
  // chop regime — its payoff is conditional on a trend showing up.
  // Spec: strategies/stocks-trend-momentum-2026-05-28-spec.md
  {
    name: 'Stocks Trend Momentum v1',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    live_start_iso: '2026-05-28T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_trend_core_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_trend_core_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'Stocks Trend Momentum Aggressive',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-05-28T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_trend_agg_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_trend_agg_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // ============================================================
  // Codex cross-pollination — 2026-05-29 (Opus 4.8)
  // Mirror of what Codex did with Claude's mean-reversion: these take Codex's
  // genuinely novel idea — the MARKOV regime classifier (lib/markov_regime.js,
  // bull/bear/sideways from 20d returns -> transition matrix -> signal =
  // P(next=bull)-P(next=bear)) — ported to Python and applied as a regime gate
  // over Claude's two proven equity edges. live_start 2026-05-29 (honest); pre
  // today is backtest, excluded by the adapter.
  // Specs: strategies/markov-gated-variants-2026-05-29-spec.md
  //
  // Trend Momentum (Markov-Gated): same confirmed-trend entries as Trend
  // Momentum v1, but the daily chop filter is Codex's Markov signal>=+0.10
  // INSTEAD of ADX>20. A/B test of which regime filter is better for momentum.
  {
    name: 'Stocks Trend Momentum (Markov-Gated)',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    live_start_iso: '2026-05-29T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_trend_markov_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_trend_markov_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // Mean Reversion v2 (Markov-Gated): proven diversified-8 Connors MR with
  // Codex's Markov gate as a falling-knife filter — block the oversold dip-buy
  // when next-state odds favour bear (signal<0 or P(next=bear)>0.40). On backfill
  // it raised win rate (67%->70%) and avg R (+0.36->+0.40) by skipping dips in
  // deteriorating regimes.
  {
    name: 'Stocks Mean Reversion v2 (Markov-Gated)',
    starting_capital: 10000,
    killswitch_dd_pct: 18,
    live_start_iso: '2026-05-29T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v2_markov_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v2_markov_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // Aggressive (3% risk) siblings of the Markov-gated pair — 2026-05-29.
  // Magnitude plays for top-3 profit: the Markov regime gate is meant to keep
  // the bigger 3% sizing out of the worst regimes. Backfill (informational):
  // trend_markov_agg 80% win / avg R +1.48 / +$4,649; v2_markov_agg +$2,513.
  {
    name: 'Stocks Trend Momentum (Markov-Gated) Aggressive',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-05-29T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_trend_markov_agg_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_trend_markov_agg_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'Stocks Mean Reversion v2 (Markov-Gated) Aggressive',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-05-29T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/stock_variants/stocks_mean_reversion_v2_markov_agg_portfolio.md',
      trade_log_path: 'data/stock_variants/stocks_mean_reversion_v2_markov_agg_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // ----- Market-neutral uncorrelated earner — 2026-06-01 (Opus 4.8) -----
  // The first genuinely direction-NEUTRAL Claude strategy: dollar-neutral
  // cross-sectional momentum (long top-3 / short bottom-3 of the wide-15 by 10d
  // return, rebalanced every 5d). Earns on dispersion, not market level, so it
  // can be a top-3-profit leg when the long-only MR/momentum book is flat or
  // bleeding. (A pairs/stat-arb sibling was built + tested same day but SHELVED
  // — the semis spreads trended rather than reverted, no edge. Cross-sectional
  // momentum is what the same dispersion data favors; backfill +6.5%, avg R +0.28.)
  // Engine: xsec_momentum (new long/short paper sim). Spec: strategies/xsec-momentum-2026-06-01-spec.md
  {
    name: 'Stocks Cross-Sectional L/S Momentum v1',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    live_start_iso: '2026-06-01T00:00:00Z',
    source: {
      type: 'codex-local',
      portfolio_path: 'data/longshort/xsec_momentum_v1_portfolio.md',
      trade_log_path: 'data/longshort/xsec_momentum_v1_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // ============================================================
  // FABLE family — 2026-06-10 (Claude Fable 5, independent competitor)
  // Seven-strategy uncorrelated book built for top-5-profit scoring: two-way
  // equity MR (base + magnitude), ADX-gated trend, short-only fade (regime
  // insurance), overnight gap fade, fee-aware crypto band reversion, and a
  // two-way crypto trend rider. Own engine at C:\trading\Fable\fable_engine;
  // shares only the common OHLC caches. live_start_iso = 2026-06-10 (HONEST
  // creation date): all pre-today trades in the logs are backtest and are
  // excluded from contest equity by the adapter — every row starts the
  // contest at $0 today. Spec: strategies/fable-family-2026-06-10-spec.md
  {
    name: 'FABLE Equities Snapback L/S v1',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    live_start_iso: '2026-06-10T00:00:00Z',
    source: {
      type: 'codex-local',
      status_path: 'data/health/cache_health.md',
      portfolio_path: 'data/fable/fable_snapback_ls_portfolio.md',
      trade_log_path: 'data/fable/fable_snapback_ls_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'FABLE Equities Snapback Turbo',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-06-10T00:00:00Z',
    source: {
      type: 'codex-local',
      status_path: 'data/health/cache_health.md',
      portfolio_path: 'data/fable/fable_snapback_turbo_portfolio.md',
      trade_log_path: 'data/fable/fable_snapback_turbo_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'FABLE Equities Afterburner v1',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    live_start_iso: '2026-06-10T00:00:00Z',
    source: {
      type: 'codex-local',
      status_path: 'data/health/cache_health.md',
      portfolio_path: 'data/fable/fable_afterburner_portfolio.md',
      trade_log_path: 'data/fable/fable_afterburner_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'FABLE Equities Fader v1',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    live_start_iso: '2026-06-10T00:00:00Z',
    source: {
      type: 'codex-local',
      status_path: 'data/health/cache_health.md',
      portfolio_path: 'data/fable/fable_fader_portfolio.md',
      trade_log_path: 'data/fable/fable_fader_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'FABLE Equities Gap Snap v1',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    live_start_iso: '2026-06-10T00:00:00Z',
    source: {
      type: 'codex-local',
      status_path: 'data/health/cache_health.md',
      portfolio_path: 'data/fable/fable_gap_snap_portfolio.md',
      trade_log_path: 'data/fable/fable_gap_snap_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'FABLE Crypto Pulse L/S v1',
    starting_capital: 10000,
    killswitch_dd_pct: 25,
    live_start_iso: '2026-06-10T00:00:00Z',
    source: {
      type: 'codex-local',
      status_path: 'data/health/cache_health.md',
      portfolio_path: 'data/fable/fable_crypto_pulse_portfolio.md',
      trade_log_path: 'data/fable/fable_crypto_pulse_trade_log.md',
    },
    adapter: adaptCodex,
  },
  {
    name: 'FABLE Crypto Drift v1',
    starting_capital: 10000,
    killswitch_dd_pct: 40,
    live_start_iso: '2026-06-10T00:00:00Z',
    source: {
      type: 'codex-local',
      status_path: 'data/health/cache_health.md',
      portfolio_path: 'data/fable/fable_crypto_drift_portfolio.md',
      trade_log_path: 'data/fable/fable_crypto_drift_trade_log.md',
    },
    adapter: adaptCodex,
  },
  // FABLE Meta-Allocator v1 — 2026-06-10. The fund-of-strategies layer:
  // allocates one $10k account daily across the 7-strategy FABLE book
  // (momentum-gated inverse-vol, 0.15 deadband, 40% cap, cash default).
  // Inputs are the public data/fable/ trade logs — fully reproducible from
  // committed repo state. Research-only for June (not in FABLE's registered
  // 5); July-eligible. Spec: strategies/fable-meta-allocator-v1-spec.md
  {
    name: 'FABLE Meta-Allocator v1',
    starting_capital: 10000,
    killswitch_dd_pct: 20,
    live_start_iso: '2026-06-10T00:00:00Z',
    source: {
      type: 'codex-local',
      status_path: 'data/health/cache_health.md',
      portfolio_path: 'data/fable/fable_meta_allocator_portfolio.md',
      trade_log_path: 'data/fable/fable_meta_allocator_trade_log.md',
    },
    adapter: adaptCodex,
  },
];




