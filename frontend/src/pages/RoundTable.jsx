import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useStore } from '../stores/useStore'
import { api } from '../api/client'

const ALL_AGENTS = [
  { id: 'pm',       name: '产品经理(宋承言)',   icon: '🎯', color: '#FDCB6E', desc: '需求分析、产品价值' },
  { id: 'dev',      name: '开发工程师(贺元彬)', icon: '💻', color: '#6C5CE7', desc: '技术可行性、架构设计' },
  { id: 'qa',       name: '测试工程师(孟清衡)', icon: '🔍', color: '#FF6B6B', desc: '质量保障、风险检测' },
  { id: 'ops',      name: '运营专家(裴衍舟)',   icon: '📈', color: '#00B894', desc: '市场推广、商业变现' },
  { id: 'reviewer', name: '审核专家(俞望舒)',   icon: '⚖️', color: '#A29BFE', desc: '整体质量、风险把控' },
]

const QUICK_TOPICS = [
  '如何设计一个高转化率的落地页？',
  '新产品上线前的 MVP 功能应该包含哪些？',
  '如何降低用户流失率？',
  '是否应该接入第三方支付？',
  '项目技术栈选型：React vs Vue？',
  '如何在预算有限的情况下做冷启动？',
]

export default function RoundTable() {
  const projects = useStore(s => s.projects)
  const [selectedProject, setSelectedProject] = useState(null)
  const [topic, setTopic] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [selectedAgents, setSelectedAgents] = useState(ALL_AGENTS.map(a => a.id))
  const [isRunning, setIsRunning] = useState(false)
  const [speakers, setSpeakers] = useState([])
  const [currentSpeaker, setCurrentSpeaker] = useState(null)
  const [currentText, setCurrentText] = useState('')
  const [summary, setSummary] = useState(null)
  const [totalSpeakers, setTotalSpeakers] = useState(0)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  // 一键总结
  const [minutesText, setMinutesText] = useState('')
  const [minutesLoading, setMinutesLoading] = useState(false)
  // 语音播报
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [speakingVoice, setSpeakingVoice] = useState('sweet') // sweet/professional/mature
  const audioQueueRef = useRef([])    // 待播放的句子队列
  const audioPlayingRef = useRef(false)
  const audioStoppedRef = useRef(false)
  const chatEndRef = useRef(null)
  const textAccRef = useRef('')

  // 声音配置
  const VOICE_OPTIONS = [
    { id: 'sweet',        label: '甜美少女', voice: 'zh-CN-XiaoyiNeural',   rate: '+0%',  pitch: '+5Hz',  icon: '🎀', color: '#FF6B9D' },
    { id: 'professional', label: '职场男士', voice: 'zh-CN-YunjianNeural',  rate: '+0%',  pitch: '+0Hz',  icon: '👔', color: '#6C5CE7' },
    { id: 'mature',       label: '知性御姐', voice: 'zh-CN-XiaoxiaoNeural', rate: '+0%',  pitch: '+0Hz',  icon: '💃', color: '#A29BFE' },
    { id: 'young',        label: '活力少年', voice: 'zh-CN-YunxiNeural',    rate: '+5%',  pitch: '+0Hz',  icon: '🌟', color: '#00B894' },
    { id: 'news',         label: '新闻播报', voice: 'zh-CN-YunyangNeural',  rate: '+0%',  pitch: '+0Hz',  icon: '📰', color: '#FDCB6E' },
  ]
  const currentVoiceConfig = VOICE_OPTIONS.find(v => v.id === speakingVoice) || VOICE_OPTIONS[0]

  // 自动滚动到底部
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [speakers, currentText, summary, minutesText])

  // 加载历史
  useEffect(() => {
    api.getRoundtableHistory(selectedProject?.id).then(setHistory).catch(() => {})
  }, [selectedProject])

  const toggleAgent = (id) => {
    setSelectedAgents(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleStart = async () => {
    if (!topic.trim()) return alert('请输入讨论议题')
    if (selectedAgents.length < 2) return alert('至少选择 2 个 Agent 参与讨论')

    setIsRunning(true)
    setSpeakers([])
    setCurrentSpeaker(null)
    setCurrentText('')
    setSummary(null)
    setMinutesText('')
    setMinutesLoading(false)
    textAccRef.current = ''

    try {
      await api.roundtable({
        project_id: selectedProject?.id || 0,
        topic: topic.trim(),
        agent_roles: selectedAgents,
        extra_context: extraContext.trim(),
      }, (event) => {
        switch (event.type) {
          case 'system':
            setSpeakers(prev => [...prev, { role: 'system', name: '系统', text: event.content, isSystem: true }])
            break
          case 'speaker_start':
            setCurrentSpeaker({ ...event, text: '' })
            setCurrentText('')
            textAccRef.current = ''
            if (event.total) setTotalSpeakers(event.total)
            break
          case 'speaker_chunk':
            textAccRef.current += event.content
            setCurrentText(textAccRef.current)
            break
          case 'speaker_end': {
            const finalText = textAccRef.current
            if (event.role === 'summary') {
              setSummary({ role: event.role, name: event.name, text: finalText })
            } else {
              setSpeakers(prev => [...prev, { role: event.role, name: event.name, text: finalText }])
            }
            setCurrentSpeaker(null)
            setCurrentText('')
            textAccRef.current = ''
            break
          }
          case 'done':
            break
        }
      })
    } catch (err) {
      alert('圆桌会议出错: ' + err.message)
    } finally {
      setIsRunning(false)
    }
  }

  // 一键总结 — 调用后端生成精炼会议纪要
  const handleGenerateMinutes = async () => {
    if (speakers.length === 0) return
    setMinutesLoading(true)
    setMinutesText('')

    // 收集所有发言
    const allSpeeches = speakers
      .filter(s => !s.isSystem)
      .map(s => `**${s.name}：**\n${s.text}`)
      .join('\n\n---\n\n')

    const summaryContent = summary ? summary.text : ''

    try {
      await api.roundtableSummary({
        project_id: selectedProject?.id || 0,
        topic: topic.trim(),
        speeches: allSpeeches,
        summary: summaryContent,
      }, (chunk) => {
        if (chunk != null) setMinutesText(prev => prev + chunk)
      })
    } catch (err) {
      setMinutesText(`⚠️ 生成失败：${err.message}`)
    } finally {
      setMinutesLoading(false)
    }
  }

  // 复制纪要
  const handleCopyMinutes = () => {
    navigator.clipboard.writeText(minutesText)
  }

  // ═══════ 播报功能：分句合成 + 逐句播放 ═══════
  const stripMarkdown = (md) => {
    return md
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/---+/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim()
  }

  // 将长文本按句子切分（控制每段长度避免 edge-tts 超时）
  const splitIntoSentences = (text) => {
    const raw = text.split(/(?<=[。！？；\n])/g).filter(s => s.trim())
    const sentences = []
    let buf = ''
    for (const s of raw) {
      buf += s
      // 累计超过 150 字或遇到换行就切一段
      if (buf.length >= 150 || s.includes('\n')) {
        sentences.push(buf.trim())
        buf = ''
      }
    }
    if (buf.trim()) sentences.push(buf.trim())
    return sentences
  }

  // 合成单句 TTS 并返回 audio blob url
  const synthesizeSentence = async (text) => {
    const v = currentVoiceConfig
    const result = await api.tts(text, v.voice, v.rate, v.pitch)
    return `${window.location.origin}/api/tts/audio/${result.filename}`
  }

  // 播放队列：逐句合成 + 即时播放
  const playQueue = async (sentences) => {
    audioStoppedRef.current = false
    audioPlayingRef.current = true

    for (let i = 0; i < sentences.length; i++) {
      if (audioStoppedRef.current) break

      // 等待暂停
      while (isPausedRef.current && !audioStoppedRef.current) {
        await new Promise(r => setTimeout(r, 200))
      }
      if (audioStoppedRef.current) break

      try {
        const url = await synthesizeSentence(sentences[i])
        if (audioStoppedRef.current) break

        await new Promise((resolve, reject) => {
          const audio = new Audio(url)
          audio.onended = resolve
          audio.onerror = (e) => reject(new Error('Audio playback error'))
          audio.play().catch(reject)
          // 保存当前 audio 引用用于暂停/恢复
          currentAudioRef.current = audio
        })
      } catch (err) {
        console.error(`TTS sentence ${i} failed:`, err)
        // 单句失败不影响后续
      }
    }

    audioPlayingRef.current = false
    currentAudioRef.current = null
    if (!audioStoppedRef.current) {
      setIsSpeaking(false)
      setIsPaused(false)
    }
  }

  const isPausedRef = useRef(false)
  const currentAudioRef = useRef(null)

  const handleSpeakMinutes = async () => {
    if (!minutesText) return

    // 如果正在播放 → 停止
    if (isSpeaking) {
      handleStopSpeak()
      return
    }

    const plainText = stripMarkdown(minutesText)
    if (!plainText) return

    const sentences = splitIntoSentences(plainText)
    if (sentences.length === 0) return

    setIsSpeaking(true)
    setIsPaused(false)
    isPausedRef.current = false
    audioStoppedRef.current = false

    // 立即开始播放（不等全部合成完）
    playQueue(sentences)
  }

  const handlePauseSpeak = () => {
    if (currentAudioRef.current && audioPlayingRef.current) {
      currentAudioRef.current.pause()
      isPausedRef.current = true
      setIsPaused(true)
      setIsSpeaking(false)
    }
  }

  const handleResumeSpeak = async () => {
    if (currentAudioRef.current && isPausedRef.current) {
      isPausedRef.current = false
      setIsPaused(false)
      setIsSpeaking(true)
      currentAudioRef.current.play().catch(() => {})
    }
  }

  const handleStopSpeak = () => {
    audioStoppedRef.current = true
    audioPlayingRef.current = false
    isPausedRef.current = false
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
    }
    setIsSpeaking(false)
    setIsPaused(false)
  }

  // 页面卸载时停止播报
  useEffect(() => {
    return () => {
      audioStoppedRef.current = true
      if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null }
    }
  }, [])

  return (
    <div className="h-full flex">
      {/* ═══════ 左侧：配置面板 ═══════ */}
      <div className="w-[400px] border-r border-[var(--border-color)] bg-[var(--bg-card)] flex flex-col flex-shrink-0 overflow-auto">
        {/* 标题 */}
        <div className="p-5 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-bold text-white">🪑 圆桌会议</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">多位 Agent 从各自专业角度讨论，汇总最优方案</p>
        </div>

        {/* 选择项目（可选） */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <label className="text-xs text-[var(--text-secondary)] mb-2 block">关联项目（可选）</label>
          <select
            className="w-full px-3 py-2 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white text-sm"
            value={selectedProject?.id || ''}
            onChange={e => {
              const p = projects.find(x => x.id === Number(e.target.value))
              setSelectedProject(p || null)
            }}>
            <option value="">不关联项目</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* 议题输入 */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <label className="text-xs text-[var(--text-secondary)] mb-2 block">讨论议题 *</label>
          <textarea
            className="w-full px-3 py-2 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white text-sm resize-none"
            rows={3}
            placeholder="输入要讨论的问题或方案..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {QUICK_TOPICS.slice(0, 4).map(t => (
              <button key={t} onClick={() => setTopic(t)}
                className="text-[10px] px-2 py-1 rounded bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 hover:text-white transition-all truncate max-w-full"
                title={t}>
                {t.length > 15 ? t.slice(0, 15) + '...' : t}
              </button>
            ))}
          </div>
        </div>

        {/* 补充背景 */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <label className="text-xs text-[var(--text-secondary)] mb-2 block">补充背景信息（可选）</label>
          <textarea
            className="w-full px-3 py-2 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white text-sm resize-none"
            rows={2}
            placeholder="例如：预算 5 万，3 个月上线..."
            value={extraContext}
            onChange={e => setExtraContext(e.target.value)}
          />
        </div>

        {/* 选择参与 Agent */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs text-[var(--text-secondary)]">参与讨论的 Agent *</label>
            <button onClick={() => setSelectedAgents(ALL_AGENTS.map(a => a.id))}
              className="text-[10px] text-[var(--primary)] hover:text-white transition-colors">
              全选
            </button>
          </div>
          <div className="space-y-2">
            {ALL_AGENTS.map(agent => {
              const selected = selectedAgents.includes(agent.id)
              return (
                <button key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border ${
                    selected
                      ? 'border-opacity-40 bg-opacity-10'
                      : 'border-transparent bg-white/5 opacity-50 hover:opacity-80'
                  }`}
                  style={selected ? { borderColor: agent.color, background: agent.color + '15' } : {}}>
                  <span className="text-xl">{agent.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">{agent.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selected ? 'border-white bg-white' : 'border-[var(--text-secondary)]'
                  }`}>
                    {selected && <span className="text-[var(--bg-dark)] text-xs font-bold">✓</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 开始讨论按钮 */}
        <div className="p-4">
          <button
            onClick={handleStart}
            disabled={isRunning || !topic.trim() || selectedAgents.length < 2}
            className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
              isRunning || !topic.trim() || selectedAgents.length < 2
                ? 'bg-white/10 text-[var(--text-secondary)] cursor-not-allowed'
                : 'bg-[var(--primary)] text-white hover:opacity-90'
            }`}>
            {isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> 讨论中...
              </span>
            ) : (
              `🪑 开始圆桌会议 (${selectedAgents.length} 人)`
            )}
          </button>
        </div>

        {/* 历史记录 */}
        {history.length > 0 && (
          <div className="p-4 border-t border-[var(--border-color)]">
            <button onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-[var(--text-secondary)] hover:text-white transition-colors">
              📜 历史会议 ({history.length})
            </button>
            {showHistory && (
              <div className="mt-2 space-y-1 max-h-[200px] overflow-auto">
                {history.map(h => (
                  <button key={h.id}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white/5 text-xs text-[var(--text-secondary)] hover:bg-white/10 hover:text-white transition-all truncate">
                    {h.file_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════ 右侧：讨论展示 ═══════ */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-dark)]">
        {!isRunning && speakers.length === 0 && !summary ? (
          /* 空态 */
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
            <span className="text-7xl mb-6">🪑</span>
            <h3 className="text-2xl font-bold text-white mb-3">圆桌会议</h3>
            <p className="text-sm mb-2 max-w-md text-center">选择议题和参与的 Agent，点击「开始圆桌会议」</p>
            <p className="text-xs opacity-50 max-w-md text-center">每位 Agent 会从自己的专业角度给出建议，最后由产品经理汇总出最优方案</p>
            <div className="flex items-center gap-2 mt-8">
              {['💬 逐个发言', '📊 观点碰撞', '📋 汇总方案'].map((step, i) => (
                <React.Fragment key={step}>
                  <span className="text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)]">{step}</span>
                  {i < 2 && <span className="text-[var(--text-secondary)]">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : (
          /* 讨论过程 */
          <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* 议题标题 */}
            <div className="text-center py-4">
              <h2 className="text-xl font-bold text-white">🎯 {topic}</h2>
              {selectedProject && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">项目：{selectedProject.name}</p>
              )}
              <div className="flex items-center justify-center gap-1.5 mt-2">
                {selectedAgents.map(id => {
                  const a = ALL_AGENTS.find(x => x.id === id)
                  return <span key={id} className="text-lg" title={a?.name}>{a?.icon}</span>
                })}
              </div>
              {/* 进度条 */}
              {isRunning && totalSpeakers > 0 && (
                <div className="mt-4 max-w-md mx-auto">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
                    <span>讨论进度</span>
                    <span>{speakers.filter(s => !s.isSystem).length} / {totalSpeakers}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-[var(--primary)] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, speakers.filter(s => !s.isSystem).length / totalSpeakers * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-2 text-center">
                    {currentSpeaker ? (currentSpeaker.role === 'summary' ? '正在汇总各方观点...' : `正在听取 ${currentSpeaker.name} 的观点...`) : '准备中...'}
                    <span className="ml-2 opacity-50">（每位 Agent 约需 30-40 秒）</span>
                  </p>
                </div>
              )}
            </div>

            {/* 已发言的 Agent */}
            {speakers.map((s, i) => {
              if (s.isSystem) {
                return (
                  <div key={`sys-${i}`} className="flex justify-center animate-fadeIn">
                    <div className="bg-[var(--bg-card)] rounded-xl px-4 py-2 border border-[var(--border-color)] text-center max-w-2xl">
                      <div className="text-xs text-[var(--text-secondary)] markdown-body">
                        <ReactMarkdown>{s.text}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )
              }
              
              const agent = ALL_AGENTS.find(a => a.id === s.role) || { icon: '📋', color: '#FDCB6E', name: s.name }
              const agentColor = agent.color || '#FDCB6E'
              const cardKey = `${s.role}-${i}`
              return (
                <div key={cardKey} className="flex gap-4 animate-fadeIn">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mt-1"
                      style={{ backgroundColor: agentColor + '25', boxShadow: `0 0 12px ${agentColor}40` }}>
                      {agent.icon}
                    </div>
                    {i < speakers.length - 1 && (
                      <div className="w-0.5 flex-1 my-1" style={{ background: `linear-gradient(to bottom, ${agentColor}40, transparent)` }}></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* 名字标签 */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold text-white"
                        style={{ backgroundColor: agentColor }}>
                        #{i + 1} {s.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: agentColor + '20', color: agentColor }}>
                        发言完毕 ✓
                      </span>
                    </div>
                    {/* 发言内容框 — 统一样式 */}
                    <div className="rounded-xl p-5 markdown-body"
                      style={{
                        borderLeft: `4px solid ${agentColor}`,
                        backgroundColor: agentColor + '08',
                        boxShadow: `inset 0 0 20px ${agentColor}06`,
                      }}>
                      <div className="text-[15px] leading-relaxed text-white/95 font-medium">
                        <ReactMarkdown>{s.text}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* 正在发言的 Agent */}
            {currentSpeaker && (() => {
              const csAgent = ALL_AGENTS.find(a => a.id === currentSpeaker.role) || { icon: '🤖', color: '#6C5CE7', name: currentSpeaker.name }
              const csColor = csAgent.color || '#6C5CE7'
              return (
              <div className="flex gap-4 animate-fadeIn">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl mt-1 animate-pulse"
                    style={{ backgroundColor: csColor + '25', boxShadow: `0 0 16px ${csColor}50` }}>
                    {csAgent.icon}
                  </div>
                  <div className="w-0.5 flex-1 my-1 animate-pulse" style={{ background: `linear-gradient(to bottom, ${csColor}40, transparent)` }}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold text-white animate-pulse"
                      style={{ backgroundColor: csColor }}>
                      #{speakers.length + 1} {currentSpeaker.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/10 text-white animate-pulse">
                      💬 发言中...
                    </span>
                  </div>
                  <div className="rounded-xl p-5 markdown-body"
                    style={{
                      borderLeft: `4px solid ${csColor}`,
                      backgroundColor: csColor + '08',
                    }}>
                    <div className="text-[15px] leading-relaxed text-white/95 font-medium">
                      <ReactMarkdown>{currentText || '...'}</ReactMarkdown>
                    </div>
                    <span className="inline-block w-1.5 h-5 ml-1 animate-blink" style={{ backgroundColor: csColor }} />
                  </div>
                </div>
              </div>
              )
            })()}

            {/* 加载状态 */}
            {isRunning && !currentSpeaker && speakers.length === 0 && (
              <div className="flex justify-center py-8">
                <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                  <span className="animate-spin text-2xl">⏳</span>
                  <span>正在准备讨论...</span>
                </div>
              </div>
            )}

            {/* 汇总报告 */}
            {summary && (
              <div className="flex gap-4 animate-fadeIn">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl mt-1 bg-[#FDCB6E]/20">
                  📋
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-[#FDCB6E]">{summary.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FDCB6E]/20 text-[#FDCB6E] font-medium">
                      📋 汇总报告
                    </span>
                  </div>
                  <div className="bg-[var(--bg-card)] rounded-xl p-5 border-2 border-[#FDCB6E]/20 markdown-body">
                    <ReactMarkdown>{summary.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════ 会议纪要区域 ═══════ */}
            {!isRunning && summary && (
              <>
                {/* 一键总结按钮 */}
                {!minutesText && !minutesLoading && (
                  <div className="flex justify-center animate-fadeIn">
                    <button
                      onClick={handleGenerateMinutes}
                      className="group flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-purple-500 text-white font-medium text-sm hover:shadow-lg hover:shadow-[var(--primary)]/25 transition-all hover:scale-[1.02] active:scale-[0.98]">
                      <span className="text-xl group-hover:scale-110 transition-transform">📝</span>
                      <span>一键生成会议纪要</span>
                      <span className="text-xs opacity-70">精炼总结，可复制</span>
                    </button>
                  </div>
                )}

                {/* 纪要加载中 */}
                {minutesLoading && !minutesText && (
                  <div className="flex justify-center py-6">
                    <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                      <span className="animate-spin text-xl">⏳</span>
                      <span className="text-sm">正在生成会议纪要...</span>
                    </div>
                  </div>
                )}

                {/* 纪要内容 */}
                {(minutesText || minutesLoading) && minutesText && (
                  <div className="animate-fadeIn">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📝</span>
                        <h3 className="text-sm font-bold text-white">会议纪要</h3>
                        {minutesLoading && <span className="text-[10px] text-[var(--primary)] animate-pulse">生成中...</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* 语音播报按钮 + 下拉选择 */}
                        {!isSpeaking && !isPaused && (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={speakingVoice}
                              onChange={e => setSpeakingVoice(e.target.value)}
                              className="px-2 py-1.5 bg-white/5 border border-[var(--border-color)] text-white rounded-lg text-xs focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                            >
                              {VOICE_OPTIONS.map(v => (
                                <option key={v.id} value={v.id}>{v.icon} {v.label}</option>
                              ))}
                            </select>
                            <button onClick={handleSpeakMinutes}
                              className="px-3 py-1.5 bg-[var(--primary)]/20 text-[var(--primary)] rounded-lg text-xs hover:bg-[var(--primary)]/30 transition-all font-medium">
                              📢 播报
                            </button>
                          </div>
                        )}
                        {isSpeaking && (
                          <>
                            <button onClick={handlePauseSpeak}
                              className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs hover:bg-yellow-500/30 transition-all">
                              ⏸️ 暂停
                            </button>
                            <button onClick={handleStopSpeak}
                              className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-all">
                              🔇 停止
                            </button>
                            <span className="text-[10px] text-[var(--text-secondary)] ml-1">{currentVoiceConfig.icon} {currentVoiceConfig.label}</span>
                          </>
                        )}
                        {isPaused && (
                          <button onClick={handleResumeSpeak}
                            className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-xs hover:bg-green-500/30 transition-all">
                            ▶️ 继续
                          </button>
                        )}
                        <button onClick={handleCopyMinutes}
                          className="px-3 py-1.5 bg-white/5 text-[var(--text-secondary)] rounded-lg text-xs hover:bg-white/10 hover:text-white transition-all">
                          📋 复制
                        </button>
                        <button onClick={() => setMinutesText('')}
                          className="px-3 py-1.5 bg-white/5 text-[var(--text-secondary)] rounded-lg text-xs hover:bg-white/10 hover:text-white transition-all">
                          🗑️ 清空
                        </button>
                      </div>
                    </div>
                    <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--primary)]/30 markdown-body">
                      <ReactMarkdown>{minutesText}</ReactMarkdown>
                      {minutesLoading && <span className="inline-block w-1.5 h-4 bg-[var(--primary)] ml-1 animate-blink" />}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 完成标记（无纪要时） */}
            {!isRunning && summary && !minutesText && !minutesLoading && (
              <div className="text-center py-4">
                <p className="text-xs text-[var(--text-secondary)]">圆桌会议结束 · 讨论结果已保存</p>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
