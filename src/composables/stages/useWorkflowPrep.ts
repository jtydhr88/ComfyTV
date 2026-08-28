import { apiFetch, apiSend, ConvertWorkflowResultSchema, WorkflowStateSchema } from '@/api'
import { emitWorkflowApiGenerated } from '@/utils/workflowEvents'

interface PrepState {
  busy: boolean
  ready: boolean
  error: string | null
}

const _state = new Map<string, PrepState>()
const _inflight = new Map<string, Promise<void>>()
const _listeners = new Map<string, Set<(s: PrepState) => void>>()

function _key(kind: string, label: string) { return `${kind}::${label}` }

function _set(key: string, partial: Partial<PrepState>) {
  const cur = _state.get(key) ?? { busy: false, ready: false, error: null }
  const next = { ...cur, ...partial }
  _state.set(key, next)
  _listeners.get(key)?.forEach(fn => fn(next))
}

export function getPrepState(kind: string, label: string): PrepState {
  return _state.get(_key(kind, label)) ?? { busy: false, ready: false, error: null }
}

export function subscribePrepState(
  kind: string, label: string, fn: (s: PrepState) => void,
): () => void {
  const key = _key(kind, label)
  let set = _listeners.get(key)
  if (!set) { set = new Set(); _listeners.set(key, set) }
  set.add(fn)
  fn(getPrepState(kind, label))
  return () => { set?.delete(fn) }
}

export function prepareWorkflow(kind: string, label: string): Promise<void> {
  if (!kind || !label) return Promise.resolve()
  const key = _key(kind, label)
  const existing = _inflight.get(key)
  if (existing) return existing

  const task = (async () => {
    _set(key, { busy: true, error: null })
    try {
      const state = await apiFetch(
        `/comfytv/workflows/state?kind=${encodeURIComponent(kind)}&label=${encodeURIComponent(label)}`,
        WorkflowStateSchema,
      )

      if (state.has_api) {
        _set(key, { busy: false, ready: true })
        emitWorkflowApiGenerated(kind, label)
        return
      }
      if (!state.file_exists) {
        throw new Error(`workflow file missing on disk: ${state.file_path}`)
      }

      const result = await apiSend(
        '/comfytv/workflows/convert', 'POST', ConvertWorkflowResultSchema,
        { kind, label },
      )
      console.info(
        `[ComfyTV/workflow-prep] ${kind}/${label}: converted server-side (${result.node_count} nodes)`,
      )

      _set(key, { busy: false, ready: true })
      emitWorkflowApiGenerated(kind, label)
    } catch (e: any) {
      const msg = String(e?.message || e || 'prepare failed')
      console.error(`[ComfyTV/workflow-prep] ${kind}/${label}:`, e)
      _set(key, { busy: false, ready: false, error: msg })
      throw e
    } finally {
      _inflight.delete(key)
    }
  })()

  _inflight.set(key, task)
  return task
}
