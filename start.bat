@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not in PATH.
  echo Please install Node.js first, then run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting Phottix Customer Agent...
start "Phottix Customer Agent Server" cmd /k call "%~dp0run-server.bat"
timeout /t 4 /nobreak >nul
start "" http://127.0.0.1:8787/
