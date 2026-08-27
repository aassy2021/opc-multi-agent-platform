import React, { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useStore } from '../stores/useStore'
import { api } from '../api/client'

const AGENT_TABS = [
  { id: 'pm', name: '产品经理(宋承言)', icon: '🎯', desc: '需求分析、PRD文档、产品规划', color: '#FDCB6E' },
  { id: 'dev', name: '开发工程师(贺元彬)', icon: '💻', desc: '架构设计、代码开发、技术方案', color: '#6C5CE7' },
  { id: 'qa', name: '测试工程师(孟清衡)', icon: '🔍', desc: '测试用例、Bug检测、质量保障', color: '#FF6B6B' },
  { id: 'ops', name: '运营专家(裴衍舟)', icon: '📈', desc: '增长策略、运营方案、数据分析', color: '#00B894' },
]

const PHASE_FLOW = [
  { key: 'planning',   label: '策划中',   icon: '📋', next: 'developing',  nextLabel: '开发阶段',   agent: 'pm',  nextAgent: 'dev',  nextAgentName: '开发工程师', color: '#FDCB6E', needsReview: true },
  { key: 'developing', label: '开发中',   icon: '💻', next: 'testing',    nextLabel: '测试阶段',   agent: 'dev', nextAgent: 'qa',   nextAgentName: '测试工程师', color: '#6C5CE7', needsReview: true },
  { key: 'testing',    label: '测试中',   icon: '🧪', next: 'launching',  nextLabel: '运营专家阶段', agent: 'qa',  nextAgent: 'ops',  nextAgentName: '运营专家', color: '#FF6B6B', needsReview: true },
  { key: 'launching',  label: '上线中',   icon: '🚀', next: 'launched',   nextLabel: '已完成',     agent: 'ops', nextAgent: null,   nextAgentName: '',           color: '#00B894', needsReview: false },
  { key: 'launched',   label: '已上线',   icon: '✅', next: null,         nextLabel: '',           agent: null,  nextAgent: null,   nextAgentName: '',           color: '#00B894', needsReview: false },
]

const PHASE_LABELS = {
  planning: '📋 筹划中', developing: '💻 开发中', testing: '🧪 测试中',
  launching: '🚀 上线中', launched: '✅ 已上线',
}

const REVIEW_STATUS_MAP = {
  none:     { label: '未提交',   color: '#666',     bg: 'bg-white/5' },
  pending:  { label: '待审核',   color: '#FDCB6E',  bg: 'bg-yellow-500/10' },
  approved: { label: '已通过',   color: '#00B894',  bg: 'bg-green-500/10' },
  rejected: { label: '已拒绝',   color: '#FF6B6B',  bg: 'bg-red-500/10' },
}

// ───────────────────── 消息气泡 ─────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  const agent = AGENT_TABS.find(a => a.id === msg.agent_type)
  // 显示完整日期时间
  const timeStr = msg.timestamp
    ? new Date(msg.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[var(--primary)] bg-opacity-20 flex items-center justify-center text-lg mr-3 flex-shrink-0 mt-1">
          {agent?.icon || '🤖'}
        </div>
      )}
      <div className={`max-w-[70%] rounded-2xl px-5 py-3 ${
        isUser
          ? 'bg-[var(--primary)] text-white rounded-br-md'
          : 'bg-[var(--bg-card)] text-white border border-[var(--border-color)] rounded-bl-md'
      }`}>
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
        <div className={`text-[10px] mt-1 ${isUser ? 'text-white/50' : 'text-[var(--text-secondary)]'}`}>
          {!isUser && agent?.name && <span className="mr-2">{agent.name}</span>}
          {timeStr}
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm mr-3 flex-shrink-0 mt-1">👤</div>
      )}
    </div>
  )
}

// ───────────────────── 快捷提示 ─────────────────────
function QuickTip({ text, onClick }) {
  return (
    <button onClick={() => onClick(text)}
      className="px-4 py-2 bg-white/5 border border-[var(--border-color)] rounded-full text-xs text-[var(--text-secondary)] hover:bg-white/10 hover:text-white transition-all">
      💡 {text}
    </button>
  )
}

