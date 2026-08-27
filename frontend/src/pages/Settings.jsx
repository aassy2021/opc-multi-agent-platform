import React, { useState, useEffect } from 'react'
import { useStore } from '../stores/useStore'

export default function Settings() {
  const agents = useStore(s => s.agents)
  const [activeTab, setActiveTab] = useState('api')
  const [apiConfig, setApiConfig] = useState({
    provider: 'xiaomi',
    model: 'mimo-v2.5',
    api_key: '',
    api_base: 'https://api.xiaomimimo.com/v1',
  })
  const [apiKeyChanged, setApiKeyChanged] = useState(false) // 标记用户是否手动修改了 API Key
  const [showApiKey, setShowApiKey] = useState(false) // API Key 显示/隐藏切换

  const [editingAgent, setEditingAgent] = useState(null)
  const [agentPrompt, setAgentPrompt] = useState('')

  // 从后端读取 + localStorage 回退
  useEffect(() => {
    fetch('/api/settings/llm').then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        setApiConfig({
          provider: data.provider || 'xiaomi',
          model: data.model || 'mimo-v2.5',
          api_key: data.api_key_masked || '',
          api_base: data.base_url || '',
        })
        return
      }
    }).catch(() => {})
    // fallback: localStorage
    const saved = localStorage.getItem('opc_api_config')
    if (saved) setApiConfig(JSON.parse(saved))
  }, [])

  const saveApiConfig = async () => {
    // 如果用户没有修改 API Key，不发送 masked 值覆盖真实 key
    const payload = { ...apiConfig }
    if (!apiKeyChanged) {
      delete payload.api_key // 后端 reconfigure 会跳过 None
    }
    // 保存到后端（运行时生效 + 持久化到 .env）
    try {
      const resp = await fetch('/api/settings/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (resp.ok) {
        const result = await resp.json()
        alert(`✅ 配置已保存并立即生效\nProvider: ${result.provider}\nModel: ${result.model}\nBase URL: ${result.base_url}`)
      } else {
        const err = await resp.json()
        alert('❌ 保存失败: ' + (err.detail || '未知错误'))
      }
    } catch (e) {
      alert('❌ 连接后端失败: ' + e.message)
    }
    // 同时保存到 localStorage 备用
    localStorage.setItem('opc_api_config', JSON.stringify(apiConfig))
  }

  const handleEditPrompt = (agent) => {
    setEditingAgent(agent)
    setAgentPrompt(agent.system_prompt || '')
  }

  const savePrompt = async () => {
    if (!editingAgent) return
    try {
      const response = await fetch(`/api/agents/${editingAgent.id}/prompt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt: agentPrompt })
      })
      if (response.ok) {
        alert('✅ Prompt 已更新')
        setEditingAgent(null)
      }
    } catch (err) {
      alert('❌ 保存失败：' + err.message)
    }
  }

  return (
    <div className="p-6 h-full overflow-auto">
      <h2 className="text-2xl font-bold text-white mb-6">⚙️ 设置</h2>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('api')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'api' ? 'bg-[var(--primary)] text-white' : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'}`}>
          🔑 API 配置
        </button>
        <button onClick={() => setActiveTab('agents')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'agents' ? 'bg-[var(--primary)] text-white' : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'}`}>
          🤖 Agent 管理
        </button>
        <button onClick={() => setActiveTab('about')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'about' ? 'bg-[var(--primary)] text-white' : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'}`}>
          ℹ️ 关于
        </button>
      </div>

      {/* API 配置 */}
      {activeTab === 'api' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 max-w-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">🔑 LLM API 配置</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Provider</label>
              <select className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white focus:outline-none" value={apiConfig.provider} onChange={e => {
                const p = e.target.value
                const defaults = {
                  xiaomi:  { model: 'mimo-v2.5',         base: 'https://api.xiaomimimo.com/v1' },
                  openai:  { model: 'gpt-4o',             base: 'https://api.openai.com/v1' },
                  deepseek:{ model: 'deepseek-chat',       base: 'https://api.deepseek.com/v1' },
                  claude:  { model: 'claude-sonnet-4-20250514', base: 'https://api.anthropic.com/v1' },
                  zhipu:   { model: 'glm-4-plus',         base: 'https://open.bigmodel.cn/api/paas/v4' },
                  qwen:    { model: 'qwen-max',            base: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
                  moonshot:{ model: 'moonshot-v1-128k',    base: 'https://api.moonshot.cn/v1' },
                  doubao:  { model: 'doubao-1.5-pro-256k', base: 'https://ark.cn-beijing.volces.com/api/v3' },
                  baichuan:{ model: 'Baichuan4',           base: 'https://api.baichuan-ai.com/v1' },
                  minimax: { model: 'abab6.5-chat',        base: 'https://api.minimax.chat/v1' },
                  ollama:  { model: 'qwen2.5:7b',          base: 'http://localhost:11434/v1' },
                  custom:  { model: '',                     base: '' },
                }
                const d = defaults[p] || {}
                setApiConfig({ ...apiConfig, provider: p, model: d.model || '', api_base: d.base || '' })
              }}>
                <optgroup label="🇨🇳 国产模型">
                  <option value="xiaomi">小米 MiMo</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="qwen">通义千问 (阿里)</option>
                  <option value="zhipu">智谱 GLM (清华)</option>
                  <option value="moonshot">月之暗面 Kimi</option>
                  <option value="doubao">豆包 (字节)</option>
                  <option value="baichuan">百川</option>
                  <option value="minimax">MiniMax</option>
                </optgroup>
                <optgroup label="🌍 国际模型">
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude (Anthropic)</option>
                </optgroup>
                <optgroup label="🖥️ 本地部署">
                  <option value="ollama">Ollama (本地)</option>
                </optgroup>
                <optgroup label="⚙️ 其他">
                  <option value="custom">自定义 (Custom)</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">模型</label>
              <input className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white focus:outline-none focus:border-[var(--primary)]" placeholder="mimo-v2.5" value={apiConfig.model} onChange={e => setApiConfig({ ...apiConfig, model: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  className="w-full px-4 py-2.5 pr-20 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white focus:outline-none focus:border-[var(--primary)]"
                  placeholder="sk-..."
                  value={apiConfig.api_key}
                  onChange={e => { setApiKeyChanged(true); setApiConfig({ ...apiConfig, api_key: e.target.value }) }}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[var(--text-secondary)] hover:text-white transition-all"
                >
                  {showApiKey ? '🙈 隐藏' : '👁️ 显示'}
                </button>
              </div>
              {!apiKeyChanged && apiConfig.api_key && (
                <p className="text-xs text-green-400 mt-1">✅ API Key 已配置并持久化保存，不修改则保持不变</p>
              )}
              {apiKeyChanged && (
                <p className="text-xs text-yellow-400 mt-1">⚠️ 已修改，点击「保存配置」后生效</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">API Base URL (可选)</label>
              <input className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white focus:outline-none focus:border-[var(--primary)]" placeholder="https://api.xiaomimimo.com/v1" value={apiConfig.api_base} onChange={e => setApiConfig({ ...apiConfig, api_base: e.target.value })} />
            </div>
            <button onClick={saveApiConfig} className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90">
              💾 保存配置
            </button>
            <p className="text-xs text-[var(--text-secondary)] mt-1">保存后立即生效，同时写入 .env 文件，重启后端也不会丢失</p>
          </div>
        </div>
      )}

      {/* Agent 管理 */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          {agents.filter(a => a.role !== 'writer').map(agent => (
            <div key={agent.id} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{agent.icon}</span>
                  <div>
                    <h4 className="text-lg font-semibold text-white">{agent.name}</h4>
                    <p className="text-sm text-[var(--text-secondary)]">{agent.description}</p>
                  </div>
                </div>
                <button onClick={() => handleEditPrompt(agent)} className="px-4 py-2 bg-white/5 text-[var(--text-secondary)] rounded-lg text-sm hover:bg-white/10 hover:text-white">
                  ✏️ 编辑 Prompt
                </button>
              </div>
              <div className="mt-3 p-3 bg-[var(--bg-dark)] rounded-lg text-xs text-[var(--text-secondary)] font-mono max-h-20 overflow-hidden">
                {agent.system_prompt?.substring(0, 200) || '暂无 Prompt'}...
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 关于 */}
      {activeTab === 'about' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 max-w-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">ℹ️ 关于 OPC Platform</h3>
          <div className="space-y-3 text-sm text-[var(--text-secondary)]">
            <p>🏢 <strong className="text-white">OPC Platform</strong> — 一人公司 AI 指挥中心</p>
            <p>让一个人也能拥有一支 AI 团队，覆盖从产品策划到开发测试再到运营推广的全流程。</p>
            <div className="border-t border-[var(--border-color)] pt-4 mt-4">
              <p><strong className="text-white">5 个 AI Agent + 1 个工具：</strong></p>
              <ul className="mt-2 space-y-1">
                <li>🎯 <strong className="text-white">产品经理(宋承言)</strong> — 需求分析、竞品调研、PRD 撰写</li>
                <li>💻 <strong className="text-white">开发工程师(贺元彬)</strong> — 架构设计、代码开发、技术选型</li>
                <li>🧪 <strong className="text-white">测试工程师(孟清衡)</strong> — 测试用例、Bug 检测、质量保障</li>
                <li>📢 <strong className="text-white">运营专家(裴衍舟)</strong> — 增长策略、数据运营、渠道推广</li>
                <li>⚖️ <strong className="text-white">审核专家(俞望舒)</strong> — 质量审核、方案评审、风险把控</li>
                <li>✍️ <strong className="text-white">内容润色</strong> — 8种风格文案优化（左侧栏独立入口）</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 编辑 Prompt 弹窗 */}
      {editingAgent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingAgent(null)}>
          <div className="bg-[var(--bg-card)] rounded-2xl p-6 w-[700px] max-h-[80vh] border border-[var(--border-color)] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">
              ✏️ 编辑 {editingAgent.name} System Prompt
            </h3>
            <textarea
              className="flex-1 w-full px-4 py-3 bg-[var(--bg-dark)] border border-[var(--border-color)] rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[var(--primary)] resize-none"
              style={{ minHeight: '400px' }}
              value={agentPrompt}
              onChange={e => setAgentPrompt(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setEditingAgent(null)} className="px-5 py-2.5 rounded-lg text-[var(--text-secondary)] hover:text-white">取消</button>
              <button onClick={savePrompt} className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90">💾 保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
