import React, { useState } from 'react'

const guideSections = [
  {
    icon: '🎯',
    title: '平台简介',
    content: `**OPC Platform** 是一款专为「一人公司」打造的 AI 多角色协作平台。

你一个人 = 一个团队。5 个 AI Agent 各司其职，从策划、开发、测试到运营，全流程协作完成项目。另有独立的「内容润色」工具随时使用。`
  },
  {
    icon: '🤖',
    title: '五大 Agent',
    content: `| Agent | 职责 | 使用场景 |
|-------|------|----------|
| 🎯 **产品经理(宋承言)** | 需求分析、PRD 撰写、功能规划 | 项目策划阶段 |
| 💻 **开发工程师(贺元彬)** | 技术方案、架构设计、编码实现 | 项目开发阶段 |
| 🧪 **测试工程师(孟清衡)** | 测试计划、用例编写、质量保障 | 项目测试阶段 |
| 📢 **运营专家(裴衍舟)** | 上线方案、增长策略、数据运营 | 项目运营阶段 |
| ⚖️ **审核专家(俞望舒)** | 质量审核、方案评审、风险把控 | 每个阶段流转前 |

每个阶段的方案必须经过 **审核专家(俞望舒)** 从客户角度审核通过后，再经您确认，才能流转到下一阶段。

另有 ✍️ **内容润色** 工具支持 8 种风格改写，可在左侧栏直接使用。`
  },
  {
    icon: '🔄',
    title: '工作流',
    content: `每个项目经历 4 个阶段，**一键推进**自动触发对应 Agent 工作：

\`\`\`
策划 → 开发 → 测试 → 上线
(PM)   (DEV)   (QA)   (OPS)
  ↓       ↓       ↓       ↓
⚖️审核  ⚖️审核  ⚖️审核  ⚖️审核
(俞望舒)(俞望舒)(俞望舒)(俞望舒)
\`\`\`

**每个阶段的流转流程：**
1. 与当前阶段 Agent 对话完成工作
2. 点击「📝 提交审核」提交方案
3. 人工审核通过后，点击「⚖️ 请求审核」
4. 审核专家(俞望舒)从客户角度评审方案
5. 查看评审结果，点击「同意」或「覆盖」
6. 点击「🔄 流转到下一步」推进项目

💡 **审核专家是质量守门员** — 确保每个交付物都达到客户标准。`
  },
  {
    icon: '✍️',
    title: '内容润色',
    content: `独立的内容创作工具，支持 **8 种风格**一键切换：

🔴 **小红书** — emoji 密集、种草感强
🟠 **知乎** — 深度分析、专业严谨
🟢 **公众号** — 故事化、情感共鸣
🔵 **抖音** — 口语化、抓人眼球
⚪ **正式** — 商务正式风格
🟡 **轻松** — 亲切随意
🟣 **技术** — 简洁精准
🔴 **营销** — 转化导向

**使用方法：** 选择风格 → 输入或粘贴原文 → 点击「开始润色」`
  },
  {
    icon: '📋',
    title: '任务看板',
    content: `三列看板管理所有 Agent 产生的任务：

• **进行中** — Agent 正在处理的任务
• **待处理** — 已创建但未开始的任务
• **已完成** — 已完成的任务

每个任务显示优先级颜色和所属 Agent，方便追踪进度。`
  },
  {
    icon: '📄',
    title: '产出中心',
    content: `所有 Agent 产出的文档、代码、方案都汇总在此：

• 支持按类型筛选（文档/代码/方案/报告）
• 左侧文件列表 + 右侧 Markdown 预览
• 一键复制内容到剪贴板`
  },
  {
    icon: '⚙️',
    title: '快速开始',
    content: `**第一步：配置 API Key**
1. 点击左侧「⚙️ 设置」
2. 选择 LLM 提供商（推荐 DeepSeek）
3. 填入 API Key，点击保存

**第二步：创建第一个项目**
1. 点击左侧「📁 项目」
2. 点击「+ 新建项目」
3. 填写项目名称和描述
4. 点击创建

**第三步：开始协作**
1. 点击项目卡片进入详情
2. 点击「推进到下一阶段」
3. 与 PM Agent 对话，描述你的需求
4. 逐步推进，直到项目上线

💡 **小贴士：** 即使没有配置 API Key，也可以体验 Demo 模式。`
  },
  {
    icon: '💡',
    title: '技巧',
    content: `1. **先和 PM 沟通清楚需求** — 好的开始是成功的一半
2. **每次对话尽量具体** — 提供背景信息，Agent 回答更精准
3. **善用内容润色** — Agent 产出的文档可以一键润色成不同风格
4. **推进阶段前先完成当前工作** — 确保本阶段产出完整再进入下一阶段
5. **查看产出中心** — 所有阶段性文档都会自动归档`
  }
]

