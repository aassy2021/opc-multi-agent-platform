"""对话历史 API"""
from fastapi import APIRouter, Query
from models.database import get_db

router = APIRouter()

@router.get("")
async def list_conversations(
    project_id: int = Query(...),
    agent_role: str = Query(None),
    limit: int = Query(50, le=200)
):
    """获取对话历史"""
    db = await get_db()
    
    if agent_role:
        cursor = await db.execute("""
            SELECT c.*, a.name as agent_name, a.icon as agent_icon
            FROM conversations c
            LEFT JOIN agents a ON c.agent_id = a.id
            WHERE c.project_id = ? AND a.role = ?
            ORDER BY c.created_at DESC
            LIMIT ?
        """, (project_id, agent_role, limit))
    else:
        cursor = await db.execute("""
            SELECT c.*, a.name as agent_name, a.icon as agent_icon
            FROM conversations c
            LEFT JOIN agents a ON c.agent_id = a.id
            WHERE c.project_id = ?
            ORDER BY c.created_at DESC
            LIMIT ?
        """, (project_id, limit))
    
    rows = await cursor.fetchall()
    return [dict(row) for row in reversed(rows)]  # 正序返回

@router.delete("")
async def clear_conversations(project_id: int, agent_role: str = None):
    """清除对话历史"""
    db = await get_db()
    if agent_role:
        await db.execute("""
            DELETE FROM conversations 
            WHERE project_id = ? AND agent_id = (SELECT id FROM agents WHERE role = ?)
        """, (project_id, agent_role))
    else:
        await db.execute("DELETE FROM conversations WHERE project_id = ?", (project_id,))
    await db.commit()
    return {"message": "Conversations cleared"}
