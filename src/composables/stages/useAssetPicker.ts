import { computed, ref } from 'vue'

import { t } from '@/i18n'
import { type AssetCategoryFilter, useAssetStore } from '@/stores/assetStore'

export interface AssetFilterOption {
  label: string
  value: string
}

export function useAssetPicker(
  getAddedIds: () => number[] = () => [],
  mediaTypes: string[] | null = ['image'],
) {
  const store = useAssetStore()

  const query = ref('')
  const filter = ref<AssetCategoryFilter>('all')
  const typeFilter = ref<string>('all')

  const filterValue = computed(() =>
    typeof filter.value === 'number' ? String(filter.value) : filter.value,
  )

  const categoryOptions = computed<AssetFilterOption[]>(() => [
    { label: t('assets.category.all'), value: 'all' },
    { label: t('assets.category.none'), value: 'none' },
    ...store.categories.map(c => ({ label: c.name, value: String(c.id) })),
  ])

  const showTypeFilter = computed(() => (mediaTypes?.length ?? 0) > 1)

  const typeOptions = computed<AssetFilterOption[]>(() => [
    { label: t('assets.media.all'), value: 'all' },
    ...(mediaTypes ?? []).map(m => ({ label: t(`assets.media.${m}`), value: m })),
  ])

  function setTypeFilter(v: string | number | null): void {
    typeFilter.value = v == null ? 'all' : String(v)
  }

  function setFilter(v: string | number | null): void {
    if (v === 'all' || v === 'none') filter.value = v
    else if (v != null) filter.value = Number(v)
  }

  const filtered = computed(() => {
    let rows = store.listByCategory(filter.value)
    if (mediaTypes) rows = rows.filter(a => mediaTypes.includes(a.media_type))
    if (typeFilter.value !== 'all') rows = rows.filter(a => a.media_type === typeFilter.value)
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
    typeFilter,
    typeOptions,
    showTypeFilter,
    setTypeFilter,
    filtered,
    isAdded,
    ensureHydrated,
  }
}
