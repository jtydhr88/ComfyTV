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
vi.mock('@/composables/dialog/useTextInputDialog', () => ({
  askText: vi.fn(async () => null),
}))
vi.mock('@/composables/dialog/useConfirmDialog', () => ({
  askConfirm: vi.fn(async () => false),
}))

import { uploadBlobNamed } from '@/utils/uploadCanvas'
import { askText } from '@/composables/dialog/useTextInputDialog'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'

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

  it('mediaFilter narrows visibleAssets and mediaCount reports per type', () => {
    store.listByCategory.mockReturnValue([
      { id: 1, media_type: 'image' },
      { id: 2, media_type: 'video' },
      { id: 3, media_type: 'audio' },
      { id: 4, media_type: 'image' },
    ] as any)
    const p = useAssetsPanel(() => false)
    expect(p.visibleAssets.value.map((a: any) => a.id)).toEqual([1, 2, 3, 4])
    expect(p.mediaCount('all')).toBe(4)
    expect(p.mediaCount('image')).toBe(2)
    expect(p.mediaCount('video')).toBe(1)
    expect(p.mediaCount('audio')).toBe(1)
    p.mediaFilter.value = 'video'
    expect(p.visibleAssets.value.map((a: any) => a.id)).toEqual([2])
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

  const ASSET_MIME = 'application/x-comfytv-asset-id'

  it('shows the add overlay for external files but not for a dragged in-library image', () => {
    const p = useAssetsPanel(() => false)
    p.onDragEnter(dragEvent(undefined, [], ['Files']))
    expect(p.fileDragDepth.value).toBe(1)
    p.onDragEnter(dragEvent(undefined, [], ['Files', ASSET_MIME]))
    expect(p.fileDragDepth.value).toBe(1)
  })

  it('onDrop does not re-add an image already in the library (no duplicate)', async () => {
    const file = new File(['x'], 'pic.png', { type: 'image/png' })
    const p = useAssetsPanel(() => false)
    p.onDrop(dragEvent(undefined, [file], ['Files', ASSET_MIME]))
    await Promise.resolve()
    expect(store.create).not.toHaveBeenCalled()
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
    vi.mocked(askText).mockResolvedValueOnce('characters')
    const p = useAssetsPanel(() => false)
    await p.onCreateCategory()
    expect(askText).toHaveBeenCalled()
    expect(store.createCategory).toHaveBeenCalledWith('characters')
  })

  it('onCreateCategory does nothing when the dialog is cancelled', async () => {
    vi.mocked(askText).mockResolvedValueOnce(null)
    const p = useAssetsPanel(() => false)
    await p.onCreateCategory()
    expect(store.createCategory).not.toHaveBeenCalled()
  })

  it('onDeleteCategory does not remove when the confirm is declined', async () => {
    vi.mocked(askConfirm).mockResolvedValueOnce(false)
    const p = useAssetsPanel(() => false)
    await p.onDeleteCategory(1)
    expect(store.removeCategory).not.toHaveBeenCalled()
  })

  it('onDeleteCategory removes when the confirm is accepted', async () => {
    vi.mocked(askConfirm).mockResolvedValueOnce(true)
    const p = useAssetsPanel(() => false)
    await p.onDeleteCategory(1)
    expect(store.removeCategory).toHaveBeenCalledWith(1)
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

  it('addFiles uploads video assets with probed dimensions', async () => {
    const spy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'video') {
        return {
          preload: '',
          videoWidth: 640,
          videoHeight: 480,
          set src(_v: string) { queueMicrotask(() => (this as any).onloadedmetadata?.()) },
        } as any
      }
      return {} as any
    }) as any)
    ;(URL as any).createObjectURL = vi.fn(() => 'blob:x')
    ;(URL as any).revokeObjectURL = vi.fn()

    const p = useAssetsPanel(() => false)
    await p.addFiles([new File(['x'], 'clip.mp4', { type: 'video/mp4' })])
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'clip', media_type: 'video', width: 640, height: 480,
    }))
    spy.mockRestore()
  })

  it('addFiles uploads audio assets without dimensions', async () => {
    const p = useAssetsPanel(() => false)
    await p.addFiles([new File(['x'], 'song.mp3', { type: 'audio/mpeg' })])
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'song', media_type: 'audio', width: null, height: null,
    }))
  })

  it('addFiles skips files that are not image/video/audio', async () => {
    const p = useAssetsPanel(() => false)
    await p.addFiles([new File(['x'], 'a.txt', { type: 'text/plain' })])
    expect(store.create).not.toHaveBeenCalled()
  })
})