export default function ProductGuide({ isOpen, onClose }) {
  const [activeSection, setActiveSection] = useState(0)

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* 滑出面板 */}
      <div
        className={`fixed top-0 right-0 h-full w-[520px] bg-[var(--bg-sidebar)] border-l border-[var(--border-color)] z-[101] transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 面板头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <h2 className="text-lg font-bold text-white">产品使用说明</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 text-[var(--text-secondary)] flex items-center justify-center hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex flex-col h-[calc(100%-61px)]">
          {/* 导航标签 */}
          <div className="flex gap-1 px-4 py-3 border-b border-[var(--border-color)] overflow-x-auto flex-shrink-0">
            {guideSections.map((section, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSection(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all cursor-pointer ${
                  activeSection === idx
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{section.icon}</span>
                <span>{section.title}</span>
              </button>
            ))}
          </div>

          {/* 详情内容 */}
          <div className="flex-1 overflow-auto px-6 py-5">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-3">
                <span className="text-2xl">{guideSections[activeSection].icon}</span>
                {guideSections[activeSection].title}
              </h3>
              <div className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap markdown-body">
                {renderContent(guideSections[activeSection].content)}
              </div>
            </div>

            {/* 上一步/下一步 */}
            <div className="flex justify-between mt-8 pt-4 border-t border-[var(--border-color)]">
              <button
                onClick={() => setActiveSection(Math.max(0, activeSection - 1))}
                disabled={activeSection === 0}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                  activeSection === 0
                    ? 'text-[var(--text-secondary)] opacity-40 cursor-not-allowed'
                    : 'text-[var(--text-secondary)] hover:bg-white/10 hover:text-white'
                }`}
              >
                ← 上一步
              </button>
              <span className="text-xs text-[var(--text-secondary)] flex items-center">
                {activeSection + 1} / {guideSections.length}
              </span>
              <button
                onClick={() => setActiveSection(Math.min(guideSections.length - 1, activeSection + 1))}
                disabled={activeSection === guideSections.length - 1}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                  activeSection === guideSections.length - 1
                    ? 'text-[var(--text-secondary)] opacity-40 cursor-not-allowed'
                    : 'text-[var(--text-secondary)] hover:bg-white/10 hover:text-white'
                }`}
              >
                下一步 →
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// 简单 Markdown 渲染
function renderContent(text) {
  const parts = []
  const lines = text.split('\n')
  let inCodeBlock = false
  let codeLines = []
  let inTable = false
  let tableRows = []

  const flushTable = () => {
    if (tableRows.length > 0) {
      parts.push(
        <div key={`table-${parts.length}`} className="my-3 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {tableRows.map((row, ri) => {
                const cells = row.split('|').map(c => c.trim()).filter(Boolean)
                return (
                  <tr key={ri} className={ri === 0 ? 'border-b border-[var(--border-color)]' : 'border-b border-white/5'}>
                    {cells.map((cell, ci) => (
                      ri === 0
                        ? <th key={ci} className="px-3 py-2 text-left text-[var(--text-secondary)] font-semibold bg-white/5">{renderInline(cell)}</th>
                        : <td key={ci} className="px-3 py-2 text-left">{renderInline(cell)}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
      tableRows = []
      inTable = false
    }
  }

  const flushCode = () => {
    if (codeLines.length > 0) {
      parts.push(
        <pre key={`code-${parts.length}`} className="bg-[#0d1117] rounded-lg p-4 my-3 overflow-x-auto text-sm">
          <code className="text-[#e6e6e6]">{codeLines.join('\n')}</code>
        </pre>
      )
      codeLines = []
      inCodeBlock = false
    }
  }

  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      if (inCodeBlock) { flushCode() } else { inCodeBlock = true }
      return
    }
    if (inCodeBlock) { codeLines.push(line); return }

    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!inTable) inTable = true
      tableRows.push(line)
      return
    } else {
      flushTable()
    }

    if (line.trim() === '') {
      parts.push(<div key={`br-${i}`} className="h-2" />)
      return
    }

    parts.push(
      <p key={`p-${i}`} className="my-1">{renderInline(line)}</p>
    )
  })

  flushCode()
  flushTable()

  return parts
}

function renderInline(text) {
  const boldRegex = /\*\*(.+?)\*\*/g
  const segments = []
  let lastIndex = 0
  let match

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'bold', value: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments.map((seg, i) => {
    if (seg.type === 'bold') {
      return <strong key={i} className="font-semibold text-white">{seg.value}</strong>
    }
    const codeParts = []
    let lastCodeIdx = 0
    let codeMatch
    const codeRegex = /`(.+?)`/g
    while ((codeMatch = codeRegex.exec(seg.value)) !== null) {
      if (codeMatch.index > lastCodeIdx) {
        codeParts.push(<span key={`t${i}-${lastCodeIdx}`}>{seg.value.slice(lastCodeIdx, codeMatch.index)}</span>)
      }
      codeParts.push(
        <code key={`c${i}-${codeMatch.index}`} className="bg-[rgba(108,92,231,0.15)] px-1.5 py-0.5 rounded text-[13px] text-[var(--primary-light)]">
          {codeMatch[1]}
        </code>
      )
      lastCodeIdx = codeMatch.index + codeMatch[0].length
    }
    if (lastCodeIdx < seg.value.length) {
      codeParts.push(<span key={`e${i}`}>{seg.value.slice(lastCodeIdx)}</span>)
    }
    return codeParts.length > 0 ? codeParts : seg.value
  })
}
