@echo off
rem Double-click to run Homed locally at http://localhost:3010. Close this window to stop it.
cd /d "%~dp0"
title Homed - http://localhost:3010 (close this window to stop)
if not exist node_modules (
  echo Installing dependencies, first run only...
  call npm install
)
echo Starting Homed at http://localhost:3010 ...
start "" cmd /c "timeout /t 10 >nul & start http://localhost:3010"
call npm run dev
pause
