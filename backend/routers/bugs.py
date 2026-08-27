"""Bug 工单管理 API — QA 提 Bug → DEV 修复 → QA 验证 → 关闭"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from models.database import get_db

router = APIRouter()

class BugCreate(BaseModel):
    project_id: int
    task_id: Optional[int] = None
    title: str
    description: str = ""
    severity: str = "medium"       # critical / high / medium / low
    steps_to_reproduce: str = ""
    expected_result: str = ""
    actual_result: str = ""

class BugFix(BaseModel):
    fix_note: str

class BugVerify(BaseModel):
    comment: str = ""

# ──────────────── 列表 ────────────────

@router.get("")
async def list_bugs(
    project_id: int = Query(None),
    status: str = Query(None),
    assignee_role: str = Query(None),
):
    db = await get_db()
    query = """
        SELECT b.*, 
               ra.name as reporter_name, ra.icon as reporter_icon,
               aa.name as assignee_name, aa.icon as assignee_icon
        FROM bug_tickets b
        LEFT JOIN agents ra ON b.reporter_role = ra.role
        LEFT JOIN agents aa ON b.assignee_role = aa.role
        WHERE 1=1
    """
    params = []
    if project_id:
        query += " AND b.project_id = ?"
        params.append(project_id)
    if status:
        query += " AND b.status = ?"
        params.append(status)
    if assignee_role:
        query += " AND b.assignee_role = ?"
        params.append(assignee_role)
    query += " ORDER BY b.created_at DESC"
    cursor = await db.execute(query, params)
    return [dict(row) for row in await cursor.fetchall()]

# ──────────────── 创建 Bug 工单 ────────────────

@router.post("")
async def create_bug(data: BugCreate):
    db = await get_db()
    
    # 生成 Bug 编号: BUG-{projectId}-{序号}
    count_cursor = await db.execute(
        "SELECT COUNT(*) FROM bug_tickets WHERE project_id = ?", (data.project_id,)
    )
    count = (await count_cursor.fetchone())[0]
    bug_no = f"BUG-{data.project_id}-{count + 1:03d}"
    
    cursor = await db.execute(
        """INSERT INTO bug_tickets 
           (project_id, task_id, bug_no, title, description, severity, 
            steps_to_reproduce, expected_result, actual_result)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (data.project_id, data.task_id, bug_no, data.title, data.description,
         data.severity, data.steps_to_reproduce, data.expected_result, data.actual_result)
    )
    await db.commit()
    bug_id = cursor.lastrowid
    
    cursor = await db.execute("SELECT * FROM bug_tickets WHERE id = ?", (bug_id,))
    row = await cursor.fetchone()
    
    bug = dict(row)
    
    # 同时创建一个任务指派给开发
    dev_cursor = await db.execute("SELECT id FROM agents WHERE role = 'dev'")
    dev_row = await dev_cursor.fetchone()
    if dev_row:
        await db.execute(
            """INSERT INTO tasks (project_id, agent_id, title, description, status, priority)
               VALUES (?, ?, ?, ?, 'todo', ?)""",
            (data.project_id, dict(dev_row)["id"],
             f"[Bug] {data.title}",
             f"Bug编号: {bug_no}\n严重程度: {data.severity}\n\n{data.description}\n\n复现步骤:\n{data.steps_to_reproduce}\n\n预期: {data.expected_result}\n实际: {data.actual_result}",
             "high" if data.severity in ("critical", "high") else "medium")
        )
        await db.commit()
    
    # 同时在对话中插入一条系统消息通知开发
    if dev_row:
        notify_msg = (
            f"🐛 **新 Bug 工单** `{bug_no}`\n\n"
            f"**标题：** {data.title}\n"
            f"**严重程度：** {data.severity}\n"
            f"**描述：** {data.description[:500]}\n"
        )
        if data.steps_to_reproduce:
            notify_msg += f"**复现步骤：** {data.steps_to_reproduce[:300]}\n"
        if data.expected_result:
            notify_msg += f"**预期结果：** {data.expected_result}\n"
        if data.actual_result:
            notify_msg += f"**实际结果：** {data.actual_result}\n"
        notify_msg += f"\n📌 请修复后点击「✅ 标记修复」"
        
        await db.execute(
            """INSERT INTO conversations (project_id, agent_id, role, content)
               VALUES (?, ?, 'assistant', ?)""",
            (data.project_id, dict(dev_row)["id"], notify_msg)
        )
        await db.commit()
    
    return bug

# ──────────────── 获取单个 Bug ────────────────