// ───────────────────── 审核弹窗 ─────────────────────
function ReviewModal({ isOpen, onClose, onApprove, onReject, phaseLabel, planContent }) {
  const [comment, setComment] = useState('')
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-2xl w-[600px] max-h-[80vh] flex flex-col border border-[var(--border-color)]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-color)]">
          <h3 className="text-lg font-bold text-white">📝 审核方案 — {phaseLabel}</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1">检查 Agent 产出的方案，满意则通过流转到下一阶段，不满意则填写修改意见让 Agent 继续修改</p>
        </div>
        {/* 方案预览 */}
        <div className="flex-1 overflow-auto p-5">
          <div className="bg-[var(--bg-dark)] rounded-xl p-4 max-h-[30vh] overflow-auto border border-[var(--border-color)]">
            <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">
              {planContent || '（暂无方案内容）'}
            </div>
          </div>
          {/* 拒绝意见 */}
          <div className="mt-4">
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">修改意见（拒绝时必填）</label>
            <textarea
              className="w-full bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-white text-sm resize-none focus:border-[var(--primary)] transition-colors"
              rows={3}
              placeholder="请描述需要修改的地方，Agent 将根据意见继续修改方案..."
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>
        </div>
        {/* 按钮 */}
        <div className="p-5 border-t border-[var(--border-color)] flex items-center justify-end gap-3">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all">
            取消
          </button>
          <button onClick={() => { if (!comment.trim()) { alert('请填写修改意见'); return } onReject(comment); setComment('') }}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all">
            ❌ 不满意，打回修改
          </button>
          <button onClick={() => { onApprove(comment); setComment('') }}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-all">
            ✅ 通过，流转到下一步
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────── 阶段日志面板 ─────────────────────
function PhaseLogPanel({ logs, currentPhase, onReview, onAdvance, advancing }) {
  const [expandedId, setExpandedId] = useState(null)
  if (!logs || logs.length === 0) {
    return (
      <div className="p-4 text-center text-[var(--text-secondary)] text-xs">
        <p>暂无阶段日志</p>
        <p className="mt-1 opacity-60">与 Agent 对话后提交方案即可记录</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {logs.map(log => {
        const review = REVIEW_STATUS_MAP[log.review_status] || REVIEW_STATUS_MAP.none
        const isCurrent = log.phase === currentPhase
        const isExpanded = expandedId === log.id
        // 截取前100字作为预览
        const preview = (log.plan_content || '').replace(/[#*>\-\n]+/g, ' ').trim().slice(0, 100)
        return (
          <div key={log.id} className={`rounded-xl border transition-all ${
            isCurrent ? 'border-[var(--primary)]/30 bg-[var(--primary)]/5' : 'border-[var(--border-color)] bg-white/[0.02]'
          }`}>
            <div className="px-3 py-2.5 flex items-center gap-2 cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : log.id)}>
              <span className="text-sm">{log.agent_icon || '📄'}</span>
              <span className="text-xs font-medium text-white flex-1">{log.phase_label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${review.bg}`}
                style={{ color: review.color }}>
                {review.label}
              </span>
              <span className="text-[var(--text-secondary)] text-xs">{isExpanded ? '▲' : '▼'}</span>
            </div>
            {/* 未展开时显示预览 */}
            {!isExpanded && preview && (
              <div className="px-3 pb-2 text-[10px] text-[var(--text-secondary)] truncate">{preview}...</div>
            )}
            {isExpanded && (
              <div className="px-3 pb-3 border-t border-[var(--border-color)]">
                {/* Markdown 渲染方案内容 */}
                <div className="mt-2 bg-[var(--bg-dark)] rounded-lg p-3 max-h-[30vh] overflow-auto markdown-body">
                  <div className="text-xs text-white leading-relaxed">
                    {log.plan_content ? (
                      <ReactMarkdown>{log.plan_content}</ReactMarkdown>
                    ) : (
                      <span className="opacity-40">（无方案内容）</span>
                    )}
                  </div>
                </div>
                {/* 审核意见 */}
                {log.review_comment && (
                  <div className={`mt-2 rounded-lg p-2 text-xs ${
                    log.review_status === 'rejected' ? 'bg-red-500/10 text-red-300' : 'bg-green-500/10 text-green-300'
                  }`}>
                    💬 {log.review_comment}
                  </div>
                )}
                <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
                  提交于 {log.created_at ? new Date(log.created_at).toLocaleString('zh-CN') : ''}
                  {log.reviewed_at && ` · 审核于 ${new Date(log.reviewed_at).toLocaleString('zh-CN')}`}
                </div>
                {/* 当前阶段的操作按钮 */}
                {isCurrent && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => onReview(log)}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all">
                      📝 审核方案
                    </button>
                    {log.review_status === 'approved' && (
                      <button onClick={onAdvance} disabled={advancing}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: PHASE_FLOW.find(p => p.key === currentPhase)?.next ? PHASE_FLOW.find(p => PHASE_FLOW.find(x => x.key === currentPhase)?.next === x.key)?.color : '#6C5CE7' }}>
                        {advancing ? '⏳ 流转中...' : '🔄 流转到下一步'}
                      </button>
                    )}
                  </div>
                )}
                {/* 非当前阶段但有 approved：显示文件路径 */}
                {isCurrent && log.review_status === 'approved' && (
                  <div className="mt-2 text-[10px] text-green-400/70">
                    ✅ 方案已保存到磁盘，可在「产出中心」查看完整文档
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ───────────────────── 审核专家决定面板（侧边栏用） ─────────────────────
function ReviewerDecisionPanel({ decisions, currentPhase }) {
  const currentDecisions = decisions.filter(d => d.phase === currentPhase)
  if (currentDecisions.length === 0) return null
  
  const DECISION_MAP = {
    pending: { label: '⏳ 审核中', color: '#FDCB6E', bg: 'bg-yellow-500/10' },
    pass: { label: '✅ 通过', color: '#00B894', bg: 'bg-green-500/10' },
    conditional_pass: { label: '⚠️ 有条件通过', color: '#FDCB6E', bg: 'bg-yellow-500/10' },
    fail: { label: '❌ 未通过', color: '#FF6B6B', bg: 'bg-red-500/10' },
    user_approved: { label: '✅ 用户已确认', color: '#00B894', bg: 'bg-green-500/10' },
    user_overridden: { label: '🔄 用户已覆盖', color: '#A29BFE', bg: 'bg-purple-500/10' },
    user_approved_rejection: { label: '✅ 同意不通过', color: '#FF6B6B', bg: 'bg-red-500/10' },
  }
  
  return (
    <div className="space-y-3">
      {currentDecisions.map(d => {
        const ds = DECISION_MAP[d.decision] || DECISION_MAP.pending
        return (
          <div key={d.id} className="rounded-xl border border-[#A29BFE]/20 bg-[#A29BFE]/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚖️</span>
                <span className="text-sm font-bold text-white">审核专家(俞望舒)</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ds.bg}`} style={{ color: ds.color }}>
                {ds.label}
              </span>
            </div>
            {d.score > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-[var(--text-secondary)]">评分：</span>
                <span className="text-lg font-bold" style={{ color: d.score >= 7 ? '#00B894' : d.score >= 5 ? '#FDCB6E' : '#FF6B6B' }}>
                  {d.score}/10
                </span>
              </div>
            )}
            {d.full_review && (
              <div className="mt-3 bg-[var(--bg-dark)] rounded-lg p-3 max-h-[30vh] overflow-auto">
                <div className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">{d.full_review}</div>
              </div>
            )}
            <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
              {d.created_at && new Date(d.created_at).toLocaleString('zh-CN')}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════ 主页面 ═══════════════════════
export default function AgentChat() {
  const currentProject = useStore(s => s.currentProject)
  const setCurrentProject = useStore(s => s.setCurrentProject)
  const refreshProjects = useStore(s => s.refreshProjects)
  const [activeAgent, setActiveAgent] = useState('pm')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [projectDetail, setProjectDetail] = useState(null)
  const [showProjectPanel, setShowProjectPanel] = useState(false)
  const [showPhaseLogs, setShowPhaseLogs] = useState(false)
  const [phaseLogs, setPhaseLogs] = useState([])
  const [advancing, setAdvancing] = useState(false)
  const [prevPhasePlan, setPrevPhasePlan] = useState(null) // 上一阶段已审核方案
  // Agent 标签通知计数（其他 Agent 有待处理事项时显示红点）
  const [agentBadgeCounts, setAgentBadgeCounts] = useState({})
  // Bug 工单
  const [bugs, setBugs] = useState([])
  const [bugModal, setBugModal] = useState(false) // 提 Bug 弹窗
  const [fixModal, setFixModal] = useState(false) // 修复确认弹窗
  const [fixBugTarget, setFixBugTarget] = useState(null)
  const [fixNote, setFixNote] = useState('')
  // 审核弹窗状态
  const [reviewModal, setReviewModal] = useState({ open: false, log: null })
  // 审核专家相关
  const [reviewerDecisions, setReviewerDecisions] = useState([])
  const [requestingReview, setRequestingReview] = useState(false)
  // 修改指示弹窗
  const [revisionModal, setRevisionModal] = useState({ open: false, decisionId: null })
  const [revisionComment, setRevisionComment] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }
  useEffect(scrollToBottom, [messages, streamingText])

  const location = useLocation()
  const navState = location.state || {}

  // 从 URL state 接收自动对话消息（来自 Projects 页面流转/切换）
  useEffect(() => {
    if (navState.agentRole) {
      setActiveAgent(navState.agentRole)
    }
    if (navState.autoMessage) {
      setInput(navState.autoMessage)
    }
  }, [navState.agentRole, navState.autoMessage])

  // 加载对话历史 + 项目详情 + 阶段日志 + 上一阶段方案
  const loadData = () => {
    if (currentProject) {
      api.getConversations(currentProject.id, activeAgent).then(data => {
        setMessages(data.map(m => ({
          role: m.role, content: m.content, agent_type: activeAgent,
          timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
        })))
      }).catch(() => {})
      api.getProject(currentProject.id).then(d => setProjectDetail(d)).catch(() => {})
      api.getPhaseLogs(currentProject.id).then(logs => {
        setPhaseLogs(logs)
        // 找上一阶段已审核通过的方案
        const prevPhases = { developing: 'planning', testing: 'developing', launching: 'testing' }
        const prevPhase = prevPhases[currentProject.phase]
        if (prevPhase) {
          const prevLog = logs.find(l => l.phase === prevPhase && l.review_status === 'approved')
          setPrevPhasePlan(prevLog || null)
        } else {
          setPrevPhasePlan(null)
        }
      }).catch(() => {})
      // 加载 Bug 工单
      api.getBugs(currentProject.id).then(b => setBugs(b)).catch(() => {})
      // 加载审核专家决定
      api.getReviewerDecisions(currentProject.id).then(d => setReviewerDecisions(d)).catch(() => {})
      // 加载各 Agent 未读通知数（用于标签红点）
      loadAgentBadges(currentProject.id)
    } else {
      setMessages([])
      setProjectDetail(null)
      setPhaseLogs([])
      setPrevPhasePlan(null)
      setReviewerDecisions([])
    }
  }
  useEffect(loadData, [currentProject, activeAgent])

  // ─── 加载各 Agent 标签通知红点 ───
  const loadAgentBadges = async (projectId) => {
    try {
      const badges = {}
      // DEV: open bugs 需要修复
      const devBugs = await api.getBugs(projectId, 'open', 'dev').catch(() => [])
      if (devBugs.length > 0) badges['dev'] = devBugs.length
      // QA: fixed bugs 等待验证
      const qaBugs = await api.getBugs(projectId, 'fixed', 'qa').catch(() => [])
      if (qaBugs.length > 0) badges['qa'] = qaBugs.length
      setAgentBadgeCounts(badges)
    } catch (e) { /* ignore */ }
  }

  // ─── 清空当前 Agent 会话历史 ───
  const handleClearHistory = async () => {
    if (!currentProject) return
    const agentName = AGENT_TABS.find(a => a.id === activeAgent)?.name || activeAgent
    if (!window.confirm(`确定清空「${agentName}」在此项目的所有对话记录？\n此操作不可恢复。`)) return
    try {
      await api.clearConversations(currentProject.id, activeAgent)
      setMessages([])
      alert('对话历史已清空')
    } catch (e) {
      alert('清空失败: ' + e.message)
    }
  }

  // ─── 发送消息 ───
  const handleSend = async (overrideInput) => {
    const text = overrideInput || input
    if (!text.trim() || loading) return
    const userMsg = { role: 'user', content: text, agent_type: activeAgent, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    if (!overrideInput) setInput('')
    setLoading(true)
    setStreamingText('')
    try {
      const projectId = currentProject?.id || 0
      let fullText = ''
      await api.chatStream(activeAgent, text, projectId,
        (chunk) => { fullText += chunk; setStreamingText(fullText) },
        () => {}
      )
      setMessages(prev => [...prev, { role: 'assistant', content: fullText, agent_type: activeAgent, timestamp: Date.now() }])
      setStreamingText('')
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ 错误：${err.message || '请求失败'}`, agent_type: activeAgent, timestamp: Date.now() }])
      setStreamingText('')
    } finally { setLoading(false) }
  }

  // ─── 提交方案（生成结构化文档 + 保存磁盘 + phase_logs） ───
  const handleSubmitPlan = async () => {
    if (!currentProject || !messages.length) return
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistant) { alert('请先与 Agent 对话，获取方案后再提交'); return }
    
    // 构建结构化方案文档：标题 + 项目信息 + 对话要点 + 最终方案
    const PHASE_LABELS = { planning: '策划', developing: '开发', testing: '测试', launching: '运营' }
    const AGENT_NAMES = { pm: '产品经理(宋承言)', dev: '开发工程师(贺元彬)', qa: '测试工程师(孟清衡)', ops: '运营专家(裴衍舟)' }
    const phaseLabel = PHASE_LABELS[currentProject.phase] || currentProject.phase
    const agentName = AGENT_NAMES[activeAgent] || activeAgent
    
    // 提取用户需求要点（所有 user 消息）
    const userMsgs = messages.filter(m => m.role === 'user').map((m, i) => `${i + 1}. ${m.content.slice(0, 200)}`)
    const chatSummary = userMsgs.length > 0
      ? `### 用户需求要点\n${userMsgs.join('\n')}\n\n`
      : ''
    
    const fullPlan = `# ${currentProject.name} — ${phaseLabel}方案\n\n` +
      `> 项目：${currentProject.name}  \n` +
      `> 阶段：${phaseLabel}  \n` +
      `> 负责人：${agentName}  \n` +
      `> 提交时间：${new Date().toLocaleString('zh-CN')}\n\n` +
      `---\n\n` +
      chatSummary +
      `### ${phaseLabel}详细方案\n\n` +
      lastAssistant.content
    
    try {
      await api.submitPlan(currentProject.id, fullPlan)
      const logs = await api.getPhaseLogs(currentProject.id)
      setPhaseLogs(logs)
      setShowPhaseLogs(true)
      const detail = await api.getProject(currentProject.id)
      setProjectDetail(detail)
      alert(`✅ ${phaseLabel}方案已保存到磁盘并提交审核！\n📄 文件位置：${phaseLabel}方案.md\n请审核后点击「流转到下一步」`)
    } catch (err) {
      alert('提交失败: ' + err.message)
    }
  }

  // ─── 审核通过 ───
  const handleApprove = async (logId, comment) => {
    if (!currentProject) return
    try {
      await api.reviewPhaseLog(currentProject.id, logId, 'approve', comment || '方案通过')
      const logs = await api.getPhaseLogs(currentProject.id)
      setPhaseLogs(logs)
      const detail = await api.getProject(currentProject.id)
      setProjectDetail(detail)
      setReviewModal({ open: false, log: null })
      // 显示成功消息
      setMessages(prev => [...prev, {
        role: 'assistant', content: '✅ 方案已审核通过！现在可以点击「🔄 流转到下一步」按钮，将项目推进到下一阶段。',
        agent_type: activeAgent, timestamp: Date.now()
      }])
    } catch (err) {
      alert('审核失败: ' + err.message)
    }
  }

  // ─── 审核拒绝 ───
  const handleReject = async (logId, comment) => {
    if (!currentProject) return
    try {
      await api.reviewPhaseLog(currentProject.id, logId, 'reject', comment)
      const logs = await api.getPhaseLogs(currentProject.id)
      setPhaseLogs(logs)
      const detail = await api.getProject(currentProject.id)
      setProjectDetail(detail)
      setReviewModal({ open: false, log: null })
      // 显示拒绝消息，引导继续对话
      setMessages(prev => [...prev, {
        role: 'assistant', content: `❌ 方案被驳回，修改意见：${comment}\n\n💬 请根据以上意见继续与 Agent 对话，修改满意后重新提交方案。`,
        agent_type: activeAgent, timestamp: Date.now()
      }])
    } catch (err) {
      alert('审核失败: ' + err.message)
    }
  }

  // ─── 流转到下一阶段 ───
  const handleAdvance = async () => {
    if (!currentProject || advancing) return
    const phaseDef = PHASE_FLOW.find(p => p.key === currentProject.phase)
    if (!phaseDef?.next) return
    const nextAgentName = phaseDef.nextAgentName || '下一角色'
    if (!confirm(`确认将项目流转到「${phaseDef.nextLabel}」？\n\n📋 ${phaseDef.label} → ${phaseDef.nextLabel}\n🤖 将由 ${nextAgentName} 接手工作`)) return
    setAdvancing(true)
    try {
      const result = await api.advanceProject(currentProject.id)
      await refreshProjects()
      const newPhase = result.next_phase
      setCurrentProject({ ...currentProject, phase: newPhase })
      setProjectDetail(prev => prev ? { ...prev, phase: newPhase } : prev)
      const nextAgent = PHASE_FLOW.find(p => p.key === newPhase)?.agent
      if (nextAgent) setActiveAgent(nextAgent)
      // 刷新日志
      const logs = await api.getPhaseLogs(currentProject.id)
      setPhaseLogs(logs)
      // 显示提示
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `🔄 **阶段流转成功！**\n\n${result.message}\n\n📌 已自动创建任务：${result.agent.name} - ${result.task_id}\n\n💬 现在可以与 **${result.agent.name}** 继续对话，描述你在这个阶段的需求。`,
        agent_type: nextAgent || activeAgent, timestamp: Date.now()
      }])
    } catch (err) {
      alert('流转失败: ' + err.message)
    } finally { setAdvancing(false) }
  }

  // ─── 请求审核专家审核 ───
  const handleRequestReview = async () => {
    if (!currentProject) return
    setRequestingReview(true)
    try {
      // 1. 后端创建 pending decision + 保存审核请求到 conversations
      const result = await api.requestReview(currentProject.id)
      // 2. 刷新审核决定
      const decisions = await api.getReviewerDecisions(currentProject.id)
      setReviewerDecisions(decisions)
      // 3. 刷新项目详情
      const detail = await api.getProject(currentProject.id)
      setProjectDetail(detail)
      // 4. 自动切到审核专家标签
      setActiveAgent('reviewer')
      // 5. 加载审核专家对话历史（含刚插入的审核请求）
      const convs = await api.getConversations(currentProject.id, 'reviewer')
      setMessages(convs.map(m => ({
        role: m.role, content: m.content, agent_type: 'reviewer',
        timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
      })))
      // 6. 自动发送审核请求消息给审核 Agent（流式）
      setStreamingText('')
      await api.chatStream('reviewer', `请审核当前阶段的方案。项目：${currentProject.name}，阶段：${currentProject.phase}`, currentProject.id,
        (chunk) => { setStreamingText(prev => prev + chunk) },
        () => {}
      )
      // 7. 流式结束后，将 streaming 内容保存为消息
      setStreamingText(prev => {
        if (prev) {
          setMessages(p => [...p, { role: 'assistant', content: prev, agent_type: 'reviewer', timestamp: Date.now() }])
        }
        return ''
      })
      // 8. 重新加载审核决定（审核 Agent 回复后可能已更新 decision）
      const updatedDecisions = await api.getReviewerDecisions(currentProject.id)
      setReviewerDecisions(updatedDecisions)
      const updatedDetail = await api.getProject(currentProject.id)
      setProjectDetail(updatedDetail)
    } catch (err) {
      alert('请求审核失败: ' + err.message)
      setStreamingText('')
    } finally { setRequestingReview(false) }
  }

  // ─── 用户对审核专家意见的回应 ───
  const handleRespondToReviewer = async (decisionId, action, comment) => {
    if (!currentProject) return
    try {
      if (action === 'agree') {
        // 同意审核专家意见 → 如果是通过/有条件通过则确认，如果未通过则标记同意不通过
        const result = await api.respondToReviewer(currentProject.id, decisionId, 'agree', comment)
        const decisions = await api.getReviewerDecisions(currentProject.id)
        setReviewerDecisions(decisions)
        const detail = await api.getProject(currentProject.id)
        setProjectDetail(detail)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ 您已确认审核专家的意见。${result.decision === 'user_approved' ? '现在可以流转到下一阶段了。' : '请继续后续操作。'}`,
          agent_type: activeAgent, timestamp: Date.now()
        }])
      } else if (action === 'override') {
        // 覆盖 → 用户强制通过
        const result = await api.respondToReviewer(currentProject.id, decisionId, 'disagree')
        const decisions = await api.getReviewerDecisions(currentProject.id)
        setReviewerDecisions(decisions)
        const detail = await api.getProject(currentProject.id)
        setProjectDetail(detail)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `🔄 您已覆盖审核专家的意见，按您的判断执行。现在可以流转到下一阶段。`,
          agent_type: activeAgent, timestamp: Date.now()
        }])
      } else if (action === 'revise') {
        // 继续修改 → 将审核意见发回给当前阶段 Agent
        const result = await api.requestRevision(currentProject.id, comment)
        const decisions = await api.getReviewerDecisions(currentProject.id)
        setReviewerDecisions(decisions)
        const detail = await api.getProject(currentProject.id)
        setProjectDetail(detail)
        // 自动切到对应 Agent
        const targetAgent = result.agent_role
        setActiveAgent(targetAgent)
        // 刷新对话历史（加载刚插入的修改指示）
        const convs = await api.getConversations(currentProject.id, targetAgent)
        setMessages(convs.map(m => ({
          role: m.role, content: m.content, agent_type: targetAgent,
          timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
        })))
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `📝 已将审核意见发送给 **${result.agent_name}**，请与其对话完善方案。修改完成后重新提交审核。`,
          agent_type: targetAgent, timestamp: Date.now()
        }])
      }
    } catch (err) {
      alert('操作失败: ' + err.message)
    }
  }

  // ─── Bug 工单操作 ───
  const [bugForm, setBugForm] = useState({
    title: '', description: '', severity: 'medium',
    steps_to_reproduce: '', expected_result: '', actual_result: ''
  })

  const handleSubmitBug = async () => {
    if (!currentProject || !bugForm.title.trim()) return
    try {
      const bug = await api.createBug({
        project_id: currentProject.id,
        title: bugForm.title,
        description: bugForm.description,
        severity: bugForm.severity,
        steps_to_reproduce: bugForm.steps_to_reproduce,
        expected_result: bugForm.expected_result,
        actual_result: bugForm.actual_result,
      })
      setBugModal(false)
      setBugForm({ title: '', description: '', severity: 'medium', steps_to_reproduce: '', expected_result: '', actual_result: '' })
      // 刷新 bug 列表
      const updatedBugs = await api.getBugs(currentProject.id)
      setBugs(updatedBugs)
      // 在聊天中显示创建成功
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `🐛 **Bug 工单已创建**\n\n**编号：** ${bug.bug_no}\n**标题：** ${bug.title}\n**严重程度：** ${bug.severity}\n\n📋 已自动通知开发工程师(贺元彬)进行修复。`,
        agent_type: activeAgent, timestamp: Date.now()
      }])
    } catch (err) {
      alert('提交失败: ' + err.message)
    }
  }

  const handleFixBug = async () => {
    if (!fixBugTarget || !fixNote.trim()) return
    try {
      await api.fixBug(fixBugTarget.id, fixNote)
      setFixModal(false)
      setFixBugTarget(null)
      setFixNote('')
      const updatedBugs = await api.getBugs(currentProject.id)
      setBugs(updatedBugs)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `🔧 **Bug ${fixBugTarget.bug_no} 已标记修复**\n\n**修复说明：** ${fixNote}\n\n📋 已通知测试工程师(孟清衡)进行验证。`,
        agent_type: activeAgent, timestamp: Date.now()
      }])
    } catch (err) {
      alert('操作失败: ' + err.message)
    }
  }

  const handleVerifyBug = async (bug) => {
    try {
      await api.verifyBug(bug.id, '验证通过')
      const updatedBugs = await api.getBugs(currentProject.id)
      setBugs(updatedBugs)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `🎉 **Bug ${bug.bug_no} 验证通过，已关闭！**\n\n**标题：** ${bug.title}`,
        agent_type: activeAgent, timestamp: Date.now()
      }])
    } catch (err) {
      alert('操作失败: ' + err.message)
    }
  }

  const handleReopenBug = async (bug) => {
    try {
      await api.reopenBug(bug.id)
      const updatedBugs = await api.getBugs(currentProject.id)
      setBugs(updatedBugs)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `🔄 **Bug ${bug.bug_no} 已重新打开**\n\n**标题：** ${bug.title}\n\n📋 已通知开发工程师(贺元彬)重新修复。`,
        agent_type: activeAgent, timestamp: Date.now()
      }])
    } catch (err) {
      alert('操作失败: ' + err.message)
    }
  }

  const openBugs = bugs.filter(b => b.status === 'open')
  const fixedBugs = bugs.filter(b => b.status === 'fixed')

  // ─── 输入历史（上下键翻阅） ───
  const [inputHistory, setInputHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1) // -1 = 当前输入, 0..N = 历史
  const savedInputRef = useRef('') // 保存用户正在编辑但未发送的内容

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim()) {
        // 发送时记录到历史
        setInputHistory(prev => [...prev, input])
        setHistoryIndex(-1)
        savedInputRef.current = ''
      }
      handleSend()
      return
    }
    // 只在光标在输入框首部时才触发上下翻阅（避免影响正常编辑）
    const textarea = e.target
    const cursorPos = textarea.selectionStart
    if (e.key === 'ArrowUp' && cursorPos === 0) {
      e.preventDefault()
      if (inputHistory.length === 0) return
      // 保存当前正在编辑的内容
      if (historyIndex === -1) savedInputRef.current = input
      const newIndex = historyIndex === -1 ? inputHistory.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(newIndex)
      setInput(inputHistory[newIndex])
    } else if (e.key === 'ArrowDown' && cursorPos === input.length) {
      e.preventDefault()
      if (historyIndex === -1) return
      if (historyIndex >= inputHistory.length - 1) {
        // 回到当前编辑内容
        setHistoryIndex(-1)
        setInput(savedInputRef.current)
      } else {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setInput(inputHistory[newIndex])
      }
    }
  }

  const currentAgentInfo = AGENT_TABS.find(a => a.id === activeAgent)
  const phaseDef = PHASE_FLOW.find(p => p.key === projectDetail?.phase)
  const phaseColor = phaseDef?.color || '#666'
  const canAdvance = phaseDef?.next && currentProject
  const phaseNeedsReview = phaseDef?.needsReview !== false // 默认需要审核
  const hasOpenBugs = currentProject?.phase === 'testing' && openBugs.length > 0
  const reviewStatus = REVIEW_STATUS_MAP[projectDetail?.phase_review_status] || REVIEW_STATUS_MAP.none

  return (
    <div className="h-full flex">
      {/* ========= 左侧：对话区 ========= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Agent 选择标签栏 */}
        <div className="border-b border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 flex items-center gap-1 flex-shrink-0">
          {AGENT_TABS.map(agent => {
            const badgeCount = agentBadgeCounts[agent.id] || 0
            return (
              <button key={agent.id}
                onClick={() => { setActiveAgent(agent.id); setStreamingText(''); setHistoryIndex(-1); savedInputRef.current = '' }}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                  activeAgent === agent.id ? 'bg-opacity-20 text-white font-medium' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'
                }`}
                style={activeAgent === agent.id ? { background: agent.color + '25', color: agent.color } : {}}>
                <span>{agent.icon}</span><span>{agent.name}</span>
                {badgeCount > 0 && activeAgent !== agent.id && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
                    {badgeCount}
                  </span>
                )}
              </button>
            )
          })}
          <div className="ml-auto flex items-center gap-2">
            {currentProject && (
              <>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: phaseColor + '20', color: phaseColor }}>
                  {PHASE_LABELS[currentProject.phase] || currentProject.phase}
                </span>
                {/* 审核状态标签 */}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${reviewStatus.bg}`} style={{ color: reviewStatus.color }}>
                  {reviewStatus.label}
                </span>
                <button onClick={() => setShowPhaseLogs(!showPhaseLogs)}
                  className={`p-2 rounded-lg text-sm transition-all ${showPhaseLogs ? 'bg-white/10 text-white' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}
                  title="阶段日志">
                  📑
                </button>
                <button onClick={() => setShowProjectPanel(!showProjectPanel)}
                  className={`p-2 rounded-lg text-sm transition-all ${showProjectPanel ? 'bg-white/10 text-white' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}
                  title="项目信息面板">
                  📦
                </button>
                <button onClick={handleClearHistory}
                  className="p-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-400 transition-all"
                  title="清空当前Agent对话历史">
                  🗑️
                </button>
              </>
            )}
          </div>
        </div>

        {/* 消息区域 */}
        <div className="flex-1 overflow-auto p-6">
          {/* 项目完成庆祝页面 */}
          {currentProject?.phase === 'launched' && (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="text-center animate-fadeIn">
                <div className="text-7xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold text-green-400 mb-3">恭喜！项目已成功上线！</h2>
                <p className="text-lg text-white mb-2">{currentProject.name}</p>
                <p className="text-sm text-[var(--text-secondary)] mb-6">所有阶段均已完成，项目正式上线运营</p>
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-2xl mb-1">📋</div>
                    <span className="text-[var(--text-secondary)]">策划</span>
                  </div>
                  <span className="text-green-500">✓</span>
                  <div className="text-center">
                    <div className="text-2xl mb-1">💻</div>
                    <span className="text-[var(--text-secondary)]">开发</span>
                  </div>
                  <span className="text-green-500">✓</span>
                  <div className="text-center">
                    <div className="text-2xl mb-1">🧪</div>
                    <span className="text-[var(--text-secondary)]">测试</span>
                  </div>
                  <span className="text-green-500">✓</span>
                  <div className="text-center">
                    <div className="text-2xl mb-1">🚀</div>
                    <span className="text-[var(--text-secondary)]">上线</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* 普通消息列表 */}
          {currentProject?.phase !== 'launched' && messages.length === 0 && !streamingText && (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
              <span className="text-6xl mb-4">{currentAgentInfo?.icon || '🤖'}</span>
              <h3 className="text-xl font-bold text-white mb-2">{currentAgentInfo?.name}</h3>
              <p className="text-sm mb-2">{currentAgentInfo?.desc}</p>
              <p className="text-xs opacity-60">在下方输入消息开始对话</p>
              {/* 上一阶段已审核方案预览 */}
              {prevPhasePlan && (
                <div className="mt-6 max-w-xl w-full mx-auto">
                  <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-400 text-sm">📋</span>
                      <span className="text-xs font-medium text-green-400">上一阶段已审核方案</span>
                      <span className="text-[10px] text-[var(--text-secondary)] ml-auto">{prevPhasePlan.phase_label}</span>
                    </div>
                    <div className="text-xs text-white/70 max-h-[15vh] overflow-auto markdown-body">
                      <ReactMarkdown>{(prevPhasePlan.plan_content || '').slice(0, 1500) + ((prevPhasePlan.plan_content || '').length > 1500 ? '\n\n...(点击阶段日志查看完整方案)' : '')}</ReactMarkdown>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-2">💡 此方案已作为上下文自动传递给当前 Agent</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-6 flex-wrap justify-center max-w-lg">
                {activeAgent === 'pm' && (<>
                  <QuickTip text="帮我分析这个需求" onClick={setInput} />
                  <QuickTip text="写一份PRD文档" onClick={setInput} />
                  <QuickTip text="做竞品分析" onClick={setInput} />
                </>)}
                {activeAgent === 'dev' && (<>
                  <QuickTip text="设计技术架构" onClick={setInput} />
                  <QuickTip text="帮我写这段代码" onClick={setInput} />
                  <QuickTip text="代码审查" onClick={setInput} />
                </>)}
                {activeAgent === 'qa' && (<>
                  <QuickTip text="写测试用例" onClick={setInput} />
                  <QuickTip text="检查这段代码" onClick={setInput} />
                  <QuickTip text="性能测试方案" onClick={setInput} />
                </>)}
                {activeAgent === 'ops' && (<>
                  <QuickTip text="制定增长策略" onClick={setInput} />
                  <QuickTip text="分析用户数据" onClick={setInput} />
                  <QuickTip text="写运营方案" onClick={setInput} />
                </>)}
                {activeAgent === 'reviewer' && (<>
                  <QuickTip text="请审核当前阶段方案，从客户角度评估质量" onClick={setInput} />
                  <QuickTip text="列出当前方案的风险点和改进建议" onClick={setInput} />
                  <QuickTip text="对比需求文档，检查方案完整性" onClick={setInput} />
                </>)}
              </div>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          
          {/* ═══════ 审核专家结论卡片（内嵌在聊天流中） ═══════ */}
          {(() => {
            const phaseDecisions = reviewerDecisions.filter(d => d.phase === currentProject?.phase)
            const latestDecision = phaseDecisions[phaseDecisions.length - 1]
            // 只在 pass/conditional_pass/fail 时显示操作卡（等用户决策）
            if (!latestDecision || !['pass', 'conditional_pass', 'fail'].includes(latestDecision.decision)) return null
            const ds = {
              pass: { label: '✅ 审核通过', color: '#00B894', bg: 'bg-green-500/10', border: 'border-green-500/30' },
              conditional_pass: { label: '⚠️ 有条件通过', color: '#FDCB6E', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
              fail: { label: '❌ 未通过', color: '#FF6B6B', bg: 'bg-red-500/10', border: 'border-red-500/30' },
            }[latestDecision.decision]
            return (
              <div className={`flex justify-center my-4 animate-fadeIn`}>
                <div className={`max-w-[85%] rounded-2xl border-2 ${ds.border} ${ds.bg} p-5`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">⚖️</span>
                    <div>
                      <div className="text-sm font-bold text-white">审核专家(俞望舒) 评审结论</div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: ds.color + '25', color: ds.color }}>{ds.label}</span>
                      {latestDecision.score > 0 && (
                        <span className="ml-2 text-sm font-bold" style={{ color: ds.color }}>{latestDecision.score}/10分</span>
                      )}
                    </div>
                  </div>
                  {/* 简洁结论 */}
                  <div className="text-sm text-white/90 mb-3 whitespace-pre-wrap leading-relaxed">
                    {latestDecision.full_review || latestDecision.issues || '暂无详细意见'}
                  </div>
                  {/* 操作按钮 */}
                  <div className="flex gap-3">
                    {latestDecision.decision !== 'fail' && (
                      <button onClick={() => handleRespondToReviewer(latestDecision.id, 'agree')}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 transition-all">
                        ✅ 同意，流转下一阶段
                      </button>
                    )}
                    <button onClick={() => handleRespondToReviewer(latestDecision.id, 'override')}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all ${latestDecision.decision === 'fail' ? 'flex-1' : ''}`}>
                      🔄 跳过，直接流转
                    </button>
                    <button onClick={() => setRevisionModal({ open: true, decisionId: latestDecision.id })}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium bg-[#A29BFE]/20 text-[#A29BFE] hover:bg-[#A29BFE]/30 transition-all ${latestDecision.decision === 'fail' ? 'flex-1' : ''}`}>
                      📝 继续修改
                    </button>
                  </div>
                  <div className="mt-2 text-[10px] text-[var(--text-secondary)] text-center">
                    「同意」确认专家意见并流转 · 「跳过」忽略专家意见直接流转 · 「继续修改」将意见发回给 Agent 重新修改
                  </div>
                </div>
              </div>
            )
          })()}

          {streamingText && (
            <div className="flex justify-start mb-4">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)] bg-opacity-20 flex items-center justify-center text-lg mr-3 flex-shrink-0 mt-1">{currentAgentInfo?.icon || '🤖'}</div>
              <div className="max-w-[70%] rounded-2xl rounded-bl-md px-5 py-3 bg-[var(--bg-card)] text-white border border-[var(--border-color)]">
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{streamingText}<span className="animate-pulse">▌</span></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ──── 底部操作栏 ──── */}
        <div className="border-t border-[var(--border-color)] bg-[var(--bg-card)] flex-shrink-0">
          {/* 工作流操作条 — 只在有项目且可流转时显示 */}
          {currentProject && canAdvance && (() => {
            const reviewStatus2 = projectDetail?.phase_review_status || 'none'
            const reviewerDecision = projectDetail?.reviewer_decision || 'none'
            const hasAssistant = messages.some(m => m.role === 'assistant')
            const isPending = reviewStatus2 === 'pending'
            const isApproved = reviewStatus2 === 'approved'
            const isRejected = reviewStatus2 === 'rejected'
            const reviewerPending = isApproved && ['pass', 'conditional_pass'].includes(reviewerDecision)
            const reviewerApproved = ['user_approved', 'user_overridden'].includes(reviewerDecision)
            // 运营阶段不需要审核专家，人工审核通过即可流转
            const allChecksPassed = phaseNeedsReview
              ? (isApproved && reviewerApproved)
              : isApproved

            return (
              <div className="px-4 py-3 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Step 1: 对话 */}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${
                    hasAssistant ? 'bg-green-500/10 text-green-400' : 'bg-white/10 text-white'
                  }`}>
                    <span>{hasAssistant ? '✅' : '1️⃣'}</span>
                    <span>与Agent对话</span>
                  </div>
                  <span className="text-[var(--text-secondary)] text-xs">→</span>

                  {/* Step 2: 提交方案 */}
                  {isApproved ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400">
                      <span>✅</span><span>已提交</span>
                    </div>
                  ) : isRejected ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400">
                      <span>❌</span><span>被拒绝</span>
                    </div>
                  ) : (
                    <button onClick={handleSubmitPlan} disabled={!hasAssistant}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        hasAssistant ? 'bg-yellow-500 text-white hover:bg-yellow-600 cursor-pointer' : 'bg-white/5 text-[var(--text-secondary)] cursor-not-allowed opacity-50'
                      }`}>
                      <span>2️⃣</span><span>{isPending ? '⏳已提交' : '📝 提交方案审核'}</span>
                    </button>
                  )}
                  <span className="text-[var(--text-secondary)] text-xs">→</span>

                  {/* Step 3: 人工审核 */}
                  {isPending ? (
                    <button onClick={() => setReviewModal({ open: true, log: phaseLogs.find(l => l.phase === currentProject?.phase) })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all cursor-pointer">
                      <span>3️⃣</span><span>👤 通过/拒绝</span>
                    </button>
                  ) : isApproved ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400">
                      <span>✅</span><span>人工已通过</span>
                    </div>
                  ) : isRejected ? (
                    <button onClick={() => { setShowPhaseLogs(true) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-[var(--text-secondary)] hover:bg-white/20 transition-all">
                      <span>3️⃣</span><span>查看拒绝意见</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 text-[var(--text-secondary)] opacity-50">
                      <span>3️⃣</span><span>人工审核</span>
                    </div>
                  )}
                  <span className="text-[var(--text-secondary)] text-xs">→</span>

                  {/* Step 4: 专家评审 — 仅需要审核的阶段显示 */}
                  {phaseNeedsReview ? (
                    <>
                      {reviewerApproved ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400">
                          <span>✅</span><span>专家已确认</span>
                        </div>
                      ) : reviewerPending ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-yellow-500/10 text-yellow-400">
                          <span>⏳</span><span>等待专家确认</span>
                        </div>
                      ) : isApproved ? (
                        <button onClick={handleRequestReview} disabled={requestingReview}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#A29BFE] text-white hover:opacity-90 transition-all disabled:opacity-50">
                          <span>4️⃣</span><span>{requestingReview ? '⏳ 评审中...' : '⚖️ 请求专家评审'}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 text-[var(--text-secondary)] opacity-50">
                          <span>4️⃣</span><span>专家评审</span>
                        </div>
                      )}
                      <span className="text-[var(--text-secondary)] text-xs">→</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-[var(--text-secondary)] italic">（本阶段无需专家评审）→</span>
                  )}

                  {/* Step 5: 流转 */}
                  {allChecksPassed ? (
                    <button onClick={handleAdvance} disabled={advancing || hasOpenBugs}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-white ${
                        !hasOpenBugs ? 'bg-green-600 hover:bg-green-700 cursor-pointer' : 'bg-white/10 text-[var(--text-secondary)] cursor-not-allowed'
                      }`}>
                      <span>{advancing ? '⏳' : hasOpenBugs ? '🚫' : '🚀'}</span>
                      <span>{advancing ? '流转中...' : hasOpenBugs ? `${openBugs.length}个Bug未关闭` : `流转到${phaseDef.nextLabel}`}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs bg-white/5 text-[var(--text-secondary)] opacity-50">
                      <span>🚀</span><span>流转</span>
                    </div>
                  )}
                </div>
                {/* 当前步骤提示 */}
                <div className="mt-2 flex items-center gap-2">
                  {!hasAssistant && <p className="text-[10px] text-[var(--text-secondary)]">💡 现在可以和 Agent 对话，完成本阶段的任务。完成后点击「提交方案审核」</p>}
                  {hasAssistant && !isPending && !isApproved && !isRejected && <p className="text-[10px] text-yellow-400">📝 对话完成后，点击「提交方案审核」将方案交给你审核</p>}
                  {isPending && <p className="text-[10px] text-yellow-400">⏳ 方案已提交，请审核：满意点「通过」，不满意点「拒绝」并让 Agent 继续修改</p>}
                  {isRejected && <p className="text-[10px] text-red-400">❌ 方案被拒绝，请继续与 Agent 对话修改，然后重新提交</p>}
                  {isApproved && phaseNeedsReview && !reviewerApproved && !reviewerPending && <p className="text-[10px] text-green-400">✅ 人工已通过，请点击「请求专家评审」让俞望舒把关质量</p>}
                  {isApproved && !phaseNeedsReview && !reviewerApproved && <p className="text-[10px] text-green-400">✅ 人工已通过！点击「流转到{phaseDef.nextLabel}」完成本阶段</p>}
                  {reviewerPending && <p className="text-[10px] text-yellow-400">⏳ 专家评审中，请查看下方评审结论卡片进行操作</p>}
                  {reviewerApproved && <p className="text-[10px] text-green-400">🎉 所有审核已通过！点击「流转到{phaseDef.nextLabel}」继续工作流</p>}
                </div>
              </div>
            )
          })()}

          {/* Bug 操作区 */}
          {currentProject && activeAgent === 'qa' && openBugs.length > 0 && (
            <div className="px-4 py-2 flex items-center gap-2 border-b border-[var(--border-color)]">
              <button onClick={() => setBugModal(true)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-all">
                🐛 提 Bug
              </button>
            </div>
          )}
          {currentProject && activeAgent === 'dev' && openBugs.length > 0 && (
            <div className="px-4 py-2 flex items-center gap-2 border-b border-[var(--border-color)]">
              <button onClick={() => { setFixBugTarget(openBugs[0]); setFixModal(true) }}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-all">
                🔧 修复 Bug ({openBugs.length})
              </button>
            </div>
          )}
          {currentProject && activeAgent === 'qa' && fixedBugs.length > 0 && (
            <div className="px-4 py-2 flex items-center gap-2 border-b border-[var(--border-color)]">
              <button onClick={() => handleVerifyBug(fixedBugs[0])}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500 text-white hover:bg-green-600 transition-all">
                🎉 验证 Bug ({fixedBugs.length})
              </button>
            </div>
          )}

          {/* 输入区 */}
          <div className="p-4">
            {currentProject && messages.length === 0 && (
              <div className="text-xs text-[var(--text-secondary)] mb-2 px-1">
                📦 当前项目：<span className="text-white">{currentProject.name}</span>
                {currentProject.description && <span className="ml-2 opacity-60">— {currentProject.description.slice(0, 60)}</span>}
              </div>
            )}
            <div className="flex items-end gap-3">
              <textarea
                className="flex-1 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-white resize-none focus:outline-none focus:border-[var(--primary)] transition-colors"
                rows={2}
                placeholder={`与${currentAgentInfo?.name || 'Agent'}对话...`}
                value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={loading}
              />
              <button onClick={() => handleSend()} disabled={!input.trim() || loading}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  input.trim() && !loading ? 'bg-[var(--primary)] text-white hover:opacity-90' : 'bg-white/10 text-[var(--text-secondary)] cursor-not-allowed'
                }`}>
                {loading ? '⏳' : '发送'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========= 右侧：阶段日志面板 ========= */}
      {showPhaseLogs && (
        <div className="w-96 border-l border-[var(--border-color)] bg-[var(--bg-card)] flex-shrink-0 overflow-auto flex flex-col">
          <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-sm font-bold text-white">📑 阶段日志</h3>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">每个环节的方案记录与审核状态</p>
            </div>
            <button onClick={() => setShowPhaseLogs(false)} className="text-[var(--text-secondary)] hover:text-white text-sm">✕</button>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <PhaseLogPanel
              logs={phaseLogs}
              currentPhase={currentProject?.phase}
              onReview={(log) => setReviewModal({ open: true, log })}
              onAdvance={handleAdvance}
              advancing={advancing}
            />
            {/* 审核专家决定 — 仅需要审核的阶段显示 */}
            {phaseNeedsReview && (
              <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <h4 className="text-xs font-bold text-[#A29BFE] mb-3 flex items-center gap-1.5">
                  ⚖️ 审核专家(俞望舒)评审
                </h4>
                <ReviewerDecisionPanel
                  decisions={reviewerDecisions}
                  currentPhase={currentProject?.phase}
                />
                {reviewerDecisions.filter(d => d.phase === currentProject?.phase).length === 0 && (
                  <p className="text-[10px] text-[var(--text-secondary)] text-center py-2">
                    提交方案并通过人工审核后，可请求审核专家评审
                  </p>
                )}
              </div>
            )}
          </div>
          {/* 底部快捷操作 */}
          {currentProject && canAdvance && (
            <div className="p-3 border-t border-[var(--border-color)] flex-shrink-0">
              <button onClick={handleSubmitPlan}
                disabled={!messages.some(m => m.role === 'assistant')}
                className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                📝 提交当前方案审核
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========= 右侧：项目信息面板 ========= */}
      {showProjectPanel && projectDetail && (
        <div className="w-80 border-l border-[var(--border-color)] bg-[var(--bg-card)] flex-shrink-0 overflow-auto">
          <div className="p-4 border-b border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">📦 项目信息</h3>
              <button onClick={() => setShowProjectPanel(false)} className="text-[var(--text-secondary)] hover:text-white text-sm">✕</button>
            </div>
            <h4 className="text-lg font-bold text-white mt-2">{projectDetail.name}</h4>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{projectDetail.description || '暂无描述'}</p>
          </div>
          {/* 阶段进度 */}
          <div className="p-4 border-b border-[var(--border-color)]">
            <h5 className="text-xs font-semibold text-[var(--text-secondary)] mb-3">工作流进度</h5>
            <div className="space-y-2">
              {PHASE_FLOW.map((p) => {
                const currentIdx = PHASE_FLOW.findIndex(x => x.key === projectDetail.phase)
                const thisIdx = PHASE_FLOW.findIndex(x => x.key === p.key)
                const isCurrent = p.key === projectDetail.phase
                const isPast = thisIdx < currentIdx
                return (
                  <div key={p.key} className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      isCurrent ? 'bg-white/20 ring-2' : isPast ? 'bg-white/10' : 'bg-white/5'
                    }`} style={isCurrent ? { ringColor: p.color } : {}}>
                      {isPast ? '✓' : thisIdx + 1}
                    </div>
                    <span className={`text-xs flex-1 ${isCurrent ? 'font-bold' : isPast ? 'text-[var(--text-secondary)]' : 'opacity-40'}`}
                      style={isCurrent ? { color: p.color } : {}}>
                      {p.icon} {p.label}
                    </span>
                    {isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10">当前</span>}
                  </div>
                )
              })}
            </div>
            {/* 面板流转按钮 — 根据阶段判断是否需要审核专家 */}
            {canAdvance && projectDetail?.phase_review_status === 'approved' && (phaseNeedsReview ? ['user_approved', 'user_overridden'].includes(projectDetail?.reviewer_decision) : true) && (
              <button onClick={handleAdvance} disabled={advancing}
                className="w-full mt-4 px-4 py-2.5 rounded-lg font-medium text-sm text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: PHASE_FLOW.find(p => p.key === phaseDef.next)?.color || '#6C5CE7' }}>
                {advancing ? '⏳ 流转中...' : `🔄 流转到${phaseDef.nextLabel}`}
              </button>
            )}
            {canAdvance && projectDetail?.phase_review_status !== 'approved' && (
              <div className="mt-4 px-4 py-2.5 rounded-lg text-sm text-center text-yellow-400 bg-yellow-500/10">
                ⏳ 请先提交方案并审核通过后流转
              </div>
            )}
            {canAdvance && projectDetail?.phase_review_status === 'approved' && phaseNeedsReview && !['user_approved', 'user_overridden'].includes(projectDetail?.reviewer_decision) && (
              <div className="mt-4 px-4 py-2.5 rounded-lg text-sm text-center text-[#A29BFE] bg-[#A29BFE]/10">
                ⚖️ 请先请求审核专家评审并确认后流转
              </div>
            )}
            {!canAdvance && projectDetail?.phase === 'launched' && (
              <div className="mt-4 px-4 py-3 rounded-xl text-center border-2 border-green-500/30 bg-green-500/10">
                <div className="text-3xl mb-2">🎉</div>
                <div className="text-lg font-bold text-green-400">项目已成功上线！</div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">所有阶段已完成，项目正式上线运营</p>
              </div>
            )}
          </div>
          {/* Agent 工作摘要 */}
          <div className="p-4 border-b border-[var(--border-color)]">
            <h5 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Agent 工作量</h5>
            <div className="space-y-1.5">
              {projectDetail.agent_summary?.map(a => (
                <div key={a.role} className="flex items-center justify-between text-xs">
                  <span>{a.icon} {a.name}</span>
                  <span className="text-[var(--text-secondary)]">{a.task_count}任务 · {a.output_count}产出</span>
                </div>
              ))}
            </div>
          </div>
          {/* 任务列表 */}
          <div className="p-4 border-b border-[var(--border-color)]">
            <h5 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">📋 任务</h5>
            {projectDetail.tasks?.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-white truncate">{t.agent_icon} {t.title}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  t.status === 'done' ? 'bg-green-500/20 text-green-400' :
                  t.status === 'doing' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {t.status === 'done' ? '完成' : t.status === 'doing' ? '进行中' : '待办'}
                </span>
              </div>
            ))}
            {(!projectDetail.tasks || projectDetail.tasks.length === 0) && <p className="text-[10px] text-[var(--text-secondary)]">暂无任务</p>}
          </div>
          {/* Bug 工单列表 */}
          {bugs.length > 0 && (
            <div className="p-4 border-b border-[var(--border-color)]">
              <h5 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">🐛 Bug 工单 ({bugs.length})</h5>
              <div className="space-y-1.5">
                {bugs.slice(0, 8).map(bug => {
                  const BUG_STATUS = { open: { label: '待修复', c: '#FF6B6B' }, fixed: { label: '已修复', c: '#FDCB6E' }, verified: { label: '已验证', c: '#00B894' }, reopened: { label: '重开', c: '#E17055' } }
                  const bs = BUG_STATUS[bug.status] || BUG_STATUS.open
                  return (
                    <div key={bug.id} className="flex items-center gap-1.5 py-1.5">
                      <span className="text-[10px]">{bs.c === '#FF6B6B' ? '🐛' : bs.c === '#FDCB6E' ? '🔧' : '🎉'}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">{bug.bug_no}</span>
                      <span className="text-xs text-white truncate flex-1">{bug.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: bs.c, background: bs.c + '20' }}>{bs.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {/* 产出物 */}
          <div className="p-4">
            <h5 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">📄 产出物</h5>
            {projectDetail.outputs?.slice(0, 5).map(o => (
              <div key={o.id} className="flex items-center gap-1.5 py-1.5">
                <span className="text-[10px]">{o.agent_icon || '📄'}</span>
                <span className="text-xs text-white truncate">{o.file_name}</span>
              </div>
            ))}
            {(!projectDetail.outputs || projectDetail.outputs.length === 0) && <p className="text-[10px] text-[var(--text-secondary)]">暂无产出物</p>}
          </div>
        </div>
      )}

      {/* ========= 审核弹窗 ========= */}
      <ReviewModal
        isOpen={reviewModal.open}
        onClose={() => setReviewModal({ open: false, log: null })}
        onApprove={(comment) => handleApprove(reviewModal.log?.id, comment)}
        onReject={(comment) => handleReject(reviewModal.log?.id, comment)}
        phaseLabel={reviewModal.log?.phase_label || ''}
        planContent={reviewModal.log?.plan_content || ''}
      />

      {/* ========= 修改指示弹窗（继续修改时填写意见） ========= */}
      {revisionModal.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setRevisionModal({ open: false, decisionId: null })}>
          <div className="bg-[var(--bg-card)] rounded-2xl w-[500px] border border-[var(--border-color)] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold text-white">📝 发回修改</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">将审核意见整理后发回给 Agent，让其修改方案</p>
            </div>
            <div className="p-5">
              <label className="block text-xs text-[var(--text-secondary)] mb-2">修改指示（可基于专家意见补充你的要求）</label>
              <textarea
                className="w-full bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-white text-sm resize-none focus:border-[var(--primary)] transition-colors"
                rows={5}
                placeholder="例如：专家指出方案缺少风险评估部分，请补充完善后重新提交..."
                value={revisionComment}
                onChange={e => setRevisionComment(e.target.value)}
              />
            </div>
            <div className="p-5 border-t border-[var(--border-color)] flex items-center justify-end gap-3">
              <button onClick={() => { setRevisionModal({ open: false, decisionId: null }); setRevisionComment('') }}
                className="px-5 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all">
                取消
              </button>
              <button onClick={() => {
                const decId = revisionModal.decisionId
                const comment = revisionComment || '请根据审核专家的意见修改方案'
                setRevisionModal({ open: false, decisionId: null })
                setRevisionComment('')
                handleRespondToReviewer(decId, 'revise', comment)
              }}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-[#A29BFE] text-white hover:opacity-90 transition-all">
                📨 发送给 Agent 修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========= 提 Bug 弹窗 ========= */}
      {bugModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setBugModal(false)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-[520px] max-h-[85vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold text-white">🐛 提交 Bug 工单</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Bug 将自动指派给开发工程师(贺元彬)</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Bug 标题 *</label>
                <input value={bugForm.title} onChange={e => setBugForm({...bugForm, title: e.target.value})}
                  className="w-full bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
                  placeholder="简要描述 Bug 现象" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">严重程度</label>
                <div className="flex gap-2">
                  {[{v:'critical',l:'致命',c:'#FF4757'},{v:'high',l:'高',c:'#FF6B6B'},{v:'medium',l:'中',c:'#FDCB6E'},{v:'low',l:'低',c:'#00B894'}].map(s => (
                    <button key={s.v} onClick={() => setBugForm({...bugForm, severity: s.v})}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        bugForm.severity === s.v ? 'text-white' : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-white/20'
                      }`}
                      style={bugForm.severity === s.v ? { background: s.c + '30', borderColor: s.c, color: s.c } : {}}>
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Bug 描述</label>
                <textarea value={bugForm.description} onChange={e => setBugForm({...bugForm, description: e.target.value})}
                  className="w-full bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none resize-none"
                  rows={2} placeholder="详细描述 Bug" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">复现步骤</label>
                <textarea value={bugForm.steps_to_reproduce} onChange={e => setBugForm({...bugForm, steps_to_reproduce: e.target.value})}
                  className="w-full bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none resize-none"
                  rows={2} placeholder="1. 打开xxx页面&#10;2. 点击xxx按钮" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">预期结果</label>
                  <textarea value={bugForm.expected_result} onChange={e => setBugForm({...bugForm, expected_result: e.target.value})}
                    className="w-full bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none resize-none"
                    rows={2} placeholder="应该显示什么" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">实际结果</label>
                  <textarea value={bugForm.actual_result} onChange={e => setBugForm({...bugForm, actual_result: e.target.value})}
                    className="w-full bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none resize-none"
                    rows={2} placeholder="实际显示了什么" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-[var(--border-color)] flex justify-end gap-3">
              <button onClick={() => setBugModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-white transition-all">
                取消
              </button>
              <button onClick={handleSubmitBug} disabled={!bugForm.title.trim()}
                className={`px-5 py-2 rounded-lg text-sm font-medium text-white transition-all ${
                  bugForm.title.trim() ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 text-[var(--text-secondary)] cursor-not-allowed'
                }`}>
                🐛 提交 Bug
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========= 修复 Bug 弹窗 ========= */}
      {fixModal && fixBugTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => { setFixModal(false); setFixBugTarget(null) }}>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-[480px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold text-white">🔧 修复 Bug</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{fixBugTarget.bug_no} — {fixBugTarget.title}</p>
            </div>
            <div className="p-5 space-y-3">
              {/* Bug 详情 */}
              <div className="bg-[var(--bg-dark)] rounded-lg p-3 text-xs text-[var(--text-secondary)] space-y-1">
                <p>严重程度: <span className="text-white">{fixBugTarget.severity}</span></p>
                {fixBugTarget.steps_to_reproduce && <p>复现步骤: <span className="text-white">{fixBugTarget.steps_to_reproduce.slice(0, 200)}</span></p>}
                {fixBugTarget.expected_result && <p>预期: <span className="text-white">{fixBugTarget.expected_result}</span></p>}
                {fixBugTarget.actual_result && <p>实际: <span className="text-white">{fixBugTarget.actual_result}</span></p>}
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">修复说明 *</label>
                <textarea value={fixNote} onChange={e => setFixNote(e.target.value)}
                  className="w-full bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none resize-none"
                  rows={3} placeholder="描述你的修复方案" />
              </div>
            </div>
            <div className="p-5 border-t border-[var(--border-color)] flex justify-end gap-3">
              <button onClick={() => { setFixModal(false); setFixBugTarget(null) }}
                className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:text-white transition-all">
                取消
              </button>
              <button onClick={handleFixBug} disabled={!fixNote.trim()}
                className={`px-5 py-2 rounded-lg text-sm font-medium text-white transition-all ${
                  fixNote.trim() ? 'bg-green-500 hover:bg-green-600' : 'bg-white/10 text-[var(--text-secondary)] cursor-not-allowed'
                }`}>
                ✅ 标记修复
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
