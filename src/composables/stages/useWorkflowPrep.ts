import { apiFetch, apiSend, OkSchema, WorkflowStateSchema } from '@/api'
import { app } from '@/lib/comfyApp'
import { convertGuiToApiHeadless } from '@/composables/stages/headlessConvert'

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
        return
      }
      if (!state.file_exists) {
        throw new Error(`workflow file missing on disk: ${state.file_path}`)
      }

      const fileResp = await (app as any).api.fetchApi(
        `/comfytv/workflows/file?kind=${encodeURIComponent(kind)}&label=${encodeURIComponent(label)}`
      )
      if (fileResp.status >= 400) {
        throw new Error(`fetch file: ${fileResp.status} ${fileResp.statusText}`)
      }
      const mtimeHeader = fileResp.headers.get('X-Workflow-Mtime')
      const fileMtime = mtimeHeader ? Number(mtimeHeader) : (state.file_mtime ?? 0)
      const guiJsonText = await fileResp.text()
      const guiJson = JSON.parse(guiJsonText)
      if (!guiJson || typeof guiJson !== 'object' || !Array.isArray(guiJson.nodes)) {
        throw new Error(
          `workflow file is not a GUI-format export (no top-level "nodes" array). ` +
          `Open it in ComfyUI and save normally — not "Save (API Format)" — to convert.`,
        )
      }

      const apiJson = await convertGuiToApiHeadless(guiJson)
      console.info(`[ComfyTV/workflow-prep] ${kind}/${label}: converted via headless iframe`)

      await apiSend('/comfytv/workflows/api_json', 'POST', OkSchema, {
        kind, label, api_json: apiJson, file_mtime: fileMtime,
      })

      _set(key, { busy: false, ready: true })
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

