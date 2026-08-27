# 🏢 OPC Platform — One-Person Company AI Command Center

> **让一个人也能拥有一支 AI 团队。**
> 4 个 AI Agent 各司其职 + 1 个审核专家把关质量 + 1 个内容润色工具，从策划、开发、测试到运营，全流程协作完成项目。

---

## 📸 功能概览

| 功能模块 | 说明 |
|---------|------|
| 📊 仪表盘 | 项目/任务/产出/Agent 全局统计 |
| 📁 项目管理 | 创建项目、5 阶段进度追踪、文件输出 |
| 💬 Agent 对话 | 与 4 个 AI Agent 多轮对话，SSE 流式输出 |
| ✍️ 内容润色 | 8 种风格一键切换，独立工具 |
| 📋 任务看板 | 4 列看板（待办/进行中/已完成/Bug工单） |
| 📄 产出中心 | 磁盘文件浏览 + 数据库记录 |
| 🪑 圆桌会议 | 多 Agent 圆桌讨论 + 一键生成会议纪要 |
| 📝 会议记录 | 历史会议回顾与管理 |
| 🐛 Bug 工单 | QA→DEV→QA 完整修复验证流程 |
| ⚖️ 质量审核 | 审核专家从客户角度评审（前 3 阶段） |
| ⚙️ 设置 | API 配置、Agent Prompt 编辑 |

---

## 🚀 快速开始

### 环境要求
- **Python** 3.9+
- **Node.js** 16+
- **npm** 或 **pnpm**

### 一键启动（推荐）

**Windows：**
```bat
cd opc-multi-agent
start.bat
```

**Linux / macOS：**
```bash
cd opc-multi-agent
chmod +x start.sh
./start.sh
```

### 手动启动

**1. 启动后端**
```bash
cd backend
pip install -r requirements.txt
python main.py
# 后端运行在 http://127.0.0.1:8000
```

**2. 启动前端**
```bash
cd frontend
npm install
npx vite --host 127.0.0.1 --port 5173
# 前端运行在 http://127.0.0.1:5173
```

**3. 打开浏览器**
```
http://127.0.0.1:5173
```

---

## 🤖 AI Agent 团队

| Agent | 角色 | 姓名 | 职责 | 阶段 |
|-------|------|------|------|------|
| 🎯 产品经理 | PM | **宋承言** | 需求分析、PRD 撰写、竞品调研、功能拆解 | 策划 |
| 💻 开发工程师 | DEV | **贺元彬** | 架构设计、代码开发、技术选型、代码审查 | 开发 |
| 🧪 测试工程师 | QA | **孟清衡** | 测试计划、用例编写、Bug 检测、自动化测试 | 测试 |
| 📈 运营专家 | OPS | **裴衍舟** | 增长策略、内容策划、数据分析、渠道运营 | 上线 |

### 辅助角色

| 工具 | 角色 | 说明 |
|------|------|------|
| ⚖️ 审核专家 | **俞望舒** | 从客户角度评审方案质量（策划/开发/测试阶段） |
| ✍️ 内容润色 | — | 8 种风格改写：小红书/知乎/公众号/抖音/正式/轻松/技术/营销 |

---

## 🔄 项目工作流

每个项目经历 **4 个阶段**，流程如下：

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  策划中   │ ──→ │  开发中   │ ──→ │  测试中   │ ──→ │  上线中   │
│  宋承言   │     │  贺元彬   │     │  孟清衡   │     │  裴衍舟   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     ▼                ▼                ▼                ▼
 ┌────────┐      ┌────────┐      ┌────────┐      ┌────────┐
 │ 👤 提交  │      │ 👤 提交  │      │ 🐛 Bug │      │ 👤 提交  │
 │ ⚖️ 审核  │      │ ⚖️ 审核  │      │   门禁  │      │ (无需审核)│
 │ 👤 确认  │      │ 👤 确认  │      │ ⚖️ 审核  │      │ 👤 确认  │
 └────┬───┘      └────┬───┘      └────┬───┘      └────┬───┘
      ▼               ▼               ▼               ▼
 ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
 │ 🔄 流转   │     │ 🔄 流转   │     │ 🔄 流转   │     │ ✅ 已上线  │
 └─────────┘     └─────────┘     └─────────┘     └─────────┘
