import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useAssetStore } from '@/stores/assetStore'

const setItemTags = vi.fn()
vi.mock('@/api/tags', () => ({
  setItemTags: (...args: unknown[]) => setItemTags(...args),
}))

import { useItemTags } from './useItemTags'

interface Row { id: number | string; category_ids: number[] }

function setup(rows: Row[]) {
  const store = useAssetStore()
  vi.spyOn(store, 'ensureHydrated').mockImplementation(() => {})
  store.categories = [
    { id: 1, name: 'warm' },
    { id: 2, name: 'film' },
    { id: 3, name: 'unused' },
  ]
  const items = ref(rows)
  return { store, items, tags: useItemTags('preset', () => items.value) }
}

describe('useItemTags', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setItemTags.mockReset()
    setItemTags.mockImplementation(async (_kind: string, _id: number, ids: number[]) => [...ids].sort())
  })

  it('offers only tags that some item carries, with counts', () => {
    const { tags } = setup([
      { id: 10, category_ids: [1, 2] },
      { id: 11, category_ids: [1] },
      { id: 12, category_ids: [] },
    ])
    expect(tags.chips.value).toEqual([
      { id: 1, name: 'warm', count: 2 },
      { id: 2, name: 'film', count: 1 },
    ])
  })

  it('filters items by the picked tag', () => {
    const { tags, items } = setup([
      { id: 10, category_ids: [1, 2] },
      { id: 11, category_ids: [1] },
      { id: 'builtin:x', category_ids: [] },
    ])
    expect(items.value.filter(tags.matches)).toHaveLength(3)
    tags.filter.value = 2
    expect(items.value.filter(tags.matches).map(i => i.id)).toEqual([10])
  })

  it('falls back to all once the picked tag has no items left', async () => {
    const { tags, items } = setup([{ id: 10, category_ids: [2] }])
    tags.filter.value = 2
    await tags.toggleTag(items.value[0], 2)
    expect(items.value[0].category_ids).toEqual([])
    expect(tags.filter.value).toBe('all')
    expect(items.value.filter(tags.matches)).toHaveLength(1)
  })

  it('toggles a tag through the API and stores the returned ids', async () => {
    const { tags, items } = setup([{ id: 10, category_ids: [2] }])
    await tags.toggleTag(items.value[0], 1)
    expect(setItemTags).toHaveBeenCalledWith('preset', 10, [2, 1])
    expect(items.value[0].category_ids).toEqual([1, 2])
  })

  it('leaves built-in rows untouched', async () => {
    const { tags, items } = setup([{ id: 'builtin:x', category_ids: [] }])
    await tags.toggleTag(items.value[0], 1)
    expect(setItemTags).not.toHaveBeenCalled()
  })

  it('reuses an existing tag of the same name instead of creating one', async () => {
    const { tags, items, store } = setup([{ id: 10, category_ids: [] }])
    const create = vi.spyOn(store, 'createCategory')
    await tags.createTag(items.value[0], 'film')
    expect(create).not.toHaveBeenCalled()
    expect(items.value[0].category_ids).toEqual([2])
  })

  it('creates a new tag and applies it', async () => {
    const { tags, items, store } = setup([{ id: 10, category_ids: [1] }])
    vi.spyOn(store, 'createCategory').mockResolvedValue({ id: 9, name: 'noir' })
    await tags.createTag(items.value[0], 'noir')
    expect(setItemTags).toHaveBeenCalledWith('preset', 10, [1, 9])
  })
})
