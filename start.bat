@echo off
chcp 65001 >nul 2>&1
title OPC Multi-Agent Platform

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   🏢 OPC Multi-Agent Platform  启动器       ║
echo  ║   一人公司 AI 多Agent协作平台                ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: 获取脚本所在目录
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

:: ============ 检查 Python ============
echo [1/4] 检查 Python 环境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [错误] 未找到 Python，请先安装 Python 3.9+
    echo   下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PY_VER=%%i
echo   ✓ %PY_VER%

:: ============ 安装后端依赖 ============
echo [2/4] 安装后端依赖...
cd /d "%ROOT_DIR%backend"
pip install -r requirements.txt -q 2>nul
if %errorlevel% neq 0 (
    echo   [提示] 依赖安装可能不完整，尝试继续...
)
echo   ✓ 后端依赖就绪

:: ============ 检查/创建 .env ============
if not exist ".env" (
    echo [3/4] 创建配置文件...
    (
        echo # LLM API 配置
        echo # 支持: openai / deepseek / claude / zhipu
        echo LLM_PROVIDER=deepseek
        echo LLM_MODEL=deepseek-chat
        echo LLM_API_KEY=your-api-key-here
        echo.
        echo # 服务配置
        echo BACKEND_PORT=8000
        echo FRONTEND_PORT=5173
    ) > .env
    echo   ✓ 已创建 .env 文件，请在启动后前往「设置」页面配置 API Key
) else (
    echo [3/4] 配置文件已存在
)

:: ============ 启动后端 ============
echo [4/4] 启动服务...
echo.
echo   ┌─────────────────────────────────────┐
echo   │  后端 API  →  http://127.0.0.1:8000 │
echo   │  前端界面  →  http://127.0.0.1:5173 │
echo   │                                     │
echo   │  按 Ctrl+C 停止服务                 │
echo   └─────────────────────────────────────┘
echo.

:: 启动后端（后台）
echo [启动] 后端服务 (端口 8000)...
start "OPC-Backend" /min /d "%ROOT_DIR%backend" python main.py

:: 等后端启动
timeout /t 2 /nobreak >nul

:: 启动前端
echo [启动] 前端服务 (端口 5173)...
cd /d "%ROOT_DIR%frontend"

:: 检查 node_modules
if not exist "node_modules" (
    echo [安装] 首次运行，安装前端依赖...
    call npm install --silent 2>nul
    echo   ✓ 前端依赖安装完成
)

:: 启动 Vite 开发服务器
echo.
echo ✅ 所有服务已启动！浏览器访问 http://127.0.0.1:5173
echo.
npx vite --host 127.0.0.1 --port 5173

:: 前端关闭后也关掉后端
echo.
echo 正在关闭后端服务...
taskkill /fi "WINDOWTITLE eq OPC-Backend" /t /f >nul 2>&1
echo 已退出。
