import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = {
  categories: [{ id: 1, name: 'people' }, { id: 2, name: 'bg' }],
  byPayloadUrl: vi.fn(),
  ensureHydrated: vi.fn(),
  hydrate: vi.fn(() => Promise.resolve()),
  create: vi.fn(),
  createCategory: vi.fn(),
  addTag: vi.fn(),
  removeTag: vi.fn(),
}

vi.mock('@/stores/assetStore', () => ({ useAssetStore: () => store }))

import { useOutputAssetTagging } from './useOutputAssetTagging'

function clickEvent(right: number, bottom: number): MouseEvent {
  return { currentTarget: { getBoundingClientRect: () => ({ right, bottom }) } } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  store.byPayloadUrl.mockReturnValue(undefined)
})

describe('useOutputAssetTagging', () => {
  it('nameFromUrl extracts the filename without extension', () => {
    const { nameFromUrl } = useOutputAssetTagging()
    expect(nameFromUrl('/view?filename=shot_01.png&type=output')).toBe('shot_01')
    expect(nameFromUrl('https://x/y/pic.jpeg')).toBe('pic')
    expect(nameFromUrl('')).toBe('image')
  })

  it('isSaved reflects the library lookup', () => {
    const { isSaved } = useOutputAssetTagging()
    expect(isSaved('/a')).toBe(false)
    store.byPayloadUrl.mockReturnValue({ id: 9, category_ids: [] })
    expect(isSaved('/a')).toBe(true)
    expect(isSaved('')).toBe(false)
  })

  it('openTagMenu anchors the menu and hydrates the library', () => {
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/a', 'pic', clickEvent(200, 80))
    expect(store.ensureHydrated).toHaveBeenCalled()
    expect(tag.tagMenu.value).toEqual({ url: '/a', name: 'pic', mediaType: 'image', x: 200, y: 84 })
    expect(tag.tagMenuStyle.value).toEqual({ left: '24px', top: '84px' })
  })

  it('openTagMenu ignores an empty url', () => {
    const tag = useOutputAssetTagging()
    tag.openTagMenu('', 'x', clickEvent(10, 10))
    expect(tag.tagMenu.value).toBeNull()
  })

  it('tagMenuHas reflects the saved asset tags', () => {
    store.byPayloadUrl.mockReturnValue({ id: 9, category_ids: [2] })
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    expect(tag.tagMenuHas(2)).toBe(true)
    expect(tag.tagMenuHas(1)).toBe(false)
  })

  it('toggleOutputTag creates+tags a not-yet-saved output', async () => {
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    await tag.toggleOutputTag(1)
    expect(store.create).toHaveBeenCalledWith({
      name: 'pic', payload_url: '/a', media_type: 'image', category_ids: [1],
    })
    expect(store.addTag).not.toHaveBeenCalled()
  })

  it('toggleOutputTag adds a tag to an already-saved output', async () => {
    store.byPayloadUrl.mockReturnValue({ id: 9, category_ids: [2] })
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    await tag.toggleOutputTag(1)
    expect(store.addTag).toHaveBeenCalledWith(9, 1)
    expect(store.create).not.toHaveBeenCalled()
  })

  it('toggleOutputTag removes a tag the output already has', async () => {
    store.byPayloadUrl.mockReturnValue({ id: 9, category_ids: [2] })
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    await tag.toggleOutputTag(2)
    expect(store.removeTag).toHaveBeenCalledWith(9, 2)
  })

  it('tagMenuIsUncategorized is true only for a saved output with no categories', () => {
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    expect(tag.tagMenuIsUncategorized()).toBe(false)
    store.byPayloadUrl.mockReturnValue({ id: 9, category_ids: [] })
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    expect(tag.tagMenuIsUncategorized()).toBe(true)
    store.byPayloadUrl.mockReturnValue({ id: 9, category_ids: [2] })
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    expect(tag.tagMenuIsUncategorized()).toBe(false)
  })

  it('setUncategorized saves a not-yet-saved output with no category', async () => {
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    await tag.setUncategorized()
    expect(store.create).toHaveBeenCalledWith({
      name: 'pic', payload_url: '/a', media_type: 'image', category_ids: [],
    })
    expect(store.removeTag).not.toHaveBeenCalled()
  })

  it('saves an audio output with media_type audio (not image)', async () => {
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/track.mp3', 'song', clickEvent(10, 10), 'audio')
    await tag.setUncategorized()
    expect(store.create).toHaveBeenCalledWith({
      name: 'song', payload_url: '/track.mp3', media_type: 'audio', category_ids: [],
    })
  })

  it('tags a not-yet-saved video output as media_type video', async () => {
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/clip.mp4', 'clip', clickEvent(10, 10), 'video')
    await tag.toggleOutputTag(1)
    expect(store.create).toHaveBeenCalledWith({
      name: 'clip', payload_url: '/clip.mp4', media_type: 'video', category_ids: [1],
    })
  })

  it('setUncategorized strips every category from an already-saved output', async () => {
    store.byPayloadUrl.mockReturnValue({ id: 9, category_ids: [1, 2] })
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    await tag.setUncategorized()
    expect(store.create).not.toHaveBeenCalled()
    expect(store.removeTag).toHaveBeenCalledWith(9, 1)
    expect(store.removeTag).toHaveBeenCalledWith(9, 2)
  })

  it('createCategoryAndTag creates a category then files the output under it', async () => {
    store.createCategory.mockResolvedValue({ id: 7, name: 'props' })
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    await tag.createCategoryAndTag('  props  ')
    expect(store.createCategory).toHaveBeenCalledWith('props')
    expect(store.create).toHaveBeenCalledWith({
      name: 'pic', payload_url: '/a', media_type: 'image', category_ids: [7],
    })
  })

  it('createCategoryAndTag ignores a blank name', async () => {
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    await tag.createCategoryAndTag('   ')
    expect(store.createCategory).not.toHaveBeenCalled()
    expect(store.create).not.toHaveBeenCalled()
  })

  it('createCategoryAndTag does nothing without an open menu', async () => {
    const tag = useOutputAssetTagging()
    await tag.createCategoryAndTag('props')
    expect(store.createCategory).not.toHaveBeenCalled()
  })

  it('createCategoryAndTag bails out if category creation fails', async () => {
    store.createCategory.mockResolvedValue(null)
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    await tag.createCategoryAndTag('props')
    expect(store.createCategory).toHaveBeenCalledWith('props')
    expect(store.create).not.toHaveBeenCalled()
    expect(store.addTag).not.toHaveBeenCalled()
  })

  it('closeTagMenu clears the popover', () => {
    const tag = useOutputAssetTagging()
    tag.openTagMenu('/a', 'pic', clickEvent(10, 10))
    tag.closeTagMenu()
    expect(tag.tagMenu.value).toBeNull()
  })
})
