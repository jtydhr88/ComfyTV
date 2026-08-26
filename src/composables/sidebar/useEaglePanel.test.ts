import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const fetchEagleStatus = vi.fn()
const fetchEagleItems = vi.fn()
const fetchEagleFolders = vi.fn()
const fetchEagleSimilar = vi.fn()
const importEagleItem = vi.fn()
const flushEagle = vi.fn()

vi.mock('@/api/eagle', () => ({
  fetchEagleStatus: (...a: unknown[]) => fetchEagleStatus(...a),
  fetchEagleItems: (...a: unknown[]) => fetchEagleItems(...a),
  fetchEagleFolders: (...a: unknown[]) => fetchEagleFolders(...a),
  fetchEagleSimilar: (...a: unknown[]) => fetchEagleSimilar(...a),
  importEagleItem: (...a: unknown[]) => importEagleItem(...a),
  flushEagle: (...a: unknown[]) => flushEagle(...a),
  eagleFileUrl: (id: string) => `/comfytv/eagle/file?id=${id}`,
  eagleThumbUrl: (id: string) => `/comfytv/eagle/thumb?id=${id}`,
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

const toastAdd = vi.fn()
vi.mock('@/lib/comfyApp', () => ({
  app: { extensionManager: { toast: { add: (...a: unknown[]) => toastAdd(...a) } } },
}))

import { useEaglePanel } from './useEaglePanel'

const STATUS_API = {
  enabled: true, mode: 'api', online: true, version: '4.0.0',
  current_library: 'Y:/lib', pinned_library: 'Y:/lib', library_match: true,
  pending: 0,
}

function item(id: string, name = id) {
  return {
    id, name, ext: 'png', width: 1, height: 1, size: 1,
    tags: [], folders: [], annotation: '', star: 0, mtime: 1,
  }
}

async function flushAll() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchEagleStatus.mockResolvedValue({ ...STATUS_API })
  fetchEagleItems.mockResolvedValue({ items: [item('A')], mode: 'api' })
  fetchEagleFolders.mockResolvedValue({ folders: [], mode: 'api' })
  fetchEagleSimilar.mockResolvedValue({ items: [item('S')], mode: 'api', total: 1 })
  importEagleItem.mockResolvedValue({ ok: true })
  flushEagle.mockResolvedValue({ ok: true, sent: 1, failed: 0, remaining: 0 })
})

describe('useEaglePanel', () => {
  it('does nothing while inactive', async () => {
    useEaglePanel(() => false)
    await flushAll()
    expect(fetchEagleStatus).not.toHaveBeenCalled()
  })

  it('loads status, folders and items on activation', async () => {
    const active = ref(false)
    const p = useEaglePanel(() => active.value)
    active.value = true
    await flushAll()
    expect(fetchEagleStatus).toHaveBeenCalled()
    expect(fetchEagleItems).toHaveBeenCalled()
    expect(p.items.value.map((i) => i.id)).toEqual(['A'])
    expect(p.mode.value).toBe('api')
  })

  it('skips item loading when integration is disabled', async () => {
    fetchEagleStatus.mockResolvedValue({ enabled: false, mode: 'disabled', pending: 0 })
    const p = useEaglePanel(() => true)
    await flushAll()
    expect(p.enabled.value).toBe(false)
    expect(fetchEagleItems).not.toHaveBeenCalled()
  })

  it('loadMore appends and dedupes, tracking exhaustion', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => item(`I${i}`))
    fetchEagleItems.mockResolvedValueOnce({ items: firstPage, mode: 'api' })
    const p = useEaglePanel(() => true)
    await flushAll()
    expect(p.exhausted.value).toBe(false)

    fetchEagleItems.mockResolvedValue({ items: [item('I0'), item('B')], mode: 'api' })
    await p.loadMore()
    expect(p.items.value).toHaveLength(101)
    expect(p.items.value.at(-1)?.id).toBe('B')
    expect(p.exhausted.value).toBe(true)

    const calls = fetchEagleItems.mock.calls.length
    await p.loadMore()
    expect(fetchEagleItems.mock.calls.length).toBe(calls)
  })

  it('importItem toasts success and clears busy state', async () => {
    const p = useEaglePanel(() => true)
    await flushAll()
    await p.importItem(item('A'))
    expect(importEagleItem).toHaveBeenCalledWith('A')
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
    expect(p.importingIds.value.size).toBe(0)
  })

  it('importItem failure toasts an error', async () => {
    importEagleItem.mockRejectedValue(new Error('boom'))
    const p = useEaglePanel(() => true)
    await flushAll()
    await p.importItem(item('A'))
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
  })

  it('flush reports and refreshes status', async () => {
    const p = useEaglePanel(() => true)
    await flushAll()
    await p.flush()
    expect(flushEagle).toHaveBeenCalled()
    expect(fetchEagleStatus).toHaveBeenCalledWith(true)
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }))
  })

  it('uses the reported total for exhaustion', async () => {
    fetchEagleItems.mockResolvedValue({ items: [item('A')], mode: 'api', total: 1 })
    const p = useEaglePanel(() => true)
    await flushAll()
    expect(p.total.value).toBe(1)
    expect(p.exhausted.value).toBe(true)
  })

  it('ai mode reloads with search=ai when ready and keyword set', async () => {
    fetchEagleStatus.mockResolvedValue({ ...STATUS_API, ai_ready: true })
    const p = useEaglePanel(() => true)
    await flushAll()
    p.keyword.value = 'a cat by the sea'
    p.aiMode.value = true
    await flushAll()
    const last = fetchEagleItems.mock.calls.at(-1)![0]
    expect(last.search).toBe('ai')
    expect(p.aiActive.value).toBe(true)
  })

  it('ai mode without ai_ready stays a plain search', async () => {
    const p = useEaglePanel(() => true)
    await flushAll()
    p.keyword.value = 'cat'
    p.aiMode.value = true
    await flushAll()
    const last = fetchEagleItems.mock.calls.at(-1)![0]
    expect(last.search).toBeUndefined()
  })

  it('findSimilar swaps the list and clearSimilar restores it', async () => {
    fetchEagleStatus.mockResolvedValue({ ...STATUS_API, ai_ready: true })
    const p = useEaglePanel(() => true)
    await flushAll()
    await p.findSimilar(item('A'))
    expect(fetchEagleSimilar).toHaveBeenCalledWith('A')
    expect(p.items.value.map((i) => i.id)).toEqual(['S'])
    expect(p.similarTo.value?.id).toBe('A')
    expect(p.exhausted.value).toBe(true)
    await p.clearSimilar()
    expect(p.similarTo.value).toBeNull()
    expect(p.items.value.map((i) => i.id)).toEqual(['A'])
  })

  it('findSimilar failure toasts and resets', async () => {
    fetchEagleStatus.mockResolvedValue({ ...STATUS_API, ai_ready: true })
    fetchEagleSimilar.mockRejectedValue(new Error('no ai'))
    const p = useEaglePanel(() => true)
    await flushAll()
    await p.findSimilar(item('A'))
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    expect(p.similarTo.value).toBeNull()
  })

  it('surfaces list errors', async () => {
    fetchEagleItems.mockRejectedValue(new Error('nope'))
    const p = useEaglePanel(() => true)
    await flushAll()
    expect(p.error.value).toContain('nope')
    expect(p.items.value).toEqual([])
  })
})
