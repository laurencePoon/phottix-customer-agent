@echo off
setlocal
cd /d "%~dp0"

echo Phottix Customer Agent Server
echo -----------------------------
echo.
echo Keep this window open while using the app.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not available in PATH.
  echo Please install Node.js from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

node server.js

echo.
echo Server stopped. Press any key to close.
pause
