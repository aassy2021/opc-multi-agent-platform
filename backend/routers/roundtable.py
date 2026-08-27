"""
圆桌会议 API — 多 Agent 依次发言讨论，最终汇总结论
"""
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
from models.database import get_db
from services.llm_service import llm_service
import os

router = APIRouter()

def load_prompt(role: str) -> str:
    prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", role, f"{role}_system.md")
    if os.path.exists(prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""


class RoundTableRequest(BaseModel):
    project_id: int = 0
    topic: str                            # 议题
    agent_roles: List[str] = []           # 参与讨论的 Agent（空 = 全部 5 个）
    extra_context: str = ""              # 补充背景信息


# ─── Agent 讨论时的角色定位：每个人从自己的专业角度发言 ───
AGENT_ROUNDTABLE_PERSONA = {
    "pm":       "作为产品经理，我会从用户需求、产品价值、功能优先级和用户体验角度分析。",
    "dev":      "作为开发工程师，我会从技术可行性、架构设计、开发成本和技术风险角度分析。",
    "qa":       "作为测试工程师，我会从质量保障、测试覆盖、潜在缺陷和验收标准角度分析。",
    "ops":      "作为运营专家，我会从市场推广、用户增长、运营成本和商业变现角度分析。",
    "reviewer": "作为审核专家，我会从整体质量、风险把控、方案完整性和可执行性角度把关。",
}

# ─── 汇总时每个 Agent 的结论格式 ───
CONCLUSION_FORMAT = """请基于以上各位的讨论，给出你对这个议题的最终结论：

**{agent_name} 的结论：**
- 核心观点（1-2句话）
- 关键建议（2-3条）
- 风险提醒（如有）

请简洁有力，突出你专业视角下最重要的判断。"""


@router.post("")
async def roundtable_discussion(req: RoundTableRequest):
    """
    圆桌会议 — SSE 流式返回
    流程：
    1. 逐个 Agent 发言（每人 1 轮）
    2. 每人发言完毕后插入分隔
    3. 全部发言后，由产品经理汇总各方观点，输出最终方案
    """
    if not req.topic.strip():
        raise HTTPException(400, "议题不能为空")

    # 确定参与的 Agent
    all_roles = ["pm", "dev", "qa", "ops", "reviewer"]
    roles = req.agent_roles if req.agent_roles else all_roles

    db = await get_db()

    # 加载 Agent 信息
    agents_info = {}
    for role in roles:
        cursor = await db.execute("SELECT * FROM agents WHERE role = ?", (role,))
        row = await cursor.fetchone()
        if row:
            agents_info[role] = dict(row)

    if not agents_info:
        raise HTTPException(400, "未找到有效的 Agent")

    # 加载项目上下文
    project_context = ""
    if req.project_id:
        proj_cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (req.project_id,))
        proj_row = await proj_cursor.fetchone()
        if proj_row:
            proj = dict(proj_row)
            from routers.projects import PHASE_FLOW
            phase_info = PHASE_FLOW.get(proj["phase"], {})
            project_context = (
                f"\n\n---\n## 项目信息\n"
                f"- 项目名称：{proj['name']}\n"
                f"- 项目描述：{proj.get('description', '暂无')}\n"
                f"- 当前阶段：{phase_info.get('label', proj['phase'])}\n"
            )

    async def generate():
        discussions = []  # 收集所有发言

        def send_event(event_data):
            return "data: " + json.dumps(event_data, ensure_ascii=False) + "\n\n"

        # ═══════ 开场 ═══════
        agent_names = " → ".join([agents_info.get(r, {}).get("name", r) for r in roles])
        yield send_event({"type": "system", "content": f"## 🎯 圆桌会议开始\n\n**议题：{req.topic}"})
        yield send_event({"type": "system", "content": f"**参与人：** {agent_names}"})
        if req.extra_context:
            yield send_event({"type": "system", "content": f"**补充背景：** {req.extra_context}"})

        # ═══════ 逐个 Agent 发言 ═══════
        for idx, role in enumerate(roles):
            agent = agents_info.get(role)
            if not agent:
                continue

            agent_name = agent["name"]
            persona = AGENT_ROUNDTABLE_PERSONA.get(role, f"作为{agent_name}，我从我的专业角度来分析这个议题。")

            # 构建这个 Agent 的 system prompt
            base_prompt = agent.get("system_prompt", "") or load_prompt(role)
            current_date = datetime.now().strftime("%Y年%m月%d日")
            roundtable_instruction = (
                f"\n\n---\n## 圆桌会议模式\n"
                f"你正在参加一个圆桌会议讨论。\n"
                f"\n**当前日期：** {current_date}\n"
                f"**议题：** {req.topic}\n"
                f"{project_context}\n"
                f"**你的发言定位：** {persona}\n"
                f"**前面同事的发言：**\n"
            )
            for prev in discussions:
                roundtable_instruction += f"\n### {prev['name']} 的发言：\n{prev['content'][:2000]}\n"

            if req.extra_context:
                roundtable_instruction += f"\n**补充背景：** {req.extra_context}\n"

            roundtable_instruction += (
                f"\n请从你的专业角度发表看法（300-500字），"
                f"回应前面同事的观点（如有），给出你的专业建议。"
                f"不要重复前面已经说过的内容，要有增量信息。"
            )

            system_prompt = base_prompt + roundtable_instruction

            # 发送 Agent 开始发言的标记
            yield send_event({"type": "speaker_start", "role": role, "name": agent_name, "icon": agent.get("icon", "🤖"), "color": agent.get("color", "#666"), "index": idx + 1, "total": len(roles)})

            # 调用 LLM
            full_response = ""
            try:
                print(f"[RoundTable] API Key 是否存在: {bool(llm_service.api_key)}", flush=True)
                if not llm_service.api_key:
                    full_response = f"[Demo 模式] {agent_name}（{persona}）\n\n议题「{req.topic}」是一个很好的讨论方向。由于当前处于 Demo 模式，请在设置中配置 API Key 以获取真实的 Agent 讨论内容。"
                    yield send_event({"type": "speaker_chunk", "content": full_response})
                else:
                    print(f"[RoundTable] 调用 LLM: {agent_name}, model={llm_service.model}", flush=True)
                    chunk_count = 0
                    async for chunk in llm_service.chat_stream(
                        messages=[{"role": "user", "content": f"请就以下议题发表你的专业看法：{req.topic}"}],
                        system_prompt=system_prompt,
                        temperature=0.8,
                        max_tokens=2048
                    ):
                        full_response += chunk
                        yield send_event({"type": "speaker_chunk", "content": chunk})
                        chunk_count += 1
                    print(f"[RoundTable] {agent_name} 发言完成, 长度={len(full_response)}, chunks={chunk_count}", flush=True)
            except Exception as e:
                import traceback
                error_msg = f"[RoundTable] {agent_name} 发言错误: {e}"
                print(error_msg, flush=True)
                traceback.print_exc()
                full_response = f"⚠️ {agent_name} 发言时出现错误：{str(e)[:200]}"
                yield send_event({"type": "speaker_chunk", "content": full_response})

            discussions.append({"role": role, "name": agent_name, "content": full_response})

            # 发送发言结束标记
            yield send_event({"type": "speaker_end", "role": role, "name": agent_name})

        # ═══════ 汇总环节：由产品经理汇总各方观点 ═══════
        yield send_event({"type": "system", "content": "## 📋 汇总环节 — 各方观点整合"})

        summary_role = "pm"
        summary_agent = agents_info.get(summary_role, list(agents_info.values())[0])
        summary_name = summary_agent["name"]

        summary_prompt = (
            f"你正在主持一场圆桌会议的总结环节。\n\n"
            f"**当前日期：** {current_date}\n"
            f"**议题：** {req.topic}\n"
            f"{project_context}\n"
            f"**各参与者的发言：**\n\n"
        )
        for d in discussions:
            summary_prompt += f"### {d['name']}（{d['role']}）的发言：\n{d['content']}\n\n"

        summary_prompt += (
            f"\n请作为主持人，整合以上所有人的观点，输出一份**圆桌会议总结报告**：\n"
            f"1. **议题概述**（一句话）\n"
            f"2. **各方观点摘要**（每个 Agent 一句话总结）\n"
            f"3. **共识点**（大家一致认同的）\n"
            f"4. **分歧点**（意见不同的地方，分析利弊）\n"
            f"5. **最终建议方案**（综合各方意见后的最佳方案）\n"
            f"6. **下一步行动**（具体可执行的 TODO 列表）\n"
            f"\n请用 Markdown 格式输出。"
        )

        summary_base_prompt = summary_agent.get("system_prompt", "") or load_prompt(summary_role)
        summary_system = summary_base_prompt + summary_prompt

        summary_label = f"{summary_name}（主持总结）"
        yield send_event({"type": "speaker_start", "role": "summary", "name": summary_label, "icon": "📋", "color": "#FDCB6E", "index": len(roles) + 1, "total": len(roles) + 1})

        summary_response = ""
        try:
            if not llm_service.api_key:
                summary_response = "## 📋 圆桌会议总结报告\n\n（Demo 模式 — 配置 API Key 后可获取真实汇总）"
            else:
                async for chunk in llm_service.chat_stream(
                    messages=[{"role": "user", "content": "请汇总以上讨论内容，输出圆桌会议总结报告。"}],
                    system_prompt=summary_system,
                    temperature=0.6,
                    max_tokens=3000
                ):
                    summary_response += chunk
                    yield send_event({"type": "speaker_chunk", "content": chunk})
        except Exception as e:
            summary_response = f"⚠️ 汇总时出现错误：{str(e)[:200]}"

        yield send_event({"type": "speaker_end", "role": "summary", "name": summary_name})

        # ═══════ 保存到数据库和磁盘 ═══════
        # 保存到产出表
        if req.project_id:
            db2 = await get_db()
            full_report = f"# 圆桌会议：{req.topic}\n\n"
            full_report += f"**日期：** {datetime.now().strftime('%Y年%m月%d日 %H:%M')}\n\n"
            full_report += f"**参与人：** {agent_names}\n\n---\n\n"
            for d in discussions:
                full_report += f"## {d['name']} 的发言\n\n{d['content']}\n\n---\n\n"
            full_report += f"## 总结报告\n\n{summary_response}\n"

            # 保存到数据库
            await db2.execute(
                "INSERT INTO outputs (project_id, agent_id, file_name, file_type, content) VALUES (?, ?, ?, ?, ?)",
                (req.project_id, summary_agent["id"], f"圆桌会议-{req.topic[:30]}.md", "roundtable", full_report)
            )
            await db2.commit()
            
            # 保存到磁盘文件
            try:
                from main import save_project_file
                # 获取项目信息
                proj_cursor = await db2.execute("SELECT name FROM projects WHERE id = ?", (req.project_id,))
                proj_row = await proj_cursor.fetchone()
                if proj_row:
                    proj_name = dict(proj_row)["name"]
                    file_name = f"圆桌会议-{req.topic[:30]}.md"
                    rel_path = save_project_file(req.project_id, proj_name, "planning", file_name, full_report)
                    # 更新 outputs 表的 file_path
                    await db2.execute("UPDATE outputs SET file_path = ? WHERE id = (SELECT MAX(id) FROM outputs WHERE file_type = 'roundtable')", (rel_path,))
                    await db2.commit()
                    print(f"[RoundTable] 保存到磁盘: {rel_path}", flush=True)
                else:
                    print(f"[RoundTable] 未找到项目 {req.project_id}，跳过磁盘保存", flush=True)
            except Exception as e:
                import traceback
                print(f"[RoundTable] 保存磁盘文件失败: {e}", flush=True)
                traceback.print_exc()

        # ═══════ 结束 ═══════
        yield send_event({"type": "done", "total_speakers": len(roles) + 1})
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/history")
async def roundtable_history(project_id: int = 0):
    """获取历史圆桌会议讨论记录"""
    db = await get_db()
    query = "SELECT id, project_id, agent_id, file_name, file_type, content, created_at FROM outputs WHERE file_type = 'roundtable'"
    params = []
    if project_id:
        query += " AND project_id = ?"
        params.append(project_id)
    query += " ORDER BY created_at DESC LIMIT 50"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.get("/minutes")
