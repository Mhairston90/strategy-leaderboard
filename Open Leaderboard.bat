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

REM Decide whether to (re)start the server. A server is REUSED only if it is
REM already serving THIS directory. A server on :8123 that serves a DIFFERENT
REM directory (e.g. a stale pre-migration copy) is killed and replaced — this
REM prevents the dashboard from silently showing data from the wrong repo.
set "EXPECTED_DIR=%SERVER_DIR%"
set "DECISION=START"
for /f "usebackq delims=" %%S in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=$env:EXPECTED_DIR; $c=@(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue)[0]; if(-not $c){'START';exit}; $cl=(Get-CimInstance Win32_Process -Filter ('ProcessId='+$c.OwningProcess) -ErrorAction SilentlyContinue).CommandLine; if($cl -and $cl.ToLower().Contains($d.ToLower())){'REUSE'}else{try{Stop-Process -Id $c.OwningProcess -Force -ErrorAction Stop}catch{}; 'START'}"`) do set "DECISION=%%S"
set START_SERVER=1
if /I "!DECISION!"=="REUSE" set START_SERVER=0

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
