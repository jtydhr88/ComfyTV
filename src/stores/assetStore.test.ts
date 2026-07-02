import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'

import { useAssetStore } from './assetStore'

const jsonResp = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  })

function category(over: Partial<{ id: number; name: string }> = {}) {
  return { id: 1, name: 'refs', created_at: null, updated_at: null, ...over }
}

function asset(over: Partial<{
  id: number; category_ids: number[]; name: string; payload_url: string
}> = {}) {
  return {
    id: 1, category_ids: [], name: 'pic', media_type: 'image',
    payload_url: '/view?filename=pic.png&subfolder=comfytv%2Fassets&type=input',
    mime_type: 'image/png', width: 512, height: 512, size_bytes: 1000,
    source: 'upload', metadata: {}, created_at: null, updated_at: null,
    ...over,
  }
}

function mockHydrate(
  fetchApi: ReturnType<typeof vi.fn>,
  categories: any[],
  assets: any[],
) {
  fetchApi.mockImplementation((path: string) => {
    if (path.startsWith('/comfytv/asset_categories')) {
      return Promise.resolve(jsonResp({ categories }))
    }
    if (path.startsWith('/comfytv/assets')) {
      return Promise.resolve(jsonResp({ assets }))
    }
    return Promise.resolve(new Response('not found', { status: 404 }))
  })
}