async def list_meeting_minutes(project_id: int = 0):
    """获取所有会议纪要（磁盘文件列表）"""
    import os
    from main import PROJECTS_ROOT, PHASE_DIR_MAP
    results = []
    if not os.path.exists(PROJECTS_ROOT):
        return results
    for proj_dir in sorted(os.listdir(PROJECTS_ROOT)):
        proj_path = os.path.join(PROJECTS_ROOT, proj_dir)
        if not os.path.isdir(proj_path):
            continue
        # 解析项目 ID
        parts = proj_dir.split('-', 1)
        pid = int(parts[0]) if parts[0].isdigit() else 0
        if project_id and pid != project_id:
            continue
        proj_name = parts[1] if len(parts) > 1 else proj_dir
        # 遍历所有阶段目录
        for phase_dir in os.listdir(proj_path) if os.path.isdir(proj_path) else []:
            phase_path = os.path.join(proj_path, phase_dir)
            if not os.path.isdir(phase_path):
                continue
            for fname in os.listdir(phase_path):
                if '会议纪要' in fname or '圆桌会议' in fname or 'roundtable' in fname.lower():
                    fpath = os.path.join(phase_path, fname)
                    stat = os.stat(fpath)
                    results.append({
                        'project_id': pid,
                        'project_name': proj_name,
                        'phase_dir': phase_dir,
                        'file_name': fname,
                        'file_path': os.path.join(proj_dir, phase_dir, fname),
                        'size': stat.st_size,
                        'modified_at': stat.st_mtime,
                    })
    results.sort(key=lambda x: x['modified_at'], reverse=True)
    return results


