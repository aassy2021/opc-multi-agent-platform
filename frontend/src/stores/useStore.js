import { create } from 'zustand'
import { api } from '../api/client'

export const useStore = create((set, get) => ({
  // ====== 状态 ======
  currentProject: null,
  projects: [],
  agents: [],
  tasks: [],
  outputs: [],
  stats: { projects: 0, tasks: 0, outputs: 0, agents: 0 },

  // ====== 初始化 ======
  init: async () => {
    const [projects, agents, stats, allTasks] = await Promise.all([
      api.getProjects(),
      api.getAgents(),
      api.getStats(),
      api.getTasks(),
    ])
    set({ projects, agents, stats, allTasks })
    // 有项目时自动选第一个，并加载其任务和产出物
    if (projects.length > 0 && !get().currentProject) {
      const project = projects[0]
      set({ currentProject: project })
      const [tasks, outputs] = await Promise.all([
        api.getTasks(project.id),
        api.getOutputs(project.id)
      ])
      set({ tasks, outputs })
    }
  },

  // ====== Project ======
  setCurrentProject: async (project) => {
    set({ currentProject: project, tasks: [], outputs: [] })
    if (project) {
      const [tasks, outputs] = await Promise.all([
        api.getTasks(project.id),
        api.getOutputs(project.id)
      ])
      set({ tasks, outputs })
    }
  },
  
  createProject: async (data) => {
    const project = await api.createProject(data)
    const projects = await api.getProjects()
    set({ projects, currentProject: project, tasks: [], outputs: [] })
    return project
  },

  refreshProjects: async () => {
    const projects = await api.getProjects()
    set({ projects })
  },

  // ====== Tasks ======
  allTasks: [],

  loadAllTasks: async () => {
    const tasks = await api.getTasks() // no project_id = all tasks
    set({ allTasks: tasks })
  },

  addTask: async (data) => {
    const task = await api.createTask(data)
    if (data.project_id) {
      const tasks = await api.getTasks(data.project_id)
      set({ tasks })
    }
    const allTasks = await api.getTasks()
    set({ allTasks })
    const stats = await api.getStats()
    set({ stats })
    return task
  },

  updateTask: async (id, data) => {
    await api.updateTask(id, data)
    const project = get().currentProject
    if (project) {
      const tasks = await api.getTasks(project.id)
      set({ tasks })
    }
    const allTasks = await api.getTasks()
    set({ allTasks })
  },

  deleteTask: async (id) => {
    await api.deleteTask(id)
    const project = get().currentProject
    if (project) {
      const tasks = await api.getTasks(project.id)
      set({ tasks })
    }
    const allTasks = await api.getTasks()
    set({ allTasks })
    const stats = await api.getStats()
    set({ stats })
  },

  // ====== Outputs ======
  addOutput: async (data) => {
    const output = await api.createOutput(data)
    if (data.project_id) {
      const outputs = await api.getOutputs(data.project_id)
      set({ outputs })
    }
    const stats = await api.getStats()
    set({ stats })
    return output
  },

  deleteOutput: async (id) => {
    await api.deleteOutput(id)
    const project = get().currentProject
    if (project) {
      const outputs = await api.getOutputs(project.id)
      set({ outputs })
    }
    const stats = await api.getStats()
    set({ stats })
  },

  // ====== Stats ======
  refreshStats: async () => {
    const stats = await api.getStats()
    set({ stats })
  }
}))
