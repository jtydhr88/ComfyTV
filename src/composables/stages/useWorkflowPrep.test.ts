import { describe, it, expect, vi, beforeEach } from 'vitest'

interface MockState {
  fetchApi: any
  graphToPrompt: any
  graphCtor: any
}

async function loadModuleWith(state: MockState) {
  vi.resetModules()

  class FakeGraph {
    nodes: any[] = []
    configure(_json: any) { /* sync */ }
  }
  const ctor = state.graphCtor ?? FakeGraph

  vi.doMock('@/lib/comfyApp', () => ({
    app: {
      api: { fetchApi: state.fetchApi },
      graphToPrompt: state.graphToPrompt,
      graph: new ctor(),
    },
  }))
  return await import('./useWorkflowPrep')
}

const jsonResp = (data: any, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })

const textResp = (s: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(s, {
    status, headers: { 'content-type': 'application/json', ...headers },
  })


describe('prepareWorkflow', () => {
  beforeEach(() => vi.resetModules())

  it('short-circuits empty args', async () => {
    const fetchApi = vi.fn()
    const { prepareWorkflow } = await loadModuleWith({
      fetchApi, graphToPrompt: vi.fn(), graphCtor: undefined,
    })
    await prepareWorkflow('', 'X')
    await prepareWorkflow('image', '')
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('skips work when has_api=true', async () => {
    const fetchApi = vi.fn(async () => jsonResp({
      has_api: true, file_path: '/x', file_mtime: 1.0, file_exists: true,
    }))
    const { prepareWorkflow, getPrepState } = await loadModuleWith({
      fetchApi, graphToPrompt: vi.fn(), graphCtor: undefined,
    })
    await prepareWorkflow('image', 'X')
    expect(getPrepState('image', 'X').ready).toBe(true)
    expect(fetchApi).toHaveBeenCalledTimes(1)
  })

  it('throws when file missing on disk', async () => {
    const fetchApi = vi.fn(async () => jsonResp({
      has_api: false, file_path: '/missing.json', file_mtime: null, file_exists: false,
    }))
    const { prepareWorkflow, getPrepState } = await loadModuleWith({
      fetchApi, graphToPrompt: vi.fn(), graphCtor: undefined,
    })
    await expect(prepareWorkflow('image', 'X')).rejects.toThrow(/missing on disk/)
    expect(getPrepState('image', 'X').error).toMatch(/missing on disk/)
  })

  it('end-to-end happy path runs graphToPrompt and persists', async () => {
    const apiJson = { '3': { class_type: 'KSampler' } }
    const fetchApi = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.startsWith('/comfytv/workflows/state')) {
        return jsonResp({
          has_api: false, file_path: '/x.json', file_mtime: 1.0, file_exists: true,
        })
      }
      if (path.startsWith('/comfytv/workflows/file')) {
        return textResp(JSON.stringify({ nodes: [{ id: 1, type: 'X' }] }),
          200, { 'X-Workflow-Mtime': '1.0' })
      }
      if (path === '/comfytv/workflows/api_json') {
        const body = init?.body ? JSON.parse(String(init.body)) : null
        expect(body.kind).toBe('image')
        expect(body.label).toBe('X')
        expect(body.api_json).toEqual(apiJson)
        return jsonResp({ ok: true })
      }
      throw new Error(`unexpected path ${path}`)
    })
    const graphToPrompt = vi.fn(async () => ({ output: apiJson, workflow: {} }))

    const { prepareWorkflow, getPrepState } = await loadModuleWith({
      fetchApi, graphToPrompt, graphCtor: undefined,
    })
    await prepareWorkflow('image', 'X')
    expect(getPrepState('image', 'X').ready).toBe(true)
    expect(graphToPrompt).toHaveBeenCalledTimes(1)
  })

  it('rejects non-GUI-format file content', async () => {
    const fetchApi = vi.fn(async (path: string) => {
      if (path.startsWith('/comfytv/workflows/state')) {
        return jsonResp({
          has_api: false, file_path: '/x.json', file_mtime: 1.0, file_exists: true,
        })
      }
      if (path.startsWith('/comfytv/workflows/file')) {
        return textResp(JSON.stringify({ '3': { class_type: 'X' } }))
      }
      throw new Error('unexpected')
    })
    const { prepareWorkflow } = await loadModuleWith({
      fetchApi, graphToPrompt: vi.fn(), graphCtor: undefined,
    })
    await expect(prepareWorkflow('image', 'X')).rejects.toThrow(/not a GUI-format/)
  })

  it('throws on HTTP error', async () => {
    const fetchApi = vi.fn(async () => jsonResp({ error: 'boom' }, 500))
    const { prepareWorkflow, getPrepState } = await loadModuleWith({
      fetchApi, graphToPrompt: vi.fn(), graphCtor: undefined,
    })
    await expect(prepareWorkflow('image', 'X')).rejects.toThrow()
    expect(getPrepState('image', 'X').error).toBeTruthy()
  })

  it('de-dupes concurrent calls', async () => {
    let stateHits = 0
    const fetchApi = vi.fn(async (path: string) => {
      if (path.startsWith('/comfytv/workflows/state')) {
        stateHits++
        await new Promise(r => setTimeout(r, 5))
        return jsonResp({
          has_api: true, file_path: '/x', file_mtime: 1, file_exists: true,
        })
      }
      throw new Error('unexpected')
    })
    const { prepareWorkflow } = await loadModuleWith({
      fetchApi, graphToPrompt: vi.fn(), graphCtor: undefined,
    })
    await Promise.all([
      prepareWorkflow('image', 'X'),
      prepareWorkflow('image', 'X'),
      prepareWorkflow('image', 'X'),
    ])
    expect(stateHits).toBe(1)
  })
})


describe('subscribePrepState', () => {
  beforeEach(() => vi.resetModules())

  it('fires current state immediately', async () => {
    const { subscribePrepState } = await loadModuleWith({
      fetchApi: vi.fn(), graphToPrompt: vi.fn(), graphCtor: undefined,
    })
    const calls: any[] = []
    const unsub = subscribePrepState('image', 'X', s => calls.push(s))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ busy: false, ready: false, error: null })
    unsub()
  })

  it('fires updates while prep runs and finishes', async () => {
    const fetchApi = vi.fn(async () => jsonResp({
      has_api: true, file_path: '/x', file_mtime: 1, file_exists: true,
    }))
    const { prepareWorkflow, subscribePrepState } = await loadModuleWith({
      fetchApi, graphToPrompt: vi.fn(), graphCtor: undefined,
    })
    const calls: any[] = []
    subscribePrepState('image', 'X', s => calls.push({ ...s }))
    await prepareWorkflow('image', 'X')
    // initial + busy + ready
    expect(calls.length).toBeGreaterThanOrEqual(2)
    expect(calls[calls.length - 1]).toMatchObject({ ready: true, busy: false })
  })

  it('unsub stops further notifications', async () => {
    const { subscribePrepState } = await loadModuleWith({
      fetchApi: vi.fn(), graphToPrompt: vi.fn(), graphCtor: undefined,
    })
    const calls: any[] = []
    const unsub = subscribePrepState('image', 'X', s => calls.push(s))
    unsub()
    expect(calls).toHaveLength(1)
  })
})


describe('getPrepState', () => {
  beforeEach(() => vi.resetModules())

  it('returns default state for unknown key', async () => {
    const { getPrepState } = await loadModuleWith({
      fetchApi: vi.fn(), graphToPrompt: vi.fn(), graphCtor: undefined,
    })
    expect(getPrepState('image', 'Nope')).toEqual({
      busy: false, ready: false, error: null,
    })
  })
})
