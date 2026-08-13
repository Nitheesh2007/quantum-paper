@echo off
title Quantum Fest 2K26 Portal Server
cd /d "%~dp0"

echo ====================================================
echo   QUANTUM FEST 2K26 - PAPER PRESENTATION PORTAL
echo ====================================================
echo.

if not exist "node_modules" (
    echo [1/3] Installing dependencies...
    call npm install
    echo.
)

echo [2/3] Starting backend server on port 5000...
start "" "http://localhost:5000"
echo.
echo [3/3] Server output:
echo ----------------------------------------------------
node server/server.js

pause
