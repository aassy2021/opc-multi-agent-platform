"""项目管理 API — 含工作流状态流转 + 审核机制 + 阶段日志"""
import os
import shutil
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from models.database import get_db
import json

router = APIRouter()

# 项目状态流转定义
# phase → 对应负责的 Agent role + 阶段任务标题
PHASE_FLOW = {
    "planning": {
        "next": "developing",
        "agent": "pm",
        "task_title": "需求分析与PRD撰写",
        "task_desc": "分析项目需求，输出PRD文档、功能清单、用户故事",
        "prompt_hint": "请对当前项目进行全面的需求分析，输出：\n1. 项目背景与目标\n2. 核心用户画像\n3. 功能清单（含优先级）\n4. 用户故事\n5. 验收标准\n请基于项目信息进行详细分析：\n\n",
        "label": "策划中",
    },
    "developing": {
        "next": "testing",
        "agent": "dev",
        "task_title": "技术方案与架构设计",
        "task_desc": "设计技术架构、选型、核心代码实现方案",
        "prompt_hint": "请为当前项目设计完整的技术方案，输出：\n1. 技术选型及理由\n2. 系统架构图描述\n3. 数据库设计\n4. API接口设计\n5. 核心模块实现方案\n请基于项目需求进行设计：\n\n",
        "label": "开发中",
    },
    "testing": {
        "next": "launching",
        "agent": "qa",
        "task_title": "测试计划与用例编写",
        "task_desc": "编写测试计划、测试用例、自动化测试方案",
        "prompt_hint": "请为当前项目编写完整的测试方案，输出：\n1. 测试策略\n2. 功能测试用例（表格）\n3. 边界测试用例\n4. 异常测试用例\n5. 性能测试方案\n6. 自动化测试代码\n请基于项目需求和架构进行测试设计：\n\n",
        "label": "测试中",
    },
    "launching": {
        "next": "launched",
        "agent": "ops",
        "task_title": "上线运营方案",
        "task_desc": "制定上线计划、增长策略、运营方案",
        "prompt_hint": "请为当前项目制定上线运营方案，输出：\n1. 上线检查清单\n2. 冷启动增长策略\n3. 用户获取渠道计划\n4. 数据埋点与监控方案\n5. 首周运营节奏\n请基于项目特点制定可落地的运营方案：\n\n",
        "label": "上线中",
    },
    "launched": {
        "next": None,
        "agent": None,
        "label": "已上线",
    },
}

PHASE_LABELS = {k: v["label"] for k, v in PHASE_FLOW.items()}

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    tech_stack: str = "{}"
    created_by: str = ""  # 创建人名称

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    phase: Optional[str] = None
    tech_stack: Optional[str] = None

class ReviewRequest(BaseModel):
    """审核请求：通过或拒绝"""
    action: str  # "approve" 或 "reject"
    comment: str = ""  # 审核意见（拒绝时必填，通过时可选）

class PlanSubmitRequest(BaseModel):
    """Agent 提交阶段方案"""
    content: str  # 方案内容（通常是 Agent 最后一条回复）

class ReviewerDecisionRequest(BaseModel):
    """用户对审核专家意见的决定"""
    action: str  # "agree" 或 "disagree"
    comment: str = ""

class RevisionRequest(BaseModel):
    """用户要求 Agent 修改方案"""
    comment: str = ""

# ──────────────────────────────── 项目 CRUD ────────────────────────────────

