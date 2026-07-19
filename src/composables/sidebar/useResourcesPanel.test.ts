import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const listResources = vi.fn()
const uploadResource = vi.fn()
const renameResource = vi.fn()
const deleteResource = vi.fn()
vi.mock('@/api', () => ({
  RESOURCE_KINDS: ['lut', 'font'] as const,
  listResources: (...a: any[]) => listResources(...a),
  uploadResource: (...a: any[]) => uploadResource(...a),
  renameResource: (...a: any[]) => renameResource(...a),
  deleteResource: (...a: any[]) => deleteResource(...a),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, args?: Record<string, unknown>) =>
      args ? `${key}:${JSON.stringify(args)}` : key,
  }),
}))

const askText = vi.fn()
vi.mock('@/composables/dialog/useTextInputDialog', () => ({
  askText: (...a: any[]) => askText(...a),
}))

const askConfirm = vi.fn()
vi.mock('@/composables/dialog/useConfirmDialog', () => ({
  askConfirm: (...a: any[]) => askConfirm(...a),
}))

import { formatResourceSize, useResourcesPanel } from './useResourcesPanel'

function resource(id: number, kind: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    kind,
    name,
    filename: `${name}.cube`,
    subfolder: `comfytv-${kind}s`,
    size: 1024,
    sha256: 'x'.repeat(64),
    created_at: null,
    url: `/view?filename=${name}.cube&subfolder=comfytv-${kind}s&type=input`,
    missing: false,
    ...extra,
  }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function pickEvent(file: File | null): { e: Event; input: HTMLInputElement } {
  const input = document.createElement('input')
  input.type = 'file'
  Object.defineProperty(input, 'files', {
    value: file ? [file] : [],
    configurable: true,
  })
  input.value = ''
  return { e: { target: input } as unknown as Event, input }
}

beforeEach(() => {
  vi.clearAllMocks()
  listResources.mockResolvedValue({ resources: [] })
})

describe('formatResourceSize', () => {
  it('formats bytes, KB and MB, and blanks invalid input', () => {
    expect(formatResourceSize(512)).toBe('512 B')
    expect(formatResourceSize(2048)).toBe('2.0 KB')
    expect(formatResourceSize(3 * 1024 ** 2)).toBe('3.0 MB')
    expect(formatResourceSize(null)).toBe('')
    expect(formatResourceSize(undefined)).toBe('')
    expect(formatResourceSize(-1)).toBe('')
  })
})

describe('useResourcesPanel', () => {
  it('loads only when the panel becomes active', async () => {
    const active = ref(false)
    const p = useResourcesPanel(() => active.value)
    await flush()
    expect(listResources).not.toHaveBeenCalled()
    active.value = true
    await flush()
    expect(listResources).toHaveBeenCalledWith()
    expect(p.resources.value).toEqual([])
  })

  it('always exposes both kind groups with accept lists', async () => {
    listResources.mockResolvedValue({ resources: [
      resource(1, 'lut', 'warm'),
      resource(2, 'font', 'inter', { filename: 'inter.ttf' }),
      resource(3, 'lut', 'cool'),
    ] })
    const p = useResourcesPanel(() => true)
    await flush()
    expect(p.groups.value.map((g) => g.kind)).toEqual(['lut', 'font'])
    expect(p.groups.value[0]!.label).toBe('resources.kind.lut')
    expect(p.groups.value[0]!.accept).toBe('.cube,.3dl,.dat,.m3d,.csp')
    expect(p.groups.value[1]!.accept).toBe('.ttf,.otf,.woff,.woff2')
    expect(p.groups.value[0]!.resources.map((r) => r.name)).toEqual(['warm', 'cool'])
    expect(p.groups.value[1]!.resources.map((r) => r.name)).toEqual(['inter'])
  })

  it('keeps groups when the list is empty', async () => {
    const p = useResourcesPanel(() => true)
    await flush()
    expect(p.groups.value).toHaveLength(2)
    expect(p.groups.value.every((g) => g.resources.length === 0)).toBe(true)
  })

  it('toggleGroup collapses and expands a kind', async () => {
    const p = useResourcesPanel(() => true)
    await flush()
    expect(p.isCollapsed('lut')).toBe(false)
    p.toggleGroup('lut')
    expect(p.isCollapsed('lut')).toBe(true)
    p.toggleGroup('lut')
    expect(p.isCollapsed('lut')).toBe(false)
  })

  it('onRename patches the display name and refetches', async () => {
    renameResource.mockResolvedValue({ ok: true, resource: resource(1, 'lut', 'warmer') })
    askText.mockResolvedValue(' warmer ')
    const p = useResourcesPanel(() => true)
    await flush()
    listResources.mockClear()
    await p.onRename(resource(1, 'lut', 'warm') as any)
    expect(renameResource).toHaveBeenCalledWith(1, 'warmer')
    expect(listResources).toHaveBeenCalled()
  })

  it('onRename is a no-op when cancelled or unchanged', async () => {
    const p = useResourcesPanel(() => true)
    await flush()
    askText.mockResolvedValueOnce(null)
    await p.onRename(resource(1, 'lut', 'warm') as any)
    askText.mockResolvedValueOnce('warm')
    await p.onRename(resource(1, 'lut', 'warm') as any)
    expect(renameResource).not.toHaveBeenCalled()
  })

  it('onRemove deletes the row only after a danger confirm that mentions the file staying', async () => {
    deleteResource.mockResolvedValue({ ok: true })
    const p = useResourcesPanel(() => true)
    await flush()
    askConfirm.mockResolvedValueOnce(false)
    await p.onRemove(resource(1, 'lut', 'warm') as any)
    expect(deleteResource).not.toHaveBeenCalled()
    listResources.mockClear()
    askConfirm.mockResolvedValueOnce(true)
    await p.onRemove(resource(1, 'lut', 'warm') as any)
    expect(askConfirm).toHaveBeenCalledWith(expect.objectContaining({
      danger: true,
      message: 'resources.removeConfirm:{"name":"warm"}',
    }))
    expect(deleteResource).toHaveBeenCalledWith(1)
    expect(listResources).toHaveBeenCalled()
  })

  it('onUpload posts the picked file for the group kind, refetches and resets the input', async () => {
    uploadResource.mockResolvedValue({ ok: true, resource: resource(9, 'font', 'new') })
    const p = useResourcesPanel(() => true)
    await flush()
    listResources.mockClear()
    const file = new File(['x'], 'new.ttf')
    const { e, input } = pickEvent(file)
    await p.onUpload('font', e)
    expect(uploadResource).toHaveBeenCalledWith('font', file)
    expect(listResources).toHaveBeenCalled()
    expect(input.value).toBe('')
  })

  it('onUpload resets the input even when the upload fails, and skips empty picks', async () => {
    uploadResource.mockRejectedValue(new Error('too large'))
    const p = useResourcesPanel(() => true)
    await flush()
    const { e, input } = pickEvent(new File(['x'], 'bad.ttf'))
    await p.onUpload('font', e)
    expect(input.value).toBe('')

    uploadResource.mockClear()
    const { e: empty } = pickEvent(null)
    await p.onUpload('font', empty)
    expect(uploadResource).not.toHaveBeenCalled()
  })
})
