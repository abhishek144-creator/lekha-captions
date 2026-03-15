@echo off
cd /d "%~dp0"
echo ===================================================
echo   Starting Caption Studio...
echo ===================================================

echo [1/3] Checking Python dependencies...
python -m pip install -r backend/requirements.txt
python -m pip install uvicorn fastapi python-multipart

echo.
echo [2/3] Starting Backend Server...
start "Caption Studio Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo.
echo [3/3] Starting Frontend Server...
echo (You might need to run 'npm install' manually if this fails the first time)
start "Caption Studio Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo ===================================================
echo   Application is launching!
echo ===================================================
echo.
echo 1. Wait for the Frontend window to say:
echo    "Local: http://localhost:5000"
echo.
echo 2. Opening your browser to:
echo    http://localhost:5000
echo.
timeout /t 10
start http://localhost:5000
pause
