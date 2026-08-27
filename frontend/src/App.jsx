import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useStore } from './stores/useStore'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import AgentChat from './pages/AgentChat'
import TaskBoard from './pages/TaskBoard'
import OutputHub from './pages/OutputHub'
import Settings from './pages/Settings'
import Writer from './pages/Writer'
import RoundTable from './pages/RoundTable'
import MeetingRecords from './pages/MeetingRecords'
import ProductGuide from './components/ProductGuide'
import NotificationCenter from './components/NotificationCenter'

const navItems = [
  { path: '/', icon: '📊', label: '仪表盘' },
  { path: '/projects', icon: '📁', label: '项目' },
  { path: '/chat', icon: '💬', label: 'Agent 对话' },
  { path: '/writer', icon: '✍️', label: '内容润色' },
  { path: '/roundtable', icon: '🪑', label: '圆桌会议' },
  { path: '/meetings', icon: '📝', label: '会议记录' },
  { path: '/tasks', icon: '📋', label: '任务看板' },
  { path: '/outputs', icon: '📄', label: '产出中心' },
  { path: '/settings', icon: '⚙️', label: '设置' },
  { path: 'help', icon: '📖', label: '帮助' },
]

export default function App() {
  const init = useStore(s => s.init)
  const currentProject = useStore(s => s.currentProject)
  const [guideOpen, setGuideOpen] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => { init() }, [])

  // 监听语音状态变化
  useEffect(() => {
    const checkSpeaking = () => {
      setIsSpeaking(window.speechSynthesis.speaking)
    }
    
    // 定期检查语音状态
    const interval = setInterval(checkSpeaking, 500)
    
    // 监听路由变化，切换页面时停止语音
    const handleBeforeUnload = () => {
      window.speechSynthesis.cancel()
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // 全局停止语音
  const stopAllVoice = () => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen">
        {/* 侧边栏 */}
        <aside className="w-60 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col">
          {/* Logo */}
          <div className="p-5 border-b border-[var(--border-color)]">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🏢</span>
              <span>OPC Platform</span>
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">一人公司 AI 指挥中心</p>
          </div>

          {/* 当前项目 */}
          {currentProject && (
            <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-dark)]">
              <p className="text-xs text-[var(--text-secondary)] mb-1">当前项目</p>
              <p className="text-sm font-medium text-white truncate">{currentProject.name}</p>
            </div>
          )}

          {/* 导航 */}
          <nav className="flex-1 py-3">
            {navItems.map(item => {
              // 帮助是特殊项，点击打开面板而非路由跳转
              if (item.path === 'help') {
                return (
                  <button
                    key="help"
                    onClick={() => setGuideOpen(true)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-sm text-[var(--text-secondary)] hover:bg-white/5 hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )
              }
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                      isActive
                        ? 'bg-[var(--primary)] bg-opacity-20 text-white border-r-3 border-[var(--primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* 底部：通知中心 + 状态 */}
          <div className="p-4 border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                <span>5 个 Agent 就绪</span>
              </div>
              <div className="flex items-center gap-2">
                {isSpeaking && (
                  <button 
                    onClick={stopAllVoice}
                    className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    title="停止所有语音">
                    🔇
                  </button>
                )}
                <NotificationCenter />
              </div>
            </div>
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-hidden relative">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/chat" element={<AgentChat />} />
            <Route path="/writer" element={<Writer />} />
            <Route path="/roundtable" element={<RoundTable />} />
            <Route path="/meetings" element={<MeetingRecords />} />
            <Route path="/tasks" element={<TaskBoard />} />
            <Route path="/outputs" element={<OutputHub />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        {/* 产品说明面板 */}
        <ProductGuide isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      </div>
    </BrowserRouter>
  )
}
