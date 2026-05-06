# CODEX Equities Opening Range v1 4W Backtest Trade Log

> Append-only. Source of truth for portfolio rebuilds.

## Schema

| Timestamp (UTC) | Event | Pair | Side | Size | Price | Stop | Target | R at exit | Realized PnL | Reason tag | Sleeve |
|-----------------|-------|------|------|------|-------|------|--------|-----------|--------------|------------|--------|

## Entries
| 2026-04-09T14:30:00Z | OPEN | NFLX | long | 19.849103 | 100.7602 | 98.5435 | 103.9845 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-09T14:30:00Z | OPEN | NVDA | long | 10.935544 | 182.8899 | 178.8663 | 188.7423 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-09T19:30:00Z | CLOSE | NFLX | long | 19.849103 | 102.0950 | - | - | +0.36 | +16.03 | eod-exit | equities_orb |
| 2026-04-09T19:30:00Z | CLOSE | NVDA | long | 10.935544 | 183.8500 | - | - | +0.00 | +0.07 | eod-exit | equities_orb |
| 2026-04-10T14:30:00Z | OPEN | NVDA | long | 10.569027 | 189.5368 | 185.3670 | 195.6020 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-10T14:30:00Z | OPEN | AVGO | long | 5.327886 | 375.9878 | 367.7160 | 388.0194 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-10T19:30:00Z | CLOSE | NVDA | long | 10.569027 | 188.6400 | - | - | -0.45 | -19.87 | eod-exit | equities_orb |
| 2026-04-10T19:30:00Z | CLOSE | AVGO | long | 5.327886 | 371.5600 | - | - | -0.77 | -33.95 | eod-exit | equities_orb |
| 2026-04-13T14:30:00Z | OPEN | SMCI | long | 78.435062 | 25.4026 | 24.8438 | 26.2155 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-13T19:30:00Z | CLOSE | SMCI | long | 78.435062 | 25.9790 | - | - | +0.79 | +34.73 | eod-exit | equities_orb |
| 2026-04-14T14:30:00Z | OPEN | META | long | 3.027273 | 660.4631 | 645.9329 | 681.5979 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-14T14:30:00Z | OPEN | NFLX | long | 18.963303 | 105.4353 | 103.1157 | 108.8093 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-14T14:30:00Z | OPEN | AAPL | short | 7.750282 | 257.9780 | 263.6535 | 249.7227 | - | - | equities_opening_range_breakout_short | equities_orb |
| 2026-04-14T19:30:00Z | CLOSE | META | long | 3.027273 | 662.5500 | - | - | -0.09 | -4.10 | eod-exit | equities_orb |
| 2026-04-14T19:30:00Z | CLOSE | NFLX | long | 18.963303 | 106.2200 | - | - | +0.10 | +4.44 | eod-exit | equities_orb |
| 2026-04-14T19:30:00Z | CLOSE | AAPL | short | 7.750282 | 258.8550 | - | - | -0.39 | -17.21 | eod-exit | equities_orb |
| 2026-04-15T14:30:00Z | OPEN | TSLA | long | 5.135911 | 388.6415 | 380.0913 | 401.0780 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-15T14:30:00Z | OPEN | AAPL | long | 7.581995 | 263.2589 | 257.4672 | 271.6832 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-15T14:30:00Z | OPEN | PLTR | long | 14.290835 | 139.6719 | 136.5991 | 144.1414 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-15T19:30:00Z | CLOSE | TSLA | long | 5.135911 | 392.0300 | - | - | +0.16 | +6.98 | eod-exit | equities_orb |
| 2026-04-15T19:30:00Z | CLOSE | AAPL | long | 7.581995 | 266.3700 | - | - | +0.30 | +13.15 | eod-exit | equities_orb |
| 2026-04-15T19:30:00Z | CLOSE | PLTR | long | 14.290835 | 142.1500 | - | - | +0.57 | +24.94 | eod-exit | equities_orb |
| 2026-04-16T14:30:00Z | OPEN | AMD | long | 7.285829 | 275.1975 | 269.1432 | 284.0038 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-16T14:30:00Z | OPEN | SMCI | long | 71.676762 | 27.9734 | 27.3580 | 28.8685 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-16T14:30:00Z | OPEN | NVDA | long | 10.072060 | 199.0697 | 194.6902 | 205.4399 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-16T19:30:00Z | CLOSE | AMD | long | 7.285829 | 278.2600 | - | - | +0.27 | +11.83 | eod-exit | equities_orb |
| 2026-04-16T19:30:00Z | CLOSE | SMCI | long | 71.676762 | 28.3800 | - | - | +0.42 | +18.64 | eod-exit | equities_orb |
| 2026-04-16T19:30:00Z | CLOSE | NVDA | long | 10.072060 | 198.2400 | - | - | -0.43 | -18.76 | eod-exit | equities_orb |
| 2026-04-17T14:30:00Z | OPEN | TSLA | long | 4.917016 | 408.2524 | 399.2709 | 421.3165 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-17T14:30:00Z | OPEN | AAPL | long | 7.379503 | 272.0216 | 266.0371 | 280.7263 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-17T14:30:00Z | OPEN | PLTR | long | 13.575390 | 147.8693 | 144.6162 | 152.6012 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-17T19:30:00Z | CLOSE | TSLA | long | 4.917016 | 400.6600 | - | - | -1.08 | -47.67 | eod-exit | equities_orb |
| 2026-04-17T19:30:00Z | CLOSE | AAPL | long | 7.379503 | 270.1850 | - | - | -0.54 | -23.96 | eod-exit | equities_orb |
| 2026-04-17T19:30:00Z | CLOSE | PLTR | long | 13.575390 | 146.3700 | - | - | -0.70 | -30.74 | eod-exit | equities_orb |
| 2026-04-20T14:30:00Z | OPEN | NFLX | short | 21.171838 | 93.8468 | 95.9115 | 90.8437 | - | - | equities_opening_range_breakout_short | equities_orb |
| 2026-04-20T14:30:00Z | OPEN | SMCI | long | 69.378769 | 28.6386 | 28.0085 | 29.5550 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-20T19:30:00Z | CLOSE | NFLX | short | 21.171838 | 94.8100 | - | - | -0.70 | -30.78 | eod-exit | equities_orb |
| 2026-04-20T19:30:00Z | CLOSE | SMCI | long | 69.378769 | 28.8200 | - | - | +0.05 | +2.22 | eod-exit | equities_orb |
| 2026-04-21T14:30:00Z | OPEN | HOOD | short | 22.615509 | 87.6035 | 89.5308 | 84.8002 | - | - | equities_opening_range_breakout_short | equities_orb |
| 2026-04-21T14:30:00Z | OPEN | AAPL | short | 7.396680 | 267.8496 | 273.7423 | 259.2784 | - | - | equities_opening_range_breakout_short | equities_orb |
| 2026-04-21T14:30:00Z | OPEN | AVGO | long | 4.928898 | 401.9555 | 393.1125 | 414.8181 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-21T19:30:00Z | CLOSE | HOOD | short | 22.615509 | 86.4400 | - | - | +0.37 | +16.08 | eod-exit | equities_orb |
| 2026-04-21T19:30:00Z | CLOSE | AAPL | short | 7.396680 | 266.2200 | - | - | +0.04 | +1.78 | eod-exit | equities_orb |
| 2026-04-21T19:30:00Z | CLOSE | AVGO | long | 4.928898 | 402.2500 | - | - | -0.20 | -8.85 | eod-exit | equities_orb |
| 2026-04-22T14:30:00Z | OPEN | AVGO | long | 4.762077 | 416.4149 | 407.2538 | 429.7402 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-22T14:30:00Z | OPEN | AMD | long | 6.655717 | 297.9394 | 291.3847 | 307.4734 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-22T14:30:00Z | OPEN | NVDA | long | 9.833315 | 201.6614 | 197.2248 | 208.1146 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-22T19:30:00Z | CLOSE | AVGO | long | 4.762077 | 422.6000 | - | - | +0.44 | +19.07 | eod-exit | equities_orb |
| 2026-04-22T19:30:00Z | CLOSE | AMD | long | 6.655717 | 303.4400 | - | - | +0.60 | +26.20 | eod-exit | equities_orb |
| 2026-04-22T19:30:00Z | CLOSE | NVDA | long | 9.833315 | 202.4200 | - | - | -0.07 | -2.87 | eod-exit | equities_orb |
| 2026-04-23T14:30:00Z | OPEN | AMD | long | 6.446950 | 308.9026 | 302.1068 | 318.7875 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-23T14:30:00Z | OPEN | META | long | 2.979360 | 668.4254 | 653.7201 | 689.8151 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-23T19:30:00Z | CLOSE | AMD | long | 6.446950 | 305.2400 | - | - | -0.77 | -33.91 | eod-exit | equities_orb |
| 2026-04-23T19:30:00Z | CLOSE | META | long | 2.979360 | 659.3300 | - | - | -0.85 | -37.38 | eod-exit | equities_orb |
| 2026-04-24T14:30:00Z | OPEN | NVDA | long | 9.461363 | 208.9786 | 204.3810 | 215.6659 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-24T14:30:00Z | OPEN | META | long | 2.939444 | 672.6517 | 657.8534 | 694.1766 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-24T19:30:00Z | CLOSE | NVDA | long | 9.461363 | 208.1900 | - | - | -0.41 | -17.72 | eod-exit | equities_orb |
| 2026-04-24T19:30:00Z | CLOSE | META | long | 2.939444 | 674.8900 | - | - | -0.09 | -3.72 | eod-exit | equities_orb |
| 2026-04-27T14:30:00Z | OPEN | SMCI | short | 71.323674 | 27.6617 | 28.2703 | 26.7765 | - | - | equities_opening_range_breakout_short | equities_orb |
| 2026-04-27T14:30:00Z | OPEN | HOOD | short | 23.652037 | 83.4150 | 85.2501 | 80.7457 | - | - | equities_opening_range_breakout_short | equities_orb |
| 2026-04-27T19:30:00Z | CLOSE | SMCI | short | 71.323674 | 27.8600 | - | - | -0.56 | -24.44 | eod-exit | equities_orb |
| 2026-04-27T19:30:00Z | CLOSE | HOOD | short | 23.652037 | 83.9500 | - | - | -0.53 | -22.95 | eod-exit | equities_orb |
| 2026-04-28T14:30:00Z | OPEN | META | short | 2.942765 | 667.2148 | 681.8935 | 645.8639 | - | - | equities_opening_range_breakout_short | equities_orb |
| 2026-04-28T19:30:00Z | CLOSE | META | short | 2.942765 | 671.2300 | - | - | -0.51 | -22.06 | eod-exit | equities_orb |
| 2026-04-29T14:30:00Z | OPEN | NFLX | long | 21.167605 | 92.5492 | 90.5131 | 95.5107 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-29T19:30:00Z | CLOSE | NFLX | long | 21.167605 | 92.1600 | - | - | -0.43 | -18.40 | eod-exit | equities_orb |
| 2026-04-30T14:30:00Z | OPEN | TSLA | long | 5.164947 | 378.5835 | 370.2547 | 390.6982 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-30T14:30:00Z | OPEN | SMCI | long | 71.577356 | 27.3182 | 26.7172 | 28.1924 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-30T14:30:00Z | OPEN | PLTR | long | 13.996688 | 139.7019 | 136.6285 | 144.1724 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-04-30T19:30:00Z | CLOSE | TSLA | long | 5.164947 | 381.5300 | - | - | +0.12 | +5.01 | eod-exit | equities_orb |
| 2026-04-30T19:30:00Z | CLOSE | SMCI | long | 71.577356 | 27.4000 | - | - | -0.10 | -4.33 | eod-exit | equities_orb |
| 2026-04-30T19:30:00Z | CLOSE | PLTR | long | 13.996688 | 139.0600 | - | - | -0.44 | -19.13 | eod-exit | equities_orb |
| 2026-05-01T14:30:00Z | OPEN | TSLA | long | 4.968964 | 392.7728 | 384.1318 | 405.3415 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-05-01T19:30:00Z | CLOSE | TSLA | long | 4.968964 | 390.6600 | - | - | -0.48 | -20.62 | eod-exit | equities_orb |
| 2026-05-04T14:30:00Z | OPEN | NVDA | short | 9.951851 | 195.6973 | 200.0026 | 189.4350 | - | - | equities_opening_range_breakout_short | equities_orb |
| 2026-05-04T14:30:00Z | OPEN | AVGO | short | 4.699622 | 414.4056 | 423.5226 | 401.1447 | - | - | equities_opening_range_breakout_short | equities_orb |
| 2026-05-04T14:30:00Z | OPEN | AMD | short | 5.695300 | 341.9574 | 349.4804 | 331.0147 | - | - | equities_opening_range_breakout_short | equities_orb |
| 2026-05-04T19:30:00Z | CLOSE | NVDA | short | 9.951851 | 198.5600 | - | - | -0.90 | -38.69 | eod-exit | equities_orb |
| 2026-05-04T19:30:00Z | CLOSE | AVGO | short | 4.699622 | 416.4700 | - | - | -0.46 | -19.85 | eod-exit | equities_orb |
| 2026-05-04T19:30:00Z | CLOSE | AMD | short | 5.695300 | 341.4900 | - | - | -0.17 | -7.46 | eod-exit | equities_orb |
| 2026-05-05T14:30:00Z | OPEN | NFLX | short | 21.951677 | 88.1186 | 90.0572 | 85.2988 | - | - | equities_opening_range_breakout_short | equities_orb |
| 2026-05-05T14:30:00Z | OPEN | NVDA | short | 9.820477 | 196.9711 | 201.3045 | 190.6680 | - | - | equities_opening_range_breakout_short | equities_orb |
| 2026-05-05T14:30:00Z | OPEN | AVGO | long | 4.522222 | 427.7433 | 418.3329 | 441.4311 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-05-05T19:30:00Z | CLOSE | NFLX | short | 21.951677 | 87.9000 | - | - | -0.12 | -5.25 | eod-exit | equities_orb |
| 2026-05-05T19:30:00Z | CLOSE | NVDA | short | 9.820477 | 196.5000 | - | - | -0.13 | -5.42 | eod-exit | equities_orb |
| 2026-05-05T19:30:00Z | CLOSE | AVGO | long | 4.522222 | 427.5000 | - | - | -0.26 | -11.16 | eod-exit | equities_orb |
| 2026-05-06T14:30:00Z | OPEN | NVDA | long | 9.350158 | 206.4119 | 201.8708 | 213.0171 | - | - | equities_opening_range_breakout_long | equities_orb |
| 2026-05-06T16:30:00Z | CLOSE | NVDA | long | 9.350158 | 204.6099 | - | - | -0.63 | -26.84 | backtest-final-mark | equities_orb |
