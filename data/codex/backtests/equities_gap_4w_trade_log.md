# CODEX Equities Gap Fade v0 4W Backtest Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries
| 2026-04-14T14:30:00Z | OPEN | MSTR | short | 13.957027 | 143.2970 | 148.3124 | 137.5651 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-04-14T14:30:00Z | OPEN | SMCI | short | 72.171725 | 27.7117 | 28.6816 | 26.6032 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-04-14T17:30:00Z | CLOSE | MSTR | short | 13.957027 | 137.2300 | - | - | +1.06 | +74.50 | target-hit | equities_gap_fade |
| 2026-04-14T19:30:00Z | CLOSE | SMCI | short | 72.171725 | 27.2200 | - | - | +0.36 | +25.18 | eod-exit | equities_gap_fade |
| 2026-04-15T14:30:00Z | OPEN | HOOD | short | 23.545325 | 85.7893 | 88.7919 | 82.3577 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-04-15T19:30:00Z | CLOSE | HOOD | short | 23.545325 | 87.3900 | - | - | -0.68 | -48.29 | eod-exit | equities_gap_fade |
| 2026-04-16T14:30:00Z | OPEN | AMD | short | 7.532462 | 266.8819 | 276.2228 | 256.2066 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-04-16T15:30:00Z | CLOSE | AMD | short | 7.532462 | 277.7100 | - | - | -1.31 | -92.23 | stop-hit | equities_gap_fade |
| 2026-04-17T14:30:00Z | OPEN | HOOD | short | 21.711123 | 91.7425 | 94.9535 | 88.0728 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-04-17T14:30:00Z | OPEN | COIN | short | 9.467473 | 210.3869 | 217.7504 | 201.9714 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-04-17T19:30:00Z | CLOSE | HOOD | short | 21.711123 | 90.8000 | - | - | +0.15 | +10.16 | eod-exit | equities_gap_fade |
| 2026-04-17T19:30:00Z | CLOSE | COIN | short | 9.467473 | 206.4100 | - | - | +0.39 | +27.39 | eod-exit | equities_gap_fade |
| 2026-04-20T14:30:00Z | OPEN | COIN | long | 9.753769 | 204.9815 | 197.8071 | 213.1807 | - | - | equities_gap_down_fade | equities_gap_fade |
| 2026-04-20T14:30:00Z | OPEN | MSTR | long | 12.052234 | 165.8897 | 160.0836 | 172.5253 | - | - | equities_gap_down_fade | equities_gap_fade |
| 2026-04-20T19:30:00Z | CLOSE | COIN | long | 9.753769 | 211.6900 | - | - | +0.78 | +54.87 | eod-exit | equities_gap_fade |
| 2026-04-20T19:30:00Z | CLOSE | MSTR | long | 12.052234 | 170.7700 | - | - | +0.69 | +48.27 | eod-exit | equities_gap_fade |
| 2026-04-22T14:30:00Z | OPEN | MSTR | short | 11.209306 | 180.2047 | 186.5119 | 172.9965 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-04-22T14:30:00Z | OPEN | HOOD | short | 22.556108 | 89.5531 | 92.6875 | 85.9710 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-04-22T19:30:00Z | CLOSE | MSTR | short | 11.209306 | 179.2500 | - | - | +0.00 | +0.23 | eod-exit | equities_gap_fade |
| 2026-04-22T19:30:00Z | CLOSE | HOOD | short | 22.556108 | 88.4500 | - | - | +0.20 | +14.44 | eod-exit | equities_gap_fade |
| 2026-04-23T14:30:00Z | OPEN | SMCI | long | 75.276282 | 26.8731 | 25.9325 | 27.9480 | - | - | equities_gap_down_fade | equities_gap_fade |
| 2026-04-23T14:30:00Z | OPEN | TSLA | long | 5.478847 | 369.2207 | 356.2980 | 383.9895 | - | - | equities_gap_down_fade | equities_gap_fade |
| 2026-04-23T19:30:00Z | CLOSE | SMCI | long | 75.276282 | 26.7300 | - | - | -0.30 | -21.26 | eod-exit | equities_gap_fade |
| 2026-04-23T19:30:00Z | CLOSE | TSLA | long | 5.478847 | 373.6300 | - | - | +0.19 | +13.58 | eod-exit | equities_gap_fade |
| 2026-04-24T14:30:00Z | OPEN | AMD | short | 5.836688 | 346.3211 | 358.4423 | 332.4682 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-04-24T14:30:00Z | OPEN | MSTR | short | 11.899568 | 169.8690 | 175.8144 | 163.0743 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-04-24T19:30:00Z | CLOSE | AMD | short | 5.836688 | 347.7600 | - | - | -0.27 | -18.93 | eod-exit | equities_gap_fade |
| 2026-04-24T19:30:00Z | CLOSE | MSTR | short | 11.899568 | 171.0200 | - | - | -0.34 | -24.24 | eod-exit | equities_gap_fade |
| 2026-04-28T14:30:00Z | OPEN | AMD | long | 6.212388 | 323.9872 | 312.6476 | 336.9467 | - | - | equities_gap_down_fade | equities_gap_fade |
| 2026-04-28T14:30:00Z | OPEN | AVGO | long | 4.994987 | 402.9508 | 388.8476 | 419.0689 | - | - | equities_gap_down_fade | equities_gap_fade |
| 2026-04-28T19:30:00Z | CLOSE | AMD | long | 6.212388 | 323.1100 | - | - | -0.23 | -15.90 | eod-exit | equities_gap_fade |
| 2026-04-28T19:30:00Z | CLOSE | AVGO | long | 4.994987 | 399.8300 | - | - | -0.37 | -26.01 | eod-exit | equities_gap_fade |
| 2026-04-29T14:30:00Z | OPEN | HOOD | long | 28.262445 | 70.9193 | 68.4371 | 73.7560 | - | - | equities_gap_down_fade | equities_gap_fade |
| 2026-04-29T19:30:00Z | CLOSE | HOOD | long | 28.262445 | 71.2100 | - | - | -0.03 | -2.23 | eod-exit | equities_gap_fade |
| 2026-04-30T14:30:00Z | OPEN | META | long | 3.326589 | 602.3907 | 581.3070 | 626.4863 | - | - | equities_gap_down_fade | equities_gap_fade |
| 2026-04-30T19:30:00Z | CLOSE | META | long | 3.326589 | 611.4000 | - | - | +0.28 | +19.47 | eod-exit | equities_gap_fade |
| 2026-05-01T14:30:00Z | OPEN | PLTR | short | 14.057553 | 142.8271 | 147.8261 | 137.1140 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-05-01T14:30:00Z | OPEN | MSTR | short | 11.433465 | 175.6073 | 181.7536 | 168.5830 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-05-01T19:30:00Z | CLOSE | PLTR | short | 14.057553 | 144.0799 | - | - | -0.40 | -28.10 | eod-exit | equities_gap_fade |
| 2026-05-01T19:30:00Z | CLOSE | MSTR | short | 11.433465 | 177.2800 | - | - | -0.42 | -29.62 | eod-exit | equities_gap_fade |
| 2026-05-04T14:30:00Z | OPEN | COIN | short | 9.839633 | 202.8791 | 209.9799 | 194.7640 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-05-04T14:30:00Z | OPEN | PLTR | short | 13.553621 | 147.2858 | 152.4408 | 141.3944 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-05-04T19:30:00Z | CLOSE | COIN | short | 9.839633 | 202.8800 | - | - | -0.15 | -10.39 | eod-exit | equities_gap_fade |
| 2026-05-04T19:30:00Z | CLOSE | PLTR | short | 13.553621 | 146.1900 | - | - | +0.06 | +4.51 | eod-exit | equities_gap_fade |
| 2026-05-05T14:30:00Z | OPEN | PLTR | long | 14.463268 | 137.9412 | 133.1132 | 143.4588 | - | - | equities_gap_down_fade | equities_gap_fade |
| 2026-05-05T14:30:00Z | OPEN | AMD | short | 5.698520 | 350.1049 | 362.3586 | 336.1007 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-05-05T19:30:00Z | CLOSE | PLTR | long | 14.463268 | 135.9100 | - | - | -0.57 | -39.68 | eod-exit | equities_gap_fade |
| 2026-05-05T19:30:00Z | CLOSE | AMD | short | 5.698520 | 355.3200 | - | - | -0.58 | -40.17 | eod-exit | equities_gap_fade |
| 2026-05-06T14:30:00Z | OPEN | AMD | short | 4.877380 | 405.7732 | 419.9753 | 389.5423 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-05-06T14:30:00Z | OPEN | SMCI | short | 61.605851 | 32.1254 | 33.2497 | 30.8403 | - | - | equities_gap_up_fade | equities_gap_fade |
| 2026-05-06T16:30:00Z | CLOSE | AMD | short | 4.877380 | 414.0616 | - | - | -0.73 | -50.82 | backtest-final-mark | equities_gap_fade |
| 2026-05-06T16:30:00Z | CLOSE | SMCI | short | 61.605851 | 32.0450 | - | - | -0.08 | -5.33 | backtest-final-mark | equities_gap_fade |
