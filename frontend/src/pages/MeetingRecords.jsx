/**
 * 会议记录页 — 浏览和管理所有圆桌会议记录和纪要
 * 左侧：会议纪要列表（磁盘文件）
 * 右侧：选中纪要的 Markdown 内容预览
 */
import React, { useState, useEffect } from 'react'
import { useStore } from '../stores/useStore'
import { api } from '../api/client'
import ReactMarkdown from 'react-markdown'

export default function MeetingRecords() {
  const projects = useStore(s => s.projects)
  const [minutes, setMinutes] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterProject, setFilterProject] = useState('all')
  const [activeTab, setActiveTab] = useState('minutes') // minutes | history
  const [historyRecords, setHistoryRecords] = useState([])

  const loadData = async () => {
    setLoading(true)
    try {
      const [minutesData, historyData] = await Promise.all([
        api.getMeetingMinutes(filterProject !== 'all' ? filterProject : undefined).catch(() => []),
        api.getRoundtableHistory(filterProject !== 'all' ? filterProject : undefined).catch(() => []),
      ])
      setMinutes(minutesData)
      setHistoryRecords(historyData)
    } catch (e) { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [filterProject])

  // 查看磁盘纪要文件内容
  const handleViewMinutes = async (item) => {
    try {
      const data = await api.readProjectFile(item.project_id, item.file_path)
      setSelected({ type: 'file', title: item.file_name, content: data.content, meta: item })
    } catch (e) {
      setSelected({ type: 'file', title: item.file_name, content: '⚠️ 无法加载文件内容', meta: item })
    }
  }

  // 查看讨论记录内容
  const handleViewHistory = async (record) => {
    setSelected({ type: 'history', title: record.file_name, content: record.content, meta: record })
  }

  // 删除会议纪要
  const handleDeleteMinutes = async (item, e) => {
    e.stopPropagation()
    if (!confirm(`确认删除「${item.file_name}」？`)) return
    try {
      await api.deleteMeetingMinute(item.file_path)
      setMinutes(prev => prev.filter(m => m.file_path !== item.file_path))
      if (selected?.meta?.file_path === item.file_path) setSelected(null)
    } catch (err) {
      alert('删除失败: ' + (err.message || ''))
    }
  }

  // 删除讨论记录
  const handleDeleteHistory = async (record, e) => {
    e.stopPropagation()
    if (!confirm(`确认删除「${record.file_name}」？`)) return
    try {
      await api.deleteRoundtableRecord(record.id)
      setHistoryRecords(prev => prev.filter(h => h.id !== record.id))
      if (selected?.meta?.id === record.id) setSelected(null)
    } catch (err) {
      alert('删除失败: ' + (err.message || ''))
    }
  }

  const getProjectName = (pid) => {
    const p = projects.find(p => p.id === pid)
    return p?.name || `项目#${pid}`
  }

  const formatSize = (bytes) => {
    if (!bytes) return '0B'
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
  }

  return (
    <div className="p-6 h-full flex gap-6">
      {/* 左侧列表 */}
      <div className="w-[480px] flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">📝 会议记录</h2>
            <p className="text-[var(--text-secondary)] mt-1">
              共 {minutes.length} 份纪要 · {historyRecords.length} 条讨论记录
            </p>
          </div>
        </div>

        {/* 过滤 + Tab */}
        <div className="flex items-center gap-3 mb-4 flex-shrink-0">
          <select
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--primary)]"
            value={filterProject} onChange={e => setFilterProject(e.target.value)}>
            <option value="all">全部项目</option>
            {projects.map(p => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>

          <div className="flex gap-1 ml-auto">
            <button onClick={() => setActiveTab('minutes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'minutes' ? 'bg-[var(--primary)] text-white' : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'
              }`}>
              📄 会议纪要 ({minutes.length})
            </button>
            <button onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'history' ? 'bg-[var(--primary)] text-white' : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'
              }`}>
              💬 讨论记录 ({historyRecords.length})
            </button>
          </div>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-auto space-y-2">
          {loading ? (
            <div className="text-center py-12 text-[var(--text-secondary)]">
              <span className="animate-spin text-3xl block mb-3">⏳</span>
              <p className="text-sm">加载中...</p>
            </div>
          ) : activeTab === 'minutes' ? (
            minutes.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-secondary)]">
                <span className="text-4xl block mb-3">📋</span>
                <p className="text-sm">暂无会议纪要</p>
                <p className="text-xs mt-1">在圆桌会议中点击「一键总结」生成</p>
              </div>
            ) : minutes.map((item, idx) => (
              <div key={idx} onClick={() => handleViewMinutes(item)}
                className={`rounded-xl border p-4 cursor-pointer transition-all ${
                  selected?.type === 'file' && selected?.meta?.file_path === item.file_path
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                    : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--primary)]/50'
                }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">📄</span>
                      <h4 className="text-sm font-medium text-white truncate">{item.file_name}</h4>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
                      <span>📁 {getProjectName(item.project_id)}</span>
                      <span>📂 {item.phase_dir}</span>
                      <span>💾 {formatSize(item.size)}</span>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                      {item.modified_at ? new Date(item.modified_at * 1000).toLocaleString('zh-CN') : ''}
                    </p>
                  </div>
                  <button onClick={(e) => handleDeleteMinutes(item, e)}
                    className="text-[10px] px-2 py-1 bg-red-500/10 rounded hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                    style={{ opacity: 0.6 }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))
          ) : (
            historyRecords.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-secondary)]">
                <span className="text-4xl block mb-3">💬</span>
                <p className="text-sm">暂无讨论记录</p>
              </div>
            ) : historyRecords.map((record) => (
              <div key={record.id} onClick={() => handleViewHistory(record)}
                className={`rounded-xl border p-4 cursor-pointer transition-all ${
                  selected?.type === 'history' && selected?.meta?.id === record.id
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                    : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--primary)]/50'
                }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">💬</span>
                      <h4 className="text-sm font-medium text-white truncate">{record.file_name}</h4>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-1 mb-1">
                      {record.content ? record.content.slice(0, 80) + '...' : '无内容'}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
                      <span>📁 {getProjectName(record.project_id)}</span>
                      <span>{record.created_at ? new Date(record.created_at).toLocaleString('zh-CN') : ''}</span>
                    </div>
                  </div>
                  <button onClick={(e) => handleDeleteHistory(record, e)}
                    className="text-[10px] px-2 py-1 bg-red-500/10 rounded hover:bg-red-500/20 text-red-400 flex-shrink-0 ml-2"
                    style={{ opacity: 0.6 }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧预览 */}
      <div className="flex-1 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{selected.type === 'file' ? '📄' : '💬'}</span>
                <h3 className="text-lg font-bold text-white">{selected.title}</h3>
                {selected.meta && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)]">
                    {getProjectName(selected.meta.project_id)}
                  </span>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-[var(--text-secondary)] hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{selected.content || '（无内容）'}</ReactMarkdown>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)]">
            <div className="text-center">
              <span className="text-6xl block mb-4">📋</span>
              <p className="text-lg">选择一份会议记录查看</p>
              <p className="text-sm mt-2">会议纪要按标题保存在项目文件夹中</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
