"""任务管理 API"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from models.database import get_db

router = APIRouter()

class TaskCreate(BaseModel):
    project_id: int
    agent_id: Optional[int] = None
    title: str
    description: str = ""
    priority: str = "medium"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    agent_id: Optional[int] = None

@router.get("")
async def list_tasks(project_id: int = Query(None)):
    db = await get_db()
    if project_id:
        cursor = await db.execute("""
            SELECT t.*, a.name as agent_name, a.icon as agent_icon
            FROM tasks t
            LEFT JOIN agents a ON t.agent_id = a.id
            WHERE t.project_id = ?
            ORDER BY 
                CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                t.created_at DESC
        """, (project_id,))
    else:
        cursor = await db.execute("""
            SELECT t.*, a.name as agent_name, a.icon as agent_icon
            FROM tasks t
            LEFT JOIN agents a ON t.agent_id = a.id
            ORDER BY t.created_at DESC
        """)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]

@router.post("")
async def create_task(data: TaskCreate):
    db = await get_db()
    cursor = await db.execute(
        "INSERT INTO tasks (project_id, agent_id, title, description, priority) VALUES (?, ?, ?, ?, ?)",
        (data.project_id, data.agent_id, data.title, data.description, data.priority)
    )
    await db.commit()
    task_id = cursor.lastrowid
    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = await cursor.fetchone()
    return dict(row)

@router.put("/{task_id}")
async def update_task(task_id: int, data: TaskUpdate):
    db = await get_db()
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [task_id]
    
    await db.execute(
        f"UPDATE tasks SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        values
    )
    await db.commit()
    
    cursor = await db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    row = await cursor.fetchone()
    return dict(row)

@router.delete("/{task_id}")
async def delete_task(task_id: int):
    db = await get_db()
    await db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    await db.commit()
    return {"message": "Task deleted"}
