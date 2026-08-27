import React, { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { useStore } from '../stores/useStore'
import { api } from '../api/client'

const WRITER_STYLES = [
  { id: 'xiaohongshu', label: '小红书风', emoji: '📕', desc: 'emoji密集、口语化、种草感' },
  { id: 'zhihu', label: '知乎风', emoji: '💡', desc: '专业理性、有理有据' },
  { id: 'gongzhonghao', label: '公众号', emoji: '📢', desc: '故事引入、金句提炼' },
  { id: 'douyin', label: '抖音风', emoji: '🎵', desc: '短句节奏、悬念开头' },
  { id: 'formal', label: '正式商务', emoji: '👔', desc: '专业严谨、书面语' },
  { id: 'casual', label: '轻松活泼', emoji: '😄', desc: '幽默风趣、网络用语' },
  { id: 'tech', label: '技术文档', emoji: '🔧', desc: '准确专业、术语规范' },
  { id: 'marketing', label: '营销文案', emoji: '🎯', desc: '痛点切入、行动号召' },
]

const QUICK_TEMPLATES = [
  { label: '📝 通用润色', prompt: '请对以下文案进行润色优化，保持原文核心意思，提升文字质量：\n\n' },
  { label: '📕 小红书改写', prompt: '请将以下内容改写为小红书风格，要求：emoji密集、口语化、种草感、感叹号多、有互动感：\n\n' },
  { label: '💡 知乎专业版', prompt: '请将以下内容改写为知乎专业风格，要求：逻辑严密、引用数据、有理有据、适当使用专业术语：\n\n' },
  { label: '📢 公众号金句', prompt: '请将以下内容改写为公众号风格，要求：故事引入、金句提炼、情感共鸣、排版精美：\n\n' },
  { label: '🎵 抖音短文案', prompt: '请将以下内容改写为抖音短视频文案风格，要求：短句节奏、悬念开头、口语化、接地气、控制在150字以内：\n\n' },
  { label: '📈 SEO优化', prompt: '请对以下内容进行SEO优化，要求：关键词自然融入、提升搜索引擎友好度、保持可读性：\n\n' },
  { label: '✏️ 缩写精简', prompt: '请将以下内容精简缩写，保留核心信息，去除冗余，目标缩短到原文50%以内：\n\n' },
  { label: '📖 扩写丰富', prompt: '请将以下内容扩写丰富，增加细节、案例和论述，使内容更充实完整：\n\n' },
]

export default function Writer() {
  const currentProject = useStore(s => s.currentProject)
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('xiaohongshu')
  const [customPrompt, setCustomPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [history, setHistory] = useState([]) // 润色历史记录
  const [activeTab, setActiveTab] = useState('polish') // polish | history
  const outputRef = useRef(null)

  const currentStyle = WRITER_STYLES.find(s => s.id === selectedStyle)

  // 执行润色
  const handlePolish = async (overrideText) => {
    const text = overrideText || inputText
    if (!text.trim() || loading) return

    setLoading(true)
    setStreamingText('')
    setOutputText('')

    // 构造润色提示词
    let systemMsg = customPrompt || ''
    if (!systemMsg) {
      const styleGuide = `你是一位专业的内容润色师，精通${currentStyle?.label || '多种'}风格改写。请根据选定的风格对用户提供的文案进行润色。`
      systemMsg = styleGuide
    }

    // 用户消息 = 风格指令 + 原文
    const userMsg = (customPrompt || `请用「${currentStyle?.label}」风格润色以下文案：`) + '\n\n---\n\n' + text

    try {
      const projectId = currentProject?.id || 0
      const history = [{ role: 'system', content: systemMsg }]

      let fullText = ''
      await api.chatStream(
        'writer', userMsg, projectId,
        (chunk) => {
          if (chunk != null) { fullText += chunk; setStreamingText(fullText) }
        },
        () => {
          // SSE 流结束 — 如果 onChunk 累积了内容就用它，否则保留已显示的
          if (fullText) setOutputText(fullText)
        }
      )

      // 后端非流式兜底：如果 onChunk 一次都没收到，fullText 仍为空
      setOutputText(fullText || streamingText || '')
      setStreamingText('')

      // 加入历史记录
      setHistory(prev => [{
        id: Date.now(),
        input: text,
        output: fullText,
        style: currentStyle?.label || '自定义',
        timestamp: Date.now(),
      }, ...prev])
    } catch (err) {
      setOutputText(`⚠️ 润色失败：${err.message || '请检查后端是否启动'}`)
      setStreamingText('')
    } finally {
      setLoading(false)
    }
  }

  // 快捷模板点击 — 只填入提示词，不自动开始润色
  const handleTemplate = (template) => {
    setCustomPrompt(template.prompt)
  }

  // 复制结果
  const handleCopy = () => {
    navigator.clipboard.writeText(outputText || streamingText)
  }

  return (
    <div className="h-full flex">
      {/* ========= 左侧：输入区 ========= */}
      <div className="w-[420px] flex flex-col border-r border-[var(--border-color)] flex-shrink-0 bg-[var(--bg-card)]">
        {/* 标题 */}
        <div className="px-5 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            ✍️ 内容润色
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">选择风格，一键改写文案</p>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-[var(--border-color)]">
          <button onClick={() => setActiveTab('polish')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all ${activeTab === 'polish' ? 'text-white border-b-2 border-[var(--primary)]' : 'text-[var(--text-secondary)] hover:text-white'}`}>
            ✨ 润色
          </button>
          <button onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all ${activeTab === 'history' ? 'text-white border-b-2 border-[var(--primary)]' : 'text-[var(--text-secondary)] hover:text-white'}`}>
            📜 历史 ({history.length})
          </button>
        </div>

        {activeTab === 'polish' ? (
          <div className="flex-1 overflow-auto p-5 space-y-5">
            {/* 风格选择 */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">选择风格</label>
              <div className="grid grid-cols-4 gap-1.5">
                {WRITER_STYLES.map(s => (
                  <button key={s.id} onClick={() => { setSelectedStyle(s.id); setCustomPrompt('') }}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-xs transition-all ${
                      selectedStyle === s.id
                        ? 'bg-[var(--primary)] bg-opacity-20 text-white ring-1 ring-[var(--primary)]'
                        : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 hover:text-white'
                    }`}>
                    <span className="text-lg">{s.emoji}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
              {currentStyle && (
                <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 px-1">{currentStyle.desc}</p>
              )}
            </div>

            {/* 快捷模板 */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">快捷模板</label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TEMPLATES.map(t => (
                  <button key={t.label} onClick={() => handleTemplate(t)}
                    className="px-2.5 py-1.5 bg-white/5 border border-[var(--border-color)] rounded-lg text-[11px] text-[var(--text-secondary)] hover:bg-white/10 hover:text-white transition-all">
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义提示词 */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">自定义指令（可选）</label>
              <textarea className="w-full px-3 py-2 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white text-xs resize-none focus:outline-none focus:border-[var(--primary)]" rows={2} placeholder="留空则使用默认风格指令..." value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} />
            </div>

            {/* 原文输入 */}
            <div className="flex-1 flex flex-col">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">输入原文</label>
              <textarea className="flex-1 min-h-[200px] px-3 py-2 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white text-sm resize-none focus:outline-none focus:border-[var(--primary)]" placeholder="在此粘贴或输入需要润色的文案..." value={inputText} onChange={e => setInputText(e.target.value)} />
            </div>

            {/* 润色按钮 */}
            <button onClick={() => handlePolish()} disabled={!inputText.trim() || loading}
              className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
                inputText.trim() && !loading
                  ? 'bg-[var(--primary)] text-white hover:opacity-90'
                  : 'bg-white/10 text-[var(--text-secondary)] cursor-not-allowed'
              }`}>
              {loading ? '⏳ 正在润色中...' : '✨ 开始润色'}
            </button>
          </div>
        ) : (
          /* 历史记录 */
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-secondary)]">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm">暂无润色记录</p>
              </div>
            ) : (
              history.map(h => (
                <div key={h.id} className="bg-[var(--bg-dark)] rounded-lg p-3 border border-[var(--border-color)] cursor-pointer hover:border-[var(--primary)] transition-colors"
                  onClick={() => { setInputText(h.input); setOutputText(h.output); setActiveTab('polish') }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--primary)] bg-opacity-20 text-[var(--primary)]">{h.style}</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">{new Date(h.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{h.input}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ========= 右侧：润色结果 ========= */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-dark)]">
        {/* 结果头部 */}
        <div className="px-6 py-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">润色结果</h3>
            {(outputText || streamingText) && (
              <span className="text-xs text-[var(--text-secondary)]">
                {currentStyle?.emoji} {currentStyle?.label}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {(outputText || streamingText) && (
              <>
                <button onClick={handleCopy}
                  className="px-3 py-1.5 bg-white/5 text-[var(--text-secondary)] rounded-lg text-xs hover:bg-white/10 hover:text-white transition-all">
                  📋 复制结果
                </button>
                <button onClick={() => { setOutputText(''); setStreamingText('') }}
                  className="px-3 py-1.5 bg-white/5 text-[var(--text-secondary)] rounded-lg text-xs hover:bg-white/10 hover:text-white transition-all">
                  🗑️ 清空
                </button>
              </>
            )}
          </div>
        </div>

        {/* 结果内容 */}
        <div className="flex-1 overflow-auto p-6" ref={outputRef}>
          {loading && !streamingText && !outputText && (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
              <div className="text-4xl mb-3 animate-bounce">⏳</div>
              <p className="text-sm">正在为您润色中...</p>
            </div>
          )}

          {streamingText && (
            <div className="prose prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-white">{streamingText}<span className="animate-pulse text-[var(--primary)]">▌</span></div>
            </div>
          )}

          {!streamingText && outputText && (
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>{outputText}</ReactMarkdown>
            </div>
          )}

          {!loading && !streamingText && !outputText && (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
              <span className="text-6xl mb-4">✍️</span>
              <p className="text-sm">在左侧输入文案并选择风格</p>
              <p className="text-xs opacity-50 mt-1">点击「开始润色」查看结果</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
