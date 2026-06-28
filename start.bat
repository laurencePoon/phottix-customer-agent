@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  npm install
)

echo Starting Phottix Customer Agent...
start "Phottix Customer Agent Server" cmd /k npm start
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8787/
