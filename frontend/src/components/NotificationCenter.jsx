/**
 * 消息通知中心 — 侧边栏底部 Bug 铃铛 + 弹窗列表
 * 展示 Bug 状态变更通知（创建/修复/验证/重新打开）
 * 不依赖 currentProject，显示所有项目的 Bug
 * 点击 Bug → 跳转到任务看板 Bug 栏并高亮
 */
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

const SEVERITY_MAP = {
  critical: { label: '致命', color: '#FF4757', bg: 'bg-red-500/10' },
  high:     { label: '高',   color: '#FF6B6B', bg: 'bg-red-400/10' },
  medium:   { label: '中',   color: '#FDCB6E', bg: 'bg-yellow-400/10' },
  low:      { label: '低',   color: '#00B894', bg: 'bg-green-400/10' },
}

const STATUS_MAP = {
  open:     { label: '待修复', color: '#FF6B6B', icon: '🐛' },
  fixed:    { label: '已修复', color: '#FDCB6E', icon: '🔧' },
  verified: { label: '已验证', color: '#00B894', icon: '🎉' },
  reopened: { label: '重新打开', color: '#E17055', icon: '🔄' },
}

export default function NotificationCenter() {
  const navigate = useNavigate()
  const [bugs, setBugs] = useState([])
  const [showPanel, setShowPanel] = useState(false)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)
  const prevBugCountRef = useRef(0)

  const loadBugs = async () => {
    try {
      const data = await api.getBugs()
      if (prevBugCountRef.current > 0 && data.length > prevBugCountRef.current) {
        const newBugs = data.slice(0, data.length - prevBugCountRef.current)
        newBugs.forEach(bug => showNotification(bug))
      }
      prevBugCountRef.current = data.length
      setBugs(data)
    } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    loadBugs()
    const interval = setInterval(loadBugs, 30000)
    return () => clearInterval(interval)
  }, [])

  const showNotification = (bug) => {
    const status = STATUS_MAP[bug.status] || STATUS_MAP.open
    const sev = SEVERITY_MAP[bug.severity] || SEVERITY_MAP.medium
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${status.icon} ${bug.bug_no}`, {
        body: `${bug.title}\n严重程度: ${sev.label} | 状态: ${status.label}`,
      })
    }
  }

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowPanel(false)
      }
    }
    if (showPanel) {
      setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPanel])

  const openBugs = bugs.filter(b => b.status === 'open')
  const fixedBugs = bugs.filter(b => b.status === 'fixed')
  const displayBugs = [...openBugs, ...fixedBugs, ...bugs.filter(b => !['open', 'fixed'].includes(b.status))]

  // 点击 Bug → 跳转到任务看板并传递高亮 Bug ID
  const handleBugClick = (bug) => {
    setShowPanel(false)
    navigate('/tasks', { state: { highlightBugId: bug.id, highlightBugNo: bug.bug_no } })
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* 🐛 按钮 */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowPanel(!showPanel) }}
        className={`relative p-2 rounded-lg transition-all ${showPanel ? 'bg-white/10 text-white' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'}`}
        title="Bug 通知中心"
      >
        🐛
        {openBugs.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold animate-pulse">
            {openBugs.length}
          </span>
        )}
      </button>

      {/* 通知面板 */}
      {showPanel && (
        <div className="absolute left-full bottom-0 ml-3 w-[420px] max-h-[60vh] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">🐛</span>
              <span className="text-sm font-bold text-white">Bug 通知中心</span>
            </div>
            <div className="flex items-center gap-2">
              {bugs.length > 0 && (
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {openBugs.length} 待修复 / {fixedBugs.length} 待验证 / {bugs.length} 总计
                </span>
              )}
              <button onClick={() => setShowPanel(false)} className="text-[var(--text-secondary)] hover:text-white text-sm">✕</button>
            </div>
          </div>

          {/* 统计条 */}
          <div className="px-4 py-2 border-b border-[var(--border-color)] flex gap-3 flex-shrink-0">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="text-[10px] text-[var(--text-secondary)]">待修复 {openBugs.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span className="text-[10px] text-[var(--text-secondary)]">待验证 {fixedBugs.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-[10px] text-[var(--text-secondary)]">已验证 {bugs.filter(b => b.status === 'verified').length}</span>
            </div>
          </div>

          {/* Bug 列表 */}
          <div className="flex-1 overflow-auto p-2 space-y-2">
            {loading && bugs.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-secondary)] text-xs">
                <span className="animate-spin text-2xl block mb-2">⏳</span>
                加载中...
              </div>
            ) : displayBugs.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-secondary)] text-xs">
                <span className="text-2xl block mb-2">✅</span>
                暂无 Bug 工单
              </div>
            ) : (
              displayBugs.map(bug => {
                const status = STATUS_MAP[bug.status] || STATUS_MAP.open
                const sev = SEVERITY_MAP[bug.severity] || SEVERITY_MAP.medium
                return (
                  <div key={bug.id}
                    onClick={() => handleBugClick(bug)}
                    className={`rounded-lg border p-3 transition-all cursor-pointer hover:brightness-110 ${
                      bug.status === 'open' ? 'border-red-500/20 bg-red-500/5' :
                      bug.status === 'fixed' ? 'border-yellow-500/20 bg-yellow-500/5' :
                      'border-[var(--border-color)] bg-white/[0.02]'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs">{status.icon}</span>
                      <span className="text-[10px] font-mono text-[var(--text-secondary)]">{bug.bug_no}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sev.bg}`}
                        style={{ color: sev.color }}>
                        {sev.label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto"
                        style={{ color: status.color, background: `${status.color}15` }}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-white font-medium mb-1">{bug.title}</p>
                    {bug.description && (
                      <p className="text-[10px] text-[var(--text-secondary)] line-clamp-2">{bug.description.slice(0, 120)}</p>
                    )}
                    {bug.fix_note && (
                      <div className="mt-1.5 text-[10px] text-yellow-400/80 bg-yellow-500/5 rounded px-2 py-1">
                        🔧 {bug.fix_note.slice(0, 100)}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                      <span>{bug.reporter_icon || '🧪'} {bug.reporter_name || 'QA'}</span>
                      <span>→</span>
                      <span>{bug.assignee_icon || '💻'} {bug.assignee_name || 'DEV'}</span>
                      <span className="ml-auto">{bug.created_at ? new Date(bug.created_at).toLocaleString('zh-CN') : ''}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--border-color)] flex-shrink-0 flex gap-2">
            <button
              onClick={() => { setShowPanel(false); navigate('/tasks') }}
              className="flex-1 text-center text-[10px] text-[var(--primary)] hover:text-white hover:bg-[var(--primary)]/20 transition-all py-1.5 rounded-lg border border-[var(--primary)]/30">
              📋 查看全部
            </button>
            <button
              onClick={() => { setLoading(true); loadBugs().finally(() => setLoading(false)) }}
              className="flex-1 text-center text-[10px] text-[var(--text-secondary)] hover:text-white transition-all py-1.5">
              🔄 刷新
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
