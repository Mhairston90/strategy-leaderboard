# NinjaTrader watchdog: keeps NT8 running and its data connection honest.
#
# Problems this solves (observed 2026-07-02..09 on the laptop):
#  1. NinjaTrader disconnects and never auto-reconnects -> restart it.
#  2. NinjaTrader gets closed/killed -> the connection status file keeps its
#     last value (e.g. CONNECTED), silently lying to the sentinel's connection
#     gate -> rewrite it to DISCONNECTED so the gate blocks correctly.
#  3. Stale order files left in incoming\ would execute late on NT startup ->
#     delete OIFs older than the staleness window before (re)starting NT.
#
# Scheduled task: "NinjaTrader Watchdog", every 5 minutes, interactive session.
# Safe alongside the sentinel: restarts never submit orders; the sentinel's
# risk gates decide what trades.

param(
  [string]$RepoRoot = "C:\trading\strategy-leaderboard",
  [string]$NinjaTraderExe = "C:\Program Files\NinjaTrader 8\bin\NinjaTrader.exe",
  [int]$DisconnectedGraceMinutes = 6,
  [int]$RestartCooldownMinutes = 30,
  [int]$StaleOifMinutes = 5
)

$ErrorActionPreference = "Stop"

$configPath = Join-Path $RepoRoot "data\sentinel\config.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$documentsRoot = $config.ninjatrader.documents_root
if (-not $documentsRoot) { $documentsRoot = Join-Path $env:USERPROFILE "Documents\NinjaTrader 8" }
$connectionName = $config.ninjatrader.connection_name
if (-not $connectionName) { $connectionName = "Simulation" }

$connectionFile = Join-Path $documentsRoot "outgoing\$connectionName.txt"
$incomingDir = Join-Path $documentsRoot "incoming"
$logFile = Join-Path $RepoRoot "data\sentinel\ninjatrader_watchdog.log"
$stateFile = Join-Path $RepoRoot "data\sentinel\ninjatrader_watchdog_state.json"

function Write-Log([string]$message) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"), $message
  Add-Content -Path $logFile -Value $line
  # keep the log from growing without bound
  if ((Get-Item $logFile -ErrorAction SilentlyContinue).Length -gt 1MB) {
    $tail = Get-Content $logFile -Tail 500
    Set-Content -Path $logFile -Value $tail
  }
}

function Read-State {
  try { Get-Content $stateFile -Raw -ErrorAction Stop | ConvertFrom-Json } catch { $null }
}

function Write-State($state) {
  $state | ConvertTo-Json | Set-Content -Path $stateFile
}

function Clear-StaleOifs {
  if (-not (Test-Path $incomingDir)) { return }
  $cutoff = (Get-Date).AddMinutes(-$StaleOifMinutes)
  $stale = Get-ChildItem $incomingDir -Filter "oif*.txt" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $cutoff }
  foreach ($file in $stale) {
    Remove-Item $file.FullName -Force -Confirm:$false
    Write-Log "removed stale OIF: $($file.Name)"
  }
}

function Restart-Allowed($state) {
  if (-not $state -or -not $state.last_restart_at) { return $true }
  $last = [DateTime]::Parse($state.last_restart_at)
  return ((Get-Date) - $last).TotalMinutes -ge $RestartCooldownMinutes
}

function Start-NinjaTrader($state, [string]$why) {
  if (-not (Restart-Allowed $state)) {
    Write-Log "restart wanted ($why) but within $RestartCooldownMinutes-minute cooldown; skipping"
    return $state
  }
  Clear-StaleOifs
  $running = Get-Process -Name "NinjaTrader" -ErrorAction SilentlyContinue
  if ($running) {
    Write-Log "stopping NinjaTrader (pid $($running.Id -join ','))"
    $running | Stop-Process -Force -Confirm:$false
    Start-Sleep -Seconds 10
  }
  Write-Log "starting NinjaTrader: $why"
  Start-Process -FilePath $NinjaTraderExe -WorkingDirectory (Split-Path $NinjaTraderExe)
  return @{ last_restart_at = (Get-Date).ToString("o"); disconnected_since = $null }
}

$state = Read-State
$process = Get-Process -Name "NinjaTrader" -ErrorAction SilentlyContinue

if (-not $process) {
  # NT is not running: make the status file tell the sentinel the truth,
  # then bring NT back.
  if (Test-Path $connectionFile) {
    $current = (Get-Content $connectionFile -Raw).Trim()
    if ($current -ne "DISCONNECTED") {
      Set-Content -Path $connectionFile -Value "DISCONNECTED"
      Write-Log "NinjaTrader not running; corrected $connectionName.txt from '$current' to DISCONNECTED"
    }
  }
  $state = Start-NinjaTrader $state "process not running"
  Write-State $state
  exit 0
}

# NT is running: give it a startup grace period before judging the connection.
$uptimeMinutes = ((Get-Date) - $process.StartTime).TotalMinutes
if ($uptimeMinutes -lt 3) { exit 0 }

$status = if (Test-Path $connectionFile) { (Get-Content $connectionFile -Raw).Trim().ToUpperInvariant() } else { "MISSING" }

if ($status -eq "CONNECTED") {
  if ($state -and $state.disconnected_since) {
    Write-Log "connection restored"
    Write-State @{ last_restart_at = $state.last_restart_at; disconnected_since = $null }
  }
  exit 0
}

# DISCONNECTED (or the file never appeared): track how long, restart past grace.
$since = if ($state -and $state.disconnected_since) { [DateTime]::Parse($state.disconnected_since) } else { Get-Date }
if (-not ($state -and $state.disconnected_since)) {
  Write-State @{ last_restart_at = $state.last_restart_at; disconnected_since = $since.ToString("o") }
  Write-Log "connection status '$status'; grace timer started"
  exit 0
}

if (((Get-Date) - $since).TotalMinutes -ge $DisconnectedGraceMinutes) {
  $state = Start-NinjaTrader $state "connection '$status' for over $DisconnectedGraceMinutes minutes"
  Write-State $state
}
