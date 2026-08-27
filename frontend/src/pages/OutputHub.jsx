import React, { useState, useEffect } from 'react'
import { useStore } from '../stores/useStore'
import { api } from '../api/client'
import ReactMarkdown from 'react-markdown'

const FILE_TYPE_ICONS = {
  plan: '📋', code: '💻', test: '🧪', doc: '📄', report: '📈', other: '📎',
}

const PHASE_ICONS = {
  '01-策划': '📋', '02-开发': '💻', '03-测试': '🧪', '04-运营': '📈', '00-其他': '📎',
}

export default function OutputHub() {
  const projects = useStore(s => s.projects)
  const currentProject = useStore(s => s.currentProject)
  const setCurrentProject = useStore(s => s.setCurrentProject)

  const [selectedProject, setSelectedProject] = useState(null)
  const [diskFiles, setDiskFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('disk') // disk | db

  // 加载数据库产出
  const [dbOutputs, setDbOutputs] = useState([])

  useEffect(() => {
    const proj = currentProject || projects[0]
    if (proj) {
      setSelectedProject(proj)
      loadProjectFiles(proj.id)
    }
  }, [currentProject, projects])

  const loadProjectFiles = async (projectId) => {
    setLoading(true)
    try {
      const [disk, db] = await Promise.all([
        api.getProjectFiles(projectId),
        api.getOutputs(projectId),
      ])
      setDiskFiles(disk.files || [])
      setDbOutputs(db || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
    setSelectedFile(null)
    setFileContent('')
  }

  const handleReadFile = async (filePath) => {
    if (!selectedProject) return
    try {
      const result = await api.readProjectFile(selectedProject.id, filePath)
      setSelectedFile(filePath)
      setFileContent(result.content)
    } catch (err) {
      setSelectedFile(filePath)
      setFileContent(`⚠️ 读取失败: ${err.message}`)
    }
  }

  // 按阶段分组文件
  const groupedFiles = {}
  diskFiles.forEach(f => {
    const parts = f.path.split(/[/\\]/)
    const phase = parts.length > 1 ? parts[0] : '00-其他'
    if (!groupedFiles[phase]) groupedFiles[phase] = []
    groupedFiles[phase].push(f)
  })

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (ts) => {
    return new Date(ts * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white">📄 产出中心</h2>
          <p className="text-[var(--text-secondary)] mt-1">
            项目产出文件存于磁盘 <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded">projects/</code> 目录，可拔插移动
          </p>
        </div>
        {/* 项目选择 */}
        <select
          className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-white text-sm focus:outline-none focus:border-[var(--primary)]"
          value={selectedProject?.id || ''}
          onChange={e => {
            const proj = projects.find(p => p.id === parseInt(e.target.value))
            if (proj) { setSelectedProject(proj); loadProjectFiles(proj.id) }
          }}>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        <button onClick={() => setActiveTab('disk')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'disk' ? 'bg-[var(--primary)] text-white' : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'}`}>
          📁 磁盘文件 ({diskFiles.length})
        </button>
        <button onClick={() => setActiveTab('db')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'db' ? 'bg-[var(--primary)] text-white' : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'}`}>
          🗄️ 数据库记录 ({dbOutputs.length})
        </button>
      </div>

      {/* 主体 */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* 左侧：文件列表 */}
        <div className="w-80 flex-shrink-0 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-auto">
          {activeTab === 'disk' ? (
            <div className="p-3">
              {loading && <div className="text-center py-8 text-[var(--text-secondary)]">加载中...</div>}
              {!loading && diskFiles.length === 0 && (
                <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
                  <p className="text-3xl mb-2">📂</p>
                  <p>暂无产出文件</p>
                  <p className="text-xs mt-1 opacity-60">与 Agent 对话后提交方案会自动保存到磁盘</p>
                </div>
              )}
              {Object.entries(groupedFiles).sort(([a], [b]) => a.localeCompare(b)).map(([phase, files]) => (
                <div key={phase} className="mb-3">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[var(--text-secondary)]">
                    <span>{PHASE_ICONS[phase] || '📁'}</span>
                    <span>{phase}</span>
                  </div>
                  {files.map(f => {
                    const fileName = f.path.split(/[/\\]/).pop()
                    const isSelected = selectedFile === f.path
                    return (
                      <button key={f.path} onClick={() => handleReadFile(f.path)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all mb-1 ${
                          isSelected ? 'bg-[var(--primary)] bg-opacity-20 text-white border border-[var(--primary)]' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">📄</span>
                          <span className="flex-1 truncate">{fileName}</span>
                        </div>
                        <div className="text-[10px] opacity-50 mt-0.5 ml-5">{formatSize(f.size)}</div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {dbOutputs.length === 0 && (
                <div className="text-center py-8 text-[var(--text-secondary)] text-sm">暂无数据库记录</div>
              )}
              {dbOutputs.map(o => (
                <div key={o.id} className="px-3 py-2 bg-white/5 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span>{FILE_TYPE_ICONS[o.file_type] || '📎'}</span>
                    <span className="text-white truncate">{o.file_name}</span>
                  </div>
                  {o.file_path && (
                    <div className="text-[10px] text-[var(--text-secondary)] mt-1 ml-6 font-mono">{o.file_path}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-secondary)] ml-6">
                    <span>{o.agent_name || '未知'}</span>
                    <span>·</span>
                    <span>{new Date(o.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：文件预览 */}
        <div className="flex-1 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-auto">
          {selectedFile ? (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border-color)]">
                <span className="text-sm text-[var(--text-secondary)]">📄</span>
                <span className="text-sm font-medium text-white">{selectedFile}</span>
                <span className="text-xs text-[var(--text-secondary)] ml-auto">
                  {formatSize(fileContent ? new TextEncoder().encode(fileContent).length : 0)}
                </span>
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{fileContent}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-secondary)]">
              <span className="text-5xl mb-4">📄</span>
              <p className="text-lg">选择左侧文件查看内容</p>
              <p className="text-sm mt-1 opacity-60">所有产出按阶段分组存储在 projects/ 目录下</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