@router.get("")
async def list_projects():
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM projects ORDER BY updated_at DESC"
    )
    rows = await cursor.fetchall()
    projects = [dict(row) for row in rows]
    # 为每个项目附带阶段任务信息 + 输出目录
    for p in projects:
        phase_info = PHASE_FLOW.get(p["phase"], {})
        p["next_phase"] = phase_info.get("next")
        p["current_agent"] = phase_info.get("agent")
        p["phase_label"] = phase_info.get("label", "")
        # 输出目录路径
        _safe_name = p["name"].replace("/", "_").replace("\\", "_").replace(":", "_")
        p["output_path"] = f"{p['id']}-{_safe_name}"
        # 查当前阶段的审核状态
        log_cursor = await db.execute(
            "SELECT review_status FROM phase_logs WHERE project_id = ? AND phase = ? ORDER BY id DESC LIMIT 1",
            (p["id"], p["phase"])
        )
        log_row = await log_cursor.fetchone()
        p["phase_review_status"] = dict(log_row)["review_status"] if log_row else "none"
        # 查审核专家决定状态
        rd_cursor = await db.execute(
            "SELECT decision FROM reviewer_decisions WHERE project_id = ? AND phase = ? ORDER BY id DESC LIMIT 1",
            (p["id"], p["phase"])
        )
        rd_row = await rd_cursor.fetchone()
        p["reviewer_decision"] = dict(rd_row)["decision"] if rd_row else "none"
        # 查当前阶段的任务和产出
        if phase_info.get("agent"):
            agent_cursor = await db.execute(
                "SELECT id FROM agents WHERE role = ?", (phase_info["agent"],)
            )
            agent_row = await agent_cursor.fetchone()
            if agent_row:
                task_cursor = await db.execute(
                    "SELECT COUNT(*) FROM tasks WHERE project_id = ? AND agent_id = ?",
                    (p["id"], agent_row["id"])
                )
                p["agent_task_count"] = (await task_cursor.fetchone())[0]
                out_cursor = await db.execute(
                    "SELECT COUNT(*) FROM outputs WHERE project_id = ? AND agent_id = ?",
                    (p["id"], agent_row["id"])
                )
                p["agent_output_count"] = (await out_cursor.fetchone())[0]
            else:
                p["agent_task_count"] = 0
                p["agent_output_count"] = 0
        else:
            p["agent_task_count"] = 0
            p["agent_output_count"] = 0
    return projects

@router.post("")
async def create_project(data: ProjectCreate):
    db = await get_db()
    cursor = await db.execute(
        "INSERT INTO projects (name, description, tech_stack, created_by) VALUES (?, ?, ?, ?)",
        (data.name, data.description, data.tech_stack, data.created_by)
    )
    await db.commit()
    project_id = cursor.lastrowid
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = await cursor.fetchone()
    
    # 创建默认磁盘目录结构: projects/<id>-<name>/01-策划, 02-开发, 03-测试, 04-运营
    from main import PHASE_DIR_MAP, PROJECTS_ROOT
    safe_name = data.name.replace("/", "_").replace("\\", "_").replace(":", "_")
    project_dir = os.path.join(PROJECTS_ROOT, f"{project_id}-{safe_name}")
    for phase_dir in PHASE_DIR_MAP.values():
        os.makedirs(os.path.join(project_dir, phase_dir), exist_ok=True)
    
    project = dict(row)
    project["output_dir"] = project_dir
    project["output_path"] = f"{project_id}-{safe_name}"
    return project

