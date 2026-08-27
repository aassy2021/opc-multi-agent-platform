"""产出文件管理 API — 数据库存元数据 + 磁盘存实际文件"""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from models.database import get_db

router = APIRouter()

class OutputCreate(BaseModel):
    project_id: int
    task_id: Optional[int] = None
    agent_id: Optional[int] = None
    file_type: str
    file_name: str
    file_path: str = ""      # 相对路径（相对于项目目录），如 01-策划/PRD文档.md
    content: str = ""         # 文件内容（写入磁盘）

@router.get("")
async def list_outputs(
    project_id: int = Query(None),
    file_type: str = Query(None)
):
    db = await get_db()
    query = """
        SELECT o.*, a.name as agent_name, a.icon as agent_icon
        FROM outputs o
        LEFT JOIN agents a ON o.agent_id = a.id
        WHERE 1=1
    """
    params = []
    
    if project_id:
        query += " AND o.project_id = ?"
        params.append(project_id)
    if file_type:
        query += " AND o.file_type = ?"
        params.append(file_type)
    
    query += " ORDER BY o.created_at DESC"
    
    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]

@router.post("")
async def create_output(data: OutputCreate):
    db = await get_db()
    
    # 如果有内容但没有 file_path，自动保存到磁盘
    file_path = data.file_path
    if data.content and not file_path:
        # 获取项目信息以确定目录
        cursor = await db.execute("SELECT id, name, phase FROM projects WHERE id = ?", (data.project_id,))
        project = await cursor.fetchone()
        if project:
            from main import save_project_file
            project_dict = dict(project)
            file_path = save_project_file(
                project_dict["id"],
                project_dict["name"],
                project_dict["phase"],
                data.file_name,
                data.content
            )
    elif data.content and file_path:
        # 有 file_path 也有内容，写入磁盘
        cursor = await db.execute("SELECT id, name FROM projects WHERE id = ?", (data.project_id,))
        project = await cursor.fetchone()
        if project:
            from main import _get_project_dir
            import os
            project_dir = _get_project_dir(data.project_id, project["name"])
            full_path = os.path.join(project_dir, file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(data.content)

    cursor = await db.execute(
        """INSERT INTO outputs (project_id, task_id, agent_id, file_type, file_name, file_path, content)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (data.project_id, data.task_id, data.agent_id, data.file_type, data.file_name, file_path, data.content)
    )
    await db.commit()
    output_id = cursor.lastrowid
    cursor = await db.execute("SELECT * FROM outputs WHERE id = ?", (output_id,))
    row = await cursor.fetchone()
    return dict(row)

@router.get("/{output_id}")
async def get_output(output_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM outputs WHERE id = ?", (output_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(404, "Output not found")
    return dict(row)

@router.delete("/{output_id}")
async def delete_output(output_id: int):
    db = await get_db()
    await db.execute("DELETE FROM outputs WHERE id = ?", (output_id,))
    await db.commit()
    return {"message": "Output deleted"}