```

### 流转规则
1. **Agent 完成工作** — 与对应 Agent 多轮对话完成本阶段任务
2. **提交方案** — 点击「📝 提交审核」，方案保存到磁盘 + 数据库
3. **人工审核** — 用户审核方案，通过/拒绝（拒绝需填写修改意见）
4. **审核专家评审**（策划/开发/测试阶段）— 俞望舒从客户角度严格评审
5. **用户确认** — 查看审核专家意见，「同意」或「覆盖」
6. **流转** — 自动创建下一阶段任务 + 传递上下文

> 💡 **运营阶段**无需审核专家评审，人工审核通过后可直接流转到「已完成」。

### 质量门禁
- ✅ 方案必须通过人工审核
- ✅ 审核专家必须完成评审（策划/开发/测试阶段）
- ✅ 测试阶段 Bug 必须全部关闭
- ⚠️ 审核专家不通过时，用户可以选择「覆盖」强制流转

---

## 📁 项目结构

```
opc-multi-agent/
├── backend/                    # Python FastAPI 后端
│   ├── main.py                 # 入口 + CORS + 路由注册 + TTS
│   ├── models/
│   │   └── database.py         # 数据库初始化 + 迁移（7 张表）
│   ├── routers/
│   │   ├── projects.py         # 项目 CRUD + 工作流流转 + 审核
│   │   ├── agents.py           # Agent 管理 + 对话（SSE 流式）
│   │   ├── bugs.py             # Bug 工单 CRUD + 状态流转
│   │   ├── conversations.py    # 对话历史
│   │   ├── tasks.py            # 任务 CRUD
│   │   ├── outputs.py          # 产出文件管理
│   │   └── roundtable.py       # 圆桌会议 + 会议纪要
│   ├── services/
│   │   └── llm_service.py      # 多 LLM 提供商支持
│   ├── prompts/                # Agent 系统提示词
│   │   ├── pm/pm_system.md
│   │   ├── dev/dev_system.md
│   │   ├── qa/qa_system.md
│   │   ├── ops/ops_system.md
│   │   ├── reviewer/reviewer_system.md
│   │   └── writer/writer_system.md
│   ├── requirements.txt
│   └── .env.example
├── frontend/                   # React + Vite 前端
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx             # 路由 + 侧边栏
│   │   ├── api/client.js       # API 客户端
│   │   ├── stores/useStore.js  # Zustand 全局状态
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx   # 仪表盘
│   │   │   ├── Projects.jsx    # 项目管理
│   │   │   ├── AgentChat.jsx   # Agent 对话（核心）
│   │   │   ├── Writer.jsx      # 内容润色
│   │   │   ├── TaskBoard.jsx   # 任务看板
│   │   │   ├── OutputHub.jsx   # 产出中心
│   │   │   ├── RoundTable.jsx  # 圆桌会议
│   │   │   ├── MeetingRecords.jsx  # 会议记录
│   │   │   └── Settings.jsx    # 设置
│   │   ├── components/
│   │   │   ├── ProductGuide.jsx
│   │   │   └── NotificationCenter.jsx
│   │   └── styles/index.css    # 暗色主题
│   ├── package.json
│   └── vite.config.js
├── projects/                   # 项目文件输出目录（自动创建）
├── start.bat                   # Windows 一键启动
├── start.sh                    # Linux/macOS 一键启动
├── .env.example                # 环境变量模板
├── .gitignore
└── README.md
```

---

## 🗄️ 数据库设计

| 表名 | 说明 |
|------|------|
| `projects` | 项目信息（名称、描述、阶段、创建人） |
| `agents` | Agent 角色配置（名称、角色、提示词） |
| `conversations` | 对话历史（项目 + Agent 维度） |
| `tasks` | 任务（Agent 产出的任务） |
| `outputs` | 产出文件（磁盘路径 + 内容） |
| `phase_logs` | 阶段日志（方案内容、审核状态） |
| `bug_tickets` | Bug 工单（完整生命周期） |
| `reviewer_decisions` | 审核专家决定（评审意见、评分、结论） |

### 项目阶段
```
planning(策划) → developing(开发) → testing(测试) → launching(上线) → launched(已上线)
```

---

## ⚙️ API 配置

### 支持的 LLM 提供商

| 提供商 | Base URL | 推荐模型 |
|--------|----------|----------|
| 🔵 小米 MiMo | `https://api.xiaomimimo.com/v1` | `mimo-v2.5` |
| 🟢 OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| 🟣 DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 🟠 Claude | (Anthropic API) | `claude-sonnet-4-20250514` |
| 🔴 智谱 | `https://open.bigmodel.cn/api/paas/v4` | `glm-4` |

### 配置方式

1. 打开前端 → ⚙️ 设置 → API 配置
2. 选择 Provider，填入 API Key
3. 点击「💾 保存配置」，立即生效无需重启

或通过环境变量：
```bash
cp backend/.env.example backend/.env
# 编辑 .env 填入 API_KEY 和 PROVIDER
```

---

## 🐛 Bug 工单系统

### 生命周期

```
QA 发现 Bug → 提交工单 → 自动指派 DEV → DEV 修复 → QA 验证 → 关闭
                    ↑                                          │
                    └──────────── 重新打开 ←───────────────────┘
```

### 严重程度
- 🔴 **致命 (critical)** — 系统崩溃、数据丢失
- 🟠 **高 (high)** — 核心功能不可用
- 🟡 **中 (medium)** — 功能异常但有 workaround
- 🟢 **低 (low)** — 体验问题、优化建议

