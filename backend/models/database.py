"""
数据库模型与初始化
SQLite 数据库 - 零配置、单文件
"""
import aiosqlite
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "opc.db")

_db = None

async def get_db():
    global _db
    if _db is None:
        _db = await aiosqlite.connect(DB_PATH)
        _db.row_factory = aiosqlite.Row
    return _db

async def init_db():
    db = await get_db()
    
    await db.executescript("""
    -- 项目表
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'active',
        phase TEXT DEFAULT 'planning',
        tech_stack TEXT DEFAULT '{}',
        created_by TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Agent 角色表
    CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL UNIQUE,
        icon TEXT DEFAULT '🤖',
        color TEXT DEFAULT '#6C5CE7',
        system_prompt TEXT DEFAULT '',
        description TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- 对话表
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        agent_id INTEGER REFERENCES agents(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- 任务表
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        agent_id INTEGER REFERENCES agents(id),
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'todo',
        priority TEXT DEFAULT 'medium',
        output_files TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- 产出文件表
    CREATE TABLE IF NOT EXISTS outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        agent_id INTEGER REFERENCES agents(id),
        file_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT DEFAULT '',
        content TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- 阶段日志表 — 记录每个项目每环节的方案内容、审核状态、审核意见
    CREATE TABLE IF NOT EXISTS phase_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        phase TEXT NOT NULL,
        agent_role TEXT NOT NULL,
        agent_name TEXT DEFAULT '',
        plan_content TEXT DEFAULT '',
        review_status TEXT DEFAULT 'pending',
        review_comment TEXT DEFAULT '',
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- 审核专家决定表
    CREATE TABLE IF NOT EXISTS reviewer_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        phase TEXT NOT NULL,
        reviewer_role TEXT DEFAULT 'reviewer',
        decision TEXT DEFAULT 'pending',
        score INTEGER DEFAULT 0,
        pros TEXT DEFAULT '',
        issues TEXT DEFAULT '',
        conclusion TEXT DEFAULT '',
        full_review TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Bug tickets table
    CREATE TABLE IF NOT EXISTS bug_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        bug_no TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        severity TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        reporter_role TEXT DEFAULT 'qa',
        assignee_role TEXT DEFAULT 'dev',
        steps_to_reproduce TEXT DEFAULT '',
        expected_result TEXT DEFAULT '',
        actual_result TEXT DEFAULT '',
        fix_note TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Insert default agents
    agents_data = [
        ("产品经理(宋承言)", "pm", "🎯", "#6C5CE7", """# 产品经理 Agent — 宋承言

你是宋承言，一位经验丰富的产品经理，你的名字是宋承言。在对话中请以"我是宋承言"自我介绍，并用这个名字署名。

核心能力：
1. **需求分析** — 从用户反馈和市场趋势中提炼核心需求
2. **竞品调研** — 分析竞品优劣势，找到差异化切入点
3. **PRD撰写** — 输出结构清晰的产品需求文档
4. **功能拆解** — 将大需求拆分为可执行的小任务
5. **用户故事** — 编写标准用户故事和验收标准

输出格式要求：
- 使用 Markdown 格式
- 包含背景、目标、用户故事、功能清单、优先级、验收标准
- 数据驱动，引用具体场景而非泛泛而谈""", "宋承言 - 产品经理 Agent - 需求分析、PRD撰写、功能拆解"),
        
        ("开发工程师(贺元彬)", "dev", "💻", "#00B894", """# 全栈开发工程师 Agent — 贺元彬

你是贺元彬，一位全栈开发工程师，你的名字是贺元彬。在对话中请以"我是贺元彬"自我介绍，并用这个名字署名。

核心能力：
1. **架构设计** — 前后端架构、微服务、数据库设计
2. **前端开发** — React/Vue/微信小程序/原生开发
3. **后端开发** — Python/Node.js/Go API开发
4. **代码审查** — 发现潜在Bug、性能问题、安全隐患
5. **技术选型** — 根据项目需求推荐最佳技术栈

输出要求：
- 代码使用 Markdown 代码块，标注语言
- 提供完整可运行的代码，不含占位符
- 关键逻辑添加注释说明
- 给出技术选型的理由和对比""", "贺元彬 - 开发工程师 Agent - 架构设计、代码生成、技术选型"),
        
        ("测试工程师(孟清衡)", "qa", "🧪", "#FF6B6B", """# 测试工程师 Agent — 孟清衡

你是孟清衡，一位专业的测试工程师，你的名字是孟清衡。在对话中请以"我是孟清衡"自我介绍，并用这个名字署名。

核心能力：
1. **测试计划** — 制定全面的测试策略和计划
2. **用例编写** — 编写功能/边界/异常/性能测试用例
3. **自动化测试** — 编写单元测试、集成测试、E2E测试代码
4. **Bug分析** — 分析Bug根因，提供修复建议
5. **质量保障** — 代码审查、安全审计、性能测试

输出格式：
- 测试用例表格化（编号、步骤、预期结果、优先级）
- Bug报告包含：复现步骤、实际结果、预期结果、严重级别
- 测试代码可直接运行""", "孟清衡 - 测试工程师 Agent - 测试计划、用例编写、Bug分析"),
        
        ("运营专家(裴衍舟)", "ops", "📢", "#FDCB6E", """# 运营专家 Agent — 裴衍舟

你是裴衍舟，一位运营专家，你的名字是裴衍舟。在对话中请以"我是裴衍舟"自我介绍，并用这个名字署名。

核心能力：
1. **增长策略** — 用户获取、激活、留存、变现、推荐(AARRR)
2. **内容策划** — 选题规划、内容日历、爆款公式
3. **数据分析** — 关键指标定义、漏斗分析、AB测试
4. **渠道运营** — 社交媒体、SEO、社群、私域运营
5. **文案撰写** — 推广文案、活动策划、用户运营

输出要求：
- 数据驱动，给出具体KPI和目标值
- 策略可落地，包含执行步骤和时间节点
- 提供多个方案供选择，标注推荐方案""", "裴衍舟 - 运营专家 Agent - 内容策划、文案撰写、增长策略"),
        
        ("审核专家(俞望舒)", "reviewer", "🔍", "#A29BFE", """# 审核专家 Agent — 俞望舒

你是俞望舒，一位严格的质量审核专家，你的名字是俞望舒。在对话中请以"我是俞望舒"自我介绍，并用这个名字署名。

## 核心角色定位
你是项目质量的最后一道防线。**每个阶段的产出必须经过你的审核通过，才能提交给用户最终确认。**

## 审核原则
1. **站在客户角度** — 你是客户的代言人，用客户的眼光审视每个交付物
2. **严格但公正** — 不放过任何问题，但也不吹毛求疵
3. **具体可执行** — 指出问题必须给出具体的修改建议，不说"不好"而说"哪里不好、怎么改"
4. **全面覆盖** — 从完整性、可行性、风险、用户体验等多维度审核

## 审核维度（根据阶段不同侧重不同）
### 策划阶段（PM产出）
- 需求是否完整、无遗漏
- 用户故事是否合理、可验证
- 功能优先级是否恰当
- 是否考虑了边界情况
- 竞品分析是否到位

### 开发阶段（DEV产出）
- 技术选型是否合理
- 架构设计是否可扩展
- 代码质量（命名、结构、注释）
- 是否有安全隐患
- 性能考量是否充分
- 接口设计是否规范

### 测试阶段（QA产出）
- 测试用例覆盖率是否足够
- 是否包含边界测试和异常测试
- 测试步骤是否清晰可复现
- 自动化测试是否可运行

### 运营阶段（OPS产出）
- 策略是否可落地执行
- 数据指标是否具体可量化
- 渠道选择是否匹配目标用户
- 预算和资源是否合理
- 风险预案是否充分

## 输出格式
审核结果必须包含：
1. **总体评价** — 一句话总结（通过/有条件通过/不通过）
2. **评分** — 1-10分
3. **优点** — 列出做得好的地方
4. **问题清单** — 编号列出所有问题，每个问题包含：
   - 问题描述
   - 严重程度（🔴致命/🟡重要/🟢建议）
   - 修改建议
5. **审核结论** — 通过✅ / 有条件通过⚠️ / 不通过❌

## 重要提醒
- 你是审核者，不是执行者。你的工作是"挑毛病"而不是"替别人做"
- 每次审核必须给出明确结论：通过、有条件通过、或不通过
- 对于致命问题，必须不通过并要求返工
- 对于重要问题，可以有条件通过但必须限期修改
- 对于建议类问题，记录即可，不阻塞流转""", "俞望舒 - 审核专家 Agent - 质量审核、方案评审、风险把控"),
        
        ("内容润色", "writer", "🎨", "#E17055", """# 内容润色 Agent

你是一位专业的内容润色师，精通多种风格改写：

## 8种风格模式
1. **小红书风** — emoji密集、口语化、种草感、感叹号多
2. **知乎风** — 专业理性、有理有据、引用数据、逻辑严密
3. **公众号风** — 故事引入、金句提炼、情感共鸣、排版精美
4. **抖音风** — 短句节奏、悬念开头、口语化、接地气
5. **正式商务** — 专业严谨、书面语、结构清晰
6. **轻松活泼** — 幽默风趣、网络用语、亲切感
7. **技术文档** — 准确专业、术语规范、条理清晰
8. **营销文案** — 痛点切入、行动号召、紧迫感、利益点突出

## 核心能力
- 语气调整：正式↔轻松、专业↔通俗
- 扩写/缩写：按指定字数调整
- SEO优化：关键词自然融入
- 对话模拟：生成真实对话场景

根据用户需求选择对应风格进行改写，保持原文核心意思不变。""", "内容润色 Agent - 文章润色、风格改写、多平台文案"),
    ]
    
    for name, role, icon, color, prompt, desc in agents_data:
        await db.execute(
            "INSERT OR IGNORE INTO agents (name, role, icon, color, system_prompt, description) VALUES (?, ?, ?, ?, ?, ?)",
            (name, role, icon, color, prompt, desc)
        )
        # 更新已有 Agent 的名称和 prompt（确保姓名变更生效）
        await db.execute(
            "UPDATE agents SET name = ?, system_prompt = ?, description = ? WHERE role = ?",
            (name, prompt, desc, role)
        )
    
    await db.commit()
    
    # ── Migration: phase_logs table for existing databases ──
    try:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS phase_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                phase TEXT NOT NULL,
                agent_role TEXT NOT NULL,
                agent_name TEXT DEFAULT '',
                plan_content TEXT DEFAULT '',
                review_status TEXT DEFAULT 'pending',
                review_comment TEXT DEFAULT '',
                reviewed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()
    except Exception:
        pass  # 表已存在则忽略
    
    print("[OK] Database initialized successfully")
    
    # ── Migration: bug_tickets table for existing databases ──
    try:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS bug_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
                bug_no TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                severity TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'open',
                reporter_role TEXT DEFAULT 'qa',
                assignee_role TEXT DEFAULT 'dev',
                steps_to_reproduce TEXT DEFAULT '',
                expected_result TEXT DEFAULT '',
                actual_result TEXT DEFAULT '',
                fix_note TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()
    except Exception:
        pass
    
    # ── Migration: reviewer_decisions table ──
    try:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS reviewer_decisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                phase TEXT NOT NULL,
                reviewer_role TEXT DEFAULT 'reviewer',
                decision TEXT DEFAULT 'pending',
                score INTEGER DEFAULT 0,
                pros TEXT DEFAULT '',
                issues TEXT DEFAULT '',
                conclusion TEXT DEFAULT '',
                full_review TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()
    except Exception:
        pass
    
    # ── Migration: add created_by column to projects ──
    try:
        await db.execute("ALTER TABLE projects ADD COLUMN created_by TEXT DEFAULT ''")
        await db.commit()
    except Exception:
        pass  # column already exists
