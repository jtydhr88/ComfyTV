import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'

import { useStageParamStore } from './stageParamStore'

vi.mock('@/composables/sidebar/workflowConfigCatalog', () => ({
  reloadCaps: vi.fn(() => Promise.resolve()),
}))

const jsonResp = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  })

function param(over: Partial<any> = {}) {
  return {
    id: 1, kind: 'audio', key: 'guidance', label: 'Guidance', type: 'float',
    default: 5.0, config: {}, origin: 1, order: 10, ...over,
  }
}

describe('stageParamStore', () => {
  let fetchApi: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockReset()
  })

  it('hydrates the param list', async () => {
    fetchApi.mockResolvedValue(jsonResp({ params: [param()] }))
    const s = useStageParamStore()
    await s.hydrate()
    expect(s.params).toHaveLength(1)
  })

  it('forKind filters by kind and sorts by order then id', async () => {
    fetchApi.mockResolvedValue(jsonResp({ params: [
      param({ id: 3, kind: 'audio', key: 'b', order: 20 }),
      param({ id: 1, kind: 'audio', key: 'a', order: 10 }),
      param({ id: 2, kind: 'image', key: 'c', order: 5 }),
    ] }))
    const s = useStageParamStore()
    await s.hydrate()
    expect(s.forKind('audio').map(p => p.key)).toEqual(['a', 'b'])
    expect(s.forKind('image').map(p => p.key)).toEqual(['c'])
  })

  it('create appends the returned param', async () => {
    fetchApi.mockResolvedValueOnce(jsonResp({ params: [] }))
    const s = useStageParamStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true, param: param({ id: 9, key: 'bpm', label: 'BPM' }) }))
    const created = await s.create({ kind: 'audio', label: 'BPM', type: 'int' })
    expect(created?.key).toBe('bpm')
    expect(s.params.map(p => p.id)).toEqual([9])
  })

  it('remove drops it optimistically', async () => {
    fetchApi.mockResolvedValueOnce(jsonResp({ params: [param({ id: 7 })] }))
    const s = useStageParamStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true }))
    await s.remove(7)
    expect(s.params).toHaveLength(0)
  })

  it('hydrate is a one-shot: a second call does not re-fetch', async () => {
    fetchApi.mockResolvedValue(jsonResp({ params: [param()] }))
    const s = useStageParamStore()
    await s.hydrate()
    await s.hydrate()
    expect(fetchApi).toHaveBeenCalledTimes(1)
  })

  it('ensureHydrated triggers a hydrate only once', async () => {
    fetchApi.mockResolvedValue(jsonResp({ params: [param()] }))
    const s = useStageParamStore()
    s.ensureHydrated()
    s.ensureHydrated()
    await s.hydrate()
    expect(fetchApi).toHaveBeenCalledTimes(1)
  })

  it('refresh forces a fresh fetch', async () => {
    fetchApi.mockResolvedValueOnce(jsonResp({ params: [param({ id: 1 })] }))
    const s = useStageParamStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(jsonResp({ params: [param({ id: 2, key: 'k2' })] }))
    await s.refresh()
    expect(s.params.map(p => p.id)).toEqual([2])
    expect(fetchApi).toHaveBeenCalledTimes(2)
  })

  it('_hydrate swallows fetch errors and stays un-hydrated', async () => {
    fetchApi.mockRejectedValueOnce(new Error('boom'))
    const s = useStageParamStore()
    await s.hydrate()
    expect(s.params).toEqual([])
    // hydrating reset to null on failure, so a retry re-fetches
    fetchApi.mockResolvedValueOnce(jsonResp({ params: [param()] }))
    await s.hydrate()
    expect(s.params).toHaveLength(1)
  })

  it('byKey finds a param by kind+key and returns undefined when absent', async () => {
    fetchApi.mockResolvedValue(jsonResp({ params: [
      param({ id: 1, kind: 'audio', key: 'guidance' }),
      param({ id: 2, kind: 'image', key: 'seed' }),
    ] }))
    const s = useStageParamStore()
    await s.hydrate()
    expect(s.byKey('audio', 'guidance')?.id).toBe(1)
    expect(s.byKey('image', 'seed')?.id).toBe(2)
    expect(s.byKey('audio', 'seed')).toBeUndefined()
    expect(s.byKey('video', 'guidance')).toBeUndefined()
  })

  it('create returns null when the request fails', async () => {
    fetchApi.mockResolvedValueOnce(jsonResp({ params: [] }))
    const s = useStageParamStore()
    await s.hydrate()
    fetchApi.mockRejectedValueOnce(new Error('server down'))
    const created = await s.create({ kind: 'audio', label: 'BPM', type: 'int' })
    expect(created).toBeNull()
    expect(s.params).toHaveLength(0)
  })

  it('update replaces the matching param on success', async () => {
    fetchApi.mockResolvedValueOnce(jsonResp({ params: [param({ id: 5, label: 'Old' })] }))
    const s = useStageParamStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true, param: param({ id: 5, label: 'New' }) }))
    const updated = await s.update(5, { label: 'New' })
    expect(updated?.label).toBe('New')
    expect(s.byKey('audio', 'guidance')?.label).toBe('New')
  })

  it('update returns null and leaves state untouched on failure', async () => {
    fetchApi.mockResolvedValueOnce(jsonResp({ params: [param({ id: 5, label: 'Old' })] }))
    const s = useStageParamStore()
    await s.hydrate()
    fetchApi.mockRejectedValueOnce(new Error('nope'))
    const updated = await s.update(5, { label: 'New' })
    expect(updated).toBeNull()
    expect(s.params[0].label).toBe('Old')
  })

  it('remove stays optimistic even when the delete request fails', async () => {
    fetchApi.mockResolvedValueOnce(jsonResp({ params: [param({ id: 7 })] }))
    const s = useStageParamStore()
    await s.hydrate()
    fetchApi.mockRejectedValueOnce(new Error('delete failed'))
    await s.remove(7)
    expect(s.params).toHaveLength(0)
  })

  it('installWebSocketSync registers the listener once and the handler refreshes', async () => {
    const api = (app as any).api
    api.addEventListener.mockClear()
    const s = useStageParamStore()
    s.installWebSocketSync()
    s.installWebSocketSync()
    expect(api.addEventListener).toHaveBeenCalledTimes(1)
    const [evt, cb] = api.addEventListener.mock.calls[0]
    expect(evt).toBe('comfytv-stage-params')
    fetchApi.mockResolvedValue(jsonResp({ params: [param()] }))
    await cb()
  })

  it('installWebSocketSync is inert when the api has no addEventListener', () => {
    const api = (app as any).api
    const saved = api.addEventListener
    api.addEventListener = undefined
    try {
      const s = useStageParamStore()
      expect(() => s.installWebSocketSync()).not.toThrow()
    } finally {
      api.addEventListener = saved
    }
  })
})