@router.get("/{project_id}")
async def get_project(project_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    project = dict(row)
    
    # 附带完整的工作流状态
    phase_info = PHASE_FLOW.get(project["phase"], {})
    project["next_phase"] = phase_info.get("next")
    project["current_agent"] = phase_info.get("agent")
    project["phase_label"] = phase_info.get("label", "")
    
    # 输出目录路径
    _safe_name = project["name"].replace("/", "_").replace("\\", "_").replace(":", "_")
    project["output_path"] = f"{project_id}-{_safe_name}"
    
    # 当前阶段审核状态
    log_cursor = await db.execute(
        "SELECT * FROM phase_logs WHERE project_id = ? AND phase = ? ORDER BY id DESC LIMIT 1",
        (project_id, project["phase"])
    )
    log_row = await log_cursor.fetchone()
    project["phase_review_status"] = dict(log_row)["review_status"] if log_row else "none"
    
    # 审核专家决定状态
    rd_cursor2 = await db.execute(
        "SELECT decision FROM reviewer_decisions WHERE project_id = ? AND phase = ? ORDER BY id DESC LIMIT 1",
        (project_id, project["phase"])
    )
    rd_row2 = await rd_cursor2.fetchone()
    project["reviewer_decision"] = dict(rd_row2)["decision"] if rd_row2 else "none"
    
    # 该项目所有Agent的工作摘要
    agent_summary = []
    agents_cursor = await db.execute("SELECT * FROM agents ORDER BY id")
    agents = await agents_cursor.fetchall()
    for a in agents:
        a = dict(a)
        tc = await db.execute(
            "SELECT COUNT(*) FROM tasks WHERE project_id = ? AND agent_id = ?",
            (project_id, a["id"])
        )
        oc = await db.execute(
            "SELECT COUNT(*) FROM outputs WHERE project_id = ? AND agent_id = ?",
            (project_id, a["id"])
        )
        cc = await db.execute(
            "SELECT COUNT(*) FROM conversations WHERE project_id = ? AND agent_id = ?",
            (project_id, a["id"])
        )
        agent_summary.append({
            "role": a["role"],
            "name": a["name"],
            "icon": a["icon"],
            "task_count": (await tc.fetchone())[0],
            "output_count": (await oc.fetchone())[0],
            "conversation_count": (await cc.fetchone())[0],
        })
    project["agent_summary"] = agent_summary
    
    # 项目所有任务
    tasks_cursor = await db.execute(
        """SELECT t.*, a.name as agent_name, a.role as agent_role, a.icon as agent_icon
           FROM tasks t LEFT JOIN agents a ON t.agent_id = a.id
           WHERE t.project_id = ? ORDER BY t.created_at DESC""",
        (project_id,)
    )
    project["tasks"] = [dict(t) for t in await tasks_cursor.fetchall()]
    
    # 项目所有产出
    outputs_cursor = await db.execute(
        """SELECT o.*, a.name as agent_name, a.role as agent_role, a.icon as agent_icon
           FROM outputs o LEFT JOIN agents a ON o.agent_id = a.id
           WHERE o.project_id = ? ORDER BY o.created_at DESC""",
        (project_id,)
    )
    project["outputs"] = [dict(o) for o in await outputs_cursor.fetchall()]
    
    # 审核专家决定
    rd_cursor = await db.execute(
        "SELECT * FROM reviewer_decisions WHERE project_id = ? ORDER BY created_at ASC",
        (project_id,)
    )
    project["reviewer_decisions"] = [dict(rd) for rd in await rd_cursor.fetchall()]
    
    return project

@router.put("/{project_id}")
async def update_project(project_id: int, data: ProjectUpdate):
    db = await get_db()
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [project_id]
    
    await db.execute(
        f"UPDATE projects SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values
    )
    await db.commit()
    
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = await cursor.fetchone()
    return dict(row)

# ──────────────────────────────── 阶段日志 ────────────────────────────────

@router.get("/{project_id}/phase-logs")
async def get_phase_logs(project_id: int):
    """获取项目的所有阶段日志"""
    db = await get_db()
    cursor = await db.execute(
        """SELECT pl.*, a.icon as agent_icon
           FROM phase_logs pl LEFT JOIN agents a ON pl.agent_role = a.role
           WHERE pl.project_id = ? ORDER BY pl.created_at ASC""",
        (project_id,)
    )
    logs = []
    for row in await cursor.fetchall():
        log = dict(row)
        log["phase_label"] = PHASE_LABELS.get(log["phase"], log["phase"])
        logs.append(log)
    return logs

@router.post("/{project_id}/phase-logs")
async def submit_plan(project_id: int, data: PlanSubmitRequest):
    """Agent 提交阶段方案（保存到阶段日志，状态为 pending）"""
    db = await get_db()
    
    # 获取当前项目和阶段
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    project = dict(row)
    current_phase = project["phase"]
    flow = PHASE_FLOW.get(current_phase, {})
    
    # 查找 Agent 信息
    agent_role = flow.get("agent", "unknown")
    agent_cursor = await db.execute("SELECT name FROM agents WHERE role = ?", (agent_role,))
    agent_row = await agent_cursor.fetchone()
    agent_name = dict(agent_row)["name"] if agent_row else agent_role
    
    # 检查该阶段是否已有日志
    existing = await db.execute(
        "SELECT id FROM phase_logs WHERE project_id = ? AND phase = ?",
        (project_id, current_phase)
    )
    existing_row = await existing.fetchone()
    
    if existing_row:
        # 更新已有日志
        await db.execute(
            """UPDATE phase_logs SET plan_content = ?, review_status = 'pending', 
               review_comment = '', reviewed_at = NULL, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (data.content, dict(existing_row)["id"])
        )
    else:
        # 新建日志
        await db.execute(
            """INSERT INTO phase_logs (project_id, phase, agent_role, agent_name, plan_content, review_status)
               VALUES (?, ?, ?, ?, ?, 'pending')""",
            (project_id, current_phase, agent_role, agent_name, data.content)
        )
    await db.commit()
    
    # ── 保存方案文件到磁盘 ──
    phase_label_map = {"planning": "策划", "developing": "开发", "testing": "测试", "launching": "运营"}
    phase_label = phase_label_map.get(current_phase, current_phase)
    file_name = f"{phase_label}方案.md"
    
    from main import save_project_file
    relative_path = save_project_file(
        project["id"], project["name"], current_phase, file_name, data.content
    )
    
    # 同时记录到 outputs 表
    agent_cursor2 = await db.execute("SELECT id FROM agents WHERE role = ?", (agent_role,))
    agent_row2 = await agent_cursor2.fetchone()
    agent_id = agent_row2[0] if agent_row2 else None
    
    await db.execute(
        """INSERT INTO outputs (project_id, agent_id, file_type, file_name, file_path, content)
           VALUES (?, ?, 'plan', ?, ?, ?)""",
        (project_id, agent_id, file_name, relative_path, data.content)
    )
    await db.commit()
    
    return {"message": "方案已提交，等待审核", "phase": current_phase, "file_path": relative_path}

@router.post("/{project_id}/phase-logs/{log_id}/review")
async def review_phase_log(project_id: int, log_id: int, data: ReviewRequest):
    """审核阶段日志：approve（通过）或 reject（拒绝+意见）"""
    db = await get_db()
    
    cursor = await db.execute(
        "SELECT * FROM phase_logs WHERE id = ? AND project_id = ?",
        (log_id, project_id)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Phase log not found")
    
    if data.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")
    
    if data.action == "reject" and not data.comment.strip():
        raise HTTPException(status_code=400, detail="拒绝时必须填写修改意见")
    
    review_status = "approved" if data.action == "approve" else "rejected"
    await db.execute(
        """UPDATE phase_logs SET review_status = ?, review_comment = ?,
           reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?""",
        (review_status, data.comment, log_id)
    )
    await db.commit()
    
    status_text = "通过" if data.action == "approve" else "拒绝"
    return {"message": f"已{status_text}", "review_status": review_status, "comment": data.comment}

# ──────────────────────────────── 审核专家相关 ────────────────────────────

@router.get("/{project_id}/reviewer-decisions")
async def get_reviewer_decisions(project_id: int):
    """获取项目的所有审核专家决定"""
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM reviewer_decisions WHERE project_id = ? ORDER BY created_at ASC",
        (project_id,)
    )
    return [dict(row) for row in await cursor.fetchall()]

@router.post("/{project_id}/request-review")
async def request_reviewer_review(project_id: int):
    """提交方案给审核专家(俞望舒)审核 — 自动调用审核 Agent 对当前阶段方案进行评审"""
    db = await get_db()
    
    # 获取项目信息
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    project = dict(row)
    current_phase = project["phase"]
    
    # 获取当前阶段的方案内容
    log_cursor = await db.execute(
        "SELECT plan_content FROM phase_logs WHERE project_id = ? AND phase = ? ORDER BY id DESC LIMIT 1",
        (project_id, current_phase)
    )
    log_row = await log_cursor.fetchone()
    if not log_row:
        raise HTTPException(status_code=400, detail="当前阶段尚未提交方案，请先提交方案再请求审核")
    plan_content = dict(log_row)["plan_content"]
    
    # 获取审核 Agent 信息
    reviewer_cursor = await db.execute("SELECT * FROM agents WHERE role = 'reviewer'")
    reviewer = await reviewer_cursor.fetchone()
    if not reviewer:
        raise HTTPException(status_code=500, detail="审核专家 Agent 未配置")
    reviewer = dict(reviewer)
    
    # 检查是否已有 pending 的审核决定
    existing_cursor = await db.execute(
        "SELECT id FROM reviewer_decisions WHERE project_id = ? AND phase = ? AND decision = 'pending'",
        (project_id, current_phase)
    )
    existing = await existing_cursor.fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="该阶段已有待处理的审核请求，请等待审核完成")
    
    # 构造审核请求消息
    phase_labels = {"planning": "策划", "developing": "开发", "testing": "测试", "launching": "运营"}
    phase_label = phase_labels.get(current_phase, current_phase)
    
    review_prompt = (
        f"请审核以下项目「{project['name']}」的**{phase_label}阶段方案**。\n\n"
        f"## 项目信息\n- 项目名称：{project['name']}\n- 项目描述：{project.get('description', '暂无')}\n\n"
        f"## {phase_label}阶段方案内容\n{plan_content}\n\n"
        f"请严格按照你的审核标准进行评审，给出评分、优点、问题清单和审核结论（通过✅/有条件通过⚠️/不通过❌）。"
    )
    
    # 创建 pending 的审核决定记录
    decision_cursor = await db.execute(
        """INSERT INTO reviewer_decisions (project_id, phase, reviewer_role, decision, full_review)
           VALUES (?, ?, 'reviewer', 'pending', '')""",
        (project_id, current_phase)
    )
    decision_id = decision_cursor.lastrowid
    await db.commit()
    
    # 保存审核请求到 conversations（user 角色，代表系统发送给审核 Agent）
    await db.execute(
        "INSERT INTO conversations (project_id, agent_id, role, content) VALUES (?, ?, 'user', ?)",
        (project_id, reviewer["id"], review_prompt)
    )
    await db.commit()
    
    return {
        "message": f"已提交给审核专家(俞望舒)进行{phase_label}阶段审核",
        "decision_id": decision_id,
        "reviewer": {"role": reviewer["role"], "name": reviewer["name"], "icon": reviewer["icon"]},
    }

@router.post("/{project_id}/reviewer-decisions/{decision_id}/respond")
async def respond_to_reviewer(project_id: int, decision_id: int, data: ReviewerDecisionRequest):
    """用户对审核专家意见的回应：同意或不同意"""
    db = await get_db()
    
    cursor = await db.execute(
        "SELECT * FROM reviewer_decisions WHERE id = ? AND project_id = ?",
        (decision_id, project_id)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="审核决定不存在")
    
    decision = dict(row)
    if decision["decision"] == "user_approved":
        raise HTTPException(status_code=400, detail="该审核决定已被用户确认")
    
    if data.action == "agree":
        # 用户同意审核专家意见 → 标记为 user_approved
        new_decision = "user_approved" if decision["decision"] in ("pass", "conditional_pass") else "user_rejected_with_reviewer"
        if decision["decision"] == "fail":
            new_decision = "user_approved_rejection"  # 用户同意不通过
        
        await db.execute(
            "UPDATE reviewer_decisions SET decision = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_decision, decision_id)
        )
        await db.commit()
        
        return {"message": "已确认审核专家意见", "decision": new_decision}
    else:
        # 用户不同意审核专家意见 → 标记为 user_overridden，用户自行决策
        await db.execute(
            "UPDATE reviewer_decisions SET decision = 'user_overridden', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (decision_id,)
        )
        await db.commit()
        
        return {"message": "已覆盖审核专家意见，将按您的人工判断执行", "decision": "user_overridden"}

# ──────────────────────────────── 用户要求修改（驳回审核后发回给 Agent） ──────────────────────

@router.post("/{project_id}/request-revision")
async def request_revision(project_id: int, data: RevisionRequest):
    """用户点击「继续修改」— 将审核意见发回给当前阶段 Agent，让其修改方案"""
    db = await get_db()
    
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    project = dict(row)
    current_phase = project["phase"]
    
    # 找到当前阶段对应的 Agent
    from routers.projects import PHASE_FLOW
    phase_flow = PHASE_FLOW.get(current_phase, {})
    agent_role = phase_flow.get("agent")
    if not agent_role:
        raise HTTPException(status_code=400, detail="当前阶段无对应 Agent")
    
    # 获取 Agent 的 agent_id
    agent_cursor = await db.execute("SELECT * FROM agents WHERE role = ?", (agent_role,))
    agent_row = await agent_cursor.fetchone()
    if not agent_row:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_role}' not found")
    agent = dict(agent_row)
    
    # 将用户的修改意见保存到该 Agent 的对话中
    comment = data.comment or "请根据审核专家的意见修改方案"
    revision_prompt = (
        f"👤 **用户反馈（来自审核专家评审后的修改指示）**\n\n"
        f"审核专家(俞望舒)对当前{current_phase}阶段的方案提出了意见，"
        f"我认为需要修改。请根据以下意见优化你的方案，完成后重新提交。\n\n"
        f"### 审核意见\n{comment}\n\n"
        f"请直接在上方意见的基础上修改方案，给出完整的新版本。"
    )
    
    await db.execute(
        "INSERT INTO conversations (project_id, agent_id, role, content) VALUES (?, ?, 'user', ?)",
        (project_id, agent["id"], revision_prompt)
    )
    await db.commit()
    
    # 将 phase_logs 状态改为 rejected，让流程回到提交前
    await db.execute(
        """UPDATE phase_logs SET review_status = 'rejected', review_comment = ?,
           updated_at = CURRENT_TIMESTAMP
           WHERE project_id = ? AND phase = ? AND review_status = 'approved'""",
        (f"用户要求修改：{comment[:200]}", project_id, current_phase)
    )
    await db.commit()
    
    # 清除该阶段的 reviewer_decisions（重新开始审核流程）
    await db.execute(
        "DELETE FROM reviewer_decisions WHERE project_id = ? AND phase = ?",
        (project_id, current_phase)
    )
    await db.commit()
    
    return {
        "message": f"已将修改意见发送给{agent['name']}，请切换到该 Agent 继续对话",
        "agent_role": agent_role,
        "agent_name": agent["name"],
        "comment": comment,
    }

# ──────────────────────────────── 流转（需审核通过） ──────────────────────

@router.post("/{project_id}/advance")
async def advance_project(project_id: int):
    """项目状态推进 — 前提：当前阶段必须已审核通过"""
    db = await get_db()
    
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = dict(row)
    current_phase = project["phase"]
    flow = PHASE_FLOW.get(current_phase)
    
    if not flow or not flow.get("next"):
        raise HTTPException(status_code=400, detail="Project already at final phase, cannot advance")
    
    # ★ 检查当前阶段是否已审核通过
    log_cursor = await db.execute(
        "SELECT review_status FROM phase_logs WHERE project_id = ? AND phase = ?",
        (project_id, current_phase)
    )
    log_row = await log_cursor.fetchone()
    if not log_row:
        raise HTTPException(
            status_code=400,
            detail=f"当前阶段「{current_phase}」尚未提交方案，请先与 Agent 对话并提交方案再流转"
        )
    review_status = dict(log_row)["review_status"]
    if review_status != "approved":
        status_text = "待审核" if review_status == "pending" else "已被拒绝"
        raise HTTPException(
            status_code=400,
            detail=f"当前阶段方案「{status_text}」，请先审核通过后再流转。拒绝后请与 Agent 沟通修改方案并重新提交"
        )
    
    # ★ 检查审核专家是否已审核 — 运营阶段(launching)不需要专家审核，其他阶段必须是 user_approved 或 user_overridden
    if current_phase != "launching":
        reviewer_cursor = await db.execute(
            "SELECT decision FROM reviewer_decisions WHERE project_id = ? AND phase = ? ORDER BY id DESC LIMIT 1",
            (project_id, current_phase)
        )
        reviewer_row = await reviewer_cursor.fetchone()
        if reviewer_row:
            reviewer_decision = dict(reviewer_row)["decision"]
            if reviewer_decision in ("pending", "pass", "conditional_pass", "fail"):
                decision_labels = {
                    "pending": "审核专家尚未完成审核",
                    "pass": "审核专家已通过，等待您确认",
                    "conditional_pass": "审核专家有条件通过，等待您确认",
                    "fail": "审核专家未通过，您可以「同意」其意见或「覆盖」后手动流转",
                }
                raise HTTPException(
                    status_code=400,
                    detail=f"⚠️ {decision_labels.get(reviewer_decision, '审核专家意见待处理')}。请在「阶段日志」中查看审核专家(俞望舒)的评审结果并做出决定。"
                )
    
    # ★ 质量门禁：测试阶段必须 Bug 全部关闭才能流转
    if current_phase == "testing":
        bug_cursor = await db.execute(
            "SELECT COUNT(*) FROM bug_tickets WHERE project_id = ? AND status NOT IN ('verified', 'closed')",
            (project_id,)
        )
        open_bugs = (await bug_cursor.fetchone())[0]
        if open_bugs > 0:
            raise HTTPException(
                status_code=400,
                detail=f"⚠️ 仍有 {open_bugs} 个 Bug 未关闭，测试阶段必须全部修复验证后才能流转。请与测试工程师确认所有 Bug 状态。"
            )
    
    # 1. 找到对应的 Agent
    agent_cursor = await db.execute("SELECT * FROM agents WHERE role = ?", (flow["agent"],))
    agent = await agent_cursor.fetchone()
    if not agent:
        raise HTTPException(status_code=500, detail=f"Agent '{flow['agent']}' not found")
    agent = dict(agent)
    
    # 2. 创建下一阶段的任务
    next_flow = PHASE_FLOW.get(flow["next"], {})
    task_cursor = await db.execute(
        """INSERT INTO tasks (project_id, agent_id, title, description, status, priority)
           VALUES (?, ?, ?, ?, 'todo', 'high')""",
        (project_id, agent["id"], next_flow.get("task_title", ""), next_flow.get("task_desc", ""))
    )
    task_id = task_cursor.lastrowid
    await db.commit()
    
    # 3. 自动给下一阶段 Agent 发送启动消息（带上一阶段审核通过的方案上下文）
    prev_log_cursor = await db.execute(
        "SELECT plan_content FROM phase_logs WHERE project_id = ? AND phase = ?",
        (project_id, current_phase)
    )
    prev_log = await prev_log_cursor.fetchone()
    prev_plan = dict(prev_log)["plan_content"] if prev_log else ""
    
    project_context = (
        f"## 项目信息\n- 项目名称：{project['name']}\n- 项目描述：{project['description']}\n\n"
        f"## 上一阶段（{PHASE_LABELS.get(current_phase, current_phase)}）已审核通过的方案\n{prev_plan}\n\n"
    )
    user_message = next_flow.get("prompt_hint", "") + project_context
    
    # 保存自动触发的用户消息
    await db.execute(
        "INSERT INTO conversations (project_id, agent_id, role, content) VALUES (?, ?, 'user', ?)",
        (project_id, agent["id"], user_message)
    )
    await db.commit()
    
    # 4. 推进项目状态
    next_phase = flow["next"]
    await db.execute(
        "UPDATE projects SET phase = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (next_phase, project_id)
    )
    await db.commit()
    
    # 5. 返回结果
    return {
        "message": f"项目已从「{PHASE_LABELS.get(current_phase, current_phase)}」流转到「{PHASE_LABELS.get(next_phase, next_phase)}」",
        "task_id": task_id,
        "agent": {
            "role": agent["role"],
            "name": agent["name"],
            "icon": agent["icon"],
        },
        "prompt_message": user_message,
        "next_phase": next_phase,
        "next_phase_label": PHASE_LABELS.get(next_phase, next_phase),
    }

# ──────────────────────────────── 手动切换阶段（用户控制） ─────────────────

class PhaseChangeRequest(BaseModel):
    phase: str  # 目标阶段

@router.post("/{project_id}/phase")
async def change_phase(project_id: int, data: PhaseChangeRequest):
    """用户手动切换项目阶段 — 可进可退，跳转到对应 Agent"""
    db = await get_db()
    
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project = dict(row)
    target_phase = data.phase
    
    # 验证目标阶段合法
    if target_phase not in PHASE_FLOW:
        raise HTTPException(status_code=400, detail=f"无效的阶段: {target_phase}")
    
    current_phase = project["phase"]
    if target_phase == current_phase:
        raise HTTPException(status_code=400, detail="目标阶段与当前阶段相同")
    
    # 记录切换日志（写入 phase_logs）
    flow = PHASE_FLOW.get(target_phase, {})
    agent_role = flow.get("agent", "unknown")
    agent_cursor = await db.execute("SELECT name FROM agents WHERE role = ?", (agent_role,))
    agent_row = await agent_cursor.fetchone()
    agent_name = dict(agent_row)["name"] if agent_row else agent_role
    
    await db.execute(
        """INSERT INTO phase_logs (project_id, phase, agent_role, agent_name, plan_content, review_status, review_comment)
           VALUES (?, ?, ?, ?, ?, 'approved', ?)""",
        (project_id, target_phase, agent_role, agent_name,
         f"[手动切换] 由「{PHASE_LABELS.get(current_phase, current_phase)}」切换到「{PHASE_LABELS.get(target_phase, target_phase)}」",
         f"用户手动切换阶段")
    )
    
    # 更新项目阶段
    await db.execute(
        "UPDATE projects SET phase = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (target_phase, project_id)
    )
    await db.commit()
    
    target_label = PHASE_FLOW[target_phase]["label"]
    agent_cursor2 = await db.execute("SELECT icon FROM agents WHERE role = ?", (agent_role,))
    agent_icon_row = await agent_cursor2.fetchone()
    agent_icon = dict(agent_icon_row)["icon"] if agent_icon_row else ""
    
    return {
        "message": f"项目已从「{PHASE_LABELS.get(current_phase, current_phase)}」切换到「{target_label}」",
        "phase": target_phase,
        "phase_label": target_label,
        "agent": {
            "role": agent_role,
            "name": agent_name,
            "icon": agent_icon,
        },
        "should_navigate": True,  # 前端据此跳转到对应 Agent
    }

@router.delete("/{project_id}")
async def delete_project(project_id: int, x_current_user: str = Header(default="")):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="项目不存在")
    project = dict(row)
    # 权限校验：只有创建人可以删除（created_by 为空时不限制）
    if project.get("created_by") and x_current_user and project["created_by"] != x_current_user:
        raise HTTPException(status_code=403, detail="只有项目创建人可以删除此项目")
    # 删除磁盘文件
    _safe_name = project["name"].replace("/", "_").replace("\\", "_").replace(":", "_")
    from main import PROJECTS_ROOT
    project_dir = os.path.join(PROJECTS_ROOT, f"{project_id}-{_safe_name}")
    if os.path.exists(project_dir):
        shutil.rmtree(project_dir, ignore_errors=True)
    # 级联删除关联数据
    await db.execute("DELETE FROM phase_logs WHERE project_id = ?", (project_id,))
    await db.execute("DELETE FROM reviewer_decisions WHERE project_id = ?", (project_id,))
    await db.execute("DELETE FROM conversations WHERE project_id = ?", (project_id,))
    await db.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))
    await db.execute("DELETE FROM outputs WHERE project_id = ?", (project_id,))
    await db.execute("DELETE FROM bug_tickets WHERE project_id = ?", (project_id,))
    await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    await db.commit()
    return {"message": f"项目「{project['name']}」已删除"}
