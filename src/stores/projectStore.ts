import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { apiFetch, apiSend } from '@/api'
import {
  DeleteProjectSchema,
  LatestOutputSchema,
  ListProjectsSchema,
  MutateProjectSchema,
  type Project,
} from '@/api/schemas'

export type { Project } from '@/api/schemas'

const DEFAULT_PROJECT_ID = 'default'

export const useProjectStore = defineStore('comfytv-project', () => {
  const projects = ref<Project[]>([])
  const currentProjectId = ref<string>(DEFAULT_PROJECT_ID)
  const loaded = ref(false)

  const current = computed<Project | null>(() => {
    return projects.value.find(p => p.id === currentProjectId.value) ?? null
  })

  async function refresh() {
    const data = await apiFetch('/comfytv/projects', ListProjectsSchema)
    projects.value = data.projects
    if (!projects.value.some(p => p.id === currentProjectId.value)) {
      currentProjectId.value = DEFAULT_PROJECT_ID
    }
    loaded.value = true
  }

  async function createProject(name: string): Promise<Project | null> {
    const data = await apiSend('/comfytv/projects', 'POST', MutateProjectSchema, { name })
    const proj = data.project
    if (!proj) return null
    projects.value = [proj, ...projects.value]
    currentProjectId.value = proj.id
    return proj
  }

  async function rename(projectId: string, name: string) {
    const data = await apiSend(
      `/comfytv/projects/${encodeURIComponent(projectId)}`,
      'PATCH',
      MutateProjectSchema,
      { name },
    )
    const proj = data.project
    if (!proj) return null
    const idx = projects.value.findIndex(p => p.id === projectId)
    if (idx >= 0) projects.value[idx] = proj
    return proj
  }

  async function remove(projectId: string) {
    await apiSend(
      `/comfytv/projects/${encodeURIComponent(projectId)}`,
      'DELETE',
      DeleteProjectSchema,
    )
    projects.value = projects.value.filter(p => p.id !== projectId)
    if (currentProjectId.value === projectId) {
      currentProjectId.value = DEFAULT_PROJECT_ID
    }
  }

  function setCurrent(projectId: string) {
    currentProjectId.value = projectId || DEFAULT_PROJECT_ID
  }

  async function fetchLatestOutput(
    projectId: string,
    stageNodeId: string,
  ) {
    if (!projectId || !stageNodeId) return null
    try {
      const data = await apiFetch(
        `/comfytv/projects/${encodeURIComponent(projectId)}/outputs/latest`
        + `?stage_node_id=${encodeURIComponent(stageNodeId)}`,
        LatestOutputSchema,
      )
      return data.output
    } catch (e) {
      console.warn('[ComfyTV/project] fetchLatestOutput failed', e)
      return null
    }
  }

  return {
    projects,
    currentProjectId,
    current,
    loaded,
    refresh,
    createProject,
    rename,
    remove,
    setCurrent,
    fetchLatestOutput,
  }
})

export const PROJECT_DEFAULT_ID = DEFAULT_PROJECT_ID