@router.delete("/minutes")
async def delete_meeting_minute(file_path: str = ""):
    """删除会议纪要文件（同时删除磁盘文件和数据库记录）"""
    import os
    from main import PROJECTS_ROOT
    if not file_path:
        raise HTTPException(400, "缺少 file_path 参数")
    full_path = os.path.normpath(os.path.join(PROJECTS_ROOT, file_path))
    # 安全检查
    if not full_path.startswith(os.path.normpath(PROJECTS_ROOT)):
        raise HTTPException(400, "非法路径")
    if os.path.exists(full_path):
        os.remove(full_path)
    # 同时删除 DB 记录（如果有的话）
    db = await get_db()
    await db.execute("DELETE FROM outputs WHERE file_path = ?", (file_path,))
    await db.commit()
    return {"message": "已删除", "file_path": file_path}


@router.delete("/history/{output_id}")
async def delete_roundtable_record(output_id: int):
    """删除一条圆桌会议讨论记录"""
    db = await get_db()
    await db.execute("DELETE FROM outputs WHERE id = ? AND file_type = 'roundtable'", (output_id,))
    await db.commit()
    return {"message": "已删除"}


class SummaryRequest(BaseModel):
    project_id: int = 0
    topic: str = ""
    speeches: str = ""        # 所有发言内容（Markdown）
    summary: str = ""         # PM 汇总报告


