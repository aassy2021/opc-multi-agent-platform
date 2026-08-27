#!/bin/bash
# OPC Multi-Agent Platform - 快速启动脚本 (Linux/macOS)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo -e "${PURPLE}  ╔══════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}  ║   🏢 OPC Multi-Agent Platform  启动器       ║${NC}"
echo -e "${PURPLE}  ║   一人公司 AI 多Agent协作平台                ║${NC}"
echo -e "${PURPLE}  ╚══════════════════════════════════════════════╝${NC}"
echo ""

# 优雅退出
cleanup() {
    echo ""
    echo -e "${YELLOW}正在停止服务...${NC}"
    [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}已退出。${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

# ============ 检查 Python ============
echo -e "${BLUE}[1/4]${NC} 检查 Python 环境..."
if ! command -v python3 &> /dev/null; then
    echo -e "  ${RED}[错误]${NC} 未找到 python3，请先安装 Python 3.9+"
    exit 1
fi
PY_VER=$(python3 --version 2>&1)
echo -e "  ${GREEN}✓${NC} $PY_VER"

# ============ 安装后端依赖 ============
echo -e "${BLUE}[2/4]${NC} 安装后端依赖..."
cd "$ROOT_DIR/backend"
pip3 install -r requirements.txt -q 2>/dev/null
echo -e "  ${GREEN}✓${NC} 后端依赖就绪"

# ============ 检查/创建 .env ============
if [ ! -f ".env" ]; then
    echo -e "${BLUE}[3/4]${NC} 创建配置文件..."
    cat > .env << 'EOF'
# LLM API 配置
# 支持: openai / deepseek / claude / zhipu
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
LLM_API_KEY=your-api-key-here

# 服务配置
BACKEND_PORT=8000
FRONTEND_PORT=5173
EOF
    echo -e "  ${GREEN}✓${NC} 已创建 .env 文件"
else
    echo -e "${BLUE}[3/4]${NC} 配置文件已存在"
fi

# ============ 启动后端 ============
echo -e "${BLUE}[4/4]${NC} 启动服务..."
echo ""
echo -e "  ┌─────────────────────────────────────┐"
echo -e "  │  后端 API  →  ${GREEN}http://127.0.0.1:8000${NC}  │"
echo -e "  │  前端界面  →  ${GREEN}http://127.0.0.1:5173${NC}  │"
echo -e "  │                                     │"
echo -e "  │  按 ${RED}Ctrl+C${NC} 停止服务               │"
echo -e "  └─────────────────────────────────────┘"
echo ""

echo -e "${YELLOW}[启动]${NC} 后端服务 (端口 8000)..."
cd "$ROOT_DIR/backend"
python3 main.py &
BACKEND_PID=$!
sleep 2

# ============ 启动前端 ============
cd "$ROOT_DIR/frontend"

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[安装]${NC} 首次运行，安装前端依赖..."
    npm install --silent 2>/dev/null
    echo -e "  ${GREEN}✓${NC} 前端依赖安装完成"
fi

echo -e "${YELLOW}[启动]${NC} 前端服务 (端口 5173)..."
npx vite --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}✅ 所有服务已启动！${NC} 浏览器访问 ${BLUE}http://127.0.0.1:5173${NC}"
echo ""

# 等待任一进程退出
wait $FRONTEND_PID
cleanup
