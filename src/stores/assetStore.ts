import { defineStore } from 'pinia'
import { ref } from 'vue'

import { apiFetch, apiSend } from '@/api'
import {
  type Asset,
  type AssetCategory,
  DeleteAssetSchema,
  ListAssetCategoriesSchema,
  ListAssetsSchema,
  MutateAssetCategorySchema,
  MutateAssetSchema,
} from '@/api/schemas'
import { app } from '@/lib/comfyApp'

export type AssetCategoryFilter = 'all' | 'none' | number

export interface CreateAssetOpts {
  name: string
  payload_url: string
  media_type?: string
  category_ids?: number[]
  mime_type?: string | null
  width?: number | null
  height?: number | null
  size_bytes?: number | null
  source?: string | null
  metadata?: Record<string, unknown>
}

export const useAssetStore = defineStore('assets', () => {
  const categories = ref<AssetCategory[]>([])
  const assets = ref<Asset[]>([])

  let hydrating: 'in-flight' | 'fetched' | null = null
  let hydratePromise: Promise<void> | null = null
  let wsInstalled = false

  function _hydrate(): Promise<void> {
    if (hydrating === 'fetched') return Promise.resolve()
    if (hydrating === 'in-flight' && hydratePromise) return hydratePromise
    hydrating = 'in-flight'
    hydratePromise = (async () => {
      try {
        const [cats, rows] = await Promise.all([
          apiFetch('/comfytv/asset_categories', ListAssetCategoriesSchema),
          apiFetch('/comfytv/assets?category=all', ListAssetsSchema),
        ])
        categories.value = cats.categories
        assets.value = rows.assets
        hydrating = 'fetched'
      } catch (e) {
        console.warn('[ComfyTV/assets] hydrate failed', e)
        hydrating = null
      } finally {
        hydratePromise = null
      }
    })()
    return hydratePromise
  }

  function ensureHydrated(): void {
    if (!hydrating) void _hydrate()
  }

  function hydrate(): Promise<void> {
    return _hydrate()
  }

  async function refresh(): Promise<void> {
    hydrating = null
    await _hydrate()
  }

  function byId(id: number): Asset | undefined {
    return assets.value.find(a => a.id === id)
  }

  function byPayloadUrl(url: string): Asset | undefined {
    return assets.value.find(a => a.payload_url === url)
  }

  function listByCategory(filter: AssetCategoryFilter): Asset[] {
    if (filter === 'all') return assets.value
    if (filter === 'none') return assets.value.filter(a => a.category_ids.length === 0)
    return assets.value.filter(a => a.category_ids.includes(filter))
  }

  function countByCategory(filter: AssetCategoryFilter): number {
    return listByCategory(filter).length
  }

  async function createCategory(name: string): Promise<AssetCategory | null> {
    if (!name.trim()) return null
    try {
      const data = await apiSend(
        '/comfytv/asset_categories', 'POST', MutateAssetCategorySchema,
        { name: name.trim() },
      )
      categories.value = [...categories.value, data.category]
        .sort((a, b) => a.name.localeCompare(b.name))
      return data.category
    } catch (e) {
      console.warn('[ComfyTV/assets] create category failed', name, e)
      return null
    }
  }

  async function renameCategory(id: number, name: string): Promise<AssetCategory | null> {
    if (!name.trim()) return null
    try {
      const data = await apiSend(
        `/comfytv/asset_categories/${id}`, 'PATCH', MutateAssetCategorySchema,
        { name: name.trim() },
      )
      categories.value = categories.value
        .map(c => (c.id === id ? data.category : c))
        .sort((a, b) => a.name.localeCompare(b.name))
      return data.category
    } catch (e) {
      console.warn('[ComfyTV/assets] rename category failed', id, e)
      return null
    }
  }

  async function removeCategory(id: number): Promise<boolean> {
    try {
      await apiSend(`/comfytv/asset_categories/${id}`, 'DELETE', DeleteAssetSchema)
      categories.value = categories.value.filter(c => c.id !== id)
      assets.value = assets.value.map(a =>
        a.category_ids.includes(id)
          ? { ...a, category_ids: a.category_ids.filter(c => c !== id) }
          : a,
      )
      return true
    } catch (e) {
      console.warn('[ComfyTV/assets] delete category failed', id, e)
      return false
    }
  }

  async function create(opts: CreateAssetOpts): Promise<Asset | null> {
    try {
      const data = await apiSend('/comfytv/assets', 'POST', MutateAssetSchema, opts)
      assets.value = [data.asset, ...assets.value]
      return data.asset
    } catch (e) {
      console.warn('[ComfyTV/assets] create failed', opts.name, e)
      return null
    }
  }

  async function rename(id: number, name: string): Promise<Asset | null> {
    try {
      const data = await apiSend(
        `/comfytv/assets/${id}`, 'PATCH', MutateAssetSchema, { name },
      )
      assets.value = assets.value.map(a => (a.id === id ? data.asset : a))
      return data.asset
    } catch (e) {
      console.warn('[ComfyTV/assets] rename failed', id, e)
      return null
    }
  }

  async function addTag(id: number, categoryId: number): Promise<Asset | null> {
    try {
      const data = await apiSend(
        `/comfytv/assets/${id}/categories/${categoryId}`, 'POST', MutateAssetSchema,
      )
      assets.value = assets.value.map(a => (a.id === id ? data.asset : a))
      return data.asset
    } catch (e) {
      console.warn('[ComfyTV/assets] add tag failed', id, categoryId, e)
      return null
    }
  }

  async function removeTag(id: number, categoryId: number): Promise<Asset | null> {
    try {
      const data = await apiSend(
        `/comfytv/assets/${id}/categories/${categoryId}`, 'DELETE', MutateAssetSchema,
      )
      assets.value = assets.value.map(a => (a.id === id ? data.asset : a))
      return data.asset
    } catch (e) {
      console.warn('[ComfyTV/assets] remove tag failed', id, categoryId, e)
      return null
    }
  }

  async function remove(id: number): Promise<void> {
    assets.value = assets.value.filter(a => a.id !== id)
    try {
      await apiSend(`/comfytv/assets/${id}`, 'DELETE', DeleteAssetSchema)
    } catch (e) {
      console.warn('[ComfyTV/assets] delete failed', id, e)
    }
  }

  function installWebSocketSync(): void {
    if (wsInstalled) return
    const api = (app as any)?.api
    if (!api?.addEventListener) return
    wsInstalled = true
    api.addEventListener('comfytv-assets', () => {
      void refresh()
    })
  }

  return {
    categories,
    assets,
    ensureHydrated,
    hydrate,
    refresh,
    byId,
    byPayloadUrl,
    listByCategory,
    countByCategory,
    createCategory,
    renameCategory,
    removeCategory,
    create,
    rename,
    addTag,
    removeTag,
    remove,
    installWebSocketSync,
  }
})
