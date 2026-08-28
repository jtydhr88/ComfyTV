import { describe, it, expect, vi, beforeEach } from 'vitest'

async function loadModuleWith(fetchApi: any) {
  vi.resetModules()
  vi.doMock('@/lib/comfyApp', () => ({
    app: { api: { fetchApi } },
  }))
  return await import('./useWorkflowPrep')
}

const jsonResp = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })

describe('prepareWorkflow', () => {
  beforeEach(() => vi.resetModules())

  it('short-circuits empty args', async () => {
    const fetchApi = vi.fn()
    const { prepareWorkflow } = await loadModuleWith(fetchApi)
    await prepareWorkflow('', 'X')
    await prepareWorkflow('image', '')
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('skips work when has_api=true', async () => {
    const fetchApi = vi.fn(async () => jsonResp({
      has_api: true, file_path: '/x', file_mtime: 1.0, file_exists: true,
    }))
    const { prepareWorkflow, getPrepState } = await loadModuleWith(fetchApi)
    await prepareWorkflow('image', 'X')
    expect(getPrepState('image', 'X').ready).toBe(true)
    expect(fetchApi).toHaveBeenCalledTimes(1)
  })

  it('throws when file missing on disk', async () => {
    const fetchApi = vi.fn(async () => jsonResp({
      has_api: false, file_path: '/missing.json', file_mtime: null, file_exists: false,
    }))
    const { prepareWorkflow, getPrepState } = await loadModuleWith(fetchApi)
    await expect(prepareWorkflow('image', 'X')).rejects.toThrow(/missing on disk/)
    expect(getPrepState('image', 'X').error).toMatch(/missing on disk/)
  })

  it('converts server-side via /comfytv/workflows/convert', async () => {
    const fetchApi = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.startsWith('/comfytv/workflows/state')) {
        return jsonResp({
          has_api: false, file_path: '/x.json', file_mtime: 1.0, file_exists: true,
        })
      }
      if (path === '/comfytv/workflows/convert') {
        const body = init?.body ? JSON.parse(String(init.body)) : null
        expect(init?.method).toBe('POST')
        expect(body).toEqual({ kind: 'image', label: 'X' })
        return jsonResp({ ok: true, node_count: 4, file_mtime: 1.0 })
      }
      throw new Error(`unexpected path ${path}`)
    })

    const { prepareWorkflow, getPrepState } = await loadModuleWith(fetchApi)
    await prepareWorkflow('image', 'X')
    expect(getPrepState('image', 'X').ready).toBe(true)
  })

  it('surfaces a conversion failure from the server', async () => {
    const fetchApi = vi.fn(async (path: string) => {
      if (path.startsWith('/comfytv/workflows/state')) {
        return jsonResp({
          has_api: false, file_path: '/x.json', file_mtime: 1.0, file_exists: true,
        })
      }
      if (path === '/comfytv/workflows/convert') {
        return jsonResp({ error: 'conversion emitted an empty prompt (0 nodes)' }, 422)
      }
      throw new Error(`unexpected path ${path}`)
    })

    const { prepareWorkflow, getPrepState } = await loadModuleWith(fetchApi)
    await expect(prepareWorkflow('image', 'X')).rejects.toThrow(/0 nodes/)
    expect(getPrepState('image', 'X').ready).toBe(false)
    expect(getPrepState('image', 'X').error).toMatch(/0 nodes/)
  })

  it('throws on HTTP error', async () => {
    const fetchApi = vi.fn(async () => jsonResp({ error: 'boom' }, 500))
    const { prepareWorkflow, getPrepState } = await loadModuleWith(fetchApi)
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
    const { prepareWorkflow } = await loadModuleWith(fetchApi)
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
    const { subscribePrepState } = await loadModuleWith(vi.fn())
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
    const { prepareWorkflow, subscribePrepState } = await loadModuleWith(fetchApi)
    const calls: any[] = []
    subscribePrepState('image', 'X', s => calls.push({ ...s }))
    await prepareWorkflow('image', 'X')
    expect(calls.length).toBeGreaterThanOrEqual(2)
    expect(calls[calls.length - 1]).toMatchObject({ ready: true, busy: false })
  })

  it('unsub stops further notifications', async () => {
    const { subscribePrepState } = await loadModuleWith(vi.fn())
    const calls: any[] = []
    const unsub = subscribePrepState('image', 'X', s => calls.push(s))
    unsub()
    expect(calls).toHaveLength(1)
  })
})


describe('getPrepState', () => {
  beforeEach(() => vi.resetModules())

  it('returns default state for unknown key', async () => {
    const { getPrepState } = await loadModuleWith(vi.fn())
    expect(getPrepState('image', 'Nope')).toEqual({
      busy: false, ready: false, error: null,
    })
  })
})
