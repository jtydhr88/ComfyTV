import { beforeEach, describe, expect, it, vi } from 'vitest'

interface MockApi {
  getServerFeature: ReturnType<typeof vi.fn>
  apiURL: ReturnType<typeof vi.fn>
  fetchApi: ReturnType<typeof vi.fn>
}

let mockApi: MockApi

vi.mock('@/lib/comfyApp', () => ({
  app: {
    get api() {
      return mockApi
    },
  },
}))

function jsonResponse(ok: boolean, data: unknown = {}) {
  return { ok, json: async () => data }
}

function makeApi(over: Partial<MockApi> = {}): MockApi {
  return {
    getServerFeature: vi.fn(() => true),
    apiURL: vi.fn((p: string) => `/api${p}`),
    fetchApi: vi.fn(async () => jsonResponse(true, { assets: [] })),
    ...over,
  }
}

async function freshModule() {
  vi.resetModules()
  return import('./nativeAssets')
}

beforeEach(() => {
  mockApi = makeApi()
})

describe('modelLookupName', () => {
  it('extracts the filename param from /view? URLs', async () => {
    const m = await freshModule()
    expect(m.modelLookupName('/view?filename=robot.glb&subfolder=3d&type=input')).toBe('robot.glb')
  })

  it('strips folders from plain paths', async () => {
    const m = await freshModule()
    expect(m.modelLookupName('3d/sub/robot.glb')).toBe('robot.glb')
    expect(m.modelLookupName('a\\b\\c.fbx')).toBe('c.fbx')
  })

  it('passes through bare filenames and empties', async () => {
    const m = await freshModule()
    expect(m.modelLookupName('robot.glb')).toBe('robot.glb')
    expect(m.modelLookupName('')).toBe('')
  })
})

describe('nativeAssetsSupported', () => {
  it('trusts the server feature flag without probing', async () => {
    const m = await freshModule()
    mockApi.getServerFeature.mockReturnValue(true)
    await expect(m.nativeAssetsSupported()).resolves.toBe(true)
    expect(mockApi.fetchApi).not.toHaveBeenCalled()
  })

  it('returns false when the feature flag says so', async () => {
    const m = await freshModule()
    mockApi.getServerFeature.mockReturnValue(false)
    await expect(m.nativeAssetsSupported()).resolves.toBe(false)
  })

  it('falls back to probing /assets when no flag is available', async () => {
    const m = await freshModule()
    mockApi.getServerFeature.mockReturnValue(undefined)
    mockApi.fetchApi.mockResolvedValue(jsonResponse(true))
    await expect(m.nativeAssetsSupported()).resolves.toBe(true)
    expect(mockApi.fetchApi).toHaveBeenCalledWith('/assets?limit=1')
  })

  it('probe failure (503 / network) means unsupported', async () => {
    const m = await freshModule()
    mockApi.getServerFeature.mockReturnValue(undefined)
    mockApi.fetchApi.mockResolvedValue(jsonResponse(false))
    await expect(m.nativeAssetsSupported()).resolves.toBe(false)

    const m2 = await freshModule()
    mockApi = makeApi({
      getServerFeature: vi.fn(() => undefined),
      fetchApi: vi.fn(async () => {
        throw new Error('down')
      }),
    })
    await expect(m2.nativeAssetsSupported()).resolves.toBe(false)
  })

  it('caches the probe result', async () => {
    const m = await freshModule()
    mockApi.getServerFeature.mockReturnValue(undefined)
    mockApi.fetchApi.mockResolvedValue(jsonResponse(true))
    await m.nativeAssetsSupported()
    await m.nativeAssetsSupported()
    expect(mockApi.fetchApi).toHaveBeenCalledTimes(1)
  })
})

