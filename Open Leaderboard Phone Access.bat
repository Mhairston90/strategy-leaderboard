@echo off
setlocal
set SERVER_DIR=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%SERVER_DIR%scripts\start_phone_access.ps1"
endlocal