### 质量门禁
测试阶段流转前，系统自动检查是否有未关闭的 Bug，有则禁止流转。

---

## 🛠️ 技术栈

### 后端
- **Python 3.9+**
- **FastAPI** — 高性能异步 Web 框架
- **SQLite + aiosqlite** — 零配置数据库
- **Pydantic** — 数据验证
- **httpx** — 异步 HTTP 客户端（调用 LLM API）
- **edge-tts** — 微软 TTS 语音合成

### 前端
- **React 18** — UI 框架
- **Vite** — 构建工具
- **TailwindCSS** — 原子化 CSS
- **Zustand** — 轻量状态管理
- **React Router 6** — 路由
- **React Markdown** — Markdown 渲染

### 特性
- 🌙 暗色主题
- 📡 SSE 流式输出
- 🔄 多轮对话 + 上下文关联
- 📂 磁盘文件输出（相对路径，可迁移）
- 👥 多 Agent 协作工作流
- ⚖️ 双重质量审核门禁（前 3 阶段）
- 🪑 圆桌会议 + 会议纪要
- 🔊 TTS 语音播报（多音色选择）
- ⌨️ 输入历史（上下键翻阅）

---

## 📋 API 接口一览

### 项目管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/{id}` | 项目详情 |
| PUT | `/api/projects/{id}` | 更新项目 |
| DELETE | `/api/projects/{id}` | 删除项目（仅创建人） |
| POST | `/api/projects/{id}/advance` | 流转到下一阶段 |
| POST | `/api/projects/{id}/phase` | 手动切换阶段 |

### 审核系统
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/{id}/phase-logs` | 阶段日志 |
| POST | `/api/projects/{id}/phase-logs` | 提交方案 |
| POST | `/api/projects/{id}/phase-logs/{log_id}/review` | 人工审核 |
| GET | `/api/projects/{id}/reviewer-decisions` | 审核专家决定 |
| POST | `/api/projects/{id}/request-review` | 请求审核专家评审 |
| POST | `/api/projects/{id}/reviewer-decisions/{id}/respond` | 确认审核意见 |

### Agent 对话
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents` | Agent 列表 |
| POST | `/api/agents/chat` | Agent 对话（SSE 流式） |

### Bug 工单
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bugs` | Bug 列表 |
| POST | `/api/bugs` | 创建 Bug |
| POST | `/api/bugs/{id}/fix` | 标记修复 |
| POST | `/api/bugs/{id}/verify` | 验证通过 |
| POST | `/api/bugs/{id}/reopen` | 重新打开 |

### 圆桌会议
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/roundtable` | 发起圆桌会议（SSE） |
| POST | `/api/roundtable/summary` | 一键生成会议纪要（SSE） |
| GET | `/api/roundtable/history` | 历史会议记录 |

### 其他
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard/stats` | 仪表盘统计 |
| GET/POST | `/api/settings/llm` | LLM 配置读写 |
| POST | `/api/tts` | TTS 语音合成 |
| GET | `/api/tts/voices` | 可用语音列表 |

---

## 🎯 使用指南

### 第一次使用

1. **配置 API Key** — 设置 → API 配置 → 选择提供商 → 填入 Key → 保存
2. **创建项目** — 项目 → 新建项目 → 填写名称和描述
3. **开始策划** — 进入对话 → 与产品经理(宋承言)沟通需求
4. **提交方案** — 满意后点击「📝 提交审核」→ 人工审核通过
5. **请求审核** — 点击「⚖️ 请求审核」→ 等待俞望舒评审
6. **确认流转** — 查看评审结果 → 同意/覆盖 → 点击「流转到下一步」
7. **重复流程** — 开发 → 测试（含 Bug 修复）→ 上线运营

---

## 🔧 开发指南

### 本地开发

```bash
# 后端热重载
cd backend
uvicorn main:app --reload --port 8000

# 前端热重载
cd frontend
npx vite --port 5173
```

### 数据库
- SQLite 自动创建：`backend/opc.db`
- 启动时自动迁移（添加新表/字段）
- 删除 `opc.db` 重启即可重置

---

## ❓ FAQ

**Q: 没有 API Key 能用吗？**
A: 可以。Demo 模式下所有 Agent 都会返回提示信息，UI 功能完整可用。

**Q: 支持哪些 LLM？**
A: 支持 OpenAI、DeepSeek、Claude、智谱 GLM、小米 MiMo，以及所有 OpenAI 兼容 API。

**Q: 数据会丢失吗？**
A: SQLite 数据库文件 + 磁盘项目文件，关闭浏览器不丢失。项目文件使用相对路径，可整体迁移。

**Q: 可以多人使用吗？**
A: 当前为单用户设计（一人公司场景），多用户需自行扩展用户系统。

**Q: 审核专家不通过怎么办？**
A: 两种选择：(1) 同意其意见，返回修改方案；(2) 覆盖其意见，强制流转。

---

## 📄 License

MIT License — 自由使用、修改、分发。
