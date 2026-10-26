@echo off
title Aura Music Launcher
cd /d "%~dp0"

echo ==============================================
echo       MEMULAI AURA MUSIC TUI & SERVER
echo ==============================================
echo.

echo Menjalankan Backend Server (Port 3001)...
start "Aura Backend Server" cmd /k "cd /d ""%~dp0"" && node server/index.js"

echo Menjalankan Frontend Dev Server (Vite)...
start "Aura Frontend (Vite)" cmd /k "cd /d ""%~dp0"" && npm run dev"

echo.
echo Kedua service sudah dibuka di jendela terpisah!
echo Buka browser kamu di: http://localhost:5173
echo.
pause
