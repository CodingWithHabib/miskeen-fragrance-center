@echo off
REM Miskeen Fragrance Center - Local Development Server Startup
REM This script starts a Python HTTP server on port 8000

echo.
echo ════════════════════════════════════════════════════════
echo  MISKEEN FRAGRANCE CENTER — Local Dev Server
echo ════════════════════════════════════════════════════════
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Python is not installed or not in PATH
    echo.
    echo Please install Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo ✅ Python found!
echo.
echo 🚀 Starting development server on port 8000...
echo.
echo Open in browser: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.
echo ════════════════════════════════════════════════════════
echo.

python -m http.server 8000

pause