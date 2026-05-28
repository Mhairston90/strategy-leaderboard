@echo off
REM Hermes Monitor launcher.
REM Starts the local Strategy Leaderboard server, then opens the Hermes page in Chrome app mode.
setlocal enabledelayedexpansion

set SERVER_DIR=%~dp0
if "%SERVER_DIR:~-1%"=="\" set SERVER_DIR=%SERVER_DIR:~0,-1%

set PORT=8123
for /f %%I in ('powershell -NoProfile -Command "[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()"') do set CACHE_BUSTER=%%I
set URL=http://127.0.0.1:%PORT%/hermes.html?v=!CACHE_BUSTER!
set SERVER_SCRIPT=%SERVER_DIR%\scripts\serve_leaderboard.py

set START_SERVER=1
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:%PORT%/hermes.html'; if ($r.StatusCode -eq 200 -and $r.Content -match 'Hermes Monitor') { exit 0 } } catch { }; exit 1" >nul 2>&1
if !ERRORLEVEL! EQU 0 set START_SERVER=0

if !START_SERVER! EQU 1 (
  where pythonw >nul 2>&1
  if !ERRORLEVEL! EQU 0 (
    start "" pythonw "%SERVER_SCRIPT%" --port %PORT% --directory "%SERVER_DIR%" --bind 127.0.0.1
  ) else (
    start "" /MIN python "%SERVER_SCRIPT%" --port %PORT% --directory "%SERVER_DIR%" --bind 127.0.0.1
  )
  timeout /t 2 /nobreak >nul
)

set "CHROME="
set "CHROME_USER_DATA_DIR=%TEMP%\hermes-monitor-chrome"
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
