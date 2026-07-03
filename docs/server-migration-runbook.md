# Server Migration Runbook — Trading Stack

> Goal: move the entire trading stack (sentinel + leaderboard nightlies + NinjaTrader) off the laptop
> onto an always-on Windows host, so the laptop can be closed at any time.
> Written 2026-07-03 by Claude. Companion to `SENTINEL_TAKEOVER_PLAN.md` §11.

## What runs, and why the host must be Windows

| Component | What it is | Portable? |
|---|---|---|
| Trade Sentinel tick loop | Node, `scripts/sentinel_tick_loop.ps1` → `sentinel_tick.js` every 60s | Any OS with Node 24 |
| Fable Nightly / Stock Nightly | Strategy regenerators (Node + Python 3.11) — produce the `*_portfolio.md` files the sentinel reads | Any OS |
| ClaudeHermesSupervisor, Trading Routine Digest | Support automations | Windows-flavored (PowerShell) |
| Alpaca paper | Cloud API | N/A |
| **NinjaTrader 8** | Desktop GUI app; the sentinel drives it via ATI order files | **Windows only — this is the constraint** |

No component uses a GPU. Do not pay for GPU hosting for this stack.

**Host spec:** Windows 10/11 or Server 2022+, 4 vCPU, 8–16 GB RAM, 60+ GB disk.
Options: Windows cloud VPS (~$20–60/mo — Contabo/Kamatera/AWS/Azure) or a home mini-PC.

**This Windows dependency is temporary.** When Kraken Derivatives US ships retail API access
(see plan §11e standing watch), NinjaTrader drops out and the stack becomes pure Node —
runnable on a $5 Linux VPS.

## Migration steps

### 1. Base software
- Node.js 24.x, Git, Python 3.11 (the nightly generators' toolchain).
- NO OneDrive on the server. Do not sign the server's Documents folder into any sync product —
  the NinjaTrader `incoming/` folder is the live order channel; sync tools cause duplicate/late orders.

### 2. Repo + secrets
```powershell
git clone https://github.com/Mhairston90/strategy-leaderboard.git C:\trading\strategy-leaderboard
```
- Copy `.env.local` from the laptop **by hand** (RDP clipboard / USB — it holds the Alpaca + Kraken
  keys and is intentionally not in git).
- `npm test` in the repo root should pass (one known unrelated failure in `adapters/adapters.test.js`
  — a stale fixture; sentinel suites must be green).

### 3. NinjaTrader 8
1. Install NT8, log in with the NinjaTrader account (demo account `DEMO8256098` or its successor).
2. Enable the ATI: Control Center → Tools → Options → Automated trading interface → check **AT Interface**.
3. Set the data connection to connect on startup: Tools → Options → General →
   "Connect on startup" → select the data connection (currently named **Simulation** — the sentinel
   reads `outgoing\<connection name>.txt`; if the connection has a different name on the server,
   update `ninjatrader.connection_name` in `data/sentinel/config.json`).
4. Add NT8 to Windows Startup (shell:startup shortcut).

### 4. Sentinel config diffs (`data/sentinel/config.json`)
- `ninjatrader.documents_root` → the server's real NT folder, e.g.
  `C:\Users\<user>\Documents\NinjaTrader 8` (the laptop value points at OneDrive — change it).
- Everything else carries over unchanged.

### 5. Scheduled tasks
XML exports of all six laptop tasks live in `docs/migration/tasks/`. On the server:
```powershell
schtasks /create /tn "Trade Sentinel Paper Tick Loop" /xml "C:\trading\strategy-leaderboard\docs\migration\tasks\Trade-Sentinel-Paper-Tick-Loop.xml"
# ...repeat for the other five XMLs
```
Then open Task Scheduler and fix per-task: the "Start in"/script paths if the repo path differs,
and the run-as user (they were exported with the laptop's SID).

### 6. Windows host settings
- Power plan: never sleep, never hibernate (mini-PC: also "do nothing" on lid/power events).
- Auto-logon at boot (NT8 needs an interactive session; `netplwiz` or Sysinternals Autologon).
  Disconnecting RDP is fine; **logging out kills NinjaTrader**.
- Windows Update: defer/schedule restarts to weekends — CME crypto is closed
  Fri 4pm CT → Sun 5pm CT, so that window is free maintenance time.

### 7. Remote access
- RDP for the NT8 UI.
- Tailscale (or similar) on server + phone + laptop so the leaderboard/sentinel dashboard
  (`Open Leaderboard.bat`, port 8123) stays reachable like it is today.

## Verification checklist (after migration)
- [ ] `data/sentinel/sentinel_tick_loop.log` appending `exit=0` every ~60s
- [ ] `data/sentinel/risk_state.json` → `"frozen": false`
- [ ] `outgoing\Simulation.txt` (or configured connection file) reads `CONNECTED`
- [ ] A tick submits NT orders and feedback files appear in `outgoing\`
- [ ] `node scripts/sentinel_ledger_reconcile.js --dry-run` reports zero orphans
- [ ] Nightly tasks produce fresh `*_portfolio.md` commits
- [ ] Dashboard reachable from phone

## Operational notes / known gaps
- **Contract roll (manual step for now):** config rolls MBT/MET/MSL/MXP to `08-26` on 2026-07-24,
  but the rebalancer does not yet auto-close the old month's position. On/after roll day, flatten any
  remaining `* 07-26` position in NT (or via a `CLOSEPOSITION` OIF) — otherwise it sits orphaned.
- **ADA/LINK/AVAX micros (MCA/MLN/MAV):** not in NT's instrument database yet
  (`data/sentinel/ninjatrader_contract_inventory.json`). Until they can be added in NT
  (Tools → Instruments), those shorts route to divergences by design.
- **Demo data feed:** NT demo feeds disconnect/expire periodically (root cause of the 2026-07-02
  incident). The sentinel now blocks NT orders while disconnected instead of storming, but the feed
  still needs a human reconnect — check the dashboard/alerts after any long gap.
- **Recovery tool:** if NT ever dies mid-flight again and the freeze latches, run
  `node scripts/sentinel_ledger_reconcile.js` (dry-run first). It terminal-izes orphaned submissions
  safely (keyed by broker_order_id — never by source_signal_id; see rebalancer.js comment).
