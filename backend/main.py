"""
OPC Multi-Agent Platform - Backend API
一人公司 AI 多Agent协作平台
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from models.database import init_db
from routers import projects, agents, conversations, tasks, outputs
from routers import bugs
from routers import roundtable

# 项目文件根目录 — 所有项目输出保存在此，支持拔插移动
PROJECTS_ROOT = os.path.join(os.path.dirname(__file__), "..", "projects")
os.makedirs(PROJECTS_ROOT, exist_ok=True)

app = FastAPI(
    title="OPC Multi-Agent Platform",
    description="一人公司 AI 多Agent协作平台 - 可视化操作面板",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发模式允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化数据库
@app.on_event("startup")
async def startup():
    await init_db()
    # 为已有项目补建缺失的磁盘目录结构
    from models.database import get_db
    db = await get_db()
    cursor = await db.execute("SELECT id, name FROM projects")
    rows = await cursor.fetchall()
    for row in rows:
        pid, pname = row["id"], row["name"]
        pdir = _get_project_dir(pid, pname)
        if not os.path.exists(pdir):
            for phase_dir in PHASE_DIR_MAP.values():
                os.makedirs(os.path.join(pdir, phase_dir), exist_ok=True)

# 注册路由
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["Conversations"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(outputs.router, prefix="/api/outputs", tags=["Outputs"])
app.include_router(bugs.router, prefix="/api/bugs", tags=["Bug Tickets"])
app.include_router(roundtable.router, prefix="/api/roundtable", tags=["RoundTable"])

@app.get("/")
async def root():
    return {"message": "OPC Multi-Agent Platform API", "version": "1.0.0"}

# 用户身份管理（OPC 单人模式，本地 localStorage 存储）
_users_store = {}  # name → user info

@app.get("/api/current-user")
async def get_current_user(name: str = ""):
    """获取/注册当前用户身份"""
    if not name:
        name = "管理员"
    if name not in _users_store:
        _users_store[name] = {"name": name, "display_name": name}
    return _users_store[name]

@app.post("/api/users/register")
async def register_user(data: dict):
    """注册/更新用户"""
    name = data.get("name", "管理员")
    display_name = data.get("display_name", name)
    _users_store[name] = {"name": name, "display_name": display_name}
    return _users_store[name]

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """仪表盘统计数据"""
    from models.database import get_db
    db = await get_db()
    
    projects_count = await db.execute("SELECT COUNT(*) FROM projects")
    tasks_count = await db.execute("SELECT COUNT(*) FROM tasks")
    outputs_count = await db.execute("SELECT COUNT(*) FROM outputs WHERE file_type NOT IN ('roundtable')")
    agents_count = await db.execute("SELECT COUNT(*) FROM agents WHERE is_active = 1 AND role != 'writer'")
    
    return {
        "projects": (await projects_count.fetchone())[0],
        "tasks": (await tasks_count.fetchone())[0],
        "outputs": (await outputs_count.fetchone())[0],
        "agents": (await agents_count.fetchone())[0]
    }

# ──────────────────── 项目文件系统 API ────────────────────

PHASE_DIR_MAP = {
    "planning":   "01-策划",
    "developing": "02-开发",
    "testing":    "03-测试",
    "launching":  "04-运营",
    "launched":   "04-运营",
}

def _get_project_dir(project_id: int, project_name: str) -> str:
    """获取项目磁盘目录路径: projects/<id>-<name>/"""
    safe_name = project_name.replace("/", "_").replace("\\", "_").replace(":", "_")
    return os.path.join(PROJECTS_ROOT, f"{project_id}-{safe_name}")

def save_project_file(project_id: int, project_name: str, phase: str, file_name: str, content: str) -> str:
    """
    保存项目产出文件到磁盘，返回相对路径。
    相对路径格式: 01-策划/PRD文档.md  (相对于项目根目录)
    """
    phase_dir = PHASE_DIR_MAP.get(phase, "00-其他")
    project_dir = _get_project_dir(project_id, project_name)
    target_dir = os.path.join(project_dir, phase_dir)
    os.makedirs(target_dir, exist_ok=True)
    
    file_path = os.path.join(target_dir, file_name)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    # 返回相对路径（相对于项目目录）
    return os.path.join(phase_dir, file_name)

@app.get("/api/projects/{project_id}/files")
async def list_project_files(project_id: int):
    """列出项目的所有磁盘文件"""
    from models.database import get_db
    db = await get_db()
    cursor = await db.execute("SELECT id, name FROM projects WHERE id = ?", (project_id,))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(404, "Project not found")
    
    project_dir = _get_project_dir(project_id, project["name"])
    if not os.path.exists(project_dir):
        return {"project_dir": project_dir, "files": []}
    
    files = []
    for root, dirs, filenames in os.walk(project_dir):
        for fn in filenames:
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, project_dir)
            files.append({
                "path": rel,
                "size": os.path.getsize(full),
                "modified": os.path.getmtime(full),
            })
    files.sort(key=lambda x: x["path"])
    return {"project_dir": project_dir, "files": files}

@app.get("/api/projects/{project_id}/files/{file_path:path}")
async def read_project_file(project_id: int, file_path: str):
    """读取项目文件内容"""
    from models.database import get_db
    db = await get_db()
    cursor = await db.execute("SELECT id, name FROM projects WHERE id = ?", (project_id,))
    project = await cursor.fetchone()
    if not project:
        raise HTTPException(404, "Project not found")
    
    project_dir = _get_project_dir(project_id, project["name"])
    full_path = os.path.join(project_dir, file_path)
    
    # 安全检查：不允许跳出项目目录
    real_project = os.path.realpath(project_dir)
    real_target = os.path.realpath(full_path)
    if not real_target.startswith(real_project):
        raise HTTPException(400, "Invalid file path")
    
    if not os.path.exists(full_path):
        raise HTTPException(404, "File not found")
    
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    return {"path": file_path, "content": content, "size": os.path.getsize(full_path)}

# ──────────────────── LLM 设置 API ────────────────────
from pydantic import BaseModel
from typing import Optional

class LLMConfigRequest(BaseModel):
    provider: str
    model: str
    api_key: str = ""
    api_base: str = ""

@app.get("/api/settings/llm")
async def get_llm_config():
    """获取当前 LLM 配置"""
    from services.llm_service import llm_service, PROVIDERS
    return {
        "provider": llm_service.provider,
        "model": llm_service.model,
        "api_key_set": bool(llm_service.api_key),
        "api_key_masked": (llm_service.api_key[:4] + "****" + llm_service.api_key[-4:]) if llm_service.api_key and len(llm_service.api_key) > 8 else ("****" if llm_service.api_key else ""),
        "base_url": llm_service.base_url or llm_service.config.get("base_url", ""),
    }

@app.post("/api/settings/llm")
async def save_llm_config(data: LLMConfigRequest):
    """保存 LLM 配置（运行时生效 + 持久化到 .env 文件，重启不丢失）"""
    from services.llm_service import llm_service
    llm_service.reconfigure(
        provider=data.provider,
        model=data.model,
        api_key=data.api_key if data.api_key.strip() else None,  # 空字符串 → None，不覆盖
        base_url=data.api_base,
    )
    # 持久化到 .env 文件，重启后端也不丢失
    try:
        env_path = os.path.join(os.path.dirname(__file__), ".env")
        # 读取现有配置，只更新非空字段（防止 masked key 覆盖真实 key）
        existing = {}
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if "=" in line:
                        k, v = line.split("=", 1)
                        existing[k] = v
        # 只更新有实际值的字段（api_key 为 None/空 → 保留原值不覆盖）
        if data.provider: existing["LLM_PROVIDER"] = data.provider
        if data.model: existing["LLM_MODEL"] = data.model
        if data.api_key: existing["LLM_API_KEY"] = data.api_key
        if data.base_url: existing["LLM_API_BASE"] = data.base_url
        with open(env_path, "w", encoding="utf-8") as f:
            for k, v in existing.items():
                f.write(f"{k}={v}\n")
        print(f"[Settings] 配置已持久化到 {env_path}", flush=True)
    except Exception as e:
        print(f"[Settings] 持久化 .env 失败: {e}", flush=True)
    return {
        "message": "配置已保存并立即生效（重启后端也不会丢失）",
        "provider": llm_service.provider,
        "model": llm_service.model,
        "base_url": llm_service.base_url or llm_service.config.get("base_url", ""),
        "api_key_set": bool(llm_service.api_key),
    }

# ──────────────────── TTS 语音合成 API（edge-tts 甜美女声）────────────────────

@app.post("/api/tts")
async def tts_synthesize(data: dict):
    """
    文本转语音 — 使用 edge-tts 微软甜美女声
    返回音频文件的临时路径，前端通过 /api/tts/audio/{filename} 播放
    """
    text = data.get("text", "").strip()
    voice = data.get("voice", "zh-CN-XiaoyiNeural")  # 甜美可爱女声
    rate = data.get("rate", "+0%")
    pitch = data.get("pitch", "+5Hz")

    if not text:
        raise HTTPException(400, "文本不能为空")
    if len(text) > 5000:
        text = text[:5000]  # 限制长度

    try:
        import edge_tts
        import uuid
        import asyncio
        import functools

        # 生成临时音频文件
        audio_dir = os.path.join(os.path.dirname(__file__), "tts_audio")
        os.makedirs(audio_dir, exist_ok=True)

        filename = f"tts_{uuid.uuid4().hex[:12]}.mp3"
        filepath = os.path.join(audio_dir, filename)

        # 使用 edge-tts 生成音频 — 直接异步调用
        import edge_tts
        import concurrent.futures

        async def _do_tts():
            communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
            await communicate.save(filepath)

        # 在线程池中运行以避免阻塞事件循环
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: asyncio.run(_do_tts()))

        return {
            "filename": filename,
            "url": f"/api/tts/audio/{filename}",
            "voice": voice,
            "size": os.path.getsize(filepath),
        }
    except ImportError:
        raise HTTPException(500, "edge-tts 未安装，请运行: pip install edge-tts")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"语音合成失败: {type(e).__name__}: {str(e)[:300]}")


@app.get("/api/tts/audio/{filename}")
async def tts_serve_audio(filename: str):
    """提供 TTS 音频文件"""
    from fastapi.responses import FileResponse
    audio_dir = os.path.join(os.path.dirname(__file__), "tts_audio")
    filepath = os.path.join(audio_dir, filename)

    # 安全检查
    real_audio = os.path.realpath(audio_dir)
    real_file = os.path.realpath(filepath)
    if not real_file.startswith(real_audio):
        raise HTTPException(400, "Invalid filename")

    if not os.path.exists(filepath):
        raise HTTPException(404, "音频文件不存在")

    return FileResponse(filepath, media_type="audio/mpeg")


@app.get("/api/tts/voices")
async def tts_list_voices():
    """列出可用的中文语音"""
    try:
        import edge_tts
        voices = await edge_tts.list_voices()
        chinese_voices = [v for v in voices if v.get("Locale", "").startswith("zh-")]
        return [
            {
                "id": v["ShortName"],
                "name": v["FriendlyName"],
                "gender": v.get("Gender", ""),
                "locale": v.get("Locale", ""),
            }
            for v in chinese_voices
        ]
    except Exception as e:
        return [{"id": "zh-CN-XiaoyiNeural", "name": "晓伊（甜美可爱）", "gender": "Female", "locale": "zh-CN"}]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
