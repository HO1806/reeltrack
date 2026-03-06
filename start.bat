@echo off
title ReelTrack Launcher

echo ===================================================
echo Starting ReelTrack Project
echo ===================================================

echo.
echo [1/3] Starting Backend Server (hidden)...
start /B /MIN "" cmd /c "cd /d "%~dp0backend" && node server.js > nul 2>&1"

echo [2/3] Starting AutoRater (hidden)...
start /B /MIN "" cmd /c "cd /d "%~dp0backend" && node autoRater.js > nul 2>&1"

echo [3/3] Starting Frontend Watcher (hidden)...
start /B /MIN "" cmd /c "cd /d "%~dp0" && npm run watch > nul 2>&1"

echo.
echo ===================================================
echo All ReelTrack components launched (hidden).
echo XAMPP must be started manually.
echo Close this window to stop all background processes.
echo ===================================================
pause
