import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'

import { useEntryStore } from './entryStore'

const jsonResp = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  })

function entry(over: Partial<{ id: number; kind: string; label: string; content: string }> = {}) {
  return {
    id: 1, kind: 'fragment', label: 'foo', content: 'value', metadata: {},
    updated_at: null, ...over,
  }
}

describe('entryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('list() with no project returns []', () => {
    const s = useEntryStore()
    expect(s.list('')).toEqual([])
  })

  it('list() triggers hydrate on first access', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({
      entries: [entry({ id: 1, label: 'a' }), entry({ id: 2, label: 'b' })],
    }))
    const s = useEntryStore()
    s.list('p1')
    await vi.waitFor(() => {
      expect(s.list('p1')).toHaveLength(2)
    })
    expect(fetchApi).toHaveBeenCalledWith('/comfytv/projects/p1/entries', undefined)
  })

  it('list() can filter by kind', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({
      entries: [
        entry({ id: 1, label: 'a', kind: 'fragment' }),
        entry({ id: 2, label: 'b', kind: 'other' as any }),
      ],
    }))
    const s = useEntryStore()
    await s._hydrate('p1')
    expect(s.list('p1', 'fragment')).toHaveLength(1)
    expect(s.list('p1', 'fragment')[0].label).toBe('a')
  })

  it('_hydrate dedupes concurrent calls via the in-flight marker', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({ entries: [] }))
    const s = useEntryStore()
    await Promise.all([s._hydrate('px'), s._hydrate('px')])
    expect(fetchApi).toHaveBeenCalledTimes(1)
  })

  it('_hydrate failure clears the in-flight marker so a retry can fetch', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(new Response('boom', { status: 500 }))
    fetchApi.mockResolvedValueOnce(jsonResp({ entries: [entry({ id: 5, label: 'x' })] }))
    const s = useEntryStore()
    await s._hydrate('p1')
    await s._hydrate('p1')
    expect(s.list('p1')).toHaveLength(1)
  })

  it('findByLabel returns every entry with a matching label', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({
      entries: [
        entry({ id: 1, label: 'dup', content: 'v1' }),
        entry({ id: 2, label: 'dup', content: 'v2' }),
        entry({ id: 3, label: 'other', content: 'v3' }),
      ],
    }))
    const s = useEntryStore()
    await s._hydrate('p1')
    const hits = s.findByLabel('p1', 'dup')
    expect(hits.map(e => e.id).sort()).toEqual([1, 2])
  })

  it('upsert with an invalid label returns null without calling the API', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    const s = useEntryStore()
    const r = await s.upsert('p1', { kind: 'fragment', label: '!bad-label', content: 'x' })
    expect(r).toBeNull()
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('upsert success path inserts new entries into the cache', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    const newRow = entry({ id: 42, label: 'fresh', content: 'hi' })
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true, entry: newRow }))
    const s = useEntryStore()
    const r = await s.upsert('p1', { kind: 'fragment', label: 'fresh', content: 'hi' })
    expect(r?.id).toBe(42)
    expect(s.list('p1').map(e => e.id)).toContain(42)
  })

  it('upsert with an existing id replaces the cached row', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({
      entries: [entry({ id: 7, label: 'name', content: 'old' })],
    }))
    const s = useEntryStore()
    await s._hydrate('p1')
    fetchApi.mockResolvedValueOnce(jsonResp({
      ok: true, entry: entry({ id: 7, label: 'name', content: 'new' }),
    }))
    await s.upsert('p1', { id: 7, kind: 'fragment', label: 'name', content: 'new' })
    const row = s.list('p1').find(e => e.id === 7)
    expect(row?.content).toBe('new')
    expect(s.list('p1')).toHaveLength(1)
  })

  it('upsert API failure returns null without mutating the cache', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({
      entries: [entry({ id: 1, label: 'keep', content: 'v' })],
    }))
    const s = useEntryStore()
    await s._hydrate('p1')
    fetchApi.mockResolvedValueOnce(new Response('nope', { status: 500 }))
    const r = await s.upsert('p1', { kind: 'fragment', label: 'fail', content: 'x' })
    expect(r).toBeNull()
    expect(s.list('p1')).toHaveLength(1)
    expect(s.list('p1')[0].label).toBe('keep')
  })

  it('remove deletes from cache immediately and then hits the API', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({
      entries: [entry({ id: 1, label: 'a' }), entry({ id: 2, label: 'b' })],
    }))
    const s = useEntryStore()
    await s._hydrate('p1')
    fetchApi.mockResolvedValueOnce(jsonResp({ ok: true }))
    await s.remove('p1', 1)
    expect(s.list('p1').map(e => e.id)).toEqual([2])
    const deletePaths = fetchApi.mock.calls
      .map(c => c[0] as string)
      .filter(p => p.includes('/entries/'))
    expect(deletePaths).toContain('/comfytv/projects/p1/entries/1')
  })

  it('remove is a no-op when no project id is given', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockClear()
    const s = useEntryStore()
    await s.remove('', 1)
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('expand replaces @tokens with the lowest-id matching content', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({
      entries: [
        entry({ id: 9, label: 'who', content: 'late' }),
        entry({ id: 3, label: 'who', content: 'early' }),
        entry({ id: 1, label: 'where', content: 'the lab' }),
      ],
    }))
    const s = useEntryStore()
    await s._hydrate('p1')
    expect(s.expand('p1', 'meet @who at @where')).toBe('meet early at the lab')
  })

  it('expand leaves unknown @tokens as-is', async () => {
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({
      entries: [entry({ id: 1, label: 'known', content: 'X' })],
    }))
    const s = useEntryStore()
    await s._hydrate('p1')
    expect(s.expand('p1', '@known and @missing')).toBe('X and @missing')
  })

  it('expand returns the input unchanged when no @ is present', () => {
    const s = useEntryStore()
    expect(s.expand('p1', 'no tokens here')).toBe('no tokens here')
  })

  it('expand returns the input unchanged when nothing is hydrated', () => {
    const s = useEntryStore()
    expect(s.expand('cold', '@missing')).toBe('@missing')
  })

  it('installWebSocketSync registers a listener that re-hydrates on push', () => {
    const addEventListener = (app as any).api.addEventListener as ReturnType<typeof vi.fn>
    addEventListener.mockClear()
    const s = useEntryStore()
    s.installWebSocketSync()
    expect(addEventListener).toHaveBeenCalledWith('comfytv-entries', expect.any(Function))
  })

  it('installWebSocketSync is a no-op when the api does not expose addEventListener', () => {
    const origApi = (app as any).api
    ;(app as any).api = {}
    const s = useEntryStore()
    expect(() => s.installWebSocketSync()).not.toThrow()
    ;(app as any).api = origApi
  })
})
