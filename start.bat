@echo off
chcp 65001 >nul 2>&1
title OPC Multi-Agent Platform

echo.
echo  ============================================
echo    OPC Multi-Agent Platform - Launcher
echo    One Person Company AI Multi-Agent Platform
echo  ============================================
echo.

:: Get script directory
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

:: ============ Check Python ============
echo [1/4] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Python not found. Please install Python 3.9+
    echo   Download: https://www.python.org/downloads/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PY_VER=%%i
echo   OK: %PY_VER%

:: ============ Install backend dependencies ============
echo [2/4] Installing backend dependencies...
cd /d "%ROOT_DIR%backend"
pip install -r requirements.txt -q 2>nul
if %errorlevel% neq 0 (
    echo   [WARN] Dependencies may be incomplete, continuing...
)
echo   OK: Backend dependencies ready

:: ============ Check/Create .env ============
if not exist ".env" (
    echo [3/4] Creating config file...
    (
        echo # LLM API Config
        echo # Supported: openai / deepseek / claude / zhipu / xiaomi
        echo LLM_PROVIDER=deepseek
        echo LLM_MODEL=deepseek-chat
        echo LLM_API_KEY=your-api-key-here
        echo.
        echo # Service Config
        echo BACKEND_PORT=8000
        echo FRONTEND_PORT=5173
    ) > .env
    echo   OK: Created .env file. Configure API Key in Settings page after startup.
) else (
    echo [3/4] Config file exists
)

:: ============ Start services ============
echo [4/4] Starting services...
echo.
echo   Backend API  ->  http://127.0.0.1:8000
echo   Frontend UI  ->  http://127.0.0.1:5173
echo.
echo   Press Ctrl+C to stop services
echo.

:: Start backend (background)
echo [START] Backend (port 8000)...
start "OPC-Backend" /min /d "%ROOT_DIR%backend" python main.py

:: Wait for backend
timeout /t 2 /nobreak >nul

:: Start frontend
echo [START] Frontend (port 5173)...
cd /d "%ROOT_DIR%frontend"

:: Check node_modules
if not exist "node_modules" (
    echo [INSTALL] First run, installing frontend dependencies...
    call npm install --silent 2>nul
    echo   OK: Frontend dependencies installed
)

:: Start Vite dev server
echo.
echo All services started! Open browser: http://127.0.0.1:5173
echo.
npx vite --host 127.0.0.1 --port 5173

:: Frontend closed -> kill backend
echo.
echo Shutting down backend...
taskkill /fi "WINDOWTITLE eq OPC-Backend" /t /f >nul 2>&1
echo Done.
