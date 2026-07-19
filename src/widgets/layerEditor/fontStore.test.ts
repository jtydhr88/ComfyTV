import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TyprFont } from '@/vendor/typr'

import type { FontRef } from './types'

const { parseMock } = vi.hoisted(() => ({ parseMock: vi.fn() }))

vi.mock('@/vendor/typr', () => ({
  default: { parse: parseMock },
}))

const MANIFEST_URL = '/comfytv/fonts/manifest.json'

const fetchMock = vi.fn<typeof fetch>()

/** The singleton lives at module scope, so re-import for an isolated store. */
async function freshStore() {
  vi.resetModules()
  const mod = await import('./fontStore')
  return mod.getFontStore()
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response
}

function fontResponse(ok = true): Response {
  return { ok, status: ok ? 200 : 404, arrayBuffer: async () => new ArrayBuffer(8) } as Response
}

function typrFont(subfamily?: string, key: 'fontSubfamily' | 'typoSubfamilyName' = 'fontSubfamily'): TyprFont {
  return (subfamily === undefined ? {} : { name: { [key]: subfamily } }) as unknown as TyprFont
}

const MANIFEST = [
  { id: 'inter', name: 'Inter', url: '/comfytv/fonts/inter.ttf' },
  { id: 'roboto', name: 'Roboto', url: '/comfytv/fonts/roboto.ttf' },
]

function builtinRef(id: string): FontRef {
  return { kind: 'builtin', id }
}

beforeEach(() => {
  fetchMock.mockReset()
  parseMock.mockReset()
  parseMock.mockReturnValue([typrFont('Regular')])
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getFontStore', () => {
  it('returns the same singleton across calls within one module instance', async () => {
    vi.resetModules()
    const mod = await import('./fontStore')
    expect(mod.getFontStore()).toBe(mod.getFontStore())
  })
})

describe('ensureBuiltins', () => {
  it('fetches the manifest once and filters out malformed rows', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([...MANIFEST, null, 'junk', { id: 42, url: '/x' }, { id: 'no-url' }]),
    )
    const store = await freshStore()

    const rows = await store.ensureBuiltins()
    expect(rows).toEqual(MANIFEST)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(MANIFEST_URL)

    // cached: no second fetch
    expect(await store.ensureBuiltins()).toEqual(MANIFEST)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('shares a single in-flight fetch between concurrent callers', async () => {
    fetchMock.mockResolvedValue(jsonResponse(MANIFEST))
    const store = await freshStore()
    const [a, b] = await Promise.all([store.ensureBuiltins(), store.ensureBuiltins()])
    expect(a).toEqual(MANIFEST)
    expect(b).toEqual(MANIFEST)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('resolves to an empty list on a non-ok response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, false))
    const store = await freshStore()
    expect(await store.ensureBuiltins()).toEqual([])
  })

  it('resolves to an empty list when the manifest is not an array', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ nope: true }))
    const store = await freshStore()
    expect(await store.ensureBuiltins()).toEqual([])
  })

  it('resolves to an empty list when the fetch rejects', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const store = await freshStore()
    expect(await store.ensureBuiltins()).toEqual([])
  })

  it('notifies ready listeners when the manifest arrives', async () => {
    fetchMock.mockResolvedValue(jsonResponse(MANIFEST))
    const store = await freshStore()
    const listener = vi.fn()
    store.onFontReady(listener)
    await store.ensureBuiltins()
    expect(listener).toHaveBeenCalledOnce()
  })
})

describe('builtins', () => {
  it('returns [] before the manifest loads and the rows afterwards', async () => {
    fetchMock.mockResolvedValue(jsonResponse(MANIFEST))
    const store = await freshStore()
    expect(store.builtins()).toEqual([])
    await store.ensureBuiltins()
    expect(store.builtins()).toEqual(MANIFEST)
  })
})

