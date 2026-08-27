const API_BASE = '/api'

export const api = {
  // ====== Dashboard ======
  getStats: () => fetch(`${API_BASE}/dashboard/stats`).then(r => r.json()),

  // ====== Projects ======
  getProjects: () => fetch(`${API_BASE}/projects`).then(r => r.json()),
  createProject: (data) => fetch(`${API_BASE}/projects`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }).then(r => r.json()),
  getProject: (id) => fetch(`${API_BASE}/projects/${id}`).then(r => r.json()),
  updateProject: (id, data) => fetch(`${API_BASE}/projects/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }).then(r => r.json()),
  deleteProject: (id) => {
    const user = localStorage.getItem('opc_user') || ''
    return fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE',
      headers: user ? { 'X-Current-User': user } : {},
    }).then(r => r.json())
  },
  advanceProject: (id) => fetch(`${API_BASE}/projects/${id}/advance`, { method: 'POST' }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || '流转失败') })
    return r.json()
  }),
  changePhase: (id, phase) => fetch(`${API_BASE}/projects/${id}/phase`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase })
  }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || '切换失败') })
    return r.json()
  }),

  // ====== Phase Logs（阶段日志） ======
  getPhaseLogs: (projectId) => fetch(`${API_BASE}/projects/${projectId}/phase-logs`).then(r => r.json()),
  submitPlan: (projectId, content) => fetch(`${API_BASE}/projects/${projectId}/phase-logs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || '提交失败') })
    return r.json()
  }),
  reviewPhaseLog: (projectId, logId, action, comment) => fetch(`${API_BASE}/projects/${projectId}/phase-logs/${logId}/review`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, comment })
  }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || '审核失败') })
    return r.json()
  }),

  // ====== Agents ======
  getAgents: () => fetch(`${API_BASE}/agents`).then(r => r.json()),
  getAgent: (id) => fetch(`${API_BASE}/agents/${id}`).then(r => r.json()),
  updateAgentPrompt: (id, system_prompt) => fetch(`${API_BASE}/agents/${id}/prompt`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system_prompt })
  }).then(r => r.json()),

  // ====== Chat ======
  getConversations: (projectId, agentRole) => {
    let url = `${API_BASE}/conversations?project_id=${projectId}`
    if (agentRole) url += `&agent_role=${agentRole}`
    return fetch(url).then(r => r.json())
  },
  clearConversations: (projectId, agentRole) => {
    let url = `${API_BASE}/conversations?project_id=${projectId}`
    if (agentRole) url += `&agent_role=${agentRole}`
    return fetch(url, { method: 'DELETE' }).then(r => r.json())
  },
  /**
   * 通用 Agent 对话（SSE 流式）
   * 后端会自动从 DB 加载完整对话历史 + 项目上下文，前端只需传新消息
   * @param {string} agentRole - e.g. 'pm', 'writer'
   * @param {string} message - 用户消息文本
   * @param {number} projectId - 项目 ID
   * @param {function} onChunk - (chunkText) => void
   * @param {function} onDone - () => void
   */
  chatStream: async (agentRole, message, projectId, onChunk, onDone) => {
    const messages = [{ role: 'user', content: message }]
    const response = await fetch(`${API_BASE}/agents/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_role: agentRole, messages, project_id: projectId || 0, stream: true })
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') {
            onDone?.()
            return
          }
          try {
            const json = JSON.parse(payload)
            if (json.content != null) onChunk(json.content)
          } catch (e) {}
        }
      }
    }
  },

  // ====== Tasks ======
  getTasks: (projectId) => {
    let url = `${API_BASE}/tasks`
    if (projectId) url += `?project_id=${projectId}`
    return fetch(url).then(r => r.json())
  },
  createTask: (data) => fetch(`${API_BASE}/tasks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }).then(r => r.json()),
  updateTask: (id, data) => fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }).then(r => r.json()),
  deleteTask: (id) => fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // ====== Bug Tickets ======
  getBugs: (projectId, status, assigneeRole) => {
    let url = `${API_BASE}/bugs?`
    if (projectId) url += `project_id=${projectId}&`
    if (status) url += `status=${status}&`
    if (assigneeRole) url += `assignee_role=${assigneeRole}&`
    return fetch(url).then(r => r.json())
  },
  getBug: (id) => fetch(`${API_BASE}/bugs/${id}`).then(r => r.json()),
  createBug: (data) => fetch(`${API_BASE}/bugs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || '创建失败') })
    return r.json()
  }),
  fixBug: (id, fixNote) => fetch(`${API_BASE}/bugs/${id}/fix`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fix_note: fixNote })
  }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || '操作失败') })
    return r.json()
  }),
  verifyBug: (id, comment) => fetch(`${API_BASE}/bugs/${id}/verify`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment })
  }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || '操作失败') })
    return r.json()
  }),
  reopenBug: (id) => fetch(`${API_BASE}/bugs/${id}/reopen`, {
    method: 'POST'
  }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || '操作失败') })
    return r.json()
  }),
  deleteBug: (id) => fetch(`${API_BASE}/bugs/${id}`, { method: 'DELETE' }).then(r => r.json()),
  getBugStats: (projectId) => {
    let url = `${API_BASE}/bugs/stats/summary?`
    if (projectId) url += `project_id=${projectId}`
    return fetch(url).then(r => r.json())
  },

  // ====== Outputs ======
  getOutputs: (projectId, fileType) => {
    let url = `${API_BASE}/outputs?`
    if (projectId) url += `project_id=${projectId}&`
    if (fileType) url += `file_type=${fileType}&`
    return fetch(url).then(r => r.json())
  },
  createOutput: (data) => fetch(`${API_BASE}/outputs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }).then(r => r.json()),
  getOutput: (id) => fetch(`${API_BASE}/outputs/${id}`).then(r => r.json()),
  deleteOutput: (id) => fetch(`${API_BASE}/outputs/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // ====== Project Files（磁盘文件浏览） ======
  getProjectFiles: (projectId) => fetch(`${API_BASE}/projects/${projectId}/files`).then(r => r.json()),
  readProjectFile: (projectId, filePath) => fetch(`${API_BASE}/projects/${projectId}/files/${encodeURIComponent(filePath)}`).then(r => r.json()),

  // ====== Reviewer（审核专家） ======
  getReviewerDecisions: (projectId) => fetch(`${API_BASE}/projects/${projectId}/reviewer-decisions`).then(r => r.json()),
  requestReview: (projectId) => fetch(`${API_BASE}/projects/${projectId}/request-review`, { method: 'POST' }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || '请求审核失败') })
    return r.json()
  }),
  respondToReviewer: (projectId, decisionId, action, comment) => fetch(`${API_BASE}/projects/${projectId}/reviewer-decisions/${decisionId}/respond`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, comment })
  }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || '操作失败') })
    return r.json()
  }),

  requestRevision: (projectId, comment) => fetch(`${API_BASE}/projects/${projectId}/request-revision`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment })
  }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || '操作失败') })
    return r.json()
  }),

  // ====== 圆桌会议 ======
  roundtable: (data, onEvent) => {
    // SSE 流式圆桌会议，data = { project_id, topic, agent_roles, extra_context }
    return fetch(`${API_BASE}/roundtable`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(async response => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: '请求失败' }))
        throw new Error(err.detail || '请求失败')
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''  // 缓冲区：处理跨 chunk 的不完整行
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()  // 最后一段可能不完整，留在缓冲区
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ')) {
            const payload = trimmed.slice(6)
            if (payload === '[DONE]') return
            try {
              const json = JSON.parse(payload)
              onEvent?.(json)
            } catch (e) {}
          }
        }
      }
    })
  },
  getRoundtableHistory: (projectId) => {
    let url = `${API_BASE}/roundtable/history`
    if (projectId) url += `?project_id=${projectId}`
    return fetch(url).then(r => r.json())
  },
  deleteRoundtableRecord: (id) => fetch(`${API_BASE}/roundtable/history/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // ====== 会议纪要（磁盘文件） ======
  getMeetingMinutes: (projectId) => {
    let url = `${API_BASE}/roundtable/minutes`
    if (projectId) url += `?project_id=${projectId}`
    return fetch(url).then(r => r.json())
  },
  deleteMeetingMinute: (filePath) => fetch(`${API_BASE}/roundtable/minutes?file_path=${encodeURIComponent(filePath)}`, { method: 'DELETE' }).then(r => r.json()),

  // ====== 圆桌会议一键总结（SSE 流式） ======
  roundtableSummary: async (data, onChunk, onDone) => {
    const response = await fetch(`${API_BASE}/roundtable/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '请求失败' }))
      throw new Error(err.detail || '请求失败')
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') { onDone?.(); return }
          try {
            const json = JSON.parse(payload)
            if (json.content != null) onChunk(json.content)
          } catch (e) {}
        }
      }
    }
  },

  // ====== TTS 语音合成（edge-tts 甜美女声） ======
  tts: (text, voice, rate, pitch) => fetch(`${API_BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: voice || 'zh-CN-XiaoyiNeural', rate: rate || '+0%', pitch: pitch || '+5Hz' })
  }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.detail || '语音合成失败') })
    return r.json()
  }),
  ttsVoices: () => fetch(`${API_BASE}/tts/voices`).then(r => r.json()),
}
