import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

import { app } from '@/lib/comfyApp'
import { useEntryStore } from '@/stores/entryStore'

import { useEntryEditor } from './useEntryEditor'
import type { MetaField } from './entryCatalog'

const jsonResp = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  })

function entry(over: Partial<{ id: number; kind: string; label: string; content: string }> = {}) {
  return {
    id: 1, kind: 'fragment', label: 'foo', content: 'value',
    metadata: {}, updated_at: null,
    ...over,
  }
}

function seedEntries(store: any, projectId: string, rows: any[]) {
  store.byProject.set(projectId, rows)
  store.hydrated?.set?.(projectId, 'fetched')
}

describe('useEntryEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockImplementation(async () => jsonResp({ entries: [] }))
  })

  it('rowsByKind groups by kind; activeRows follows activeKind', async () => {
    const store = useEntryStore()
    seedEntries(store, 'p1', [
      entry({ id: 1, label: 'a', kind: 'fragment' }),
      entry({ id: 2, label: 'b', kind: 'fragment' }),
    ])

    const ed = useEntryEditor(ref('p1'), ref<'fragment'>('fragment'), computed<MetaField[]>(() => []))
    await nextTick()
    expect(ed.activeRows.value.map(e => e.label)).toEqual(['a', 'b'])
    expect(ed.rowsByKind.value.fragment.map(e => e.label)).toEqual(['a', 'b'])
  })

  it('drafts watch syncs new rows in and dropped rows out', async () => {
    const store = useEntryStore()
    seedEntries(store, 'p1', [entry({ id: 1, label: 'first', content: 'A' })])

    const ed = useEntryEditor(ref('p1'), ref('fragment'), computed(() => []))
    await nextTick()
    expect(ed.drafts[1]).toEqual({ label: 'first', content: 'A', metadata: {} })

    ;(store as any).byProject.set('p1', [])
    await nextTick()
    expect(ed.drafts[1]).toBeUndefined()
  })

  it('saveIfDirty skips when the draft matches the row', async () => {
    const store = useEntryStore()
    seedEntries(store, 'p1', [entry({ id: 1, label: 'unchanged', content: 'X' })])
    const ed = useEntryEditor(ref('p1'), ref('fragment'), computed(() => []))
    await nextTick()

    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockClear()
    await ed.saveIfDirty(store.list('p1')[0])
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('saveIfDirty bails on invalid labels', async () => {
    const store = useEntryStore()
    seedEntries(store, 'p1', [entry({ id: 1, label: 'good' })])
    const ed = useEntryEditor(ref('p1'), ref('fragment'), computed(() => []))
    await nextTick()

    ed.drafts[1].label = '!bad-label!'
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockClear()
    await ed.saveIfDirty(store.list('p1')[0])
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('saveIfDirty POSTs the upsert when content differs', async () => {
    const store = useEntryStore()
    seedEntries(store, 'p1', [entry({ id: 7, label: 'foo', content: 'old' })])
    const ed = useEntryEditor(ref('p1'), ref('fragment'), computed(() => []))
    await nextTick()

    ed.drafts[7].content = 'fresh'
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockClear()
    fetchApi.mockResolvedValueOnce(jsonResp({
      ok: true, entry: entry({ id: 7, label: 'foo', content: 'fresh' }),
    }))
    await ed.saveIfDirty(store.list('p1')[0])
    expect(fetchApi).toHaveBeenCalledTimes(1)
  })

  it('confirmDelete cancels when user declines', async () => {
    const store = useEntryStore()
    seedEntries(store, 'p1', [entry({ id: 1, label: 'dontkill' })])
    ;(globalThis as any).window = (globalThis as any).window ?? globalThis
    ;(globalThis as any).window.confirm = () => false

    const ed = useEntryEditor(ref('p1'), ref('fragment'), computed(() => []))
    await nextTick()
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockClear()
    await ed.confirmDelete(store.list('p1')[0])
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('newLabelError lit only after the user types an invalid label', () => {
    const ed = useEntryEditor(ref('p1'), ref('fragment'), computed(() => []))
    expect(ed.newLabelError.value).toBe('')
    ed.newDraft.label = '!bad'
    expect(ed.newLabelError.value.length).toBeGreaterThan(0)
    ed.newDraft.label = 'good_label'
    expect(ed.newLabelError.value).toBe('')
  })

  it('canSaveNew requires both a valid label and non-empty content', () => {
    const ed = useEntryEditor(ref('p1'), ref('fragment'), computed(() => []))
    expect(ed.canSaveNew.value).toBe(false)
    ed.newDraft.label = 'good'
    expect(ed.canSaveNew.value).toBe(false)
    ed.newDraft.content = 'something'
    expect(ed.canSaveNew.value).toBe(true)
    ed.newDraft.content = '   '
    expect(ed.canSaveNew.value).toBe(false)
  })

  it('startCreate pre-seeds metadata keys from the provided fields', () => {
    const metaFields = computed<MetaField[]>(() => [
      { name: 'note',  label: 'Note',  type: 'text' },
      { name: 'style', label: 'Style', type: 'textarea' },
    ])
    const ed = useEntryEditor(ref('p1'), ref('fragment'), metaFields)
    ed.startCreate()
    expect(ed.creating.value).toBe(true)
    expect(ed.newDraft.metadata).toEqual({ note: '', style: '' })
  })

  it('cancelCreate clears the new draft', () => {
    const ed = useEntryEditor(ref('p1'), ref('fragment'), computed(() => []))
    ed.startCreate()
    ed.newDraft.label = 'something'
    ed.newDraft.content = 'else'
    ed.cancelCreate()
    expect(ed.creating.value).toBe(false)
    expect(ed.newDraft.label).toBe('')
    expect(ed.newDraft.content).toBe('')
  })

  it('saveNew calls the upsert endpoint with the active kind', async () => {
    const store = useEntryStore()
    seedEntries(store, 'p1', [])
    const ed = useEntryEditor(ref('p1'), ref('fragment'), computed(() => []))
    await nextTick()

    ed.newDraft.label = 'fresh'
    ed.newDraft.content = 'hi'

    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockClear()
    fetchApi.mockResolvedValueOnce(jsonResp({
      ok: true, entry: entry({ id: 99, label: 'fresh', content: 'hi' }),
    }))
    await ed.saveNew()
    expect(fetchApi).toHaveBeenCalledTimes(1)
    expect(String(fetchApi.mock.calls[0][0])).toContain('/entries')
  })
})
