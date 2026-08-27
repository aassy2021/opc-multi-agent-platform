# 🏢 OPC Platform — One-Person Company AI Command Center

> **Give a solo founder an AI team.**
> 4 AI Agents + 1 Reviewer + 1 Content Polisher, collaborating across the full project lifecycle — from planning to launch.

[中文文档](README.md)

---

## 📸 Features

| Module | Description |
|--------|-------------|
| 📊 Dashboard | Global stats for projects, tasks, outputs, and agents |
| 📁 Projects | Create projects, 5-phase progress tracking, file outputs |
| 💬 Agent Chat | Multi-turn dialogue with 4 AI Agents, SSE streaming |
| ✍️ Content Polish | 8 writing styles, standalone tool |
| 📋 Task Board | 4-column kanban (To Do / In Progress / Done / Bug Tickets) |
| 📄 Output Hub | Disk file browser + database records |
| 🪑 Round Table | Multi-agent discussion + one-click meeting minutes |
| 📝 Meeting Records | Review and manage past meetings |
| 🐛 Bug Tracker | QA → DEV → QA fix & verify workflow |
| ⚖️ Quality Review | Expert reviewer evaluates from customer perspective (first 3 phases) |
| ⚙️ Settings | API configuration, agent prompt editing |

---

## 🚀 Quick Start

### Requirements
- **Python** 3.9+
- **Node.js** 16+
- **npm** or **pnpm**

### One-Click Launch (Recommended)

**Windows:**
```bat
cd opc-multi-agent
start.bat
```

**Linux / macOS:**
```bash
cd opc-multi-agent
chmod +x start.sh
./start.sh
```

### Manual Launch

**1. Start backend**
```bash
cd backend
pip install -r requirements.txt
python main.py
# Backend runs at http://127.0.0.1:8000
```

**2. Start frontend**
```bash
cd frontend
npm install
npx vite --host 127.0.0.1 --port 5173
# Frontend runs at http://127.0.0.1:5173
```

**3. Open browser**
```
http://127.0.0.1:5173
```

---

## 🤖 AI Agent Team

| Agent | Role | Name | Responsibilities | Phase |
|-------|------|------|-----------------|-------|
| 🎯 Product Manager | PM | **Song Chengyan** | Requirements analysis, PRD, competitor research | Planning |
| 💻 Developer | DEV | **He Yuanbin** | Architecture, coding, tech selection, code review | Development |
| 🧪 QA Engineer | QA | **Meng Qingheng** | Test plans, test cases, bug detection, automation | Testing |
| 📈 Operations | OPS | **Pei Yanzhou** | Growth strategy, content planning, analytics | Launch |

### Supporting Roles

| Tool | Role | Description |
|------|------|-------------|
| ⚖️ Reviewer | **Yu Wangshu** | Reviews plan quality from customer perspective (planning/dev/testing) |
| ✍️ Content Polish | — | 8 styles: Xiaohongshu / Zhihu / WeChat / Douyin / Formal / Casual / Tech / Marketing |

---

## 🔄 Project Workflow

Each project goes through **4 phases**:

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Planning │ ──→ │  Dev     │ ──→ │ Testing  │ ──→ │ Launch   │
│  (PM)    │     │  (DEV)   │     │  (QA)    │     │  (OPS)   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     ▼                ▼                ▼                ▼
 ┌────────┐      ┌────────┐      ┌────────┐      ┌────────┐
 │ 👤 Submit │     │ 👤 Submit │     │ 🐛 Bug  │     │ 👤 Submit │
 │ ⚖️ Review │     │ ⚖️ Review │     │   Gate  │     │(no review)│
 │ 👤 Confirm│     │ 👤 Confirm│     │ ⚖️ Review│     │ 👤 Confirm│
 └────┬───┘      └────┬───┘      └────┬───┘      └────┬───┘
      ▼               ▼               ▼               ▼
 ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
 │  Advance  │     │  Advance  │     │  Advance  │     │ ✅ Done   │
 └─────────┘     └─────────┘     └─────────┘     └─────────┘
