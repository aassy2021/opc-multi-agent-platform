/**
 * 消息通知中心 — 侧边栏底部 Bug 铃铛 + 右下角弹窗
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

  // 点击面板外部关闭
  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowPanel(false)
      }
    }
    if (showPanel) {
      const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
      return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick) }
    }
  }, [showPanel])

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') setShowPanel(false) }
    if (showPanel) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [showPanel])

  const openBugs = bugs.filter(b => b.status === 'open')
  const fixedBugs = bugs.filter(b => b.status === 'fixed')
  const displayBugs = [...openBugs, ...fixedBugs, ...bugs.filter(b => !['open', 'fixed'].includes(b.status))]

  const handleBugClick = (bug) => {
    setShowPanel(false)
    navigate('/tasks', { state: { highlightBugId: bug.id, highlightBugNo: bug.bug_no } })
  }

  return (
    <>
      {/* 🐛 侧边栏触发按钮 */}
      <div ref={panelRef}>
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
      </div>

      {/* 通知面板 — 固定在屏幕右下角 */}
      {showPanel && (
        <>
          {/* 半透明遮罩，点击关闭 */}
          <div className="fixed inset-0 z-[99]" style={{ background: 'transparent' }} />

          <div ref={panelRef}
            className="fixed z-[100] w-[420px] max-h-[70vh] flex flex-col overflow-hidden"
            style={{
              bottom: '20px',
              right: '20px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
            }}>

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                  style={{ background: 'linear-gradient(135deg,#FF6B6B,#ee5a24)' }}>🐛</span>
                <div>
                  <span className="text-sm font-bold text-white block">Bug 通知中心</span>
                  {bugs.length > 0 && (
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {openBugs.length} 待修复 · {fixedBugs.length} 待验证 · {bugs.length} 总计
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setShowPanel(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all text-sm">
                ✕
              </button>
            </div>

            {/* 统计条 */}
            <div className="px-5 py-2.5 flex gap-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: '#FF6B6B', boxShadow: '0 0 6px #FF6B6B' }}></span>
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">待修复 {openBugs.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: '#FDCB6E', boxShadow: '0 0 6px #FDCB6E' }}></span>
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">待验证 {fixedBugs.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: '#00B894', boxShadow: '0 0 6px #00B894' }}></span>
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">已验证 {bugs.filter(b => b.status === 'verified').length}</span>
              </div>
            </div>

            {/* Bug 列表 */}
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {loading && bugs.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)] text-xs">
                  <span className="animate-spin text-2xl block mb-2">⏳</span>
                  加载中...
                </div>
              ) : displayBugs.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)] text-xs">
                  <span className="text-3xl block mb-2">✅</span>
                  <span className="text-sm">暂无 Bug 工单</span>
                </div>
              ) : (
                displayBugs.map(bug => {
                  const status = STATUS_MAP[bug.status] || STATUS_MAP.open
                  const sev = SEVERITY_MAP[bug.severity] || SEVERITY_MAP.medium
                  return (
                    <div key={bug.id}
                      onClick={() => handleBugClick(bug)}
                      className="rounded-xl p-3.5 transition-all cursor-pointer hover:translate-y-[-1px]"
                      style={{
                        background: bug.status === 'open' ? 'rgba(255,107,107,0.05)' :
                                    bug.status === 'fixed' ? 'rgba(253,203,110,0.05)' :
                                    'rgba(255,255,255,0.02)',
                        border: bug.status === 'open' ? '1px solid rgba(255,107,107,0.15)' :
                                bug.status === 'fixed' ? '1px solid rgba(253,203,110,0.15)' :
                                '1px solid var(--border-color)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = bug.status === 'open' ? 'rgba(255,107,107,0.1)' : 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = bug.status === 'open' ? 'rgba(255,107,107,0.05)' : bug.status === 'fixed' ? 'rgba(253,203,110,0.05)' : 'rgba(255,255,255,0.02)'}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm">{status.icon}</span>
                        <span className="text-[11px] font-mono font-bold" style={{ color: status.color }}>{bug.bug_no}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: sev.color + '18', color: sev.color }}>
                          {sev.label}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold ml-auto"
                          style={{ color: status.color, background: status.color + '18' }}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-[13px] text-white font-medium mb-1 leading-snug">{bug.title}</p>
                      {bug.description && (
                        <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mb-1.5 leading-relaxed">{bug.description.slice(0, 120)}</p>
                      )}
                      {bug.fix_note && (
                        <div className="mt-2 text-[11px] text-yellow-400/80 rounded-lg px-3 py-1.5"
                          style={{ background: 'rgba(253,203,110,0.08)', border: '1px solid rgba(253,203,110,0.12)' }}>
                          🔧 {bug.fix_note.slice(0, 100)}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
                        <span>{bug.reporter_icon || '🧪'} {bug.reporter_name || 'QA'}</span>
                        <span style={{ color: 'var(--border-color)' }}>→</span>
                        <span>{bug.assignee_icon || '💻'} {bug.assignee_name || 'DEV'}</span>
                        <span className="ml-auto text-[10px]">{bug.created_at ? new Date(bug.created_at).toLocaleString('zh-CN') : ''}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border-color)' }}>
              <button
                onClick={() => { setShowPanel(false); navigate('/tasks') }}
                className="flex-1 text-center text-xs font-semibold text-white py-2 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', boxShadow: '0 2px 8px rgba(108,92,231,0.3)' }}>
                📋 查看全部
              </button>
              <button
                onClick={() => { setLoading(true); loadBugs().finally(() => setLoading(false)) }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-all hover:bg-white/5"
                style={{ border: '1px solid var(--border-color)' }}>
                🔄 刷新
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
