@echo off
setlocal
cd /d "%~dp0"

echo.
echo Phottix Customer Agent
echo ----------------------
echo.
echo Starting local server...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not available in PATH.
  echo Please install Node.js from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo Open this link in your browser:
echo http://127.0.0.1:8787/
echo.

netstat -ano | findstr /R /C:"127\.0\.0\.1:8787 .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo The local server already seems to be running.
  echo Opening browser now...
  echo.
  start "" "http://127.0.0.1:8787/"
  pause
  exit /b 0
)

echo Opening server window...
start "Phottix Customer Agent Server" "%~dp0run-server.bat"
echo.

echo Waiting 2 seconds before opening browser...
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8787/"

echo.
echo If the page does not load, check the server window.
echo It must show: Phottix local fetch server listening on http://127.0.0.1:8787
pause
