import { computed, ref } from 'vue'

import { setItemTags, type TagTargetKind } from '@/api/tags'
import { useAssetStore } from '@/stores/assetStore'

export interface Taggable {
  id: number | string
  category_ids: number[]
}

export type TagFilter = 'all' | number

export interface TagChip {
  id: number
  name: string
  count: number
}

export function useItemTags<T extends Taggable>(kind: TagTargetKind, items: () => T[]) {
  const store = useAssetStore()
  store.ensureHydrated()

  const picked = ref<TagFilter>('all')

  const chips = computed<TagChip[]>(() =>
    store.categories
      .map(c => ({
        id: c.id,
        name: c.name,
        count: items().filter(i => i.category_ids.includes(c.id)).length,
      }))
      .filter(c => c.count > 0),
  )

  const filter = computed<TagFilter>({
    get: () => (chips.value.some(c => c.id === picked.value) ? picked.value : 'all'),
    set: (value) => { picked.value = value },
  })

  function matches(item: T): boolean {
    return filter.value === 'all' || item.category_ids.includes(filter.value)
  }

  async function setTags(item: T, ids: number[]): Promise<void> {
    if (typeof item.id !== 'number') return
    try {
      item.category_ids = await setItemTags(kind, item.id, ids)
    } catch (e) {
      console.warn('[ComfyTV/tags] set tags failed', kind, item.id, e)
    }
  }

  function toggleTag(item: T, categoryId: number): Promise<void> {
    const has = item.category_ids.includes(categoryId)
    return setTags(item, has
      ? item.category_ids.filter(id => id !== categoryId)
      : [...item.category_ids, categoryId])
  }

  async function createTag(item: T, name: string): Promise<void> {
    const cat = store.categories.find(c => c.name === name) ?? await store.createCategory(name)
    if (cat && !item.category_ids.includes(cat.id)) await setTags(item, [...item.category_ids, cat.id])
  }

  return { chips, filter, matches, toggleTag, createTag }
}
