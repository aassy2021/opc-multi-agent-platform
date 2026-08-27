import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../stores/useStore'
import { api } from '../api/client'
import ReactMarkdown from 'react-markdown'

const COLUMNS = [
  { id: 'todo', label: '待办', icon: '📝', color: '#FDCB6E' },
  { id: 'doing', label: '进行中', icon: '🔄', color: '#6C5CE7' },
  { id: 'done', label: '已完成', icon: '✅', color: '#00B894' },
]

const PRIORITY_MAP = {
  urgent: { label: '紧急', color: '#FF6B6B' },
  high: { label: '高', color: '#FDCB6E' },
  medium: { label: '中', color: '#6C5CE7' },
  low: { label: '低', color: '#00B894' },
}

const AGENT_MAP = {
  pm: { label: '产品经理', icon: '📋', color: '#FDCB6E' },
  dev: { label: '开发工程师', icon: '💻', color: '#6C5CE7' },
  qa: { label: '测试工程师', icon: '🔍', color: '#FF6B6B' },
  ops: { label: '运营专家', icon: '📈', color: '#00B894' },
  writer: { label: '内容润色', icon: '✍️', color: '#0984E3' },
}

const BUG_STATUS = {
  open:     { label: '待修复', color: '#FF6B6B', icon: '🐛' },
  fixed:    { label: '待验证', color: '#FDCB6E', icon: '🔧' },
  verified: { label: '已关闭', color: '#00B894', icon: '🎉' },
  reopened: { label: '重新打开', color: '#E17055', icon: '🔄' },
}

