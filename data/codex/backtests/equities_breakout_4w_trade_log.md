# CODEX Equities Breakout Runner v1 4W Backtest Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries
| 2026-04-09T15:30:00Z | OPEN | AVGO | long | 6.978889 | 358.2232 | 343.8943 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-04-09T15:30:00Z | OPEN | META | long | 3.935465 | 635.2490 | 609.8390 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-04-10T13:30:00Z | OPEN | AMD | long | 10.258456 | 246.2585 | 236.4081 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-04-10T13:30:00Z | OPEN | NVDA | long | 13.165335 | 187.9001 | 180.3841 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-04-20T13:30:00Z | CLOSE | AVGO | long | 6.978889 | 399.2746 | - | - | +2.73 | +272.75 | time-stop | equities_breakout_runner |
| 2026-04-20T13:30:00Z | CLOSE | META | long | 3.935465 | 676.0824 | - | - | +1.47 | +147.28 | time-stop | equities_breakout_runner |
| 2026-04-20T13:30:00Z | CLOSE | AMD | long | 10.258456 | 276.6750 | - | - | +2.95 | +298.08 | time-stop | equities_breakout_runner |
| 2026-04-20T13:30:00Z | CLOSE | NVDA | long | 13.165335 | 199.1300 | - | - | +1.36 | +134.60 | time-stop | equities_breakout_runner |
| 2026-04-20T13:30:00Z | OPEN | AAPL | long | 9.920596 | 273.4894 | 262.5498 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-04-20T19:30:00Z | OPEN | NVDA | long | 13.412032 | 202.1908 | 194.1032 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-04-21T13:30:00Z | OPEN | SMCI | long | 90.635555 | 29.8169 | 28.6242 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-04-21T13:30:00Z | OPEN | PLTR | long | 18.156962 | 148.8395 | 142.8859 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-04-21T19:30:00Z | CLOSE | SMCI | long | 90.635555 | 28.4100 | - | - | -1.31 | -141.24 | stop-hit | equities_breakout_runner |
| 2026-04-22T13:30:00Z | OPEN | AMD | long | 8.750527 | 295.2999 | 283.4879 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-04-23T16:30:00Z | CLOSE | PLTR | long | 18.156962 | 141.4501 | - | - | -1.37 | -147.87 | stop-hit | equities_breakout_runner |
| 2026-04-30T13:30:00Z | CLOSE | AAPL | long | 9.920596 | 271.9190 | - | - | -0.27 | -29.65 | time-stop | equities_breakout_runner |
| 2026-04-30T15:30:00Z | OPEN | NFLX | long | 29.403051 | 93.3623 | 89.6278 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-04-30T18:30:00Z | OPEN | AAPL | long | 9.078646 | 274.5998 | 263.6158 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-04-30T19:30:00Z | CLOSE | NVDA | long | 13.412032 | 199.5300 | - | - | -0.46 | -49.70 | time-stop | equities_breakout_runner |
| 2026-05-01T13:30:00Z | OPEN | TSLA | long | 6.856633 | 388.2502 | 372.7202 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-05-04T13:30:00Z | CLOSE | AMD | long | 8.750527 | 342.9300 | - | - | +3.89 | +402.27 | time-stop | equities_breakout_runner |
| 2026-05-04T13:30:00Z | OPEN | SMCI | long | 95.899812 | 28.3363 | 27.2029 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-05-05T13:30:00Z | CLOSE | NFLX | long | 29.403051 | 88.8900 | - | - | -1.32 | -145.43 | stop-hit | equities_breakout_runner |
| 2026-05-05T14:30:00Z | OPEN | AVGO | long | 6.299381 | 427.7860 | 410.6746 | - | - | - | equities_breakout_runner_strong_close | equities_breakout_runner |
| 2026-05-06T16:30:00Z | CLOSE | AAPL | long | 9.078646 | 286.7100 | - | - | +0.97 | +96.69 | backtest-final-mark | equities_breakout_runner |
| 2026-05-06T16:30:00Z | CLOSE | TSLA | long | 6.856633 | 399.2050 | - | - | +0.57 | +61.07 | backtest-final-mark | equities_breakout_runner |
| 2026-05-06T16:30:00Z | CLOSE | SMCI | long | 95.899812 | 31.9586 | - | - | +3.06 | +332.34 | backtest-final-mark | equities_breakout_runner |
| 2026-05-06T16:30:00Z | CLOSE | AVGO | long | 6.299381 | 421.4376 | - | - | -0.50 | -53.90 | backtest-final-mark | equities_breakout_runner |