```

### Flow Rules
1. **Agent completes work** — Multi-turn dialogue with the assigned Agent
2. **Submit plan** — Save to disk + database
3. **Human review** — Approve or reject (with feedback)
4. **Expert review** (planning/dev/testing) — Reviewer evaluates from customer perspective
5. **User confirms** — Agree with or override the reviewer's opinion
6. **Advance** — Auto-create next phase task + pass context

> 💡 The **launch phase** skips expert review — advance directly after human approval.

### Quality Gates
- ✅ Plan must pass human review
- ✅ Expert review required (planning/dev/testing phases)
- ✅ All bugs must be closed before advancing from testing
- ⚠️ Users can override a failed expert review

---

## 📁 Project Structure

```
opc-multi-agent/
├── backend/                    # Python FastAPI backend
│   ├── main.py                 # Entry + CORS + routes + TTS
│   ├── models/
│   │   └── database.py         # Database init + migrations (7 tables)
│   ├── routers/
│   │   ├── projects.py         # Project CRUD + workflow + review
│   │   ├── agents.py           # Agent management + chat (SSE)
│   │   ├── bugs.py             # Bug ticket CRUD + lifecycle
│   │   ├── conversations.py    # Chat history
│   │   ├── tasks.py            # Task CRUD
│   │   ├── outputs.py          # Output file management
│   │   └── roundtable.py       # Round table + meeting minutes
│   ├── services/
│   │   └── llm_service.py      # Multi-provider LLM support
│   ├── prompts/                # Agent system prompts
│   ├── requirements.txt
│   └── .env.example
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx             # Routes + sidebar
│   │   ├── api/client.js       # API client
│   │   ├── stores/useStore.js  # Zustand state management
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Projects.jsx
│   │   │   ├── AgentChat.jsx   # Core: agent dialogue
│   │   │   ├── Writer.jsx      # Content polish
│   │   │   ├── TaskBoard.jsx   # Kanban board
│   │   │   ├── OutputHub.jsx   # File browser
│   │   │   ├── RoundTable.jsx  # Round table meeting
│   │   │   ├── MeetingRecords.jsx
│   │   │   └── Settings.jsx
│   │   └── components/
│   ├── package.json
│   └── vite.config.js
├── projects/                   # Project file outputs (auto-created)
├── start.bat / start.sh        # One-click launcher
├── .env.example
├── .gitignore
├── README.md                   # Chinese docs
└── README_EN.md                # English docs
```

---

## 🗄️ Database

| Table | Description |
|-------|-------------|
| `projects` | Project info (name, description, phase, creator) |
| `agents` | Agent role config (name, role, prompt) |
| `conversations` | Chat history (per project + agent) |
| `tasks` | Tasks created by agents |
| `outputs` | Output files (disk path + content) |
| `phase_logs` | Phase logs (plan content, review status) |
| `bug_tickets` | Bug tickets (full lifecycle) |
| `reviewer_decisions` | Reviewer decisions (opinion, score, conclusion) |

### Phases
```
planning → developing → testing → launching → launched
```

---

## ⚙️ API Configuration

### Supported LLM Providers

| Provider | Base URL | Model |
|----------|----------|-------|
| 🔵 Xiaomi MiMo | `https://api.xiaomimimo.com/v1` | `mimo-v2.5` |
| 🟢 OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| 🟣 DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 🟠 Claude | (Anthropic API) | `claude-sonnet-4-20250514` |
| 🔴 Zhipu | `https://open.bigmodel.cn/api/paas/v4` | `glm-4` |

### Setup

1. Open the app → ⚙️ Settings → API Configuration
2. Select provider, enter API Key
3. Click "Save" — takes effect immediately

Or via environment variables:
```bash
cp backend/.env.example backend/.env
# Edit .env with your API_KEY and PROVIDER
```

---

## 🐛 Bug Tracker

### Lifecycle

```
QA finds Bug → Create ticket → Auto-assign DEV → DEV fixes → QA verifies → Close
                    ↑                                                │
                    └────────────── Reopen ←─────────────────────────┘
```

### Severity
- 🔴 **Critical** — System crash, data loss
- 🟠 **High** — Core feature unavailable
- 🟡 **Medium** — Feature broken with workaround
- 🟢 **Low** — UX issue, optimization suggestion

---

## 🛠️ Tech Stack

### Backend
- **Python 3.9+** / **FastAPI** / **SQLite + aiosqlite** / **httpx** / **edge-tts**

### Frontend
- **React 18** / **Vite** / **TailwindCSS** / **Zustand** / **React Router 6** / **React Markdown**

### Features
- 🌙 Dark theme
- 📡 SSE streaming output
- 🔄 Multi-turn dialogue with context
- 📂 Disk file outputs (relative paths, portable)
- 👥 Multi-agent collaborative workflow
- ⚖️ Dual quality review gates (first 3 phases)
- 🪑 Round table meeting + meeting minutes
- 🔊 TTS voice playback (multiple voices)
- ⌨️ Input history (up/down arrow keys)

---

## 📋 API Reference

### Projects
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/{id}` | Project details |
| PUT | `/api/projects/{id}` | Update project |
| DELETE | `/api/projects/{id}` | Delete project (creator only) |
| POST | `/api/projects/{id}/advance` | Advance to next phase |

### Review System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/{id}/phase-logs` | Phase logs |
| POST | `/api/projects/{id}/phase-logs` | Submit plan |
| POST | `/api/projects/{id}/phase-logs/{log_id}/review` | Human review |
| POST | `/api/projects/{id}/request-review` | Request expert review |
| POST | `/api/projects/{id}/reviewer-decisions/{id}/respond` | Confirm review |

### Agents
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List agents |
| POST | `/api/agents/chat` | Chat with agent (SSE streaming) |

### Bug Tracker
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bugs` | List bugs |
| POST | `/api/bugs` | Create bug |
| POST | `/api/bugs/{id}/fix` | Mark as fixed |
| POST | `/api/bugs/{id}/verify` | Verify fix |
| POST | `/api/bugs/{id}/reopen` | Reopen bug |

### Round Table
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/roundtable` | Start round table (SSE) |
| POST | `/api/roundtable/summary` | Generate meeting minutes (SSE) |
| GET | `/api/roundtable/history` | Meeting history |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/stats` | Dashboard stats |
| GET/POST | `/api/settings/llm` | LLM config |
| POST | `/api/tts` | TTS synthesis |
| GET | `/api/tts/voices` | Available voices |

---

## ❓ FAQ

**Q: Can I use it without an API key?**
A: Yes. Demo mode returns placeholder responses from all agents while the UI remains fully functional.

**Q: Which LLMs are supported?**
A: OpenAI, DeepSeek, Claude, Zhipu GLM, Xiaomi MiMo, and any OpenAI-compatible API.

**Q: Will I lose my data?**
A: No. SQLite database + disk files persist across sessions. Project files use relative paths and can be migrated as a whole.

**Q: Is multi-user supported?**
A: Currently designed for single-user (solo founder) scenarios. Extend the auth system for multi-user support.

**Q: What if the reviewer rejects my plan?**
A: Two options: (1) Agree and revise the plan; (2) Override the reviewer's opinion and force advancement.

---

## 📄 License

MIT License — Free to use, modify, and distribute.
