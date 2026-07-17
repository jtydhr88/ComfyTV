import { computed, onMounted, ref } from 'vue'

import type { Asset } from '@/api/schemas'
import type { LGraphNode } from '@/lib/comfyApp'
import { importAssetFiles } from '@/composables/sidebar/assetImport'
import { toastLoaderUploadFailed, useLoaderFileDrop } from '@/composables/stages/useLoaderFileDrop'
import { type AssetCategoryFilter, useAssetStore } from '@/stores/assetStore'
import { useStageStore, type StageState } from '@/stores/stageStore'
import { getWidget, readWidgetStr, writeWidget } from '@/utils/widget'

export type LoaderMediaType = 'image' | 'video' | 'audio' | 'model'

export function loaderMediaTypeOf(kind: string): LoaderMediaType {
  return kind === 'video' ? 'video'
    : kind === 'audio' ? 'audio'
    : kind === 'model' ? 'model'
    : 'image'
}

export function parseCategoryFilter(raw: string): AssetCategoryFilter {
  if (raw === 'all' || raw === 'none') return raw
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 'all'
}

export function assetTooltipOf(asset: Asset): string {
  const dims = asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''
  return `${asset.name || '—'}${dims}`
}

export function useAssetLoaderCard(node: LGraphNode, getState: () => StageState) {
  const store = useAssetStore()
  const stageStore = useStageStore()

  const mediaType = computed<LoaderMediaType>(() => loaderMediaTypeOf(getState().kind))

  const activeFilter = ref<AssetCategoryFilter>('all')
  const selectedId = ref<number | null>(null)

  const visibleAssets = computed(() =>
    store.listByCategory(activeFilter.value).filter(a => a.media_type === mediaType.value))

  function mediaCount(filter: AssetCategoryFilter): number {
    return store.listByCategory(filter).filter(a => a.media_type === mediaType.value).length
  }

  const selectedAsset = computed(() =>
    selectedId.value != null ? store.byId(selectedId.value) ?? null : null)

  function setFilter(f: AssetCategoryFilter): void {
    activeFilter.value = f
    writeWidget(node, 'category', String(f))
  }

  function selectAsset(asset: Asset): void {
    selectedId.value = asset.id
    writeWidget(node, 'asset_url', asset.payload_url)
    writeWidget(node, 'asset_id', asset.id)
    stageStore.setOutputSlot(getState(), 0, asset.payload_url)
  }

  const fileDrop = useLoaderFileDrop({
    kind: () => mediaType.value,
    onAsset: selectAsset,
    onFiles: async (files) => {
      try {
        const created = await importAssetFiles(files, {
          categoryIds: typeof activeFilter.value === 'number' ? [activeFilter.value] : [],
        })
        const last = created[created.length - 1]
        if (last) selectAsset(last)
      } catch (e) {
        console.error('[ComfyTV/asset-loader] drop import failed', e)
        toastLoaderUploadFailed(e)
      }
    },
  })

  onMounted(async () => {
    store.ensureHydrated()
    store.installWebSocketSync()
    await store.hydrate()

    activeFilter.value = parseCategoryFilter(readWidgetStr(node, 'category', 'all'))

    const savedId = Number(getWidget(node, 'asset_id')?.value)
    const savedUrl = readWidgetStr(node, 'asset_url', '')
    const match = Number.isFinite(savedId) && savedId > 0
      ? store.byId(savedId)
      : (savedUrl ? store.byPayloadUrl(savedUrl) : undefined)

    if (match) {
      selectedId.value = match.id
      if (match.payload_url !== savedUrl) writeWidget(node, 'asset_url', match.payload_url)
      stageStore.setOutputSlot(getState(), 0, match.payload_url)
    } else if (savedUrl) {
      stageStore.setOutputSlot(getState(), 0, savedUrl)
    }
  })

  return {
    store,
    mediaType,
    activeFilter,
    selectedId,
    visibleAssets,
    mediaCount,
    selectedAsset,
    setFilter,
    selectAsset,
    fileDrop,
  }
}
