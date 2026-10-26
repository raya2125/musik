@echo off
title AURA Music Studio Launcher
cd /d "%~dp0"

:: Check if backend is already running on port 3001
netstat -ano | findstr ":3001" >nul
if %errorlevel% neq 0 (
    start /b "" node server/index.js
)

:: Check if Vite is already running on port 5173
netstat -ano | findstr ":5173" >nul
if %errorlevel% neq 0 (
    start /b "" cmd /c "npm run dev"
    timeout /t 2 /nobreak >nul
)

:: Open as a Standalone Native Borderless Application Window (no URL bar / browser tabs)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:5173 --window-size=1360,860
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:5173 --window-size=1360,860
) else (
    start http://localhost:5173
)