@router.get("/{bug_id}")
async def get_bug(bug_id: int):
    db = await get_db()
    cursor = await db.execute(
        """SELECT b.*, ra.name as reporter_name, aa.name as assignee_name
           FROM bug_tickets b
           LEFT JOIN agents ra ON b.reporter_role = ra.role
           LEFT JOIN agents aa ON b.assignee_role = aa.role
           WHERE b.id = ?""",
        (bug_id,)
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Bug not found")
    return dict(row)

# ──────────────── 标记修复（DEV → QA 验证）────────────────

@router.post("/{bug_id}/fix")
async def fix_bug(bug_id: int, data: BugFix):
    db = await get_db()
    
    cursor = await db.execute("SELECT * FROM bug_tickets WHERE id = ?", (bug_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Bug not found")
    bug = dict(row)
    
    if bug["status"] != "open":
        raise HTTPException(400, f"Bug 当前状态为 {bug['status']}，只有 open 状态才能标记修复")
    
    await db.execute(
        """UPDATE bug_tickets SET status = 'fixed', fix_note = ?, 
           updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
        (data.fix_note, bug_id)
    )
    await db.commit()
    
    # 通知 QA 去验证
    qa_cursor = await db.execute("SELECT id FROM agents WHERE role = 'qa'")
    qa_row = await qa_cursor.fetchone()
    if qa_row:
        notify_msg = (
            f"🔧 **Bug `{bug['bug_no']}` 已修复**\n\n"
            f"**标题：** {bug['title']}\n"
            f"**修复说明：** {data.fix_note}\n\n"
            f"📌 请验证修复是否通过。通过后点击「🎉 验证通过」关闭工单；"
            f"如仍有问题点击「🔄 重新打开」"
        )
        await db.execute(
            """INSERT INTO conversations (project_id, agent_id, role, content)
               VALUES (?, ?, 'assistant', ?)""",
            (bug["project_id"], dict(qa_row)["id"], notify_msg)
        )
        await db.commit()
    
    cursor = await db.execute("SELECT * FROM bug_tickets WHERE id = ?;", (bug_id,))
    return dict(await cursor.fetchone())

# ──────────────── 验证通过（QA → 关闭）────────────────

@router.post("/{bug_id}/verify")
async def verify_bug(bug_id: int, data: BugVerify):
    db = await get_db()
    
    cursor = await db.execute("SELECT * FROM bug_tickets WHERE id = ?", (bug_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Bug not found")
    bug = dict(row)
    
    if bug["status"] != "fixed":
        raise HTTPException(400, f"Bug 当前状态为 {bug['status']}，只有 fixed 状态才能验证")
    
    await db.execute(
        """UPDATE bug_tickets SET status = 'verified', updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
        (bug_id,)
    )
    await db.commit()
    
    # 通知开发验证通过
    dev_cursor = await db.execute("SELECT id FROM agents WHERE role = 'dev'")
    dev_row = await dev_cursor.fetchone()
    if dev_row:
        comment = f"\n**验证意见：** {data.comment}" if data.comment else ""
        notify_msg = f"🎉 **Bug `{bug['bug_no']}` 验证通过，已关闭！**\n\n**标题：** {bug['title']}{comment}"
        await db.execute(
            """INSERT INTO conversations (project_id, agent_id, role, content)
               VALUES (?, ?, 'assistant', ?)""",
            (bug["project_id"], dict(dev_row)["id"], notify_msg)
        )
        await db.commit()
    
    cursor = await db.execute("SELECT * FROM bug_tickets WHERE id = ?", (bug_id,))
    return dict(await cursor.fetchone())

# ──────────────── 重新打开（QA → DEV）────────────────

@router.post("/{bug_id}/reopen")
async def reopen_bug(bug_id: int):
    db = await get_db()
    
    cursor = await db.execute("SELECT * FROM bug_tickets WHERE id = ?", (bug_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Bug not found")
    bug = dict(row)
    
    if bug["status"] not in ("fixed", "verified"):
        raise HTTPException(400, f"Bug 当前状态为 {bug['status']}，无法重新打开")
    
    await db.execute(
        """UPDATE bug_tickets SET status = 'open', fix_note = '', 
           updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
        (bug_id,)
    )
    await db.commit()
    
    # 通知开发
    dev_cursor = await db.execute("SELECT id FROM agents WHERE role = 'dev'")
    dev_row = await dev_cursor.fetchone()
    if dev_row:
        notify_msg = (
            f"🔄 **Bug `{bug['bug_no']}` 已重新打开**\n\n"
            f"**标题：** {bug['title']}\n"
            f"📌 之前的修复未通过验证，请重新修复"
        )
        await db.execute(
            """INSERT INTO conversations (project_id, agent_id, role, content)
               VALUES (?, ?, 'assistant', ?)""",
            (bug["project_id"], dict(dev_row)["id"], notify_msg)
        )
        await db.commit()
    
    cursor = await db.execute("SELECT * FROM bug_tickets WHERE id = ?", (bug_id,))
    return dict(await cursor.fetchone())

# ──────────────── 删除 ────────────────

@router.delete("/{bug_id}")
async def delete_bug(bug_id: int):
    db = await get_db()
    await db.execute("DELETE FROM bug_tickets WHERE id = ?", (bug_id,))
    await db.commit()
    return {"message": "Bug deleted"}

# ──────────────── Bug 统计 ────────────────

@router.get("/stats/summary")
async def bug_stats(project_id: int = Query(None)):
    db = await get_db()
    where = ""
    params = []
    if project_id:
        where = "WHERE project_id = ?"
        params.append(project_id)
    
    cursor = await db.execute(f"""
        SELECT status, COUNT(*) as count FROM bug_tickets {where} GROUP BY status
    """, params)
    rows = await cursor.fetchall()
    stats = {row["status"]: row["count"] for row in rows}
    
    cursor2 = await db.execute(f"""
        SELECT severity, COUNT(*) as count FROM bug_tickets {where} GROUP BY severity
    """, params)
    rows2 = await cursor2.fetchall()
    severity_stats = {row["severity"]: row["count"] for row in rows2}
    
    return {"by_status": stats, "by_severity": severity_stats}
