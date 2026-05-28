param(
    [int]$Port = 8123
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverScript = Join-Path $repoRoot "scripts\serve_leaderboard.py"
$installer = Join-Path $env:TEMP "codex-tailscale-install\tailscale-setup-full-1.98.2.exe"

function Test-LeaderboardServer {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:$Port/registry.js"
        return ($response.StatusCode -eq 200 -and $response.Content -match "STRATEGIES")
    } catch {
        return $false
    }
}

function Get-TailscaleExe {
    $cmd = Get-Command tailscale -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $candidates = @(
        "C:\Program Files\Tailscale\tailscale.exe",
        "C:\Program Files (x86)\Tailscale\tailscale.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    return $null
}

Write-Host "Starting Strategy Leaderboard local server on 127.0.0.1:$Port..."
if (-not (Test-LeaderboardServer)) {
    $python = (Get-Command pythonw -ErrorAction SilentlyContinue)
    if ($python) {
        Start-Process -FilePath $python.Source -ArgumentList @($serverScript, "--port", $Port, "--directory", $repoRoot, "--bind", "127.0.0.1") -WindowStyle Hidden
    } else {
        $python = Get-Command python -ErrorAction Stop
        Start-Process -FilePath $python.Source -ArgumentList @($serverScript, "--port", $Port, "--directory", $repoRoot, "--bind", "127.0.0.1") -WindowStyle Hidden
    }
    Start-Sleep -Seconds 2
}

if (-not (Test-LeaderboardServer)) {
    throw "Leaderboard server did not start on http://127.0.0.1:$Port"
}

$tailscale = Get-TailscaleExe
if (-not $tailscale) {
    Write-Host ""
    Write-Host "Tailscale is not installed yet."
    if (Test-Path $installer) {
        Write-Host "Launching the downloaded signed Tailscale installer. Approve the Windows admin prompt, finish install, then run this shortcut again."
        Start-Process -FilePath $installer -Verb RunAs
    } else {
        Write-Host "Install Tailscale on this PC, then run this shortcut again:"
        Write-Host "https://tailscale.com/download/windows"
    }
    exit 2
}

Write-Host "Found Tailscale: $tailscale"

$statusText = & $tailscale status 2>&1
if ($LASTEXITCODE -ne 0 -or ($statusText -join "`n") -match "Logged out|not logged in|NeedsLogin") {
    Write-Host ""
    Write-Host "Tailscale is installed but not logged in. Starting login now..."
    & $tailscale up
    Write-Host "After login finishes, run this shortcut again to enable phone access."
    exit 3
}

Write-Host "Enabling private Tailscale Serve for http://127.0.0.1:$Port ..."
Write-Host "Using tailnet-only HTTP mode to avoid requiring the tailnet HTTPS/Serve consent toggle."
& $tailscale serve --http=80 --bg $Port

Write-Host ""
Write-Host "Tailscale Serve status:"
& $tailscale serve status

try {
    $json = (& $tailscale status --json) | ConvertFrom-Json
    $dnsName = $json.Self.DNSName
    if ($dnsName) {
        $dnsName = $dnsName.TrimEnd(".")
        Write-Host ""
        Write-Host "Open this on your iPhone after signing into Tailscale:"
        Write-Host "http://$dnsName/"
    }
} catch {
    Write-Host "Could not auto-read the Tailscale DNS name. Use the URL shown in Tailscale Serve status above."
}

Write-Host ""
Write-Host "Leave this PC awake when you want the phone dashboard available."
