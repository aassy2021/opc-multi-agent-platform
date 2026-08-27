"""Agent 管理 API"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from models.database import get_db
from services.llm_service import llm_service
import json
import os

router = APIRouter()

def load_prompt(role: str) -> str:
    """加载 Agent 系统提示词"""
    prompt_path = os.path.join(
        os.path.dirname(__file__), "..", "prompts", role, f"{role}_system.md"
    )
    if os.path.exists(prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""

class ChatRequest(BaseModel):
    project_id: int
    agent_role: str
    messages: List[dict]
    stream: bool = True

@router.get("")
async def list_agents():
    db = await get_db()
    cursor = await db.execute("SELECT * FROM agents ORDER BY id")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]

@router.get("/{agent_id}")
async def get_agent(agent_id: int):
    db = await get_db()
    cursor = await db.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    return dict(row)

@router.put("/{agent_id}/prompt")
async def update_prompt(agent_id: int, data: dict):
    db = await get_db()
    await db.execute(
        "UPDATE agents SET system_prompt = ? WHERE id = ?",
        (data.get("system_prompt", ""), agent_id)
    )
    await db.commit()
    return {"message": "Prompt updated"}

@router.post("/chat")
async def agent_chat(req: ChatRequest):
    """Agent 对话（支持流式）— 自动加载项目上下文和完整对话历史"""
    db = await get_db()
    
    # 获取 Agent 信息
    cursor = await db.execute(
        "SELECT * FROM agents WHERE role = ?", (req.agent_role,)
    )
    agent = await cursor.fetchone()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent = dict(agent)
    
    # ── 加载系统提示词 ──
    system_prompt = agent.get("system_prompt", "") or load_prompt(req.agent_role)
    
    # ── 自动注入项目上下文到 system prompt ──
    project_context = ""
    if req.project_id:
        proj_cursor = await db.execute(
            "SELECT * FROM projects WHERE id = ?", (req.project_id,)
        )
        project = await proj_cursor.fetchone()
        if project:
            project = dict(project)
            from routers.projects import PHASE_FLOW, PHASE_LABELS
            phase_info = PHASE_FLOW.get(project["phase"], {}) or {}
            project_context = (
                f"\n\n---\n## 当前项目信息\n"
                f"- 项目名称：{project['name']}\n"
                f"- 项目描述：{project.get('description', '暂无')}\n"
                f"- 当前阶段：{phase_info.get('label', project['phase']) if phase_info else project['phase']}\n"
                f"- 你的角色：{agent['name']}\n"
                f"请始终围绕这个项目和当前阶段来回答问题。\n"
            )
            # 审核专家：加载当前阶段方案内容作为审核对象
            if req.agent_role == "reviewer":
                plan_cursor = await db.execute(
                    "SELECT plan_content FROM phase_logs WHERE project_id = ? AND phase = ? ORDER BY id DESC LIMIT 1",
                    (req.project_id, project["phase"])
                )
                plan_row = await plan_cursor.fetchone()
                if plan_row:
                    project_context += f"\n## 当前阶段方案（待审核）\n{dict(plan_row)['plan_content'][:5000]}\n"
            # 如果是开发/测试阶段，注入上一阶段的方案作为参考
            if project["phase"] in ("developing", "testing", "launching"):
                prev_phases = {
                    "developing": "planning",
                    "testing": "developing",
                    "launching": "testing",
                }
                prev_phase = prev_phases[project["phase"]]
                log_cursor = await db.execute(
                    "SELECT plan_content FROM phase_logs WHERE project_id = ? AND phase = ? AND review_status = 'approved' ORDER BY id DESC LIMIT 1",
                    (req.project_id, prev_phase)
                )
                log_row = await log_cursor.fetchone()
                if log_row:
                    project_context += f"\n## 上一阶段已审核通过的方案\n{dict(log_row)['plan_content'][:3000]}\n"
    
    system_prompt += project_context
    
    # ── 从 DB 加载当前项目+Agent的完整对话历史 ──
    history_from_db = []
    if req.project_id:
        agent_cursor = await db.execute(
            "SELECT id FROM agents WHERE role = ?", (req.agent_role,)
        )
        agent_row = await agent_cursor.fetchone()
        if agent_row:
            hist_cursor = await db.execute(
                """SELECT role, content FROM conversations 
                   WHERE project_id = ? AND agent_id = ? 
                   ORDER BY created_at ASC""",
                (req.project_id, agent_row["id"])
            )
            rows = await hist_cursor.fetchall()
            history_from_db = [{"role": r["role"], "content": r["content"]} for r in rows]
    
    # ── 合并消息：DB历史 + 本轮新消息 ──
    # 前端传来的 messages 只有本轮新消息，DB 里有之前所有轮次
    # 去重：如果 DB 最后一条 user 和前端第一条 user 内容相同，跳过前端的
    final_messages = list(history_from_db)
    new_messages = req.messages or []
    if final_messages and new_messages:
        last_db = final_messages[-1]
        first_new = new_messages[0]
        if last_db["role"] == first_new["role"] == "user" and last_db["content"] == first_new["content"]:
            new_messages = new_messages[1:]  # 跳过重复的
    final_messages.extend(new_messages)
    
    # 如果 DB 为空且前端也没传，用前端的（兜底）
    if not final_messages:
        final_messages = list(new_messages)
    
    # 限制 token 量：保留 system + 最近 40 轮（80条）消息
    MAX_HISTORY = 80
    if len(final_messages) > MAX_HISTORY:
        final_messages = final_messages[-MAX_HISTORY:]
    
    # ── 保存用户消息到 DB ──
    for msg in req.messages:
        if msg["role"] == "user":
            await db.execute(
                "INSERT INTO conversations (project_id, agent_id, role, content) VALUES (?, ?, ?, ?)",
                (req.project_id, agent["id"], "user", msg["content"])
            )
    await db.commit()
    
    # ── Demo 模式 ──
    if not llm_service.api_key:
        last_user_msg = ""
        for msg in reversed(req.messages):
            if msg["role"] == "user":
                last_user_msg = msg["content"]
                break
        
        demo_reply = f"[Demo 模式] {agent['name']} 收到了你的消息，但尚未配置 LLM API Key，无法生成真实回复。\n\n"
        demo_reply += f"你的消息：{last_user_msg[:200]}\n\n"
        demo_reply += "👉 请前往 **设置页面** 配置 API Key，配置后即可正常对话。\n\n"
        demo_reply += f"**{agent['name']}** 的能力：\n{agent.get('description', '')}"
        
        if req.stream:
            async def demo_stream():
                yield f"data: {json.dumps({'content': demo_reply}, ensure_ascii=False)}\n\n"
                db2 = await get_db()
                await db2.execute(
                    "INSERT INTO conversations (project_id, agent_id, role, content) VALUES (?, ?, ?, ?)",
                    (req.project_id, agent["id"], "assistant", demo_reply)
                )
                await db2.commit()
                yield "data: [DONE]\n\n"
            return StreamingResponse(demo_stream(), media_type="text/event-stream")
        else:
            await db.execute(
                "INSERT INTO conversations (project_id, agent_id, role, content) VALUES (?, ?, ?, ?)",
                (req.project_id, agent["id"], "assistant", demo_reply)
            )
            await db.commit()
            return {"content": demo_reply}
    
    # ── 调用 LLM ──
    if req.stream:
        async def generate():
            full_response = ""
            async for chunk in llm_service.chat_stream(
                messages=final_messages,
                system_prompt=system_prompt
            ):
                full_response += chunk
                yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
            
            db2 = await get_db()
            await db2.execute(
                "INSERT INTO conversations (project_id, agent_id, role, content) VALUES (?, ?, ?, ?)",
                (req.project_id, agent["id"], "assistant", full_response)
            )
            # ★ 审核专家回复后，自动更新 pending decision
            if req.agent_role == "reviewer" and req.project_id:
                try:
                    dec_cursor = await db2.execute(
                        "SELECT id, decision FROM reviewer_decisions WHERE project_id = ? AND phase = (SELECT phase FROM projects WHERE id = ?) AND decision = 'pending' ORDER BY id DESC LIMIT 1",
                        (req.project_id, req.project_id)
                    )
                    dec_row = await dec_cursor.fetchone()
                    if dec_row:
                        dec_id = dec_row[0]
                        # 根据回复内容自动判断审核结论
                        resp_lower = full_response.lower()
                        if any(kw in full_response for kw in ["不通过", "❌", "严重不足", "无法通过", "建议重新"]):
                            new_decision = "fail"
                        elif any(kw in full_response for kw in ["有条件通过", "⚠️", "部分通过", "建议改进"]):
                            new_decision = "conditional_pass"
                        else:
                            new_decision = "pass"  # 默认通过
                        await db2.execute(
                            "UPDATE reviewer_decisions SET decision = ?, full_review = ?, score = CASE WHEN ? > 0 THEN ? ELSE score END, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                            (new_decision, full_response[:5000], 0, 0, dec_id)
                        )
                        print(f"[Reviewer] Auto-updated decision {dec_id}: pending → {new_decision}", flush=True)
                except Exception as e:
                    print(f"[Reviewer] Failed to auto-update decision: {e}", flush=True)
            await db2.commit()
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(generate(), media_type="text/event-stream")
    else:
        try:
            response = await llm_service.chat(
                messages=final_messages,
                system_prompt=system_prompt
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"LLM 调用失败: {type(e).__name__}: {str(e)[:200]}")
        
        await db.execute(
            "INSERT INTO conversations (project_id, agent_id, role, content) VALUES (?, ?, ?, ?)",
            (req.project_id, agent["id"], "assistant", response)
        )
        await db.commit()
        
        return {"content": response}