describe('assetStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockReset()
  })

  it('ensureHydrated fetches categories and assets once', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [category()], [asset()])
    const s = useAssetStore()
    s.ensureHydrated()
    s.ensureHydrated()
    await vi.waitFor(() => {
      expect(s.assets).toHaveLength(1)
      expect(s.categories).toHaveLength(1)
    })
    expect(fetchApi).toHaveBeenCalledTimes(2)
  })

  it('hydrate failure allows a later retry', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValue(new Response('boom', { status: 500 }))
    const s = useAssetStore()
    s.ensureHydrated()
    await vi.waitFor(() => expect(fetchApi).toHaveBeenCalled())
    mockHydrate(fetchApi, [], [asset({ id: 5 })])
    await vi.waitFor(() => {
      s.ensureHydrated()
      expect(s.assets.map(a => a.id)).toEqual([5])
    })
  })

  it('listByCategory filters all / none / id', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [category({ id: 9 })], [
      asset({ id: 1, category_ids: [9] }),
      asset({ id: 2, category_ids: [] }),
      asset({ id: 3, category_ids: [9, 5] }),
    ])
    const s = useAssetStore()
    s.ensureHydrated()
    await vi.waitFor(() => expect(s.assets).toHaveLength(3))
    expect(s.listByCategory('all').map(a => a.id)).toEqual([1, 2, 3])
    expect(s.listByCategory('none').map(a => a.id)).toEqual([2])
    expect(s.listByCategory(9).map(a => a.id)).toEqual([1, 3])
    expect(s.countByCategory(9)).toBe(2)
  })

  it('createCategory inserts the new category sorted by name', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [category({ id: 1, name: 'people' })], [])
    const s = useAssetStore()
    s.ensureHydrated()
    await vi.waitFor(() => expect(s.categories).toHaveLength(1))
    fetchApi.mockResolvedValueOnce(jsonResp({
      ok: true, category: category({ id: 2, name: 'background' }),
    }))
    const cat = await s.createCategory('background')
    expect(cat?.id).toBe(2)
    expect(s.categories.map(c => c.name)).toEqual(['background', 'people'])
  })

  it('createCategory failure returns null without mutating state', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(new Response('dup', { status: 409 }))
    const s = useAssetStore()
    const cat = await s.createCategory('dup')
    expect(cat).toBeNull()
    expect(s.categories).toHaveLength(0)
  })

  it('removeCategory drops the tag from its assets locally', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [category({ id: 3 })], [asset({ id: 1, category_ids: [3, 7] })])
    const s = useAssetStore()
    s.ensureHydrated()
    await vi.waitFor(() => expect(s.assets).toHaveLength(1))
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true }))
    const ok = await s.removeCategory(3)
    expect(ok).toBe(true)
    expect(s.categories).toHaveLength(0)
    expect(s.assets[0].category_ids).toEqual([7])
  })

  it('create prepends the new asset', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [], [asset({ id: 1 })])
    const s = useAssetStore()
    s.ensureHydrated()
    await vi.waitFor(() => expect(s.assets).toHaveLength(1))
    fetchApi.mockResolvedValueOnce(jsonResp({
      ok: true, asset: asset({ id: 2, name: 'new' }),
    }))
    const row = await s.create({ name: 'new', payload_url: '/view?filename=n.png' })
    expect(row?.id).toBe(2)
    expect(s.assets.map(a => a.id)).toEqual([2, 1])
  })

  it('create failure returns null without mutating the cache', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(new Response('nope', { status: 400 }))
    const s = useAssetStore()
    const row = await s.create({ name: 'x', payload_url: '/view?filename=x.png' })
    expect(row).toBeNull()
    expect(s.assets).toHaveLength(0)
  })

  it('rename replaces the cached row', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [], [asset({ id: 7, name: 'old' })])
    const s = useAssetStore()
    s.ensureHydrated()
    await vi.waitFor(() => expect(s.assets).toHaveLength(1))
    fetchApi.mockResolvedValueOnce(jsonResp({
      ok: true, asset: asset({ id: 7, name: 'new' }),
    }))
    await s.rename(7, 'new')
    expect(s.assets[0].name).toBe('new')
  })

  it('addTag updates the cached category_ids', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [category({ id: 4 })], [asset({ id: 7, category_ids: [] })])
    const s = useAssetStore()
    s.ensureHydrated()
    await vi.waitFor(() => expect(s.assets).toHaveLength(1))
    fetchApi.mockResolvedValueOnce(jsonResp({
      ok: true, asset: asset({ id: 7, category_ids: [4] }),
    }))
    await s.addTag(7, 4)
    expect(s.assets[0].category_ids).toEqual([4])
    expect(fetchApi).toHaveBeenCalledWith(
      '/comfytv/assets/7/categories/4', expect.objectContaining({ method: 'POST' }),
    )
  })

  it('removeTag updates the cached category_ids', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [category({ id: 4 })], [asset({ id: 7, category_ids: [4, 9] })])
    const s = useAssetStore()
    s.ensureHydrated()
    await vi.waitFor(() => expect(s.assets).toHaveLength(1))
    fetchApi.mockResolvedValueOnce(jsonResp({
      ok: true, asset: asset({ id: 7, category_ids: [9] }),
    }))
    await s.removeTag(7, 4)
    expect(s.assets[0].category_ids).toEqual([9])
    expect(fetchApi).toHaveBeenCalledWith(
      '/comfytv/assets/7/categories/4', expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('remove deletes from cache immediately and then hits the API', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [], [asset({ id: 1 }), asset({ id: 2 })])
    const s = useAssetStore()
    s.ensureHydrated()
    await vi.waitFor(() => expect(s.assets).toHaveLength(2))
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true }))
    await s.remove(1)
    expect(s.assets.map(a => a.id)).toEqual([2])
    const deletePaths = fetchApi.mock.calls
      .map(c => c[0] as string)
      .filter(p => p.startsWith('/comfytv/assets/'))
    expect(deletePaths).toContain('/comfytv/assets/1')
  })

  it('installWebSocketSync registers exactly one listener', () => {
    const addEventListener = (app as any).api.addEventListener as ReturnType<typeof vi.fn>
    addEventListener.mockClear()
    const s = useAssetStore()
    s.installWebSocketSync()
    s.installWebSocketSync()
    expect(addEventListener).toHaveBeenCalledTimes(1)
    expect(addEventListener).toHaveBeenCalledWith('comfytv-assets', expect.any(Function))
  })

  it('installWebSocketSync is a no-op when the api lacks addEventListener', () => {
    const origApi = (app as any).api
    ;(app as any).api = {}
    const s = useAssetStore()
    expect(() => s.installWebSocketSync()).not.toThrow()
    ;(app as any).api = origApi
  })

  it('hydrate dedups concurrent calls and no-ops once fetched', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [category({ id: 2 })], [asset({ id: 3 })])
    const s = useAssetStore()
    const p1 = s.hydrate()
    const p2 = s.hydrate() // in-flight branch reuses the same fetch
    await Promise.all([p1, p2])
    expect(s.assets.map(a => a.id)).toEqual([3])
    expect(fetchApi).toHaveBeenCalledTimes(2)
    await s.hydrate() // fetched branch is a no-op
    expect(fetchApi).toHaveBeenCalledTimes(2)
  })

  it('refresh re-fetches even after a successful hydrate', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [], [asset({ id: 1 })])
    const s = useAssetStore()
    await s.hydrate()
    expect(fetchApi).toHaveBeenCalledTimes(2)
    mockHydrate(fetchApi, [], [asset({ id: 2 })])
    await s.refresh()
    expect(s.assets.map(a => a.id)).toEqual([2])
    expect(fetchApi).toHaveBeenCalledTimes(4)
  })

  it('byId and byPayloadUrl look up cached assets', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [], [asset({ id: 4, payload_url: '/view?filename=z.png' })])
    const s = useAssetStore()
    await s.hydrate()
    expect(s.byId(4)?.id).toBe(4)
    expect(s.byId(999)).toBeUndefined()
    expect(s.byPayloadUrl('/view?filename=z.png')?.id).toBe(4)
    expect(s.byPayloadUrl('/nope')).toBeUndefined()
  })

  it('createCategory returns null for a blank name without calling the API', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    const s = useAssetStore()
    expect(await s.createCategory('   ')).toBeNull()
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('renameCategory replaces the row and re-sorts by name', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [
      category({ id: 1, name: 'zeta' }), category({ id: 2, name: 'alpha' }),
    ], [])
    const s = useAssetStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(jsonResp({
      ok: true, category: category({ id: 1, name: 'beta' }),
    }))
    const cat = await s.renameCategory(1, 'beta')
    expect(cat?.name).toBe('beta')
    expect(s.categories.map(c => c.name)).toEqual(['alpha', 'beta'])
  })

  it('renameCategory returns null for a blank name', async () => {
    const s = useAssetStore()
    expect(await s.renameCategory(1, '  ')).toBeNull()
  })

  it('renameCategory failure returns null and keeps state', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [category({ id: 1, name: 'orig' })], [])
    const s = useAssetStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(new Response('boom', { status: 500 }))
    expect(await s.renameCategory(1, 'new')).toBeNull()
    expect(s.categories.map(c => c.name)).toEqual(['orig'])
  })

  it('removeCategory failure returns false and keeps the tag on assets', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [category({ id: 3 })], [asset({ id: 1, category_ids: [3] })])
    const s = useAssetStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(new Response('boom', { status: 500 }))
    expect(await s.removeCategory(3)).toBe(false)
    expect(s.categories).toHaveLength(1)
    expect(s.assets[0].category_ids).toEqual([3])
  })

  it('rename failure returns null and keeps the cached name', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [], [asset({ id: 7, name: 'old' })])
    const s = useAssetStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(new Response('x', { status: 500 }))
    expect(await s.rename(7, 'new')).toBeNull()
    expect(s.assets[0].name).toBe('old')
  })

  it('addTag failure returns null and leaves category_ids intact', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [], [asset({ id: 7, category_ids: [] })])
    const s = useAssetStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(new Response('x', { status: 500 }))
    expect(await s.addTag(7, 4)).toBeNull()
    expect(s.assets[0].category_ids).toEqual([])
  })

  it('removeTag failure returns null and leaves category_ids intact', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [], [asset({ id: 7, category_ids: [4] })])
    const s = useAssetStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(new Response('x', { status: 500 }))
    expect(await s.removeTag(7, 4)).toBeNull()
    expect(s.assets[0].category_ids).toEqual([4])
  })

  it('remove still drops the row from cache when the API call fails', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [], [asset({ id: 1 }), asset({ id: 2 })])
    const s = useAssetStore()
    await s.hydrate()
    fetchApi.mockResolvedValueOnce(new Response('x', { status: 500 }))
    await s.remove(1)
    expect(s.assets.map(a => a.id)).toEqual([2])
  })

  it('installWebSocketSync refreshes the cache when a comfytv-assets event fires', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    mockHydrate(fetchApi, [], [asset({ id: 1 })])
    const addEventListener = (app as any).api.addEventListener as ReturnType<typeof vi.fn>
    addEventListener.mockClear()
    const s = useAssetStore()
    await s.hydrate()
    s.installWebSocketSync()
    const handler = addEventListener.mock.calls
      .find(c => c[0] === 'comfytv-assets')?.[1] as (() => void) | undefined
    expect(handler).toBeTypeOf('function')
    mockHydrate(fetchApi, [], [asset({ id: 2 })])
    handler!()
    await vi.waitFor(() => expect(s.assets.map(a => a.id)).toEqual([2]))
  })
})
