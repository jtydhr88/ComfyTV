import { computed, ref } from 'vue'

import { useAssetStore } from '@/stores/assetStore'

interface TagMenuState {
  url: string
  name: string
  mediaType: string
  x: number
  y: number
}

export function useOutputAssetTagging() {
  const assetStore = useAssetStore()

  const tagMenu = ref<TagMenuState | null>(null)

  const categories = computed(() => assetStore.categories)

  const tagMenuAsset = computed(() =>
    tagMenu.value ? assetStore.byPayloadUrl(tagMenu.value.url) ?? null : null,
  )

  const tagMenuStyle = computed(() =>
    tagMenu.value
      ? { left: `${Math.max(8, tagMenu.value.x - 176)}px`, top: `${tagMenu.value.y}px` }
      : {},
  )

  function nameFromUrl(url: string): string {
    try {
      const u = new URL(url, window.location.origin)
      const fn = u.searchParams.get('filename') || u.pathname.split('/').pop() || 'image'
      return fn.replace(/\.[^.]+$/, '')
    } catch {
      return 'image'
    }
  }

  function isSaved(url: string): boolean {
    return !!url && !!assetStore.byPayloadUrl(url)
  }

  function openTagMenu(url: string, name: string, e: MouseEvent, mediaType: string = 'image') {
    if (!url) return
    assetStore.ensureHydrated()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    tagMenu.value = { url, name, mediaType, x: r.right, y: r.bottom + 4 }
  }

  function closeTagMenu() {
    tagMenu.value = null
  }

  function tagMenuHas(catId: number): boolean {
    return tagMenuAsset.value?.category_ids.includes(catId) ?? false
  }

  function tagMenuIsUncategorized(): boolean {
    const a = tagMenuAsset.value
    return !!a && a.category_ids.length === 0
  }

  async function setUncategorized() {
    if (!tagMenu.value) return
    await assetStore.hydrate()
    if (!tagMenu.value) return
    const existing = tagMenuAsset.value
    if (!existing) {
      await assetStore.create({
        name: tagMenu.value.name,
        payload_url: tagMenu.value.url,
        media_type: tagMenu.value.mediaType || 'image',
        category_ids: [],
      })
      return
    }
    for (const catId of [...existing.category_ids]) {
      await assetStore.removeTag(existing.id, catId)
    }
  }

  async function toggleOutputTag(catId: number) {
    if (!tagMenu.value) return
    await assetStore.hydrate()
    if (!tagMenu.value) return
    const existing = tagMenuAsset.value
    if (!existing) {
      await assetStore.create({
        name: tagMenu.value.name,
        payload_url: tagMenu.value.url,
        media_type: tagMenu.value.mediaType || 'image',
        category_ids: [catId],
      })
      return
    }
    if (existing.category_ids.includes(catId)) await assetStore.removeTag(existing.id, catId)
    else await assetStore.addTag(existing.id, catId)
  }

  async function createCategoryAndTag(name: string) {
    const trimmed = name.trim()
    if (!trimmed || !tagMenu.value) return
    const cat = await assetStore.createCategory(trimmed)
    if (!cat || !tagMenu.value) return
    await toggleOutputTag(cat.id)
  }

  return {
    tagMenu,
    categories,
    tagMenuStyle,
    nameFromUrl,
    isSaved,
    openTagMenu,
    closeTagMenu,
    tagMenuHas,
    tagMenuIsUncategorized,
    setUncategorized,
    toggleOutputTag,
    createCategoryAndTag,
  }
}
