@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  npm install
)

echo Starting Phottix Customer Agent...
start "" http://127.0.0.1:8787/
npm start
