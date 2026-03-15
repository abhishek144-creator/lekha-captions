@echo off
cd /d "%~dp0"
cls
echo ===================================================
echo   CAPTION STUDIO DIAGNOSTIC LAUNCHER
echo ===================================================
echo.

:: 1. Check Python
echo [Checking Python...]
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo CRITICAL ERROR: Python is not installed or not in your PATH.
    echo Please install Python from python.org (checked "Add to PATH" during install).
    pause
    exit
)
echo Python is Ready.

:: 2. Check Node.js
echo.
echo [Checking Node.js...]
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo CRITICAL ERROR: Node.js is not installed or not in your PATH.
    echo Please install Node.js from nodejs.org (LTS version).
    pause
    exit
)
echo Node.js is Ready.

:: 3. Check/Install Python Dependencies
echo.
echo [Checking Python Libraries...]
pip install uvicorn fastapi python-multipart
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Python libraries. 
    echo Please check your internet connection.
    pause
)

:: 4. Check/Install Node Dependencies
echo.
echo [Checking Website Libraries...]
if not exist "node_modules" (
    echo "node_modules" folder not found. installing dependencies...
    echo This might take a few minutes...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: npm install failed.
        pause
        exit
    )
) else (
    echo Website libraries found.
)

:: 5. Launch
echo.
echo [Starting Servers...]
echo.
echo 1. Launching Backend (Black Window 1)...
start "Caption Studio Backend" cmd /k "cd /d "%~dp0" && python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 2 >nul

echo 2. Launching Frontend (Black Window 2)...
start "Caption Studio Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo ===================================================
echo   ALL SYSTEMS GO!
echo ===================================================
echo.
echo The website should open automatically in 15 seconds.
echo If it doesn't, allow your firewall/antivirus if asked.
echo.
echo Waiting...

timeout /t 15

start http://localhost:5000

echo.
echo If the page says "Refused to connect", wait a bit longer and refresh.
echo.
pause
