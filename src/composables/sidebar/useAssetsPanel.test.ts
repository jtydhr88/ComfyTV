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
vi.mock('@/composables/stages/assetLoaderNode', () => ({
  createAssetLoaderNode: vi.fn(),
  canvasCenter: vi.fn(() => [0, 0]),
}))

import { uploadBlobNamed } from '@/utils/uploadCanvas'
import { askText } from '@/composables/dialog/useTextInputDialog'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
import { createAssetLoaderNode } from '@/composables/stages/assetLoaderNode'
import { useLightbox } from '@/composables/useLightbox'

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
  store.listByCategory.mockReturnValue([])
  // The lightbox is a module-level singleton; reset it between tests.
  useLightbox().close()
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

  it('searchQuery narrows visibleAssets by name', () => {
    store.listByCategory.mockReturnValue([
      { id: 1, media_type: 'image', name: 'Hero portrait' },
      { id: 2, media_type: 'image', name: 'Background' },
    ] as any)
    const p = useAssetsPanel(() => false)
    p.searchQuery.value = 'hero'
    expect(p.visibleAssets.value.map((a: any) => a.id)).toEqual([1])
    p.searchQuery.value = ''
    expect(p.visibleAssets.value.length).toBe(2)
  })

  it('openAssetMenu resolves the asset; menuEditTags hands off to the tag editor', () => {
    const p = useAssetsPanel(() => false)
    p.openAssetMenu({ id: 5 } as any, { clientX: 100, clientY: 40 } as any, 'pointer')
    expect(p.assetMenu.value?.assetId).toBe(5)
    p.menuEditTags()
    expect(p.assetMenu.value).toBeNull()
    expect(p.tagEditor.value?.assetId).toBe(5)
    expect(p.editorHas(1)).toBe(true)
    p.toggleTag(1)
    expect(store.removeTag).toHaveBeenCalledWith(5, 1)
    p.toggleTag(2)
    expect(store.addTag).toHaveBeenCalledWith(5, 2)
  })

  it('menuDeleteAsset closes the menu and asks for confirmation', async () => {
    vi.mocked(askConfirm).mockResolvedValueOnce(true)
    const p = useAssetsPanel(() => false)
    p.openAssetMenu({ id: 5 } as any, { clientX: 10, clientY: 10 } as any, 'pointer')
    p.menuDeleteAsset()
    expect(p.assetMenu.value).toBeNull()
    await Promise.resolve()
    expect(askConfirm).toHaveBeenCalled()
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

  it('assetTooltip shows the name, with dimensions when present', () => {
    const p = useAssetsPanel(() => false)
    expect(p.assetTooltip({ name: 'hero', width: 2, height: 3 } as any)).toBe('hero · 2×3')
    expect(p.assetTooltip({ name: '' } as any)).toBe('—')
  })

  it('assetMeta returns dims for images and formatted size otherwise', () => {
    const p = useAssetsPanel(() => false)
    expect(p.assetMeta({ media_type: 'image', width: 2, height: 3 } as any)).toBe('2×3')
    expect(p.assetMeta({ media_type: 'video', size_bytes: 500 } as any)).toBe('500 B')
    expect(p.assetMeta({ media_type: 'video', size_bytes: 2048 } as any)).toBe('2.0 KB')
    expect(p.assetMeta({ media_type: 'video', size_bytes: 2 * 1024 ** 2 } as any)).toBe('2.0 MB')
    expect(p.assetMeta({ media_type: 'video', size_bytes: 2 * 1024 ** 3 } as any)).toBe('2.0 GB')
    expect(p.assetMeta({ media_type: 'video' } as any)).toBe('')
  })

  it('openAssetMenu with the element anchor derives coords from the bounding rect', () => {
    const p = useAssetsPanel(() => false)
    const el = { getBoundingClientRect: () => ({ right: 300, bottom: 120 }) }
    p.openAssetMenu({ id: 5 } as any, { currentTarget: el } as any, 'element')
    expect(p.assetMenu.value?.assetId).toBe(5)
    expect(p.assetMenuStyle.value).toHaveProperty('left')
    expect(p.assetMenuStyle.value).toHaveProperty('top')
  })

  it('openAssetMenu defaults to the element anchor', () => {
    const p = useAssetsPanel(() => false)
    const el = { getBoundingClientRect: () => ({ right: 300, bottom: 120 }) }
    p.openAssetMenu({ id: 9 } as any, { currentTarget: el } as any)
    expect(p.assetMenu.value?.assetId).toBe(9)
  })

  it('closeAssetMenu clears the open menu', () => {
    const p = useAssetsPanel(() => false)
    p.openAssetMenu({ id: 5 } as any, { clientX: 10, clientY: 10 } as any, 'pointer')
    expect(p.assetMenu.value).not.toBeNull()
    p.closeAssetMenu()
    expect(p.assetMenu.value).toBeNull()
  })

  it('closeTagEditor clears the tag editor', () => {
    const p = useAssetsPanel(() => false)
    p.openAssetMenu({ id: 5 } as any, { clientX: 10, clientY: 10 } as any, 'pointer')
    p.menuEditTags()
    expect(p.tagEditor.value).not.toBeNull()
    expect(p.tagEditorStyle.value).toHaveProperty('left')
    p.closeTagEditor()
    expect(p.tagEditor.value).toBeNull()
    expect(p.tagEditorStyle.value).toEqual({})
  })

  it('toggleTag is a no-op when no editor asset is resolved', () => {
    const p = useAssetsPanel(() => false)
    p.toggleTag(1)
    expect(store.addTag).not.toHaveBeenCalled()
    expect(store.removeTag).not.toHaveBeenCalled()
  })

  it('menuEditTags returns early when no menu is open', () => {
    const p = useAssetsPanel(() => false)
    p.menuEditTags()
    expect(p.tagEditor.value).toBeNull()
  })

  it('menuLoadNode closes the menu and spawns a loader node', () => {
    const p = useAssetsPanel(() => false)
    p.openAssetMenu({ id: 5 } as any, { clientX: 10, clientY: 10 } as any, 'pointer')
    p.menuLoadNode()
    expect(p.assetMenu.value).toBeNull()
    expect(createAssetLoaderNode).toHaveBeenCalled()
  })

  it('menuRenameAsset closes the menu and prompts for a new name', async () => {
    const p = useAssetsPanel(() => false)
    p.openAssetMenu({ id: 5 } as any, { clientX: 10, clientY: 10 } as any, 'pointer')
    p.menuRenameAsset()
    expect(p.assetMenu.value).toBeNull()
    await Promise.resolve()
    expect(askText).toHaveBeenCalled()
  })

  it('viewFullAsset opens the lightbox over visible images at the clicked index', () => {
    store.listByCategory.mockReturnValue([
      { id: 1, media_type: 'image', name: 'a', payload_url: '/a.png' },
      { id: 2, media_type: 'video', name: 'v', payload_url: '/v.mp4' },
      { id: 3, media_type: 'image', name: 'b', payload_url: '/b.png' },
    ] as any)
    const p = useAssetsPanel(() => false)
    p.viewFullAsset({ id: 3, media_type: 'image' } as any)
    const lb = useLightbox()
    expect(lb.count.value).toBe(2)
    expect(lb.index.value).toBe(1)
    expect(lb.current.value?.url).toBe('/b.png')
    expect(lb.current.value?.label).toBe('b')
  })

  it('viewFullAsset is a no-op for a non-image asset', () => {
    store.listByCategory.mockReturnValue([
      { id: 1, media_type: 'image', name: 'a', payload_url: '/a.png' },
      { id: 2, media_type: 'video', name: 'v', payload_url: '/v.mp4' },
    ] as any)
    const p = useAssetsPanel(() => false)
    p.viewFullAsset({ id: 2, media_type: 'video' } as any)
    expect(useLightbox().count.value).toBe(0)
  })

  it('viewFullAsset is a no-op when the asset is not in the visible list', () => {
    store.listByCategory.mockReturnValue([
      { id: 1, media_type: 'image', name: 'a', payload_url: '/a.png' },
    ] as any)
    const p = useAssetsPanel(() => false)
    p.viewFullAsset({ id: 99, media_type: 'image' } as any)
    expect(useLightbox().count.value).toBe(0)
  })

  it('menuViewFull routes the current menu asset through the lightbox', () => {
    store.listByCategory.mockReturnValue([
      { id: 1, media_type: 'image', name: 'a', payload_url: '/a.png' },
      { id: 3, media_type: 'image', name: 'b', payload_url: '/b.png' },
    ] as any)
    store.byId.mockReturnValue({ id: 3, media_type: 'image', name: 'b', payload_url: '/b.png' })
    const p = useAssetsPanel(() => false)
    p.openAssetMenu({ id: 3 } as any, { clientX: 5, clientY: 5 } as any, 'pointer')
    p.menuViewFull()
    expect(p.assetMenu.value).toBeNull()
    const lb = useLightbox()
    expect(lb.count.value).toBe(2)
    expect(lb.index.value).toBe(1)
  })

  it('onPickFiles reads and resets the input, forwarding files to addFiles', () => {
    const p = useAssetsPanel(() => false)
    const input = { files: [new File(['x'], 'a.txt', { type: 'text/plain' })], value: 'C:\\fakepath\\a.txt' }
    p.onPickFiles({ target: input } as any)
    expect(input.value).toBe('')
  })

  it('addFiles records an error when the upload throws', async () => {
    vi.mocked(uploadBlobNamed).mockRejectedValueOnce(new Error('boom'))
    const p = useAssetsPanel(() => false)
    await p.addFiles([new File(['x'], 'song.mp3', { type: 'audio/mpeg' })])
    expect(p.uploadError.value).toBe('assets.uploadFailed')
    expect(p.uploading.value).toBe(false)
  })

  it('addFiles stores null dimensions when image probing fails', async () => {
    class FakeImgErr {
      onload: any
      onerror: any
      naturalWidth = 0
      naturalHeight = 0
      set src(_v: string) { queueMicrotask(() => this.onerror?.()) }
    }
    vi.stubGlobal('Image', FakeImgErr as any)
    ;(URL as any).createObjectURL = vi.fn(() => 'blob:x')
    ;(URL as any).revokeObjectURL = vi.fn()

    const p = useAssetsPanel(() => false)
    await p.addFiles([new File(['x'], 'pic.png', { type: 'image/png' })])
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({
      media_type: 'image', width: null, height: null,
    }))
    vi.unstubAllGlobals()
  })

  it('addFiles stores null dimensions when video probing fails', async () => {
    const spy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'video') {
        return {
          preload: '',
          set src(_v: string) { queueMicrotask(() => (this as any).onerror?.()) },
        } as any
      }
      return {} as any
    }) as any)
    ;(URL as any).createObjectURL = vi.fn(() => 'blob:x')
    ;(URL as any).revokeObjectURL = vi.fn()

    const p = useAssetsPanel(() => false)
    await p.addFiles([new File(['x'], 'clip.mp4', { type: 'video/mp4' })])
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({
      media_type: 'video', width: null, height: null,
    }))
    spy.mockRestore()
  })

  it('onRenameCategory renames when a new name is given', async () => {
    vi.mocked(askText).mockResolvedValueOnce('landscapes')
    const p = useAssetsPanel(() => false)
    await p.onRenameCategory(1, 'old')
    expect(store.renameCategory).toHaveBeenCalledWith(1, 'landscapes')
  })

  it('onRenameCategory does nothing when unchanged or cancelled', async () => {
    vi.mocked(askText).mockResolvedValueOnce('same')
    const p = useAssetsPanel(() => false)
    await p.onRenameCategory(1, 'same')
    expect(store.renameCategory).not.toHaveBeenCalled()
  })

  it('onDeleteCategory resets the active filter when the removed category was active', async () => {
    vi.mocked(askConfirm).mockResolvedValueOnce(true)
    const p = useAssetsPanel(() => false)
    p.activeFilter.value = 1
    await p.onDeleteCategory(1)
    expect(store.removeCategory).toHaveBeenCalledWith(1)
    expect(p.activeFilter.value).toBe('all')
  })

  it('onRenameAsset renames when a new name is provided', async () => {
    vi.mocked(askText).mockResolvedValueOnce('newname')
    const p = useAssetsPanel(() => false)
    await p.onRenameAsset({ id: 5, name: 'old' } as any)
    expect(store.rename).toHaveBeenCalledWith(5, 'newname')
  })

  it('onRenameAsset does nothing when unchanged', async () => {
    vi.mocked(askText).mockResolvedValueOnce('old')
    const p = useAssetsPanel(() => false)
    await p.onRenameAsset({ id: 5, name: 'old' } as any)
    expect(store.rename).not.toHaveBeenCalled()
  })

  it('onDeleteAsset removes when the confirm is accepted', async () => {
    vi.mocked(askConfirm).mockResolvedValueOnce(true)
    const p = useAssetsPanel(() => false)
    await p.onDeleteAsset({ id: 5 } as any)
    expect(store.remove).toHaveBeenCalledWith(5)
  })

  it('onAssetDragStart sets the asset id on the drag payload', () => {
    const p = useAssetsPanel(() => false)
    const dt = { setData: vi.fn(), effectAllowed: '' }
    p.onAssetDragStart({ id: 7 } as any, { dataTransfer: dt } as any)
    expect(dt.setData).toHaveBeenCalledWith(ASSET_MIME, '7')
    expect(dt.effectAllowed).toBe('copy')
  })

  it('onAssetDragStart is a no-op without a dataTransfer', () => {
    const p = useAssetsPanel(() => false)
    expect(() => p.onAssetDragStart({ id: 7 } as any, {} as any)).not.toThrow()
  })

  it('onChipDrop ignores a non-numeric asset payload', () => {
    const p = useAssetsPanel(() => false)
    p.onChipDrop(2, dragEvent('not-a-number'))
    expect(store.addTag).not.toHaveBeenCalled()
  })

  it('onDragLeave decrements the file drag depth for external files', () => {
    const p = useAssetsPanel(() => false)
    p.onDragEnter(dragEvent(undefined, [], ['Files']))
    expect(p.fileDragDepth.value).toBe(1)
    p.onDragLeave(dragEvent(undefined, [], ['Files']))
    expect(p.fileDragDepth.value).toBe(0)
    p.onDragLeave(dragEvent(undefined, [], ['Files']))
    expect(p.fileDragDepth.value).toBe(0)
  })

  it('onDrop of external files resets the depth and forwards them', () => {
    const p = useAssetsPanel(() => false)
    p.onDragEnter(dragEvent(undefined, [], ['Files']))
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    p.onDrop(dragEvent(undefined, [file], ['Files']))
    expect(p.fileDragDepth.value).toBe(0)
  })
})
