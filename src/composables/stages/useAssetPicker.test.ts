import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = {
  categories: [] as Array<{ id: number; name: string }>,
  listByCategory: vi.fn(),
  ensureHydrated: vi.fn(),
}

vi.mock('@/stores/assetStore', () => ({ useAssetStore: () => store }))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import { useAssetPicker } from './useAssetPicker'

const A = (id: number, name: string, media_type = 'image') =>
  ({ id, name, payload_url: `/u${id}`, category_ids: [], media_type })

beforeEach(() => {
  vi.clearAllMocks()
  store.categories = [{ id: 1, name: 'people' }, { id: 2, name: 'bg' }]
  store.listByCategory.mockReturnValue([A(1, 'Hero'), A(2, 'sunset'), A(3, 'HERO backup')])
})

describe('useAssetPicker', () => {
  it('defaults to the "all" filter and exposes all rows', () => {
    const p = useAssetPicker()
    expect(p.filter.value).toBe('all')
    expect(p.filtered.value.map(a => a.id)).toEqual([1, 2, 3])
    expect(store.listByCategory).toHaveBeenCalledWith('all')
  })

  it('defaults to image-only, hiding video/audio assets', () => {
    store.listByCategory.mockReturnValue([
      A(1, 'Hero'), A(2, 'clip', 'video'), A(3, 'song', 'audio'),
    ])
    const p = useAssetPicker()
    expect(p.filtered.value.map(a => a.id)).toEqual([1])
  })

  it('honors an explicit media-type allowlist', () => {
    store.listByCategory.mockReturnValue([
      A(1, 'Hero'), A(2, 'clip', 'video'), A(3, 'song', 'audio'),
    ])
    const p = useAssetPicker(() => [], ['video', 'audio'])
    expect(p.filtered.value.map(a => a.id)).toEqual([2, 3])
  })

  it('passing null media types disables media filtering', () => {
    store.listByCategory.mockReturnValue([
      A(1, 'Hero'), A(2, 'clip', 'video'),
    ])
    const p = useAssetPicker(() => [], null)
    expect(p.filtered.value.map(a => a.id)).toEqual([1, 2])
  })

  it('filters by a case-insensitive name search', () => {
    const p = useAssetPicker()
    p.query.value = '  hero '
    expect(p.filtered.value.map(a => a.id)).toEqual([1, 3])
  })

  it('returns everything when the search query is blank', () => {
    const p = useAssetPicker()
    p.query.value = '   '
    expect(p.filtered.value).toHaveLength(3)
  })

  it('setFilter accepts the all/none sentinels', () => {
    const p = useAssetPicker()
    p.setFilter('none')
    expect(p.filter.value).toBe('none')
    p.setFilter('all')
    expect(p.filter.value).toBe('all')
  })

  it('setFilter coerces a numeric category id from the select string', () => {
    const p = useAssetPicker()
    p.setFilter('2')
    expect(p.filter.value).toBe(2)
    expect(p.filtered.value).toBeDefined()
    expect(store.listByCategory).toHaveBeenLastCalledWith(2)
  })

  it('setFilter ignores null (no change)', () => {
    const p = useAssetPicker()
    p.setFilter(2)
    p.setFilter(null)
    expect(p.filter.value).toBe(2)
  })

  it('filterValue stringifies a numeric filter, passes sentinels through', () => {
    const p = useAssetPicker()
    expect(p.filterValue.value).toBe('all')
    p.setFilter(2)
    expect(p.filterValue.value).toBe('2')
    p.setFilter('none')
    expect(p.filterValue.value).toBe('none')
  })

  it('categoryOptions = all/none sentinels then one option per category', () => {
    const p = useAssetPicker()
    expect(p.categoryOptions.value).toEqual([
      { label: 'assets.category.all', value: 'all' },
      { label: 'assets.category.none', value: 'none' },
      { label: 'people', value: '1' },
      { label: 'bg', value: '2' },
    ])
  })

  it('isAdded reflects the supplied added-id getter', () => {
    const added = [2]
    const p = useAssetPicker(() => added)
    expect(p.isAdded(2)).toBe(true)
    expect(p.isAdded(1)).toBe(false)
    added.push(1)
    expect(p.isAdded(1)).toBe(true)
  })

  it('isAdded is false by default (no getter)', () => {
    const p = useAssetPicker()
    expect(p.isAdded(1)).toBe(false)
  })

  it('ensureHydrated delegates to the store', () => {
    useAssetPicker().ensureHydrated()
    expect(store.ensureHydrated).toHaveBeenCalledOnce()
  })
})
