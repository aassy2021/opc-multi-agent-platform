import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../stores/useStore'
import { api } from '../api/client'

/* ═══════════════════════════════════════════════════════
   数据配置
   ═══════════════════════════════════════════════════════ */

const COLUMNS = [
  { id: 'todo',   label: '待办',   icon: '📋', gradient: 'linear-gradient(135deg,#636e72,#b2bec3)', dotColor: '#dfe6e9' },
  { id: 'doing',  label: '进行中', icon: '⚡', gradient: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', dotColor: '#a29bfe' },
  { id: 'done',   label: '已完成', icon: '✅', gradient: 'linear-gradient(135deg,#00b894,#55efc4)', dotColor: '#55efc4' },
]

const PRIORITY_MAP = {
  urgent: { label: '紧急', color: '#FF6B6B', icon: '🔴', glow: '0 0 8px rgba(255,107,107,0.3)' },
  high:   { label: '高',   color: '#FDCB6E', icon: '🟡', glow: '0 0 8px rgba(253,203,110,0.3)' },
  medium: { label: '中',   color: '#74b9ff', icon: '🔵', glow: '0 0 8px rgba(116,185,255,0.3)' },
  low:    { label: '低',   color: '#00b894', icon: '🟢', glow: 'none' },
}

const AGENT_MAP = {
  pm:     { label: '产品经理',   icon: '📋', color: '#FDCB6E', gradient: 'linear-gradient(135deg,#fdcb6e,#e17055)' },
  dev:    { label: '开发工程师', icon: '💻', color: '#6C5CE7', gradient: 'linear-gradient(135deg,#6c5ce7,#a29bfe)' },
  qa:     { label: '测试工程师', icon: '🔍', color: '#FF6B6B', gradient: 'linear-gradient(135deg,#ff7675,#fd79a8)' },
  ops:    { label: '运营专家',   icon: '📈', color: '#00b894', gradient: 'linear-gradient(135deg,#00b894,#55efc4)' },
  writer: { label: '内容润色',   icon: '✍️', color: '#0984E3', gradient: 'linear-gradient(135deg,#0984e3,#74b9ff)' },
}

const BUG_STATUS = {
  open:     { label: '待修复', color: '#FF6B6B', icon: '🐛', bg: 'rgba(255,107,107,0.08)' },
  fixed:    { label: '待验证', color: '#FDCB6E', icon: '🔧', bg: 'rgba(253,203,110,0.08)' },
  verified: { label: '已关闭', color: '#00b894', icon: '🎉', bg: 'rgba(0,184,148,0.08)' },
  reopened: { label: '重开',   color: '#E17055', icon: '🔄', bg: 'rgba(225,112,85,0.08)' },
}

const BUG_SEVERITY = {
  critical: { label: '致命', color: '#FF4757' },
  high:     { label: '高',   color: '#FF6B6B' },
  medium:   { label: '中',   color: '#FDCB6E' },
  low:      { label: '低',   color: '#00b894' },
}

/* ═══════════════════════════════════════════════════════
   主组件
   ═══════════════════════════════════════════════════════ */
export default function TaskBoard() {
  const location = useLocation()
  const allTasks = useStore(s => s.allTasks)
  const loadAllTasks = useStore(s => s.loadAllTasks)
  const projects = useStore(s => s.projects)
  const updateTask = useStore(s => s.updateTask)
  const deleteTask = useStore(s => s.deleteTask)

  const [filterProject, setFilterProject] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', assigned_agent: 'pm', project_id: '' })
  const [bugs, setBugs] = useState([])
  const [detailItem, setDetailItem] = useState(null)
  const [highlightBugId, setHighlightBugId] = useState(null)
  const [view, setView] = useState('board') // board | list

  useEffect(() => { loadAllTasks(); loadBugs() }, [])

  useEffect(() => {
    const state = location.state
    if (state?.highlightBugId) {
      setHighlightBugId(state.highlightBugId)
      api.getBug(state.highlightBugId).then(bug => {
        setDetailItem({ type: 'bug', data: bug })
      }).catch(() => {})
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const loadBugs = async () => {
    try {
      const data = await api.getBugs(filterProject !== 'all' ? filterProject : undefined)
      setBugs(data)
    } catch (e) { /* ignore */ }
  }

  useEffect(() => { loadBugs() }, [filterProject])

  useEffect(() => {
    if (highlightBugId) {
      const timer = setTimeout(() => setHighlightBugId(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [highlightBugId])

  const handleCreate = async () => {
    if (!form.title.trim() || !form.project_id) return
    const AGENT_ROLE_TO_ID = { pm: 1, dev: 2, qa: 3, ops: 4, writer: 5 }
    await api.createTask({
      title: form.title, description: form.description,
      priority: form.priority, agent_id: AGENT_ROLE_TO_ID[form.assigned_agent] || null,
      project_id: parseInt(form.project_id),
    })
    await loadAllTasks()
    setShowCreateModal(false)
    setForm({ title: '', description: '', priority: 'medium', assigned_agent: 'pm', project_id: '' })
  }

  const handleMoveTask = (taskId, newStatus) => updateTask(taskId, { status: newStatus })

  const filteredTasks = allTasks.filter(t => {
    if (filterProject !== 'all' && String(t.project_id) !== filterProject) return false
    return true
  })

  const getTasksByStatus = (status) => filteredTasks.filter(t => t.status === status)

  const projectTaskCounts = {}
  allTasks.forEach(t => {
    const pid = String(t.project_id)
    projectTaskCounts[pid] = (projectTaskCounts[pid] || 0) + 1
  })

  const getProjectName = (projectId) => {
    const p = projects.find(p => p.id === projectId)
    return p?.name || `项目#${projectId}`
  }

  const totalByStatus = {
    todo: getTasksByStatus('todo').length,
    doing: getTasksByStatus('doing').length,
    done: getTasksByStatus('done').length,
  }

  const openBugCount = bugs.filter(b => b.status === 'open' || b.status === 'reopened').length

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-dark)' }}>

      {/* ═══ 顶部统计卡片 ═══ */}
      <div className="flex-shrink-0 px-6 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-tight">任务看板</h2>
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              <button onClick={() => setView('board')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === 'board' ? 'bg-white/10 text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}>
                ▦ 看板
              </button>
              <button onClick={() => setView('list')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === 'list' ? 'bg-white/10 text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}>
                ☰ 列表
              </button>
            </div>
          </div>
          <button onClick={() => { setShowCreateModal(true); setForm(f => ({ ...f, project_id: filterProject !== 'all' ? filterProject : (projects[0]?.id || '') })) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', boxShadow: '0 4px 15px rgba(108,92,231,0.35)' }}>
            <span className="text-lg leading-none">+</span> 新建任务
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-5 gap-3 mb-3">
          {COLUMNS.map(col => (
            <div key={col.id} className="rounded-xl p-3 relative overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-[40px] opacity-10" style={{ background: col.gradient }}></div>
              <div className="text-[11px] text-[var(--text-secondary)] mb-1 font-medium">{col.icon} {col.label}</div>
              <div className="text-2xl font-black text-white">{totalByStatus[col.id]}</div>
            </div>
          ))}
          <div className="rounded-xl p-3 relative overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-[40px] opacity-10" style={{ background: 'linear-gradient(135deg,#FF6B6B,#ee5a24)' }}></div>
            <div className="text-[11px] text-[var(--text-secondary)] mb-1 font-medium">🐛 Bug</div>
            <div className="text-2xl font-black" style={{ color: openBugCount > 0 ? '#FF6B6B' : '#00b894' }}>{openBugCount}</div>
          </div>
        </div>

        {/* 过滤栏 */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white/5 rounded-xl p-1">
            <button onClick={() => setFilterProject('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterProject === 'all' ? 'text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-white'
              }`} style={filterProject === 'all' ? { background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)' } : {}}>
              全部
            </button>
            {projects.map(p => {
              const count = projectTaskCounts[String(p.id)] || 0
              const isActive = filterProject === String(p.id)
              return (
                <button key={p.id} onClick={() => setFilterProject(String(p.id))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isActive ? 'text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-white'
                  }`} style={isActive ? { background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)' } : {}}>
                  {p.name}
                  {count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)' }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══ 看板主体 ═══ */}
      {view === 'board' ? (
        <div className="flex-1 overflow-auto px-6 pb-4">
          <div className="grid grid-cols-4 gap-4 h-full" style={{ gridTemplateColumns: '1fr 1fr 1fr minmax(280px, 0.8fr)' }}>
            {COLUMNS.map(col => {
              const colTasks = getTasksByStatus(col.id)
              return (
                <div key={col.id} className="flex flex-col min-h-0">
                  {/* 列头 */}
                  <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.dotColor, boxShadow: `0 0 6px ${col.dotColor}` }}></div>
                      <span className="text-sm font-bold text-white">{col.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                        {colTasks.length}
                      </span>
                    </div>
                  </div>
                  {/* 列内容 */}
                  <div className="flex-1 space-y-2.5 overflow-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                    {colTasks.map(task => (
                      <TaskCard key={task.id} task={task} col={col} getProjectName={getProjectName}
                        onDetail={() => setDetailItem({ type: 'task', data: task })}
                        onMove={(newStatus) => handleMoveTask(task.id, newStatus)}
                        onDelete={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                        colIndex={COLUMNS.findIndex(c => c.id === col.id)} />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 opacity-30">
                        <span className="text-3xl mb-2">{col.icon}</span>
                        <span className="text-xs text-[var(--text-secondary)]">暂无任务</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Bug 工单列 */}
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF6B6B', boxShadow: '0 0 6px #FF6B6B' }}></div>
                  <span className="text-sm font-bold text-white">Bug 工单</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                    {bugs.length}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-2.5 overflow-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {bugs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 opacity-30">
                    <span className="text-3xl mb-2">🐛</span>
                    <span className="text-xs text-[var(--text-secondary)]">暂无 Bug</span>
                  </div>
                )}
                {bugs.map(bug => (
                  <BugCard key={bug.id} bug={bug} highlight={highlightBugId === bug.id}
                    onDetail={() => setDetailItem({ type: 'bug', data: bug })} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ═══ 列表视图 ═══ */
        <div className="flex-1 overflow-auto px-6 pb-4">
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)]">标题</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)]">项目</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)]">状态</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)]">优先级</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)]">指派</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)]">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => {
                  const agentInfo = AGENT_MAP[task.assigned_agent] || AGENT_MAP[task.agent_role] || null
                  const col = COLUMNS.find(c => c.id === task.status)
                  return (
                    <tr key={task.id} className="border-b border-[var(--border-color)] hover:bg-white/[0.02] cursor-pointer transition-colors"
                      onClick={() => setDetailItem({ type: 'task', data: task })}>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-white">{task.title}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[var(--text-secondary)]">📁 {getProjectName(task.project_id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: col?.gradient || '#666', color: '#fff' }}>
                          {col?.icon} {col?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: (PRIORITY_MAP[task.priority]?.color || '#666') + '20', color: PRIORITY_MAP[task.priority]?.color || '#999' }}>
                          {PRIORITY_MAP[task.priority]?.icon} {PRIORITY_MAP[task.priority]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {agentInfo && (
                          <span className="text-xs" style={{ color: agentInfo.color }}>{agentInfo.icon} {agentInfo.label}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {task.status !== 'todo' && (
                            <button onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, COLUMNS[Math.max(0, COLUMNS.findIndex(c => c.id === task.status) - 1)]?.id || 'todo') }}
                              className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[var(--text-secondary)]">←</button>
                          )}
                          {task.status !== 'done' && (
                            <button onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, COLUMNS[Math.min(2, COLUMNS.findIndex(c => c.id === task.status) + 1)]?.id || 'done') }}
                              className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[var(--text-secondary)]">→</button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                            className="text-xs px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400">✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredTasks.length === 0 && (
              <div className="text-center py-12 text-[var(--text-secondary)]">
                <span className="text-3xl block mb-2">📭</span>
                <span className="text-sm">暂无任务</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ 详情弹窗 ═══ */}
      {detailItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setDetailItem(null)}>
          <div className="rounded-2xl w-[680px] max-h-[80vh] flex flex-col overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            {/* 弹窗头部 */}
            <div className="px-6 py-5 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: detailItem.type === 'task' ? 'linear-gradient(135deg,#6C5CE7,#a29bfe)' : 'linear-gradient(135deg,#FF6B6B,#ee5a24)' }}>
                  {detailItem.type === 'task' ? '📋' : '🐛'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{detailItem.data.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {detailItem.type === 'bug' ? detailItem.data.bug_no : `#${detailItem.data.id}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setDetailItem(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all">
                ✕
              </button>
            </div>
            {/* 弹窗内容 */}
            <div className="flex-1 overflow-auto p-6">
              {detailItem.type === 'task' ? (
                <TaskDetail task={detailItem.data} getProjectName={getProjectName} />
              ) : (
                <BugDetail bug={detailItem.data} getProjectName={getProjectName} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 新建任务弹窗 ═══ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="rounded-2xl p-6 w-[520px]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                style={{ background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)' }}>+</span>
              新建任务
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">所属项目 *</label>
                <select className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-xl text-white text-sm focus:outline-none focus:border-[var(--primary)]"
                  value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">请选择项目</option>
                  {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">任务标题 *</label>
                <input className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-xl text-white text-sm focus:outline-none focus:border-[var(--primary)]"
                  placeholder="输入任务标题..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">描述</label>
                <textarea className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-xl text-white text-sm focus:outline-none focus:border-[var(--primary)] resize-none"
                  rows={2} placeholder="任务描述..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">优先级</label>
                  <select className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-xl text-white text-sm focus:outline-none"
                    value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="urgent">🔴 紧急</option>
                    <option value="high">🟡 高</option>
                    <option value="medium">🔵 中</option>
                    <option value="low">🟢 低</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">指派给</label>
                  <select className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-xl text-white text-sm focus:outline-none"
                    value={form.assigned_agent} onChange={e => setForm({ ...form, assigned_agent: e.target.value })}>
                    <option value="pm">📋 产品经理</option>
                    <option value="dev">💻 开发工程师</option>
                    <option value="qa">🔍 测试工程师</option>
                    <option value="ops">📈 运营专家</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all">
                取消
              </button>
              <button onClick={handleCreate} disabled={!form.project_id || !form.title.trim()}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', boxShadow: '0 4px 15px rgba(108,92,231,0.3)' }}>
                创建任务
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   任务卡片组件
   ═══════════════════════════════════════════════════════ */
function TaskCard({ task, col, getProjectName, onDetail, onMove, onDelete, colIndex }) {
  const agentInfo = AGENT_MAP[task.assigned_agent] || AGENT_MAP[task.agent_role] || null
  const pConfig = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium

  return (
    <div onClick={onDetail}
      className="group rounded-xl p-3.5 cursor-pointer transition-all duration-200 hover:translate-y-[-2px]"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = col.dotColor; e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.25), 0 0 0 1px ${col.dotColor}30` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)' }}
    >
      {/* 顶部：项目标签 + 优先级 */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
          style={{ background: 'rgba(108,92,231,0.12)', color: '#a29bfe' }}>
          📁 {getProjectName(task.project_id)}
        </span>
        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-semibold"
          style={{ background: pConfig.color + '18', color: pConfig.color, boxShadow: pConfig.glow }}>
          {pConfig.icon} {pConfig.label}
        </span>
      </div>

      {/* 标题 */}
      <h4 className="text-[13px] font-semibold text-white mb-1.5 leading-snug">{task.title}</h4>

      {/* 描述 */}
      {task.description && (
        <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mb-3 leading-relaxed">{task.description}</p>
      )}

      {/* 底部：指派人 + 操作 */}
      <div className="flex items-center justify-between mt-1">
        {agentInfo ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px]"
              style={{ background: agentInfo.gradient }}>
              {agentInfo.icon}
            </div>
            <span className="text-[11px] font-medium" style={{ color: agentInfo.color }}>{agentInfo.label}</span>
          </div>
        ) : (
          <span className="text-[11px] text-[var(--text-secondary)] opacity-50">未分配</span>
        )}

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {colIndex > 0 && (
            <button onClick={(e) => { e.stopPropagation(); onMove(COLUMNS[colIndex - 1].id) }}
              className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all"
              title={`移至${COLUMNS[colIndex - 1].label}`}>
              ←
            </button>
          )}
          {colIndex < 2 && (
            <button onClick={(e) => { e.stopPropagation(); onMove(COLUMNS[colIndex + 1].id) }}
              className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all"
              title={`移至${COLUMNS[colIndex + 1].label}`}>
              →
            </button>
          )}
          <button onClick={onDelete}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="删除">
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Bug 卡片组件
   ═══════════════════════════════════════════════════════ */
function BugCard({ bug, highlight, onDetail }) {
  const bs = BUG_STATUS[bug.status] || BUG_STATUS.open
  const sev = BUG_SEVERITY[bug.severity] || BUG_SEVERITY.medium

  return (
    <div onClick={onDetail}
      className="group rounded-xl p-3.5 cursor-pointer transition-all duration-200 hover:translate-y-[-2px]"
      style={{
        background: highlight ? 'rgba(253,203,110,0.08)' : 'var(--bg-card)',
        border: highlight ? '1.5px solid #FDCB6E' : '1px solid var(--border-color)',
        boxShadow: highlight ? '0 0 20px rgba(253,203,110,0.2)' : '0 2px 8px rgba(0,0,0,0.15)',
        animation: highlight ? 'bugPulse 1.5s ease-in-out infinite' : 'none',
      }}
      onMouseEnter={e => { if (!highlight) e.currentTarget.style.borderColor = bs.color }}
      onMouseLeave={e => { if (!highlight) e.currentTarget.style.borderColor = 'var(--border-color)' }}
    >
      {/* 顶部：编号 + 严重度 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{bs.icon}</span>
          <span className="text-[11px] font-mono font-bold" style={{ color: bs.color }}>{bug.bug_no}</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
          style={{ background: sev.color + '18', color: sev.color }}>
          {sev.label}
        </span>
      </div>

      {/* 标题 */}
      <p className="text-[13px] font-semibold text-white mb-1.5 leading-snug">{bug.title}</p>

      {/* 修复说明 */}
      {bug.fix_note && (
        <p className="text-[11px] text-yellow-400/80 truncate mb-2">🔧 {bug.fix_note.slice(0, 50)}</p>
      )}

      {/* 底部：状态 + 指向 */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
          style={{ background: bs.color + '18', color: bs.color }}>
          {bs.label}
        </span>
        <span className="text-[10px] text-[var(--text-secondary)]">
          {bug.reporter_icon || '🧪'} → {bug.assignee_icon || '💻'}
        </span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   任务详情子组件
   ═══════════════════════════════════════════════════════ */
function TaskDetail({ task, getProjectName }) {
  const agentInfo = AGENT_MAP[task.assigned_agent] || AGENT_MAP[task.agent_role] || null
  const col = COLUMNS.find(c => c.id === task.status)
  const pConfig = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium

  return (
    <div className="space-y-5">
      {/* 状态条 */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
          style={{ background: col?.gradient }}>
          {col?.icon} {col?.label}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: pConfig.color + '18', color: pConfig.color, boxShadow: pConfig.glow }}>
          {pConfig.icon} {pConfig.label}优先级
        </span>
      </div>

      {/* 信息网格 */}
      <div className="grid grid-cols-2 gap-4">
        <InfoCard label="所属项目" icon="📁" value={getProjectName(task.project_id)} />
        {agentInfo && (
          <InfoCard label="指派给" icon={agentInfo.icon} value={agentInfo.label} color={agentInfo.color} />
        )}
        {task.created_at && (
          <InfoCard label="创建时间" icon="🕐" value={new Date(task.created_at).toLocaleString('zh-CN')} />
        )}
        {task.updated_at && (
          <InfoCard label="更新时间" icon="🕐" value={new Date(task.updated_at).toLocaleString('zh-CN')} />
        )}
      </div>

      {/* 描述 */}
      {task.description && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }}>
          <h4 className="text-xs font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">📝 描述</h4>
          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{task.description}</p>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Bug 详情子组件
   ═══════════════════════════════════════════════════════ */
function BugDetail({ bug, getProjectName }) {
  const bs = BUG_STATUS[bug.status] || BUG_STATUS.open
  const sev = BUG_SEVERITY[bug.severity] || BUG_SEVERITY.medium

  return (
    <div className="space-y-5">
      {/* 状态条 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: bs.color + '20', color: bs.color }}>
          {bs.icon} {bs.label}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: sev.color + '20', color: sev.color }}>
          {sev.label}严重
        </span>
        <span className="text-xs text-[var(--text-secondary)] font-mono">{bug.bug_no}</span>
      </div>

      {/* 信息网格 */}
      <div className="grid grid-cols-2 gap-4">
        <InfoCard label="所属项目" icon="📁" value={getProjectName(bug.project_id)} />
        <InfoCard label="报告人" icon={bug.reporter_icon || '🧪'} value={bug.reporter_name || 'QA'} />
        <InfoCard label="指派修复" icon={bug.assignee_icon || '💻'} value={bug.assignee_name || 'DEV'} />
        {bug.created_at && (
          <InfoCard label="创建时间" icon="🕐" value={new Date(bug.created_at).toLocaleString('zh-CN')} />
        )}
      </div>

      {/* 问题描述 */}
      {bug.description && (
        <DetailSection icon="🐛" title="问题描述" color="#FF6B6B">{bug.description}</DetailSection>
      )}

      {/* 复现步骤 */}
      {bug.steps_to_reproduce && (
        <DetailSection icon="🔄" title="复现步骤" color="#FDCB6E">{bug.steps_to_reproduce}</DetailSection>
      )}

      {/* 期望/实际结果 */}
      {(bug.expected_result || bug.actual_result) && (
        <div className="grid grid-cols-2 gap-4">
          {bug.expected_result && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(0,184,148,0.05)', border: '1px solid rgba(0,184,148,0.15)' }}>
              <h4 className="text-xs font-bold text-green-400 mb-2">✅ 期望结果</h4>
              <p className="text-sm text-white leading-relaxed">{bug.expected_result}</p>
            </div>
          )}
          {bug.actual_result && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,107,107,0.05)', border: '1px solid rgba(255,107,107,0.15)' }}>
              <h4 className="text-xs font-bold text-red-400 mb-2">❌ 实际结果</h4>
              <p className="text-sm text-white leading-relaxed">{bug.actual_result}</p>
            </div>
          )}
        </div>
      )}

      {/* 修复说明 */}
      {bug.fix_note && (
        <DetailSection icon="🔧" title="修复说明" color="#FDCB6E">{bug.fix_note}</DetailSection>
      )}

      {/* 时间 */}
      {bug.updated_at && (
        <p className="text-[10px] text-[var(--text-secondary)]">
          更新于 {new Date(bug.updated_at).toLocaleString('zh-CN')}
        </p>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   通用小组件
   ═══════════════════════════════════════════════════════ */
function InfoCard({ label, icon, value, color }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }}>
      <div className="text-[10px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-sm font-medium" style={{ color: color || 'white' }}>{value}</span>
      </div>
    </div>
  )
}

function DetailSection({ icon, title, color, children }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)' }}>
      <h4 className="text-xs font-bold mb-2 uppercase tracking-wider flex items-center gap-1.5" style={{ color: color || 'var(--text-secondary)' }}>
        {icon} {title}
      </h4>
      <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{children}</p>
    </div>
  )
}