const BUG_SEVERITY = {
  critical: { label: '致命', color: '#FF4757' },
  high:     { label: '高', color: '#FF6B6B' },
  medium:   { label: '中', color: '#FDCB6E' },
  low:      { label: '低', color: '#00B894' },
}

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

  // 详情弹窗
  const [detailItem, setDetailItem] = useState(null) // { type: 'task'|'bug', data: {...} }
  // 从 NotificationCenter 跳转来的高亮 Bug
  const [highlightBugId, setHighlightBugId] = useState(null)

  useEffect(() => { loadAllTasks(); loadBugs() }, [])

  // 接收 NotificationCenter 的高亮参数
  useEffect(() => {
    const state = location.state
    if (state?.highlightBugId) {
      setHighlightBugId(state.highlightBugId)
      // 自动加载并打开该 Bug 详情
      api.getBug(state.highlightBugId).then(bug => {
        setDetailItem({ type: 'bug', data: bug })
      }).catch(() => {})
      // 清除导航 state 避免刷新重复触发
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

  // 持续轮询高亮 Bug 的存在性（3秒后清除高亮）
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
      title: form.title,
      description: form.description,
      priority: form.priority,
      agent_id: AGENT_ROLE_TO_ID[form.assigned_agent] || null,
      project_id: parseInt(form.project_id),
    })
    await loadAllTasks()
    setShowCreateModal(false)
    setForm({ title: '', description: '', priority: 'medium', assigned_agent: 'pm', project_id: '' })
  }

  const handleMoveTask = (taskId, newStatus) => {
    updateTask(taskId, { status: newStatus })
  }

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

  return (
    <div className="p-6 h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white">📋 任务看板</h2>
          <p className="text-[var(--text-secondary)] mt-1">
            共 {allTasks.length} 个任务 · {filteredTasks.length} 个匹配 · {bugs.length} 个 Bug
          </p>
        </div>
        <button onClick={() => { setShowCreateModal(true); setForm(f => ({ ...f, project_id: filterProject !== 'all' ? filterProject : (projects[0]?.id || '') })) }}
          className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
          + 新建任务
        </button>
      </div>

      {/* 过滤栏 */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-secondary)]">📁 项目：</span>
          <select
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--primary)]"
            value={filterProject} onChange={e => setFilterProject(e.target.value)}>
            <option value="all">全部项目 ({allTasks.length})</option>
            {projects.map(p => (
              <option key={p.id} value={String(p.id)}>
                {p.name} ({projectTaskCounts[String(p.id)] || 0})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1.5 flex-wrap flex-1">
          <button onClick={() => setFilterProject('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              filterProject === 'all' ? 'bg-[var(--primary)] text-white' : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'
            }`}>
            全部
          </button>
          {projects.map(p => {
            const count = projectTaskCounts[String(p.id)] || 0
            return (
              <button key={p.id} onClick={() => setFilterProject(String(p.id))}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  filterProject === String(p.id) ? 'bg-[var(--primary)] text-white' : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'
                }`}>
                {p.name} {count > 0 && <span className="opacity-60">({count})</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* 看板列 */}
      <div className="flex-1 grid grid-cols-4 gap-4 overflow-auto" style={{ gridTemplateColumns: '1fr 1fr 1fr minmax(280px, 0.8fr)' }}>
        {COLUMNS.map(col => {
          const colTasks = getTasksByStatus(col.id)
          return (
            <div key={col.id} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] flex flex-col min-h-[300px]">
              <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{col.icon}</span>
                  <span className="font-medium text-white">{col.label}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-[var(--text-secondary)]">
                  {colTasks.length}
                </span>
              </div>
              <div className="flex-1 p-3 space-y-3 overflow-auto">
                {colTasks.map(task => {
                  const agentInfo = AGENT_MAP[task.assigned_agent] || AGENT_MAP[task.agent_role] || null
                  const projectName = getProjectName(task.project_id)
                  return (
                    <div key={task.id}
                      onClick={() => setDetailItem({ type: 'task', data: task })}
                      className="bg-[var(--bg-dark)] rounded-lg p-4 border border-[var(--border-color)] hover:border-[var(--primary)] transition-colors cursor-pointer group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary)] bg-opacity-20 text-[var(--primary)]">
                          📁 {projectName}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ background: (PRIORITY_MAP[task.priority]?.color || '#666') + '20', color: PRIORITY_MAP[task.priority]?.color || '#999' }}>
                          {PRIORITY_MAP[task.priority]?.label || task.priority}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-white mb-1">{task.title}</h4>
                      {task.description && (
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-secondary)]">
                          {agentInfo ? `${agentInfo.icon} ${agentInfo.label}` : (task.agent_name || '未分配')}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {col.id !== 'todo' && (
                            <button onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, COLUMNS[COLUMNS.findIndex(c => c.id === col.id) - 1]?.id || 'todo') }}
                              className="text-xs px-2 py-1 bg-white/5 rounded hover:bg-white/10 text-[var(--text-secondary)]">←</button>
                          )}
                          {col.id !== 'done' && (
                            <button onClick={(e) => { e.stopPropagation(); handleMoveTask(task.id, COLUMNS[COLUMNS.findIndex(c => c.id === col.id) + 1]?.id || 'done') }}
                              className="text-xs px-2 py-1 bg-white/5 rounded hover:bg-white/10 text-[var(--text-secondary)]">→</button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                            className="text-xs px-2 py-1 bg-red-500/10 rounded hover:bg-red-500/20 text-red-400">×</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {colTasks.length === 0 && (
                  <div className="text-center py-8 text-[var(--text-secondary)] text-sm opacity-50">暂无任务</div>
                )}
              </div>
            </div>
          )
        })}

        {/* Bug 工单列 */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] flex flex-col min-h-[300px]">
          <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>🐛</span>
              <span className="font-medium text-white text-sm">Bug 工单</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-[var(--text-secondary)]">
              {bugs.length}
            </span>
          </div>
          <div className="flex-1 p-3 space-y-2 overflow-auto">
            {bugs.length === 0 && (
              <div className="text-center py-8 text-[var(--text-secondary)] text-sm opacity-50">暂无 Bug</div>
            )}
            {bugs.map(bug => {
              const bs = BUG_STATUS[bug.status] || BUG_STATUS.open
              const sev = BUG_SEVERITY[bug.severity] || BUG_SEVERITY.medium
              const isHighlighted = highlightBugId === bug.id
              return (
                <div key={bug.id}
                  onClick={() => setDetailItem({ type: 'bug', data: bug })}
                  className={`rounded-lg p-3 border transition-all cursor-pointer ${
                    isHighlighted ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-[var(--bg-dark)] animate-pulse' : ''
                  }`}
                  style={{ background: bs.color + '08', borderColor: isHighlighted ? '#FDCB6E' : bs.color + '20' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs">{bs.icon}</span>
                    <span className="text-[10px] font-mono" style={{ color: bs.color }}>{bug.bug_no}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto"
                      style={{ background: sev.color + '20', color: sev.color }}>
                      {sev.label}
                    </span>
                  </div>
                  <p className="text-xs text-white font-medium mb-1">{bug.title}</p>
                  {bug.fix_note && <p className="text-[10px] text-yellow-400/80 truncate">🔧 {bug.fix_note.slice(0, 40)}</p>}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px]" style={{ color: bs.color }}>
                    <span style={{ background: bs.color + '20' }} className="px-1.5 py-0.5 rounded">{bs.label}</span>
                    <span className="text-[var(--text-secondary)] ml-auto">{bug.reporter_icon || '🧪'} → {bug.assignee_icon || '💻'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══ 详情弹窗 ═══ */}
      {detailItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDetailItem(null)}>
          <div className="bg-[var(--bg-card)] rounded-2xl w-[640px] max-h-[80vh] border border-[var(--border-color)] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* 弹窗头部 */}
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xl">
                  {detailItem.type === 'task' ? '📋' : '🐛'}
                </span>
                <h3 className="text-lg font-bold text-white">{detailItem.data.title}</h3>
              </div>
              <button onClick={() => setDetailItem(null)} className="text-[var(--text-secondary)] hover:text-white text-lg">✕</button>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {detailItem.type === 'task' ? (
                <TaskDetail task={detailItem.data} getProjectName={getProjectName} />
              ) : (
                <BugDetail bug={detailItem.data} getProjectName={getProjectName} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 新建任务弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-[var(--bg-card)] rounded-2xl p-6 w-[500px] border border-[var(--border-color)]" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">📋 新建任务</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">所属项目 *</label>
                <select className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white focus:outline-none focus:border-[var(--primary)]"
                  value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">请选择项目</option>
                  {projects.map(p => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">任务标题 *</label>
                <input className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white focus:outline-none focus:border-[var(--primary)]"
                  placeholder="任务名称" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">描述</label>
                <textarea className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white focus:outline-none focus:border-[var(--primary)] resize-none"
                  rows={2} placeholder="任务描述..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">优先级</label>
                  <select className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white focus:outline-none"
                    value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="urgent">🔴 紧急</option>
                    <option value="high">🟡 高</option>
                    <option value="medium">🟣 中</option>
                    <option value="low">🟢 低</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">指派给</label>
                  <select className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white focus:outline-none"
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
              <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 rounded-lg text-[var(--text-secondary)] hover:text-white transition-colors">取消</button>
              <button onClick={handleCreate} disabled={!form.project_id || !form.title.trim()}
                className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                创建任务
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══ 任务详情子组件 ═══ */
function TaskDetail({ task, getProjectName }) {
  const agentInfo = AGENT_MAP[task.assigned_agent] || AGENT_MAP[task.agent_role] || null
  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <div className="grid grid-cols-2 gap-4">
        <InfoRow label="所属项目" value={`📁 ${getProjectName(task.project_id)}`} />
        <InfoRow label="优先级">
          <span className="px-2 py-0.5 rounded text-xs font-medium"
            style={{ background: (PRIORITY_MAP[task.priority]?.color || '#666') + '20', color: PRIORITY_MAP[task.priority]?.color || '#999' }}>
            {PRIORITY_MAP[task.priority]?.label || task.priority}
          </span>
        </InfoRow>
        <InfoRow label="状态">
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white">
            {COLUMNS.find(c => c.id === task.status)?.icon} {COLUMNS.find(c => c.id === task.status)?.label || task.status}
          </span>
        </InfoRow>
        <InfoRow label="指派给" value={agentInfo ? `${agentInfo.icon} ${agentInfo.label}` : (task.agent_name || '未分配')} />
      </div>

      {/* 描述 */}
      {task.description && (
        <div className="bg-[var(--bg-dark)] rounded-lg p-4 border border-[var(--border-color)]">
          <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">📝 描述</h4>
          <p className="text-sm text-white whitespace-pre-wrap">{task.description}</p>
        </div>
      )}

      {/* 时间信息 */}
      <div className="flex gap-4 text-[10px] text-[var(--text-secondary)]">
        {task.created_at && <span>创建于 {new Date(task.created_at).toLocaleString('zh-CN')}</span>}
        {task.updated_at && <span>更新于 {new Date(task.updated_at).toLocaleString('zh-CN')}</span>}
      </div>
    </div>
  )
}

/* ═══ Bug 详情子组件 ═══ */
function BugDetail({ bug, getProjectName }) {
  const bs = BUG_STATUS[bug.status] || BUG_STATUS.open
  const sev = BUG_SEVERITY[bug.severity] || BUG_SEVERITY.medium
  return (
    <div className="space-y-4">
      {/* Bug 编号 + 状态 */}
      <div className="flex items-center gap-3">
        <span className="text-lg">{bs.icon}</span>
        <span className="text-sm font-mono text-[var(--text-secondary)]">{bug.bug_no}</span>
        <span className="px-2 py-0.5 rounded text-xs font-medium"
          style={{ background: bs.color + '20', color: bs.color }}>{bs.label}</span>
        <span className="px-2 py-0.5 rounded text-xs font-medium"
          style={{ background: sev.color + '20', color: sev.color }}>{sev.label}</span>
      </div>

      {/* 基本信息 */}
      <div className="grid grid-cols-2 gap-4">
        <InfoRow label="所属项目" value={`📁 ${getProjectName(bug.project_id)}`} />
        <InfoRow label="严重程度" value={sev.label} />
        <InfoRow label="指派修复" value={`${bug.assignee_icon || '💻'} ${bug.assignee_name || 'DEV'}`} />
        <InfoRow label="报告人" value={`${bug.reporter_icon || '🧪'} ${bug.reporter_name || 'QA'}`} />
      </div>

      {/* 问题描述 */}
      {bug.description && (
        <div className="bg-[var(--bg-dark)] rounded-lg p-4 border border-[var(--border-color)]">
          <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">🐛 问题描述</h4>
          <p className="text-sm text-white whitespace-pre-wrap">{bug.description}</p>
        </div>
      )}

      {/* 复现步骤 */}
      {bug.steps_to_reproduce && (
        <div className="bg-[var(--bg-dark)] rounded-lg p-4 border border-[var(--border-color)]">
          <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">🔄 复现步骤</h4>
          <p className="text-sm text-white whitespace-pre-wrap">{bug.steps_to_reproduce}</p>
        </div>
      )}

      {/* 期望/实际结果 */}
      {(bug.expected_result || bug.actual_result) && (
        <div className="grid grid-cols-2 gap-4">
          {bug.expected_result && (
            <div className="bg-green-500/5 rounded-lg p-3 border border-green-500/20">
              <h4 className="text-xs font-medium text-green-400 mb-1">✅ 期望结果</h4>
              <p className="text-xs text-white">{bug.expected_result}</p>
            </div>
          )}
          {bug.actual_result && (
            <div className="bg-red-500/5 rounded-lg p-3 border border-red-500/20">
              <h4 className="text-xs font-medium text-red-400 mb-1">❌ 实际结果</h4>
              <p className="text-xs text-white">{bug.actual_result}</p>
            </div>
          )}
        </div>
      )}

      {/* 修复说明 */}
      {bug.fix_note && (
        <div className="bg-yellow-500/5 rounded-lg p-4 border border-yellow-500/20">
          <h4 className="text-xs font-medium text-yellow-400 mb-2">🔧 修复说明</h4>
          <p className="text-sm text-white whitespace-pre-wrap">{bug.fix_note}</p>
        </div>
      )}

      {/* 时间信息 */}
      <div className="flex gap-4 text-[10px] text-[var(--text-secondary)]">
        {bug.created_at && <span>创建于 {new Date(bug.created_at).toLocaleString('zh-CN')}</span>}
        {bug.updated_at && <span>更新于 {new Date(bug.updated_at).toLocaleString('zh-CN')}</span>}
      </div>
    </div>
  )
}

/* ═══ 通用信息行 ═══ */
function InfoRow({ label, value, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--text-secondary)] min-w-[70px]">{label}</span>
      {children || <span className="text-sm text-white">{value}</span>}
    </div>
  )
}
