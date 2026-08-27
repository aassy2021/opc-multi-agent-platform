import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../stores/useStore'

const statCards = [
  { key: 'projects', icon: '📁', label: '项目数', color: '#6C5CE7' },
  { key: 'tasks', icon: '📋', label: '任务数', color: '#00B894' },
  { key: 'outputs', icon: '📄', label: '产出物', color: '#FF6B6B' },
  { key: 'agents', icon: '🤖', label: 'Agent', color: '#FDCB6E' },
]

export default function Dashboard() {
  const stats = useStore(s => s.stats)
  const projects = useStore(s => s.projects)
  const agents = useStore(s => s.agents)
  const navigate = useNavigate()

  return (
    <div className="p-6 h-full overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">📊 Dashboard</h2>
        <p className="text-[var(--text-secondary)] mt-1">一人公司 AI 指挥中心总览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {statCards.map(card => (
          <div key={card.key} className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-color)] hover:border-opacity-50 transition-all" style={{ borderColor: card.color + '40' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--text-secondary)] text-sm">{card.label}</p>
                <p className="text-3xl font-bold text-white mt-1">{stats[card.key] || 0}</p>
              </div>
              <span className="text-3xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 最近项目 */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">📁 最近项目</h3>
            <button
              onClick={() => navigate('/projects')}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              查看全部 →
            </button>
          </div>
          {projects.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              <p className="text-3xl mb-2">📝</p>
              <p>还没有项目</p>
              <button
                onClick={() => navigate('/projects')}
                className="mt-3 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm hover:opacity-90"
              >
                + 新建项目
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 5).map(p => {
                const phaseColors = {
                  planning: '#FDCB6E',
                  developing: '#6C5CE7',
                  testing: '#FF6B6B',
                  launched: '#00B894'
                }
                const phaseLabels = {
                  planning: '策划中',
                  developing: '开发中',
                  testing: '测试中',
                  launched: '已上线'
                }
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                    onClick={() => navigate('/chat')}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📦</span>
                      <div>
                        <p className="text-sm font-medium text-white">{p.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{p.description || '暂无描述'}</p>
                      </div>
                    </div>
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ background: (phaseColors[p.phase] || '#666') + '20', color: phaseColors[p.phase] || '#999' }}
                    >
                      {phaseLabels[p.phase] || p.phase}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Agent 状态 */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">🤖 Agent 状态</h3>
            <button
              onClick={() => navigate('/settings')}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              管理 →
            </button>
          </div>
          <div className="space-y-3">
            {agents.filter(a => a.role !== 'writer').map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <span className="text-2xl">{a.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{a.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{a.description}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>
                  <span className="text-xs text-green-400">就绪</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
