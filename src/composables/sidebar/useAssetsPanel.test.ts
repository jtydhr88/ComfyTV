import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = {
  categories: [{ id: 1, name: 'people' }, { id: 2, name: 'bg' }],
  byId: vi.fn(),
  listByCategory: vi.fn(() => []),
  ensureHydrated: vi.fn(),
  installWebSocketSync: vi.fn(),
  createCategory: vi.fn(async () => ({ id: 3, name: 'new' })),
  renameCategory: vi.fn(),
  removeCategory: vi.fn(async () => true),
  rename: vi.fn(),
  remove: vi.fn(),
  addTag: vi.fn(),
  removeTag: vi.fn(),
  create: vi.fn(async () => ({ id: 1 })),
}

vi.mock('@/stores/assetStore', () => ({ useAssetStore: () => store }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('@/utils/uploadCanvas', () => ({
  uploadBlobNamed: vi.fn(async (_f: File, o: any) => ({ url: `/up/${o.filename}` })),
}))

import { uploadBlobNamed } from '@/utils/uploadCanvas'

import { useAssetsPanel } from './useAssetsPanel'

function dragEvent(data?: string, files: File[] = [], types: string[] = []): DragEvent {
  return {
    dataTransfer: {
      getData: () => data ?? '',
      setData: vi.fn(),
      files,
      types,
    },
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  store.byId.mockReturnValue({ id: 5, category_ids: [1] })
})

describe('useAssetsPanel', () => {
  it('hydrates + installs ws sync when the tab becomes active', () => {
    useAssetsPanel(() => true)
    expect(store.ensureHydrated).toHaveBeenCalled()
    expect(store.installWebSocketSync).toHaveBeenCalled()
  })

  it('does not hydrate while inactive', () => {
    useAssetsPanel(() => false)
    expect(store.ensureHydrated).not.toHaveBeenCalled()
  })

  it('visibleAssets follows the active filter', () => {
    const p = useAssetsPanel(() => false)
    p.activeFilter.value = 2
    void p.visibleAssets.value
    expect(store.listByCategory).toHaveBeenLastCalledWith(2)
  })

  it('onChipDrop tags the dragged asset onto the category', () => {
    const p = useAssetsPanel(() => false)
    p.onChipDrop(2, dragEvent('7'))
    expect(store.addTag).toHaveBeenCalledWith(7, 2)
  })

  it('onChipDrop ignores a drop with no asset payload', () => {
    const p = useAssetsPanel(() => false)
    p.onChipDrop(2, dragEvent(''))
    expect(store.addTag).not.toHaveBeenCalled()
  })

  it('openTagEditor + toggleTag add/remove via the resolved asset', () => {
    const p = useAssetsPanel(() => false)
    p.openTagEditor({ id: 5 } as any, { currentTarget: { getBoundingClientRect: () => ({ right: 200, bottom: 40 }) } } as any)
    expect(p.tagEditor.value?.assetId).toBe(5)
    expect(p.editorHas(1)).toBe(true)   // asset has cat 1
    p.toggleTag(1)                       // already has → remove
    expect(store.removeTag).toHaveBeenCalledWith(5, 1)
    p.toggleTag(2)                       // missing → add
    expect(store.addTag).toHaveBeenCalledWith(5, 2)
  })

  it('catName resolves the category label with a fallback', () => {
    const p = useAssetsPanel(() => false)
    expect(p.catName(1)).toBe('people')
    expect(p.catName(99)).toBe('#99')
  })

  it('onCreateCategory prompts then creates and selects it', async () => {
    vi.stubGlobal('prompt', vi.fn(() => 'characters'))
    const p = useAssetsPanel(() => false)
    p.onCreateCategory()
    await Promise.resolve(); await Promise.resolve()
    expect(store.createCategory).toHaveBeenCalledWith('characters')
    vi.unstubAllGlobals()
  })

  it('onDeleteCategory confirms before removing', () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    const p = useAssetsPanel(() => false)
    p.onDeleteCategory(1)
    expect(store.removeCategory).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('addFiles uploads images and creates assets under the active category', async () => {
    class FakeImg { onload: any; onerror: any; naturalWidth = 2; naturalHeight = 3
      set src(_v: string) { queueMicrotask(() => this.onload?.()) } }
    vi.stubGlobal('Image', FakeImg as any)
    ;(URL as any).createObjectURL = vi.fn(() => 'blob:x')
    ;(URL as any).revokeObjectURL = vi.fn()

    const p = useAssetsPanel(() => false)
    p.activeFilter.value = 2
    const file = new File(['x'], 'pic.png', { type: 'image/png' })
    await p.addFiles([file])
    expect(uploadBlobNamed).toHaveBeenCalled()
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'pic', payload_url: '/up/pic.png', media_type: 'image', category_ids: [2],
    }))
    vi.unstubAllGlobals()
  })

  it('addFiles skips non-image files', async () => {
    const p = useAssetsPanel(() => false)
    await p.addFiles([new File(['x'], 'a.txt', { type: 'text/plain' })])
    expect(store.create).not.toHaveBeenCalled()
  })
})
