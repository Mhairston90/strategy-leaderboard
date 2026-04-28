@echo off
REM Strategy Leaderboard launcher.
REM Starts a tiny local Python HTTP server (browsers block fetch() from file:// URLs)
REM then opens the dashboard in Chrome's chromeless --app mode.
setlocal enabledelayedexpansion

set SERVER_DIR=%~dp0
if "%SERVER_DIR:~-1%"=="\" set SERVER_DIR=%SERVER_DIR:~0,-1%

set PORT=8123
set URL=http://localhost:%PORT%/

REM Start server. If port is already in use (server already running), this fails silently —
REM the existing instance keeps serving and we proceed to open the browser.
where pythonw >nul 2>&1
if !ERRORLEVEL! EQU 0 (
  start "" pythonw -m http.server %PORT% --directory "%SERVER_DIR%"
) else (
  start "" /MIN python -m http.server %PORT% --directory "%SERVER_DIR%"
)

REM Wait briefly for the server to bind
timeout /t 2 /nobreak >nul

REM Find Chrome for chromeless --app mode; fall back to default browser
set "CHROME="
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
  set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
  set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

if defined CHROME (
  start "" "!CHROME!" --app=%URL%
) else (
  start "" %URL%
)

endlocal
