import { defineStore } from 'pinia'
import { reactive } from 'vue'

import { batchImageUrls, toImagePoolJson, useStageStore } from '@/stores/stageStore'

export interface PinnedBatch {
  id: string
  label: string
  source_uid: string | null
  urls: string[]
  pinned_at: number
}

const LS_KEY = 'comfytv:pinned-batches:'

function genId(): string {
  const c: any = (globalThis as any).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return Math.random().toString(36).slice(2, 12)
}

function loadFromStorage(projectId: string): PinnedBatch[] {
  try {
    const raw = localStorage.getItem(LS_KEY + projectId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(b =>
      b && typeof b.id === 'string' && Array.isArray(b.urls))
  } catch {
    return []
  }
}

function saveToStorage(projectId: string, batches: PinnedBatch[]): void {
  try {
    if (batches.length === 0) localStorage.removeItem(LS_KEY + projectId)
    else localStorage.setItem(LS_KEY + projectId, JSON.stringify(batches))
  } catch {}
}

function nodeByStageUid(app: any, uid: string): any {
  for (const n of app?.graph?._nodes ?? []) {
    if (n?.properties?.comfytv_stage_uid === uid) return n
  }
  return null
}

export const usePinnedBatchStore = defineStore('pinnedBatches', () => {
  const byProject = reactive<Map<string, PinnedBatch[]>>(new Map())

  function list(projectId: string): PinnedBatch[] {
    if (!byProject.has(projectId)) {
      byProject.set(projectId, loadFromStorage(projectId))
    }
    return byProject.get(projectId)!
  }

  function byId(projectId: string, id: string): PinnedBatch | undefined {
    return list(projectId).find(b => b.id === id)
  }

  function pin(projectId: string, opts: {
    label: string
    sourceUid: string | null
    batchJson: string | null | undefined
  }): PinnedBatch | null {
    const urls = batchImageUrls(opts.batchJson)
    if (urls.length === 0) return null
    const batches = list(projectId)
    const entry: PinnedBatch = {
      id: genId(),
      label: opts.label,
      source_uid: opts.sourceUid,
      urls,
      pinned_at: Date.now(),
    }
    byProject.set(projectId, [...batches, entry])
    saveToStorage(projectId, byProject.get(projectId)!)
    return entry
  }

  function unpin(projectId: string, id: string): void {
    const next = list(projectId).filter(b => b.id !== id)
    byProject.set(projectId, next)
    saveToStorage(projectId, next)
  }

  function refresh(projectId: string, id: string, app: any): boolean {
    const batches = list(projectId)
    const entry = batches.find(b => b.id === id)
    if (!entry) return false
    if (!entry.source_uid) {
      console.warn('[ComfyTV/pinned-batch] refresh: batch has no source uid', entry.label)
      return false
    }
    const node = nodeByStageUid(app, entry.source_uid)
    if (!node) {
      console.warn('[ComfyTV/pinned-batch] refresh: source stage not found on this canvas', entry.label, entry.source_uid)
      return false
    }
    const state = useStageStore().getStage(node)
    const raw = state?.pool ?? state?.outputs?.[0] ?? state?.output ?? null
    const urls = batchImageUrls(toImagePoolJson(raw))
    if (urls.length === 0) {
      console.warn('[ComfyTV/pinned-batch] refresh: source stage has no batch content', entry.label, raw)
      return false
    }
    const next = batches.map(b =>
      b.id === id ? { ...b, urls, pinned_at: Date.now() } : b)
    byProject.set(projectId, next)
    saveToStorage(projectId, next)
    return true
  }

  return { byProject, list, byId, pin, unpin, refresh }
})
