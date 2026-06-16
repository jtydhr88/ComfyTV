import { computed, ref } from 'vue'

import { t } from '@/i18n'
import { type AssetCategoryFilter, useAssetStore } from '@/stores/assetStore'

export interface AssetFilterOption {
  label: string
  value: string
}

export function useAssetPicker(getAddedIds: () => number[] = () => []) {
  const store = useAssetStore()

  const query = ref('')
  const filter = ref<AssetCategoryFilter>('all')

  const filterValue = computed(() =>
    typeof filter.value === 'number' ? String(filter.value) : filter.value,
  )

  const categoryOptions = computed<AssetFilterOption[]>(() => [
    { label: t('assets.category.all'), value: 'all' },
    { label: t('assets.category.none'), value: 'none' },
    ...store.categories.map(c => ({ label: c.name, value: String(c.id) })),
  ])

  function setFilter(v: string | number | null): void {
    if (v === 'all' || v === 'none') filter.value = v
    else if (v != null) filter.value = Number(v)
  }

  const filtered = computed(() => {
    let rows = store.listByCategory(filter.value)
    const q = query.value.trim().toLowerCase()
    if (q) rows = rows.filter(a => a.name.toLowerCase().includes(q))
    return rows
  })

  function isAdded(id: number): boolean {
    return getAddedIds().includes(id)
  }

  function ensureHydrated(): void {
    store.ensureHydrated()
  }

  return {
    query,
    filter,
    filterValue,
    categoryOptions,
    setFilter,
    filtered,
    isAdded,
    ensureHydrated,
  }
}