describe('findModelPreviewUrl', () => {
  it('resolves null for empty input without touching the API', async () => {
    const m = await freshModule()
    await expect(m.findModelPreviewUrl('')).resolves.toBeNull()
    expect(mockApi.fetchApi).not.toHaveBeenCalled()
  })

  it('resolves null when the assets API is unsupported', async () => {
    const m = await freshModule()
    mockApi.getServerFeature.mockReturnValue(false)
    await expect(m.findModelPreviewUrl('robot.glb')).resolves.toBeNull()
    expect(mockApi.fetchApi).not.toHaveBeenCalled()
  })

  it('resolves null when the asset has no preview_id', async () => {
    const m = await freshModule()
    mockApi.fetchApi.mockResolvedValue(
      jsonResponse(true, { assets: [{ id: 'a1', name: 'robot.glb', preview_id: null }] }),
    )
    await expect(m.findModelPreviewUrl('robot.glb')).resolves.toBeNull()
  })

  it('resolves null when no exact-name match exists', async () => {
    const m = await freshModule()
    mockApi.fetchApi.mockResolvedValue(
      jsonResponse(true, { assets: [{ id: 'a1', name: 'robot2.glb', preview_id: 'p1' }] }),
    )
    await expect(m.findModelPreviewUrl('robot.glb')).resolves.toBeNull()
  })

  it('builds the content URL from preview_id', async () => {
    const m = await freshModule()
    mockApi.fetchApi.mockResolvedValue(
      jsonResponse(true, { assets: [{ id: 'a1', name: 'robot.glb', preview_id: 'p1' }] }),
    )
    await expect(m.findModelPreviewUrl('/view?filename=robot.glb&subfolder=3d&type=input'))
      .resolves.toBe('/api/assets/p1/content')
  })

  it('prefers the server-provided preview_url', async () => {
    const m = await freshModule()
    mockApi.fetchApi.mockResolvedValue(
      jsonResponse(true, {
        assets: [{ id: 'a1', name: 'robot.glb', preview_id: 'p1', preview_url: '/view?filename=t.png' }],
      }),
    )
    await expect(m.findModelPreviewUrl('robot.glb')).resolves.toBe('/api/view?filename=t.png')
  })

  it('caches lookups per basename', async () => {
    const m = await freshModule()
    mockApi.fetchApi.mockResolvedValue(
      jsonResponse(true, { assets: [{ id: 'a1', name: 'robot.glb', preview_id: 'p1' }] }),
    )
    await m.findModelPreviewUrl('robot.glb')
    await m.findModelPreviewUrl('3d/robot.glb')
    expect(mockApi.fetchApi.mock.calls.filter(([p]) => String(p).startsWith('/assets?'))).toHaveLength(1)
  })

  it('swallows lookup errors as null', async () => {
    const m = await freshModule()
    mockApi.fetchApi.mockRejectedValue(new Error('boom'))
    await expect(m.findModelPreviewUrl('robot.glb')).resolves.toBeNull()
  })

  it('treats a malformed list response as no assets', async () => {
    const m = await freshModule()
    mockApi.fetchApi.mockResolvedValue(jsonResponse(true, { nope: 1 }))
    await expect(m.findModelPreviewUrl('robot.glb')).resolves.toBeNull()
  })
})

