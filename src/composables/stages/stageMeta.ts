import { apiFetch } from '@/api'
import { StageMetaResponseSchema, type StageMetaEntry } from '@/api/schemas'
import type { StageKind } from '@/stores/stageStore'

export type { StageMetaEntry } from '@/api/schemas'

let _stages: Map<string, StageMetaEntry> = new Map()
let _pending: Promise<Map<string, StageMetaEntry>> | null = null

async function fetchStageMeta(): Promise<Map<string, StageMetaEntry>> {
  const data = await apiFetch('/comfytv/stages', StageMetaResponseSchema)
  const m = new Map<string, StageMetaEntry>()
  for (const s of data.stages) {
    m.set(s.node_id, s)
  }
  _stages = m
  return m
}

export function loadStageMeta(): Promise<Map<string, StageMetaEntry>> {
  if (_pending) return _pending
  _pending = fetchStageMeta().catch((e) => {
    console.error('[ComfyTV/stageMeta] load failed', e)
    _pending = null
    return new Map()
  })
  return _pending
}

export function getStageMeta(nodeId: string): StageMetaEntry | undefined {
  return _stages.get(nodeId)
}

export function isStageKind(kind: string): kind is StageKind {
  return kind !== 'project'
}
