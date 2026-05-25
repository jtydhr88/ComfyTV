import { app } from '@/lib/comfyApp'

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

async function _fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await (app as any).api.fetchApi(path, init)
  if (resp.status >= 400) {
    let detail = `${resp.status} ${resp.statusText}`
    try {
      const j = await resp.json()
      if (j?.error) detail += ` — ${j.error}`
    } catch { /* not json */ }
    throw new Error(detail)
  }
  return resp.json()
}

export function prepareWorkflow(kind: string, label: string): Promise<void> {
  if (!kind || !label) return Promise.resolve()
  const key = _key(kind, label)
  const existing = _inflight.get(key)
  if (existing) return existing

  const task = (async () => {
    _set(key, { busy: true, error: null })
    try {
      const state = await _fetchJson<{
        has_api: boolean
        file_path: string
        file_mtime: number | null
        file_exists: boolean
      }>(`/comfytv/workflows/state?kind=${encodeURIComponent(kind)}&label=${encodeURIComponent(label)}`)

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

      const apiJson = await _convertGuiToApi(guiJson)

      await _fetchJson('/comfytv/workflows/api_json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, label, api_json: apiJson, file_mtime: fileMtime }),
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

async function _convertGuiToApi(guiJson: any): Promise<any> {
  const a = app as any
  if (typeof a.graphToPrompt !== 'function') {
    throw new Error('app.graphToPrompt missing — ComfyUI frontend too old?')
  }

  const HostGraph = a.graph?.constructor
  if (!HostGraph) throw new Error('app.graph not initialised')

  const detached = new HostGraph()

  const stripLayoutFields = (json: any): any => {
    if (!json || typeof json !== 'object') return json
    const clone = Array.isArray(json) ? json.slice() : { ...json }
    if (Array.isArray(clone.nodes)) {
      clone.nodes = clone.nodes.map((n: any) => {
        if (!n || typeof n !== 'object') return n
        const { pos: _pos, size: _size, ...rest } = n
        return rest
      })
    }
    if (clone.definitions?.subgraphs) {
      clone.definitions = {
        ...clone.definitions,
        subgraphs: clone.definitions.subgraphs.map(stripLayoutFields),
      }
    }
    return clone
  }
  guiJson = stripLayoutFields(guiJson)

  const rootGraph = a.rootGraph ?? a.graph
  detached.events.addEventListener('subgraph-created', (e: any) => {
    try {
      rootGraph?.events?.dispatch('subgraph-created', e.detail)
    } catch (err) {
      console.warn('[ComfyTV/workflow-prep] subgraph forward failed:', err)
    }
  })

  const configured = detached.configure(guiJson)
  if (configured && typeof configured.then === 'function') {
    await configured
  }

  const result = await a.graphToPrompt(detached, { sortNodes: false })
  return result?.output ?? result
}