describe('persistModelThumbnail', () => {
  const blob = new Blob(['png'])

  function routeApi(routes: {
    list?: unknown
    post?: { ok: boolean; data?: unknown }
    put?: { ok: boolean }
  }) {
    mockApi.fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
      if (String(path).startsWith('/assets?')) return jsonResponse(true, routes.list ?? { assets: [] })
      if (path === '/assets' && init?.method === 'POST') {
        return jsonResponse(routes.post?.ok ?? true, routes.post?.data ?? {})
      }
      if (init?.method === 'PUT') return jsonResponse(routes.put?.ok ?? true)
      return jsonResponse(true, {})
    })
  }

  it('no-ops for empty names and unsupported servers', async () => {
    const m = await freshModule()
    await m.persistModelThumbnail('', blob)
    expect(mockApi.fetchApi).not.toHaveBeenCalled()

    const m2 = await freshModule()
    mockApi = makeApi({ getServerFeature: vi.fn(() => false) })
    await m2.persistModelThumbnail('robot.glb', blob)
    expect(mockApi.fetchApi).not.toHaveBeenCalled()
  })

  it('skips when the model has no asset record', async () => {
    const m = await freshModule()
    routeApi({ list: { assets: [] } })
    await m.persistModelThumbnail('robot.glb', blob)
    const posts = mockApi.fetchApi.mock.calls.filter(([, i]) => i?.method === 'POST')
    expect(posts).toHaveLength(0)
  })

  it('skips when a thumbnail already exists', async () => {
    const m = await freshModule()
    routeApi({ list: { assets: [{ id: 'a1', name: 'robot.glb', preview_id: 'p0' }] } })
    await m.persistModelThumbnail('robot.glb', blob)
    const posts = mockApi.fetchApi.mock.calls.filter(([, i]) => i?.method === 'POST')
    expect(posts).toHaveLength(0)
  })

  it('uploads the preview, links it, updates cache and notifies listeners', async () => {
    const m = await freshModule()
    routeApi({
      list: { assets: [{ id: 'a1', name: 'robot.glb', preview_id: null }] },
      post: { ok: true, data: { id: 'p9' } },
      put: { ok: true },
    })
    const seen: Array<[string, string]> = []
    const stop = m.onModelPreviewChanged((name, url) => seen.push([name, url]))

    await m.persistModelThumbnail('/view?filename=robot.glb&type=input', blob)

    const post = mockApi.fetchApi.mock.calls.find(([, i]) => i?.method === 'POST')
    expect(post?.[0]).toBe('/assets')
    expect(post?.[1].body).toBeInstanceOf(FormData)
    const put = mockApi.fetchApi.mock.calls.find(([, i]) => i?.method === 'PUT')
    expect(put?.[0]).toBe('/assets/a1')
    expect(JSON.parse(put?.[1].body)).toEqual({ preview_id: 'p9' })
    expect(seen).toEqual([['robot.glb', '/api/assets/p9/content']])

    mockApi.fetchApi.mockClear()
    await expect(m.findModelPreviewUrl('robot.glb')).resolves.toBe('/api/assets/p9/content')
    expect(mockApi.fetchApi).not.toHaveBeenCalled()

    stop()
    await m.persistModelThumbnail('other.glb', blob)
    expect(seen).toHaveLength(1)
  })

  it('stops after a failed upload (no PUT, no notification)', async () => {
    const m = await freshModule()
    routeApi({
      list: { assets: [{ id: 'a1', name: 'robot.glb', preview_id: null }] },
      post: { ok: false },
    })
    const seen: string[] = []
    m.onModelPreviewChanged((name) => seen.push(name))
    await m.persistModelThumbnail('robot.glb', blob)
    expect(mockApi.fetchApi.mock.calls.filter(([, i]) => i?.method === 'PUT')).toHaveLength(0)
    expect(seen).toHaveLength(0)
  })

  it('stops when the upload response has no id', async () => {
    const m = await freshModule()
    routeApi({
      list: { assets: [{ id: 'a1', name: 'robot.glb', preview_id: null }] },
      post: { ok: true, data: {} },
    })
    await m.persistModelThumbnail('robot.glb', blob)
    expect(mockApi.fetchApi.mock.calls.filter(([, i]) => i?.method === 'PUT')).toHaveLength(0)
  })

  it('does not cache or notify when the PUT link fails', async () => {
    const m = await freshModule()
    routeApi({
      list: { assets: [{ id: 'a1', name: 'robot.glb', preview_id: null }] },
      post: { ok: true, data: { id: 'p9' } },
      put: { ok: false },
    })
    const seen: string[] = []
    m.onModelPreviewChanged((name) => seen.push(name))
    await m.persistModelThumbnail('robot.glb', blob)
    expect(seen).toHaveLength(0)
  })

  it('swallows unexpected errors', async () => {
    const m = await freshModule()
    mockApi.fetchApi.mockRejectedValue(new Error('boom'))
    await expect(m.persistModelThumbnail('robot.glb', blob)).resolves.toBeUndefined()
  })
})