describe('loadFont', () => {
  it('loads a builtin font by id and caches it', async () => {
    const regular = typrFont('Regular')
    parseMock.mockReturnValue([typrFont('Bold'), regular])
    fetchMock.mockImplementation(async (url) =>
      url === MANIFEST_URL ? jsonResponse(MANIFEST) : fontResponse(),
    )
    const store = await freshStore()

    const font = await store.loadFont(builtinRef('roboto'))
    expect(font).toBe(regular)
    expect(fetchMock).toHaveBeenCalledWith('/comfytv/fonts/roboto.ttf')

    const again = await store.loadFont(builtinRef('roboto'))
    expect(again).toBe(font)
    expect(fetchMock).toHaveBeenCalledTimes(2) // manifest + font, no refetch
  })

  it('falls back to the first builtin when the id is unknown', async () => {
    fetchMock.mockImplementation(async (url) =>
      url === MANIFEST_URL ? jsonResponse(MANIFEST) : fontResponse(),
    )
    const store = await freshStore()
    await store.loadFont(builtinRef('does-not-exist'))
    expect(fetchMock).toHaveBeenCalledWith('/comfytv/fonts/inter.ttf')
  })

  it('rejects when no builtin fonts are available', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    const store = await freshStore()
    await expect(store.loadFont(builtinRef('inter'))).rejects.toThrow(
      'no builtin fonts available (wanted "inter")',
    )
    await Promise.resolve()
    expect(store.hasFailed(builtinRef('inter'))).toBe(true)
  })

  it('loads a url font directly without touching the manifest', async () => {
    fetchMock.mockResolvedValue(fontResponse())
    const store = await freshStore()
    const ref: FontRef = { kind: 'url', url: 'http://fonts/x.ttf' }
    await store.loadFont(ref)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('http://fonts/x.ttf')
  })

  it('rejects on a non-ok font response and marks the ref failed', async () => {
    fetchMock.mockResolvedValue(fontResponse(false))
    const store = await freshStore()
    const ref: FontRef = { kind: 'url', url: 'http://fonts/missing.ttf' }
    await expect(store.loadFont(ref)).rejects.toThrow('font fetch 404 for http://fonts/missing.ttf')
    await Promise.resolve()
    expect(store.hasFailed(ref)).toBe(true)
  })

  it('rejects when Typr cannot parse the font', async () => {
    parseMock.mockReturnValue([])
    fetchMock.mockResolvedValue(fontResponse())
    const store = await freshStore()
    await expect(store.loadFont({ kind: 'url', url: 'http://fonts/bad.ttf' })).rejects.toThrow(
      'Typr could not parse font at http://fonts/bad.ttf',
    )
  })

  it('deduplicates concurrent loads of the same ref', async () => {
    let release!: (r: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (release = resolve)))
    const store = await freshStore()
    const ref: FontRef = { kind: 'url', url: 'http://fonts/slow.ttf' }

    const p1 = store.loadFont(ref)
    const p2 = store.loadFont(ref)
    expect(fetchMock).toHaveBeenCalledOnce()

    release(fontResponse())
    expect(await p1).toBe(await p2)
  })

  it('prefers the Regular instance via typoSubfamilyName and falls back to the first font', async () => {
    const store = await freshStore()

    const typoRegular = typrFont('Regular', 'typoSubfamilyName')
    parseMock.mockReturnValue([typrFont('Italic'), typoRegular])
    fetchMock.mockResolvedValue(fontResponse())
    expect(await store.loadFont({ kind: 'url', url: 'http://fonts/a.ttf' })).toBe(typoRegular)

    const first = typrFont() // no name table at all
    parseMock.mockReturnValue([first, typrFont('Bold')])
    expect(await store.loadFont({ kind: 'url', url: 'http://fonts/b.ttf' })).toBe(first)
  })

  it('notifies ready listeners once per successful load, and unsubscribe works', async () => {
    fetchMock.mockResolvedValue(fontResponse())
    const store = await freshStore()
    const listener = vi.fn()
    const off = store.onFontReady(listener)

    await store.loadFont({ kind: 'url', url: 'http://fonts/a.ttf' })
    expect(listener).toHaveBeenCalledOnce()

    off()
    await store.loadFont({ kind: 'url', url: 'http://fonts/b.ttf' })
    expect(listener).toHaveBeenCalledOnce()
  })
})

describe('getFontSync', () => {
  it('returns null initially, kicks off a background load, then returns the font', async () => {
    const font = typrFont('Regular')
    parseMock.mockReturnValue([font])
    fetchMock.mockResolvedValue(fontResponse())
    const store = await freshStore()
    const ref: FontRef = { kind: 'url', url: 'http://fonts/x.ttf' }

    expect(store.getFontSync(ref)).toBeNull()
    await store.loadFont(ref) // same pending promise; wait for it
    expect(store.getFontSync(ref)).toBe(font)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('swallows background failures and does not retry refs that already failed', async () => {
    fetchMock.mockResolvedValue(fontResponse(false))
    const store = await freshStore()
    const ref: FontRef = { kind: 'url', url: 'http://fonts/broken.ttf' }

    // background load kicked off by getFontSync fails silently
    expect(store.getFontSync(ref)).toBeNull()
    await vi.waitFor(() => expect(store.hasFailed(ref)).toBe(true))

    const callsBefore = fetchMock.mock.calls.length
    expect(store.getFontSync(ref)).toBeNull()
    expect(fetchMock.mock.calls.length).toBe(callsBefore)
  })

  it('reports hasFailed=false for refs never attempted', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    const store = await freshStore()
    expect(store.hasFailed({ kind: 'url', url: 'http://never.ttf' })).toBe(false)
  })
})

describe('getFontSyncWithFallback', () => {
  it('falls back to the default builtin when a url font failed to load', async () => {
    const font = typrFont('Regular')
    parseMock.mockReturnValue([font])
    fetchMock.mockImplementation(async (url) => {
      if (url === MANIFEST_URL) return jsonResponse(MANIFEST)
      if (url === 'http://fonts/missing.ttf') return fontResponse(false)
      return fontResponse()
    })
    const store = await freshStore()
    const ref: FontRef = { kind: 'url', url: 'http://fonts/missing.ttf' }

    await expect(store.loadFont(ref)).rejects.toThrow()
    await vi.waitFor(() => expect(store.hasFailed(ref)).toBe(true))

    expect(store.getFontSyncWithFallback(ref)).toBeNull()
    await store.loadFont({ kind: 'builtin', id: 'inter' })
    expect(store.getFontSyncWithFallback(ref)).toBe(font)
  })

  it('returns the font itself when the ref loads fine', async () => {
    const font = typrFont('Regular')
    parseMock.mockReturnValue([font])
    fetchMock.mockResolvedValue(fontResponse())
    const store = await freshStore()
    const ref: FontRef = { kind: 'url', url: 'http://fonts/x.ttf' }
    await store.loadFont(ref)
    expect(store.getFontSyncWithFallback(ref)).toBe(font)
  })

  it('does not fall back for pending or failed builtin refs', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    const store = await freshStore()
    await expect(store.loadFont(builtinRef('inter'))).rejects.toThrow()
    await vi.waitFor(() => expect(store.hasFailed(builtinRef('inter'))).toBe(true))
    expect(store.getFontSyncWithFallback(builtinRef('inter'))).toBeNull()
    expect(store.getFontSyncWithFallback({ kind: 'url', url: 'http://pending.ttf' })).toBeNull()
  })
})
