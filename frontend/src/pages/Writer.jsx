import React, { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { useStore } from '../stores/useStore'
import { api } from '../api/client'

const WRITER_STYLES = [
  { id: 'xiaohongshu', label: '小红书', emoji: '📕', desc: 'emoji密集、口语化、种草感', gradient: 'from-rose-500 to-pink-500' },
  { id: 'zhihu', label: '知乎', emoji: '💡', desc: '专业理性、有理有据', gradient: 'from-blue-500 to-cyan-500' },
  { id: 'gongzhonghao', label: '公众号', emoji: '📢', desc: '故事引入、金句提炼', gradient: 'from-green-500 to-emerald-500' },
  { id: 'douyin', label: '抖音', emoji: '🎵', desc: '短句节奏、悬念开头', gradient: 'from-violet-500 to-purple-500' },
  { id: 'formal', label: '正式商务', emoji: '👔', desc: '专业严谨、书面语', gradient: 'from-slate-500 to-gray-500' },
  { id: 'casual', label: '轻松活泼', emoji: '😄', desc: '幽默风趣、网络用语', gradient: 'from-amber-500 to-yellow-500' },
  { id: 'tech', label: '技术文档', emoji: '🔧', desc: '准确专业、术语规范', gradient: 'from-teal-500 to-cyan-500' },
  { id: 'marketing', label: '营销文案', emoji: '🎯', desc: '痛点切入、行动号召', gradient: 'from-orange-500 to-red-500' },
]

const QUICK_TEMPLATES = [
  { icon: '✨', label: '通用润色', prompt: '请对以下文案进行润色优化，保持原文核心意思，提升文字质量：\n\n' },
  { icon: '📕', label: '小红书改写', prompt: '请将以下内容改写为小红书风格，要求：emoji密集、口语化、种草感、感叹号多、有互动感：\n\n' },
  { icon: '💡', label: '知乎专业版', prompt: '请将以下内容改写为知乎专业风格，要求：逻辑严密、引用数据、有理有据、适当使用专业术语：\n\n' },
  { icon: '📢', label: '公众号金句', prompt: '请将以下内容改写为公众号风格，要求：故事引入、金句提炼、情感共鸣、排版精美：\n\n' },
  { icon: '🎵', label: '抖音短文案', prompt: '请将以下内容改写为抖音短视频文案风格，要求：短句节奏、悬念开头、口语化、接地气、控制在150字以内：\n\n' },
  { icon: '📈', label: 'SEO优化', prompt: '请对以下内容进行SEO优化，要求：关键词自然融入、提升搜索引擎友好度、保持可读性：\n\n' },
  { icon: '✂️', label: '缩写精简', prompt: '请将以下内容精简缩写，保留核心信息，去除冗余，目标缩短到原文50%以内：\n\n' },
  { icon: '📖', label: '扩写丰富', prompt: '请将以下内容扩写丰富，增加细节、案例和论述，使内容更充实完整：\n\n' },
]

export default function Writer() {
  const currentProject = useStore(s => s.currentProject)
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('xiaohongshu')
  const [customPrompt, setCustomPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [history, setHistory] = useState([])
  const [activeTab, setActiveTab] = useState('polish')
  const outputRef = useRef(null)

  const currentStyle = WRITER_STYLES.find(s => s.id === selectedStyle)

  const handlePolish = async () => {
    if (!inputText.trim() || loading) return
    setLoading(true)
    setStreamingText('')
    setOutputText('')

    let systemMsg = customPrompt || ''
    if (!systemMsg) {
      systemMsg = `你是一位专业的内容润色师，精通${currentStyle?.label || '多种'}风格改写。请根据选定的风格对用户提供的文案进行润色。`
    }
    const userMsg = (customPrompt || `请用「${currentStyle?.label}」风格润色以下文案：`) + '\n\n---\n\n' + inputText

    try {
      const projectId = currentProject?.id || 0
      let fullText = ''
      await api.chatStream('writer', userMsg, projectId,
        (chunk) => { if (chunk != null) { fullText += chunk; setStreamingText(fullText) } },
        () => { if (fullText) setOutputText(fullText) }
      )
      setOutputText(fullText || streamingText || '')
      setStreamingText('')
      setHistory(prev => [{
        id: Date.now(), input: inputText, output: fullText,
        style: currentStyle?.label || '自定义', timestamp: Date.now(),
      }, ...prev])
    } catch (err) {
      setOutputText(`⚠️ 润色失败：${err.message || '请检查后端是否启动'}`)
      setStreamingText('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-dark)]">

      {/* ═══════ 顶部导航栏 ═══════ */}
      <div className="flex-shrink-0 px-6 py-3 flex items-center justify-between border-b border-[var(--border-color)]" style={{background:'linear-gradient(135deg,rgba(108,92,231,0.12),rgba(162,155,254,0.08))'}}>
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-white">✍️ 内容润色</h1>
          <div className="flex items-center bg-[var(--bg-card)] rounded-xl p-1 border border-[var(--border-color)]">
            <button onClick={() => setActiveTab('polish')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'polish' ? 'bg-[var(--primary)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-white'}`}>
              ✨ 润色
            </button>
            <button onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === 'history' ? 'bg-[var(--primary)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-white'}`}>
              📜 历史 ({history.length})
            </button>
          </div>
        </div>
        {(outputText || streamingText) && (
          <div className="flex gap-2">
            <button onClick={() => navigator.clipboard.writeText(outputText || streamingText)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-white/10 hover:text-white transition-all">
              📋 复制结果
            </button>
            <button onClick={() => { setOutputText(''); setStreamingText('') }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all">
              🗑️ 清空
            </button>
          </div>
        )}
      </div>

      {/* ═══════ 中间：左右等宽双栏 ═══════ */}
      <div className="flex-1 flex min-h-0 gap-0">
        {/* ── 左侧：原文输入 ── */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[var(--border-color)]">
          <div className="px-5 py-3 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-card)] flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">📄</span>
              <span className="text-sm font-semibold text-white">原文</span>
            </div>
            <span className="text-xs text-[var(--text-secondary)] tabular-nums">{inputText.length} 字</span>
          </div>
          <div className="flex-1 min-h-0">
            {activeTab === 'polish' ? (
              <textarea
                className="w-full h-full px-5 py-4 bg-transparent text-white text-[15px] leading-relaxed resize-none focus:outline-none placeholder-[var(--text-secondary)]/50"
                placeholder="在此粘贴或输入需要润色的文案...&#10;&#10;支持任意长度文本"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
              />
            ) : (
              <div className="h-full overflow-auto p-4 space-y-3">
                {history.length === 0 ? (
                  <div className="text-center py-20 text-[var(--text-secondary)]">
                    <p className="text-5xl mb-4">📭</p>
                    <p className="text-sm">暂无润色记录</p>
                  </div>
                ) : (
                  history.map(h => (
                    <div key={h.id}
                      className="p-4 rounded-xl border border-[var(--border-color)] cursor-pointer hover:border-[var(--primary)] hover:bg-[var(--bg-card)] transition-all"
                      onClick={() => { setInputText(h.input); setOutputText(h.output); setActiveTab('polish') }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--primary)]/20 text-[var(--primary-light)] font-medium">{h.style}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">{new Date(h.timestamp).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed">{h.input}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── 右侧：润色结果 ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-5 py-3 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-card)] flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">✨</span>
              <span className="text-sm font-semibold text-white">润色结果</span>
              {currentStyle && <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-[var(--text-secondary)]">{currentStyle.emoji} {currentStyle.label}</span>}
            </div>
            {(outputText || streamingText) && (
              <span className="text-xs text-green-400">✓ 完成</span>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-5" ref={outputRef}>
            {loading && !streamingText && !outputText && (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
                <div className="relative mb-4">
                  <div className="w-12 h-12 rounded-full border-4 border-[var(--primary)]/30 border-t-[var(--primary)] animate-spin" />
                  <span className="absolute inset-0 flex items-center justify-center text-lg">✍️</span>
                </div>
                <p className="text-sm font-medium">正在润色中...</p>
              </div>
            )}
            {streamingText && (
              <div className="prose prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-white">{streamingText}<span className="animate-pulse text-[var(--primary)] font-bold">▌</span></div>
              </div>
            )}
            {!streamingText && outputText && (
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown>{outputText}</ReactMarkdown>
              </div>
            )}
            {!loading && !streamingText && !outputText && (
              <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
                <span className="text-6xl mb-4 opacity-30">✍️</span>
                <p className="text-sm font-medium">选择风格后点击「开始润色」</p>
                <p className="text-xs opacity-40 mt-1">润色结果将在这里显示</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ 底部：工具栏 ═══════ */}
      {activeTab === 'polish' && (
        <div className="flex-shrink-0 border-t border-[var(--border-color)]" style={{background:'linear-gradient(180deg,rgba(30,30,58,0.95),rgba(26,26,46,1))'}}>

          {/* 风格选择 — 大图标卡片 */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold text-white">🎨 选择风格</span>
              {currentStyle && <span className="text-xs text-[var(--text-secondary)]">— {currentStyle.desc}</span>}
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {WRITER_STYLES.map(s => (
                <button key={s.id} onClick={() => { setSelectedStyle(s.id); setCustomPrompt('') }}
                  className={`group flex flex-col items-center gap-2 py-3 px-2 rounded-2xl text-center transition-all ${
                    selectedStyle === s.id
                      ? 'bg-white/10 ring-2 ring-[var(--primary)] shadow-lg scale-[1.03]'
                      : 'bg-white/[0.03] hover:bg-white/[0.07] border border-[var(--border-color)] hover:border-white/20'
                  }`}>
                  <span className={`text-2xl ${selectedStyle === s.id ? 'drop-shadow-lg' : 'group-hover:scale-110 transition-transform'}`}>{s.emoji}</span>
                  <span className={`text-xs font-semibold ${selectedStyle === s.id ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-white'}`}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 快捷模板 + 自定义指令 + 润色按钮 */}
          <div className="px-5 pb-4 pt-2 flex items-end gap-4">
            {/* 模板 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-white">⚡ 快捷模板</span>
                {customPrompt && <span className="text-[10px] text-[var(--primary-light)] bg-[var(--primary)]/15 px-2 py-0.5 rounded-full">自定义指令已设</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TEMPLATES.map(t => (
                  <button key={t.label} onClick={() => setCustomPrompt(t.prompt)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                      customPrompt === t.prompt
                        ? 'bg-[var(--primary)]/15 border-[var(--primary)]/40 text-white'
                        : 'bg-white/[0.03] border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-white/[0.07] hover:text-white hover:border-white/20'
                    }`}>
                    <span className="text-base">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义指令 + 润色按钮 */}
            <div className="flex items-end gap-3 flex-shrink-0">
              <div className="w-[220px]">
                <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">自定义指令</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-xl text-xs text-white placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--primary)]"
                  placeholder="留空=使用默认风格指令"
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                />
              </div>
              <button onClick={handlePolish} disabled={!inputText.trim() || loading}
                className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-bold transition-all ${
                  inputText.trim() && !loading
                    ? 'bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] text-white shadow-xl hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98]'
                    : 'bg-white/5 text-[var(--text-secondary)] cursor-not-allowed border border-[var(--border-color)]'
                }`}>
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 润色中...</>
                ) : (
                  <><span className="text-lg">✨</span> 开始润色</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
