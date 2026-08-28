#!/bin/bash
# OPC Multi-Agent Platform - Launcher (Linux/macOS)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  ============================================"
echo "    OPC Multi-Agent Platform - Launcher"
echo "    One Person Company AI Multi-Agent Platform"
echo "  ============================================"
echo ""

# Graceful exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping services...${NC}"
    [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}Done.${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

# ============ Check Python ============
echo -e "${BLUE}[1/4]${NC} Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo -e "  ${RED}[ERROR]${NC} python3 not found. Please install Python 3.9+"
    exit 1
fi
PY_VER=$(python3 --version 2>&1)
echo -e "  ${GREEN}OK:${NC} $PY_VER"

# ============ Install backend dependencies ============
echo -e "${BLUE}[2/4]${NC} Installing backend dependencies..."
cd "$ROOT_DIR/backend"
pip3 install -r requirements.txt -q 2>/dev/null
echo -e "  ${GREEN}OK:${NC} Backend dependencies ready"

# ============ Check/Create .env ============
if [ ! -f ".env" ]; then
    echo -e "${BLUE}[3/4]${NC} Creating config file..."
    cat > .env << 'EOF'
# LLM API Config
# Supported: openai / deepseek / claude / zhipu / xiaomi
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
LLM_API_KEY=your-api-key-here

# Service Config
BACKEND_PORT=8000
FRONTEND_PORT=5173
EOF
    echo -e "  ${GREEN}OK:${NC} Created .env file"
else
    echo -e "${BLUE}[3/4]${NC} Config file exists"
fi

# ============ Start backend ============
echo -e "${BLUE}[4/4]${NC} Starting services..."
echo ""
echo "  Backend API  ->  http://127.0.0.1:8000"
echo "  Frontend UI  ->  http://127.0.0.1:5173"
echo ""

echo -e "${YELLOW}[START]${NC} Backend (port 8000)..."
cd "$ROOT_DIR/backend"
python3 main.py &
BACKEND_PID=$!
sleep 2

# ============ Start frontend ============
cd "$ROOT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[INSTALL]${NC} First run, installing frontend dependencies..."
    npm install --silent 2>/dev/null
    echo -e "  ${GREEN}OK:${NC} Frontend dependencies installed"
fi

echo -e "${YELLOW}[START]${NC} Frontend (port 5173)..."
npx vite --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}All services started!${NC} Open browser: http://127.0.0.1:5173"
echo ""

wait $FRONTEND_PID
cleanup
