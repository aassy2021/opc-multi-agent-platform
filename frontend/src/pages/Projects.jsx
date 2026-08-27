import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../stores/useStore'
import { api } from '../api/client'

const PHASE_CONFIG = {
  planning:     { label: '策划中', color: '#FDCB6E', icon: '📋', agent: 'pm',    agentLabel: '产品经理' },
  developing:   { label: '开发中', color: '#6C5CE7', icon: '💻', agent: 'dev',   agentLabel: '开发工程师' },
  testing:      { label: '测试中', color: '#FF6B6B', icon: '🧪', agent: 'qa',    agentLabel: '测试工程师' },
  launching:    { label: '上线中', color: '#00B894', icon: '🚀', agent: 'ops',   agentLabel: '运营专家' },
  launched:     { label: '已上线', color: '#00B894', icon: '✅', agent: null,    agentLabel: '' },
}

const PHASE_WORKFLOW = ['planning', 'developing', 'testing', 'launching', 'launched']

export default function Projects() {
  const projects = useStore(s => s.projects)
  const createProject = useStore(s => s.createProject)
  const setCurrentProject = useStore(s => s.setCurrentProject)
  const refreshProjects = useStore(s => s.refreshProjects)
  const navigate = useNavigate()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [detailProject, setDetailProject] = useState(null)
  const [editingProject, setEditingProject] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [deleting, setDeleting] = useState(null)

  // 获取当前用户（localStorage）
  const getCurrentUser = () => localStorage.getItem('opc_user') || ''

  const handleCreate = async () => {
    if (!form.name.trim()) return
    const user = getCurrentUser() || '管理员'
    await createProject({ ...form, created_by: user })
    if (!getCurrentUser()) localStorage.setItem('opc_user', user)
    setShowCreateModal(false)
    setForm({ name: '', description: '' })
  }

  const handleDetail = async (e, project) => {
    e.stopPropagation()
    try {
      const full = await api.getProject(project.id)
      setDetailProject(full)
    } catch (err) {
      console.error(err)
    }
  }

  const handleEdit = (e, project) => {
    e.stopPropagation()
    setEditingProject(project)
    setEditForm({ name: project.name, description: project.description || '' })
  }

  const handleSaveEdit = async () => {
    if (!editForm.name.trim()) return
    await api.updateProject(editingProject.id, editForm)
    setEditingProject(null)
    await refreshProjects()
    if (detailProject?.id === editingProject.id) {
      const full = await api.getProject(editingProject.id)
      setDetailProject(full)
    }
  }

  // 点击项目卡片 → 跳转到当前阶段对应的 Agent 对话
  const handleSelectProject = async (project) => {
    try {
      const full = await api.getProject(project.id)
      setCurrentProject(full)
    } catch {
      setCurrentProject(project)
    }
    const cfg = PHASE_CONFIG[project.phase]
    navigate('/chat', { state: {
      agentRole: cfg?.agent || 'pm',
      projectId: project.id,
      projectName: project.name,
    }})
  }

  // 手动切换阶段
  const handlePhaseChange = async (e, project, targetPhase) => {
    e.stopPropagation()
    if (targetPhase === project.phase) return
    if (!confirm(`确认切换到「${PHASE_CONFIG[targetPhase].label}」？`)) return
    try {
      await api.changePhase(project.id, targetPhase)
      await refreshProjects()
      const full = await api.getProject(project.id)
      setDetailProject(full)
    } catch (err) {
      alert(err.message || '切换失败')
    }
  }

  // 删除项目
  const handleDelete = async (e, project) => {
    e.stopPropagation()
    if (!window.confirm(`确定删除项目「${project.name}」？\n此操作将删除所有对话、任务、产出和磁盘文件，不可恢复！`)) return
    setDeleting(project.id)
    try {
      const user = getCurrentUser()
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: user ? { 'X-Current-User': user } : {},
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '删除失败')
      alert(data.message || '已删除')
      setDetailProject(null)
      await refreshProjects()
    } catch (err) {
      alert('删除失败: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  // 复制输出路径
  const copyPath = (path) => {
    navigator.clipboard.writeText(path).then(() => {
      alert('已复制路径: ' + path)
    }).catch(() => {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = path; document.body.appendChild(ta)
      ta.select(); document.execCommand('copy')
      document.body.removeChild(ta)
      alert('已复制路径: ' + path)
    })
  }

  return (
    <div className="p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">📁 项目管理</h2>
          <p className="text-[var(--text-secondary)] mt-1">点击项目卡片进入对应 Agent 对话 · 可随时手动切换阶段</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
          + 新建项目
        </button>
      </div>

      {/* 工作流说明 */}
      <div className="flex items-center gap-2 mb-6 px-4 py-3 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
        <span className="text-sm text-[var(--text-secondary)] mr-2">工作流：</span>
        {PHASE_WORKFLOW.map((phase, i) => (
          <React.Fragment key={phase}>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: PHASE_CONFIG[phase].color + '20', color: PHASE_CONFIG[phase].color }}>
              {PHASE_CONFIG[phase].icon} {PHASE_CONFIG[phase].label}
            </span>
            {i < PHASE_WORKFLOW.length - 1 && <span className="text-[var(--text-secondary)] text-xs">→</span>}
          </React.Fragment>
        ))}
        <span className="text-xs text-[var(--text-secondary)] ml-2">· 点击卡片可切换到任意阶段</span>
      </div>

      {/* 项目列表 */}
      <div className="grid grid-cols-3 gap-4">
        {projects.map(p => {
          const cfg = PHASE_CONFIG[p.phase] || PHASE_CONFIG.planning
          return (
            <div key={p.id} 
              onClick={() => handleSelectProject(p)}
              className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-5 hover:border-[var(--primary)] transition-all group cursor-pointer">
              {/* 顶部 */}
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">📦</span>
                <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: cfg.color + '20', color: cfg.color }}>
                  {cfg.icon} {cfg.label}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white">{p.name}</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">{p.description || '暂无描述'}</p>
              
              {/* 输出路径 */}
              {p.output_path && (
                <div className="mt-2 flex items-center gap-1.5 group/path">
                  <span className="text-[10px] text-[var(--text-secondary)] opacity-60">📂</span>
                  <code className="text-[11px] text-[var(--text-secondary)] opacity-60 font-mono truncate max-w-[200px]">{p.output_path}</code>
                  <button onClick={(e) => { e.stopPropagation(); copyPath(p.output_path) }}
                    className="text-[10px] text-[var(--primary)] opacity-0 group-hover/path:opacity-100 transition-opacity hover:text-white"
                    title="复制路径">📋</button>
                </div>
              )}
              
              {/* 进度条 */}
              <div className="flex gap-1 mt-3">
                {PHASE_WORKFLOW.map(phase => {
                  const currentIdx = PHASE_WORKFLOW.indexOf(p.phase)
                  const phaseIdx = PHASE_WORKFLOW.indexOf(phase)
                  return (
                    <div key={phase} className="flex-1 h-1.5 rounded-full transition-all" 
                      style={{ background: phaseIdx <= currentIdx ? PHASE_CONFIG[phase].color : 'rgba(255,255,255,0.1)' }} />
                  )
                })}
              </div>

              {/* Agent 摘要 */}
              <div className="flex gap-2 mt-3 text-xs text-[var(--text-secondary)]">
                <span>📋 {p.agent_task_count || 0} 任务</span>
                <span>📄 {p.agent_output_count || 0} 产出</span>
                <span className="ml-auto text-[var(--primary)]">🤖 {cfg.agentLabel}</span>
              </div>

              {/* 底部按钮 */}
              <div className="flex gap-2 mt-4">
                <button onClick={(e) => handleDetail(e, p)}
                  className="flex-1 px-3 py-2 bg-white/5 text-[var(--text-secondary)] rounded-lg text-xs hover:bg-white/10 hover:text-white transition-all">
                  📋 详情
                </button>
                <button onClick={(e) => handleEdit(e, p)}
                  className="flex-1 px-3 py-2 bg-white/5 text-[var(--text-secondary)] rounded-lg text-xs hover:bg-white/10 hover:text-white transition-all">
                  ✏️ 编辑
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleSelectProject(p) }}
                  className="flex-1 px-3 py-2 bg-[var(--primary)] bg-opacity-80 text-white rounded-lg text-xs font-medium hover:opacity-90 transition-all">
                  💬 对话
                </button>
                <button onClick={(e) => handleDelete(e, p)}
                  disabled={deleting === p.id}
                  className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-all disabled:opacity-50"
                  title="删除项目">
                  {deleting === p.id ? '⏳' : '🗑️'}
                </button>
              </div>
            </div>
          )
        })}

        {/* 新建卡片 */}
        <div className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--primary)] transition-colors min-h-[280px]"
          onClick={() => setShowCreateModal(true)}>
          <span className="text-4xl text-[var(--text-secondary)]">+</span>
          <p className="text-[var(--text-secondary)] mt-2">新建项目</p>
        </div>
      </div>

      {/* ========= 详情面板 ========= */}
      {detailProject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDetailProject(null)}>
          <div className="bg-[var(--bg-card)] rounded-2xl w-[800px] max-h-[85vh] border border-[var(--border-color)] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📦</span>
                  <div>
                    <h3 className="text-xl font-bold text-white">{detailProject.name}</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">{detailProject.description || '暂无描述'}</p>
                    {detailProject.output_path && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-xs text-[var(--text-secondary)]">📂 输出目录：</span>
                        <code className="text-xs text-[var(--primary)] font-mono bg-white/5 px-2 py-0.5 rounded cursor-pointer hover:bg-white/10"
                          onClick={() => copyPath(detailProject.output_path)} title="点击复制">
                          {detailProject.output_path}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => setDetailProject(null)} className="text-[var(--text-secondary)] hover:text-white text-xl p-1">✕</button>
              </div>

              {/* 阶段进度条 */}
              <div className="flex items-center gap-2 mt-4">
                {PHASE_WORKFLOW.map((phase, i) => {
                  const currentIdx = PHASE_WORKFLOW.indexOf(detailProject.phase)
                  const phaseIdx = PHASE_WORKFLOW.indexOf(phase)
                  const c = PHASE_CONFIG[phase]
                  return (
                    <React.Fragment key={phase}>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${phaseIdx === currentIdx ? 'font-bold' : ''}`}
                        style={{ 
                          background: phaseIdx <= currentIdx ? c.color + '20' : 'rgba(255,255,255,0.05)',
                          color: phaseIdx <= currentIdx ? c.color : 'var(--text-secondary)',
                        }}>
                        {c.icon} {c.label}
                      </div>
                      {i < PHASE_WORKFLOW.length - 1 && <span className="text-xs" style={{ color: phaseIdx < currentIdx ? 'var(--text-primary)' : 'var(--text-secondary)' }}>→</span>}
                    </React.Fragment>
                  )
                })}
              </div>

              {/* ★ 手动切换阶段 */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-[var(--text-secondary)]">🔄 切换阶段：</span>
                <div className="flex gap-1 flex-wrap">
                  {PHASE_WORKFLOW.map(phase => {
                    const c = PHASE_CONFIG[phase]
                    const isCurrent = phase === detailProject.phase
                    return (
                      <button key={phase}
                        onClick={(e) => handlePhaseChange(e, detailProject, phase)}
                        disabled={isCurrent}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${isCurrent ? 'ring-2 ring-offset-1 ring-offset-[var(--bg-card)]' : 'hover:opacity-80 cursor-pointer'}`}
                        style={{ 
                          background: isCurrent ? c.color : c.color + '30', 
                          color: isCurrent ? '#fff' : c.color,
                          ...(isCurrent ? { ringColor: c.color } : {}),
                        }}>
                        {c.icon} {c.label} {isCurrent ? '(当前)' : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Agent 摘要 */}
            <div className="px-6 py-4 border-b border-[var(--border-color)]">
              <h4 className="text-sm font-semibold text-white mb-3">🤖 Agent 工作摘要</h4>
              <div className="grid grid-cols-5 gap-2">
                {detailProject.agent_summary?.map(a => {
                  const isActive = PHASE_CONFIG[detailProject.phase]?.agent === a.role
                  return (
                    <div key={a.role} className={`p-3 rounded-lg text-center ${isActive ? 'bg-[var(--primary)] bg-opacity-20 border border-[var(--primary)]' : 'bg-white/5'}`}>
                      <span className="text-xl">{a.icon}</span>
                      <p className="text-xs text-white mt-1 font-medium">{a.name}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{a.task_count}任务 · {a.output_count}产出 · {a.conversation_count}对话</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 任务列表 */}
            <div className="px-6 py-4 border-b border-[var(--border-color)] max-h-[200px] overflow-auto">
              <h4 className="text-sm font-semibold text-white mb-3">📋 任务记录</h4>
              {detailProject.tasks?.length > 0 ? (
                <div className="space-y-2">
                  {detailProject.tasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span>{t.agent_icon || '🤖'}</span>
                        <span className="text-sm text-white">{t.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${t.status === 'done' ? 'bg-green-500/20 text-green-400' : t.status === 'doing' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {t.status === 'done' ? '已完成' : t.status === 'doing' ? '进行中' : '待办'}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">{t.agent_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">暂无任务</p>
              )}
            </div>

            {/* 产出物 */}
            <div className="px-6 py-4 flex-1 overflow-auto">
              <h4 className="text-sm font-semibold text-white mb-3">📄 产出物</h4>
              {detailProject.outputs?.length > 0 ? (
                <div className="space-y-2">
                  {detailProject.outputs.map(o => (
                    <div key={o.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span>{o.agent_icon || '📄'}</span>
                        <span className="text-sm text-white">{o.file_name}</span>
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">{o.agent_name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">暂无产出物</p>
              )}
            </div>

            {/* 底部 */}
            <div className="px-6 py-3 border-t border-[var(--border-color)] flex justify-between items-center">
              <button onClick={(e) => handleDelete(e, detailProject)}
                disabled={deleting === detailProject.id}
                className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition-all disabled:opacity-50">
                {deleting === detailProject.id ? '⏳ 删除中...' : '🗑️ 删除项目'}
              </button>
              <div className="flex gap-3">
                <button onClick={(e) => { handleEdit(e, detailProject); setDetailProject(null) }}
                  className="px-4 py-2 bg-white/5 text-[var(--text-secondary)] rounded-lg text-sm hover:bg-white/10 hover:text-white">
                  ✏️ 编辑项目
                </button>
                <button onClick={() => {
                  const cfg = PHASE_CONFIG[detailProject.phase]
                  if (cfg?.agent) {
                    setCurrentProject(detailProject)
                    navigate('/chat', { state: { agentRole: cfg.agent, projectId: detailProject.id, projectName: detailProject.name }})
                    setDetailProject(null)
                  }
                }}
                  className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90">
                  💬 进入对话
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========= 编辑弹窗 ========= */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingProject(null)}>
          <div className="bg-[var(--bg-card)] rounded-2xl p-6 w-[500px] border border-[var(--border-color)]" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">✏️ 编辑项目</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">项目名称 *</label>
                <input className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">项目描述</label>
                <textarea className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white resize-none" rows={3} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingProject(null)} className="px-5 py-2.5 rounded-lg text-[var(--text-secondary)] hover:text-white">取消</button>
              <button onClick={handleSaveEdit} className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* ========= 新建弹窗 ========= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-[var(--bg-card)] rounded-2xl p-6 w-[500px] border border-[var(--border-color)]" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">📁 新建项目</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">项目名称 *</label>
                <input className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white" placeholder="例如：记账小程序" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">项目描述</label>
                <textarea className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white resize-none" rows={3} placeholder="简要描述项目的目标和功能..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 rounded-lg text-[var(--text-secondary)] hover:text-white">取消</button>
              <button onClick={handleCreate} className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90">创建项目</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