@router.post("/summary")
async def roundtable_summary(req: SummaryRequest):
    """一键生成会议纪要 — 流式输出精炼总结"""
    if not req.speeches:
        raise HTTPException(400, "没有可总结的发言内容")

    def send_event(data):
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def generate():
        current_date = datetime.now().strftime('%Y年%m月%d日')
        try:
            system_prompt = (
                "你是一位专业的会议纪要撰写专家。请根据以下圆桌会议的讨论内容，生成一份精炼的会议纪要。\n\n"
                "⚠️ 重要：日期只在开头出现一次，格式为「📅 YYYY年MM月DD日」，后面不要再重复任何日期。\n\n"
                "输出格式（严格按此结构，不要添加额外的日期或时间信息）：\n\n"
                f"# 📝 会议纪要\n\n"
                f"📅 {current_date}\n\n"
                "---\n\n"
                "## 🎯 议题\n\n"
                "（一句话概括讨论议题）\n\n"
                "## 💡 核心结论\n\n"
                "（每位参与 Agent 的关键观点，用 **角色名** 标注，每条不超过两行）\n\n"
                "## ✅ 共识与决策\n\n"
                "（大家达成一致的结论，用 ✓ 标记）\n\n"
                "## ⚠️ 分歧点\n\n"
                "（未达成一致的议题，列出各方立场）\n\n"
                "## 📋 待办事项\n\n"
                "- [ ] 待办 1：负责人 — 截止日期\n"
                "- [ ] 待办 2：负责人 — 截止日期\n\n"
                "## 🚨 风险提示\n\n"
                "（潜在风险和应对建议）\n\n"
                "---\n"
                f"*以上纪要由 AI 自动生成于 {current_date}*\n\n"
                "## 会议详情\n\n"
                f"### 议题\n{req.topic}\n\n"
            )
            if req.summary:
                system_prompt += f"### PM 汇总报告\n{req.summary}\n\n"
            system_prompt += f"### 各方发言详情\n\n{req.speeches}"

            # 尝试 LLM 流式生成
            full_text = ""
            try:
                async for chunk in llm_service.chat_stream(
                    system_prompt=system_prompt,
                    user_message="请生成本次会议的精炼纪要。再次提醒：日期只在开头出现一次。",
                    model=None,
                ):
                    choices = chunk.get("choices", [])
                    if choices and choices[0].get("delta", {}).get("content"):
                        content = choices[0]["delta"]["content"]
                        full_text += content
                        yield send_event({"content": content})
            except Exception as e:
                # LLM 失败时用 demo 模式逐句输出
                print(f"[RoundTable Summary] LLM 调用失败: {e}", flush=True)
                demo_text = _generate_demo_minutes(req.topic, req.speeches, req.summary)
                # 逐段输出，模拟流式效果
                paragraphs = demo_text.split('\n\n')
                full_text = ""
                for para in paragraphs:
                    chunk = para + '\n\n'
                    full_text += chunk
                    yield send_event({"content": chunk})
                    await __import__('asyncio').sleep(0.15)  # 150ms 间隔，视觉上渐进显示

            # 保存纪要到磁盘
            if req.project_id:
                try:
                    from main import save_project_file
                    db = await get_db()
                    cursor = await db.execute("SELECT name FROM projects WHERE id = ?", (req.project_id,))
                    row = await cursor.fetchone()
                    if row:
                        proj_name = dict(row)["name"]
                        file_name = f"会议纪要-{req.topic[:20]}.md"
                        save_project_file(req.project_id, proj_name, "planning", file_name, full_text)
                except Exception as e:
                    print(f"[RoundTable Summary] 保存纪要失败: {e}", flush=True)

        except Exception as e:
            yield send_event({"content": f"\n\n⚠️ 生成失败：{str(e)[:200]}"})

        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


