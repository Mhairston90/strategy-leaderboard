# CODEX Pulse v0 Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries

| 2026-05-05T18:00:00Z | OPEN | DOGE/USD | long | 21907.949804 | 0.1141 | 0.1116 | 0.1178 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-06T17:00:00Z | CLOSE | DOGE/USD | long | 21907.949804 | 0.1133 | - | - | -0.55 | -30.25 | time-stop | pulse_momentum |
| 2026-05-06T17:00:00Z | OPEN | SOL/USD | long | 27.964114 | 89.2457 | 87.2823 | 92.1015 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-10T13:00:00Z | CLOSE | SOL/USD | long | 27.964114 | 93.8400 | - | - | +2.10 | +115.16 | target-hit | pulse_momentum |
| 2026-05-10T13:00:00Z | OPEN | LINK/USD | long | 238.248030 | 10.5963 | 10.3632 | 10.9354 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-10T13:00:00Z | OPEN | LTC/USD | long | 42.902873 | 58.8435 | 57.5490 | 60.7265 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-12T07:00:00Z | CLOSE | LINK/USD | long | 238.248030 | 10.4448 | - | - | -0.88 | -49.13 | time-stop | pulse_momentum |
| 2026-05-12T07:00:00Z | CLOSE | LTC/USD | long | 42.902873 | 58.3500 | - | - | -0.62 | -34.25 | time-stop | pulse_momentum |
| 2026-05-17T09:00:00Z | OPEN | DOGE/USD | long | 22641.120694 | 0.1104 | 0.1080 | 0.1140 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-17T10:00:00Z | OPEN | AVAX/USD | long | 266.611855 | 9.4038 | 9.1969 | 9.7047 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-17T10:00:00Z | OPEN | LINK/USD | long | 254.855946 | 9.8375 | 9.6211 | 10.1523 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-17T20:00:00Z | CLOSE | DOGE/USD | long | 22641.120694 | 0.1106 | - | - | -0.16 | -8.61 | time-stop | pulse_momentum |
| 2026-05-17T20:00:00Z | CLOSE | AVAX/USD | long | 266.611855 | 9.2900 | - | - | -0.78 | -43.30 | time-stop | pulse_momentum |
| 2026-05-17T20:00:00Z | CLOSE | LINK/USD | long | 254.855946 | 9.7228 | - | - | -0.76 | -42.19 | time-stop | pulse_momentum |
| 2026-05-18T22:00:00Z | OPEN | LINK/USD | long | 257.715984 | 9.6108 | 9.3994 | 9.9183 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-18T22:00:00Z | OPEN | AVAX/USD | long | 267.372263 | 9.2637 | 9.0599 | 9.5601 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-18T22:00:00Z | OPEN | SOL/USD | long | 28.910172 | 85.6743 | 83.7894 | 88.4158 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-18T22:00:00Z | OPEN | ETH/USD | long | 1.157304 | 2140.1957 | 2093.1114 | 2208.6820 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-19T13:00:00Z | CLOSE | LINK/USD | long | 257.715984 | 9.5333 | - | - | -0.60 | -32.80 | time-stop | pulse_momentum |
| 2026-05-19T13:00:00Z | CLOSE | AVAX/USD | long | 267.372263 | 9.1200 | - | - | -0.94 | -51.20 | time-stop | pulse_momentum |
| 2026-05-19T13:00:00Z | CLOSE | SOL/USD | long | 28.910172 | 84.5300 | - | - | -0.84 | -45.88 | time-stop | pulse_momentum |
| 2026-05-19T13:00:00Z | CLOSE | ETH/USD | long | 1.157304 | 2111.3800 | - | - | -0.85 | -46.14 | time-stop | pulse_momentum |
| 2026-05-19T18:00:00Z | OPEN | LTC/USD | long | 44.951567 | 54.1216 | 52.9310 | 55.8535 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-21T19:00:00Z | CLOSE | LTC/USD | long | 44.951567 | 54.0800 | - | - | -0.27 | -14.52 | time-stop | pulse_momentum |
| 2026-05-21T19:00:00Z | OPEN | SOL/USD | long | 27.797101 | 87.5050 | 85.5799 | 90.3051 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-21T19:00:00Z | OPEN | AVAX/USD | long | 257.020342 | 9.4638 | 9.2556 | 9.7666 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-21T19:00:00Z | OPEN | LINK/USD | long | 249.190339 | 9.7612 | 9.5464 | 10.0735 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-24T07:00:00Z | CLOSE | SOL/USD | long | 27.797101 | 86.3400 | - | - | -0.84 | -44.95 | time-stop | pulse_momentum |
| 2026-05-24T07:00:00Z | CLOSE | AVAX/USD | long | 257.020342 | 9.3500 | - | - | -0.78 | -41.82 | time-stop | pulse_momentum |
| 2026-05-24T07:00:00Z | CLOSE | LINK/USD | long | 249.190339 | 9.5999 | - | - | -0.99 | -52.74 | time-stop | pulse_momentum |
| 2026-05-24T07:00:00Z | OPEN | LINK/USD | long | 249.640932 | 9.6037 | 9.3925 | 9.9111 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-25T15:00:00Z | CLOSE | LINK/USD | long | 249.640932 | 9.6169 | - | - | -0.17 | -9.17 | time-stop | pulse_momentum |
| 2026-05-25T15:00:00Z | OPEN | AVAX/USD | long | 253.356005 | 9.4538 | 9.2458 | 9.7563 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-26T12:00:00Z | CLOSE | AVAX/USD | long | 253.356005 | 9.3700 | - | - | -0.64 | -33.63 | time-stop | pulse_momentum |
| 2026-05-26T14:00:00Z | OPEN | DOGE/USD | long | 23236.888168 | 0.1026 | 0.1003 | 0.1059 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-26T14:00:00Z | OPEN | XRP/USD | long | 1761.355986 | 1.3533 | 1.3235 | 1.3966 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-26T14:00:00Z | OPEN | LTC/USD | long | 45.195219 | 52.7411 | 51.5808 | 54.4288 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-26T20:15:01Z | CLOSE | DOGE/USD | long | 23236.888168 | 0.1027 | - | - | -0.17 | -9.31 | time-stop | pulse_momentum |
| 2026-05-26T20:15:01Z | CLOSE | XRP/USD | long | 1761.355986 | 1.3553 | - | - | -0.17 | -8.85 | time-stop | pulse_momentum |
| 2026-05-26T20:15:01Z | CLOSE | LTC/USD | long | 45.195219 | 52.7300 | - | - | -0.25 | -12.90 | time-stop | pulse_momentum |
| 2026-05-27T19:00:00Z | OPEN | ETH/USD | short | 1.157155 | 2053.2084 | 2098.3790 | 1987.5057 | - | - | pulse_short_intraday_momentum | pulse_momentum |
| 2026-05-28T01:50:27Z | CLOSE | ETH/USD | short | 1.157155 | 2054.0300 | - | - | -0.25 | -13.31 | time-stop | pulse_momentum |
| 2026-05-28T18:00:00Z | OPEN | AVAX/USD | long | 262.345560 | 9.0436 | 8.8447 | 9.3330 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-28T18:00:00Z | OPEN | SOL/USD | long | 28.691070 | 82.6931 | 80.8738 | 85.3392 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-28T18:00:00Z | OPEN | LINK/USD | long | 261.858919 | 9.0604 | 8.8611 | 9.3504 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-28T18:00:00Z | OPEN | DOGE/USD | long | 23670.449299 | 0.1002 | 0.0980 | 0.1034 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-29T15:00:00Z | CLOSE | AVAX/USD | long | 262.345560 | 8.8900 | - | - | -1.01 | -52.53 | time-stop | pulse_momentum |
| 2026-05-29T15:00:00Z | CLOSE | SOL/USD | long | 28.691070 | 82.3700 | - | - | -0.41 | -21.58 | time-stop | pulse_momentum |
| 2026-05-29T15:00:00Z | CLOSE | LINK/USD | long | 261.858919 | 9.0526 | - | - | -0.28 | -14.38 | time-stop | pulse_momentum |
| 2026-05-29T15:00:00Z | CLOSE | DOGE/USD | long | 23670.449299 | 0.1002 | - | - | -0.24 | -12.73 | time-stop | pulse_momentum |
| 2026-05-29T15:00:00Z | OPEN | ETH/USD | long | 1.158750 | 2028.3110 | 1983.6882 | 2093.2170 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-29T15:00:00Z | OPEN | XRP/USD | long | 1778.354377 | 1.3216 | 1.2925 | 1.3639 | - | - | pulse_long_intraday_momentum | pulse_momentum |
| 2026-05-29T15:00:00Z | OPEN | LTC/USD | long | 45.154068 | 52.0508 | 50.9057 | 53.7164 | - | - | pulse_long_intraday_momentum | pulse_momentum |