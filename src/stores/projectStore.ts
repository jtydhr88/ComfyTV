import { useTimeoutFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ApiError, apiFetch, apiSend, fetchLatestOutputsBatch } from '@/api'
import {
  DeleteProjectSchema,
  LatestOutputSchema,
  type Output,
  ListProjectsSchema,
  MutateProjectSchema,
  type Project,
} from '@/api/schemas'

export type { Project } from '@/api/schemas'

const DEFAULT_PROJECT_ID = 'default'
const LATEST_BATCH_MS = 20
const LATEST_BATCH_MAX = 200
const LATEST_APPLY_SLICE = 8

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

  type LatestReq = {
    stage_uid: string
    output_type: string | null
    resolve: (o: Output | null) => void
  }
  const latestQueues = new Map<string, LatestReq[]>()
  const flushLatest = async () => {
    const queues = [...latestQueues.entries()]
    latestQueues.clear()
    for (const [projectId, reqs] of queues) {
      for (let i = 0; i < reqs.length; i += LATEST_BATCH_MAX) {
        const chunk = reqs.slice(i, i + LATEST_BATCH_MAX)
        try {
          const rows = await fetchLatestOutputsBatch(
            projectId,
            chunk.map(r => ({ stage_uid: r.stage_uid, output_type: r.output_type })),
          )
          for (let k = 0; k < chunk.length; k += LATEST_APPLY_SLICE) {
            if (k > 0) await new Promise<void>(r => setTimeout(r, 0))
            chunk.slice(k, k + LATEST_APPLY_SLICE).forEach((r, j) => r.resolve(rows[k + j] ?? null))
          }
        } catch (e) {
          if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
            await Promise.all(chunk.map(async r => r.resolve(await fetchLatestOutputLegacy(projectId, r))))
            continue
          }
          console.warn('[ComfyTV/project] fetchLatestOutput batch failed', e)
          chunk.forEach(r => r.resolve(null))
        }
      }
    }
  }
  async function fetchLatestOutputLegacy(projectId: string, r: LatestReq): Promise<Output | null> {
    try {
      let url = `/comfytv/projects/${encodeURIComponent(projectId)}/outputs/latest`
        + `?stage_uid=${encodeURIComponent(r.stage_uid)}`
      if (r.output_type) url += `&output_type=${encodeURIComponent(r.output_type)}`
      return (await apiFetch(url, LatestOutputSchema)).output
    } catch (e) {
      console.warn('[ComfyTV/project] fetchLatestOutput failed', e)
      return null
    }
  }
  const latestTimer = useTimeoutFn(() => { void flushLatest() }, LATEST_BATCH_MS, { immediate: false })

  function fetchLatestOutput(
    projectId: string,
    stageUid: string,
    outputType?: string,
  ): Promise<Output | null> {
    if (!projectId || !stageUid) return Promise.resolve(null)
    return new Promise((resolve) => {
      const q = latestQueues.get(projectId) ?? []
      q.push({ stage_uid: stageUid, output_type: outputType ?? null, resolve })
      latestQueues.set(projectId, q)
      if (!latestTimer.isPending.value) latestTimer.start()
    })
  }

  async function adoptOutputs(
    projectId: string,
    stageNodeId: string,
    stageClass: string,
    stageUid: string,
    outputType?: string,
  ) {
    if (!projectId || !stageNodeId || !stageClass || !stageUid) return null
    try {
      const data = await apiSend(
        `/comfytv/projects/${encodeURIComponent(projectId)}/outputs/adopt`,
        'POST',
        LatestOutputSchema,
        { stage_node_id: stageNodeId, stage_class: stageClass, stage_uid: stageUid, output_type: outputType },
      )
      return data.output
    } catch (e) {
      console.warn('[ComfyTV/project] adoptOutputs failed', e)
      return null
    }
  }

  async function tagOutputStageUid(outputId: number, stageUid: string) {
    if (!outputId || outputId < 0 || !stageUid) return
    try {
      await apiSend(
        `/comfytv/outputs/${encodeURIComponent(String(outputId))}/stage_uid`,
        'POST',
        LatestOutputSchema,
        { stage_uid: stageUid },
      )
    } catch (e) {
      console.warn('[ComfyTV/project] tagOutputStageUid failed', e)
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
    adoptOutputs,
    tagOutputStageUid,
  }
})

export const PROJECT_DEFAULT_ID = DEFAULT_PROJECT_ID