def _generate_demo_minutes(topic: str, speeches: str, summary: str) -> str:
    """Demo 模式下生成静态会议纪要 — 日期只出现一次，格式精美"""
    current_date = datetime.now().strftime('%Y年%m月%d日')
    lines = [
        f"# 📝 会议纪要\n",
        f"📅 {current_date}\n",
        f"\n---\n",
        f"\n## 🎯 议题\n",
        f"\n**{topic}**\n",
    ]
    if summary:
        lines.append(f"\n## 📋 PM 汇总\n\n{summary}\n")
    # 提取各角色发言摘要
    import re
    parts = re.split(r'\*\*(.+?)（(.+?)）：\*\*', speeches)
    if len(parts) >= 4:
        lines.append("\n## 💡 核心结论\n")
        for i in range(1, len(parts), 3):
            if i + 2 < len(parts):
                name = parts[i].strip()
                role = parts[i + 1].strip()
                content = parts[i + 2].strip()[:300]
                # 截取第一段作为核心观点
                first_para = content.split('\n')[0][:150]
                lines.append(f"- **{name}（{role}）：** {first_para}\n")
    lines.append(f"\n---\n\n*📝 以上纪要由 AI 自动生成于 {current_date}*\n\n> 💡 Demo 模式 — 配置 API Key 后可获取 AI 生成的精炼纪要")
    return "\n".join(lines)
