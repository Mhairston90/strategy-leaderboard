@echo off
REM Trade Sentinel launcher.
REM Starts the existing Strategy Leaderboard server, then opens the Sentinel page.
setlocal enabledelayedexpansion

set SERVER_DIR=%~dp0
if "%SERVER_DIR:~-1%"=="\" set SERVER_DIR=%SERVER_DIR:~0,-1%

set PORT=8123
for /f %%I in ('powershell -NoProfile -Command "[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()"') do set CACHE_BUSTER=%%I
set URL=http://127.0.0.1:%PORT%/sentinel.html?v=!CACHE_BUSTER!

start "" /MIN "%SERVER_DIR%\Open Leaderboard.bat"
timeout /t 2 /nobreak >nul

set "CHROME="
set "CHROME_USER_DATA_DIR=%TEMP%\trade-sentinel-chrome"
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
