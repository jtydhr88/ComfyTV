import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const entryStore = {
  upsert: vi.fn(async (_pid: string, row: any) => ({ id: 1, ...row })),
}
vi.mock('@/stores/entryStore', () => ({
  ENTRY_KINDS: ['fragment', 'character'] as const,
  useEntryStore: () => entryStore,
}))

const downloadBlob = vi.fn()
vi.mock('@/utils/download', () => ({
  downloadBlob: (...a: any[]) => downloadBlob(...a),
}))

vi.mock('@/i18n', () => ({
  t: (key: string, args?: Record<string, unknown>) =>
    args ? `${key}:${JSON.stringify(args)}` : key,
}))

import type { Entry } from '@/api/schemas'
import { useEntryTransfer } from './useEntryTransfer'

function entry(over: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    kind: 'fragment',
    label: 'hero',
    content: 'the hero',
    metadata: {},
    ...over,
  } as Entry
}

function jsonFile(data: unknown): File {
  return new File([typeof data === 'string' ? data : JSON.stringify(data)], 'entries.json', {
    type: 'application/json',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('exportEntries', () => {
  it('reports an empty status instead of downloading nothing', () => {
    const { ioStatus, exportEntries } = useEntryTransfer(ref('proj'), ref<Entry[]>([]))
    exportEntries()
    expect(downloadBlob).not.toHaveBeenCalled()
    expect(ioStatus.value).toBe('entries.exportEmpty')
  })

  it('downloads a versioned payload named after the project and date', async () => {
    const rows = [entry(), entry({ id: 2, label: 'villain', content: 'the villain' })]
    const { ioStatus, exportEntries } = useEntryTransfer(ref('proj'), ref(rows))
    exportEntries()
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    const [filename, blob] = downloadBlob.mock.calls[0]
    const stamp = new Date().toISOString().slice(0, 10)
    expect(filename).toBe(`comfytv-entries-proj-${stamp}.json`)
    const payload = JSON.parse(await (blob as Blob).text())
    expect(payload.comfytv_entries).toBe(1)
    expect(payload.project_id).toBe('proj')
    expect(payload.entries).toEqual([
      { kind: 'fragment', label: 'hero', content: 'the hero', metadata: {} },
      { kind: 'fragment', label: 'villain', content: 'the villain', metadata: {} },
    ])
    expect(ioStatus.value).toBe('')
  })
})

describe('importFromFile', () => {
  it('rejects files that are not JSON arrays or export payloads', async () => {
    const { ioStatus, importFromFile } = useEntryTransfer(ref('proj'), ref<Entry[]>([]))
    await importFromFile(jsonFile('not json at all'))
    expect(ioStatus.value).toBe('entries.importError')
    await importFromFile(jsonFile({ nope: true }))
    expect(ioStatus.value).toBe('entries.importError')
    expect(entryStore.upsert).not.toHaveBeenCalled()
  })

  it('accepts both a bare array and an export payload', async () => {
    const { importFromFile } = useEntryTransfer(ref('proj'), ref<Entry[]>([]))
    await importFromFile(jsonFile([{ kind: 'fragment', label: 'a_1', content: 'x' }]))
    await importFromFile(jsonFile({ entries: [{ kind: 'fragment', label: 'b_2', content: 'y' }] }))
    expect(entryStore.upsert).toHaveBeenCalledTimes(2)
  })

  it('counts added, duplicate and invalid rows', async () => {
    const existing = [entry({ label: 'dup', content: 'same' })]
    const { ioStatus, importFromFile } = useEntryTransfer(ref('proj'), ref(existing))
    await importFromFile(jsonFile([
      { kind: 'fragment', label: 'fresh', content: 'new one' },
      { kind: 'fragment', label: 'dup', content: 'same' },
      { kind: 'fragment', label: '!bad!', content: 'x' },
      { kind: 'fragment', label: 'blank', content: '   ' },
    ]))
    expect(ioStatus.value).toBe('entries.importResult:{"added":1,"dup":1,"invalid":2}')
    expect(entryStore.upsert).toHaveBeenCalledTimes(1)
    expect(entryStore.upsert).toHaveBeenCalledWith('proj', {
      kind: 'fragment', label: 'fresh', content: 'new one', metadata: {},
    })
  })

  it('coerces unknown kinds and non-object metadata', async () => {
    const { importFromFile } = useEntryTransfer(ref('proj'), ref<Entry[]>([]))
    await importFromFile(jsonFile([
      { kind: 'mystery', label: 'a_1', content: 'x', metadata: [1, 2] },
    ]))
    expect(entryStore.upsert).toHaveBeenCalledWith('proj', {
      kind: 'fragment', label: 'a_1', content: 'x', metadata: {},
    })
  })

  it('counts rows the store refuses as invalid', async () => {
    entryStore.upsert.mockResolvedValueOnce(null as any)
    const { ioStatus, importFromFile } = useEntryTransfer(ref('proj'), ref<Entry[]>([]))
    await importFromFile(jsonFile([{ kind: 'fragment', label: 'a_1', content: 'x' }]))
    expect(ioStatus.value).toBe('entries.importResult:{"added":0,"dup":0,"invalid":1}')
  })
})
