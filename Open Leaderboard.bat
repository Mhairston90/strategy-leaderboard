@echo off
REM Strategy Leaderboard launcher.
REM Starts a tiny local Python HTTP server (browsers block fetch() from file:// URLs)
REM then opens the dashboard in Chrome's chromeless --app mode.
setlocal enabledelayedexpansion

set SERVER_DIR=%~dp0
if "%SERVER_DIR:~-1%"=="\" set SERVER_DIR=%SERVER_DIR:~0,-1%

set PORT=8123
for /f %%I in ('powershell -NoProfile -Command "[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()"') do set CACHE_BUSTER=%%I
set URL=http://127.0.0.1:%PORT%/?v=!CACHE_BUSTER!
set SERVER_SCRIPT=%SERVER_DIR%\scripts\serve_leaderboard.py

REM Only start a server when the current one is missing or unhealthy.
set START_SERVER=1
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:%PORT%/registry.js'; if ($r.StatusCode -eq 200 -and $r.Content -match 'STRATEGIES') { exit 0 } } catch { }; exit 1" >nul 2>&1
if !ERRORLEVEL! EQU 0 set START_SERVER=0

if !START_SERVER! EQU 1 (
  where pythonw >nul 2>&1
  if !ERRORLEVEL! EQU 0 (
    start "" pythonw "%SERVER_SCRIPT%" --port %PORT% --directory "%SERVER_DIR%" --bind 127.0.0.1
  ) else (
    start "" /MIN python "%SERVER_SCRIPT%" --port %PORT% --directory "%SERVER_DIR%" --bind 127.0.0.1
  )

  REM Wait briefly for the server to bind
  timeout /t 2 /nobreak >nul
)

REM Find Chrome for chromeless --app mode; fall back to default browser
set "CHROME="
set "CHROME_USER_DATA_DIR=%TEMP%\strategy-leaderboard-chrome"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
  set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
  set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

if defined CHROME (
  start "" "!CHROME!" --user-data-dir="!CHROME_USER_DATA_DIR!" --no-first-run --no-default-browser-check --new-window --app=!URL!
) else (
  start "" !URL!
)

endlocal
