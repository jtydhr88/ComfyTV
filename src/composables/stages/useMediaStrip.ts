import { useDebounceFn } from '@vueuse/core'
import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Asset } from '@/api/schemas'
import {
  assetChipLabel,
  fetchImageSlotOptionsCached,
  fetchWorkflowMetaCached,
  type ImageSlotOption,
  type MediaBindingWarning,
  mediaBindingWarnings,
  workflowRefOfNode,
} from '@/composables/stages/assetSlots'
import { slotColor } from '@/composables/stages/imageSlotMentions'
import {
  assetEntry,
  batchEntry,
  type MediaEntry,
  type MediaType,
  MEDIA_TYPES,
  nodeAcceptsMedia,
  readMediaTable,
  subscribeMediaTable,
} from '@/composables/stages/mediaOrder'
import {
  appendMediaEntry,
  mediaEntrySourceNode,
  mediaEntryUrl,
  moveMediaEntry,
  removeMediaEntry,
} from '@/composables/stages/mediaOrderSync'
import { importAssetFiles } from '@/composables/sidebar/assetImport'
import { toastLoaderUploadFailed, useLoaderFileDrop } from '@/composables/stages/useLoaderFileDrop'
import { app, type LGraphNode } from '@/lib/comfyApp'
import { useAssetStore } from '@/stores/assetStore'
import { usePinnedBatchStore } from '@/stores/pinnedBatchStore'
import { useProjectStore } from '@/stores/projectStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { useStageStore } from '@/stores/stageStore'

export interface BatchGroup {
  id: string
  label: string
  urls: string[]
  canRefresh: boolean
}

export interface StripItem {
  type: MediaType
  position: number
  index: number
  entry: MediaEntry
  url: string | null
  label: string
  color: string
  pending: boolean
}

export function useMediaStrip(
  getNode: () => LGraphNode | undefined,
  opts?: { types?: MediaType[] },
) {
  const { t } = useI18n()
  const assetStore = useAssetStore()
  const selectionStore = useSelectionStore()
  const stageStore = useStageStore()
  const pinnedStore = usePinnedBatchStore()
  const projectStore = useProjectStore()
  const projectId = computed(() => projectStore.currentProjectId || '')

  const version = ref(0)
  const stopSync = subscribeMediaTable(getNode(), () => { version.value++ })
  if (getCurrentScope()) onScopeDispose(stopSync)

  const acceptedTypes = computed<Record<MediaType, boolean>>(() => {
    const node = getNode()
    const forced = opts?.types
    return {
      image: forced ? forced.includes('image') : nodeAcceptsMedia(node, 'image'),
      video: forced ? forced.includes('video') : nodeAcceptsMedia(node, 'video'),
      audio: forced ? forced.includes('audio') : nodeAcceptsMedia(node, 'audio'),
    }
  })
  const accepts = computed(() => MEDIA_TYPES.some(k => acceptedTypes.value[k]))
  const acceptedMediaTypes = computed<string[]>(() =>
    MEDIA_TYPES.filter(k => acceptedTypes.value[k]))

  function entryLabel(entry: MediaEntry, type: MediaType): string {
    if (entry.src === 'link') {
      const src = mediaEntrySourceNode(getNode(), entry)
      const title = src?.title || src?.comfyClass || ''
      return title ? t('mediaStrip.wiredFrom', { title }) : t('mediaStrip.wired')
    }
    if (entry.src === 'batch') {
      const item = t('imageRefs.batchItem', { n: entry.batch_index! + 1 })
      const group = pinnedStore.byId(projectId.value, entry.batch_id!)
      return group ? `${group.label} · ${item}` : item
    }
    return assetChipLabel(assetStore.byId(entry.asset_id!), entry.asset_id!)
  }

  const items = computed<StripItem[]>(() => {
    void version.value
    void selectionStore.bindingsVersion
    const node = getNode()
    const table = readMediaTable(node)
    const state = node ? stageStore.getStage(node) : undefined
    void state?.inputs
    const out: StripItem[] = []
    for (const type of MEDIA_TYPES) {
      if (!acceptedTypes.value[type]) continue
      table[type].forEach((entry, index) => {
        const url = mediaEntryUrl(node, entry)
        out.push({
          type,
          position: index + 1,
          index,
          entry,
          url,
          label: `${t(`mention.${type}Expand`, { n: index + 1 })} · ${entryLabel(entry, type)}`,
          color: slotColor(index + 1),
          pending: entry.src === 'link' && !url,
        })
      })
    }
    return out
  })

  const addedIds = computed(() =>
    items.value.map(it => it.entry.asset_id).filter((id): id is number => id != null))
  const addedBatchKeys = computed(() =>
    items.value.filter(it => it.entry.src === 'batch')
      .map(it => `${it.entry.batch_id}:${it.entry.batch_index}`))

  const batchGroups = computed<BatchGroup[]>(() =>
    pinnedStore.list(projectId.value).map(b => ({
      id: b.id, label: b.label, urls: b.urls, canRefresh: !!b.source_uid,
    })),
  )

  function onRefreshBatch(id: string) {
    const ok = pinnedStore.refresh(projectId.value, id, app as any)
    if (!ok) {
      ;(app as any)?.extensionManager?.toast?.add?.({
        severity: 'warn',
        summary: t('imageRefs.refreshFailed'),
        life: 4000,
      })
    }
  }

  function onUnpinBatch(id: string) {
    pinnedStore.unpin(projectId.value, id)
  }

  function onAddAsset(asset: Asset) {
    const type: MediaType =
      asset.media_type === 'video' ? 'video'
      : asset.media_type === 'audio' ? 'audio'
      : 'image'
    if (!acceptedTypes.value[type]) return
    appendMediaEntry(getNode(), type, assetEntry(asset.id))
    void scheduleWarnings()
  }

  function onAddBatchImage(groupId: string, index: number) {
    if (!acceptedTypes.value.image) return
    appendMediaEntry(getNode(), 'image', batchEntry(groupId, index))
    void scheduleWarnings()
  }

  async function importFiles(files: File[]): Promise<void> {
    try {
      const created = await importAssetFiles(files)
      for (const asset of created) onAddAsset(asset)
    } catch (e) {
      console.error('[ComfyTV/media-strip] import failed', e)
      toastLoaderUploadFailed(e)
    }
  }

  const fileDrop = useLoaderFileDrop({
    kind: () => 'image',
    onAsset: onAddAsset,
    onFiles: importFiles,
  })

  function remove(item: StripItem) {
    removeMediaEntry(getNode(), item.type, item.index)
    void scheduleWarnings()
  }

  function move(type: MediaType, from: number, to: number) {
    moveMediaEntry(getNode(), type, from, to)
  }

  const warnings = ref<string[]>([])
  let warningsSeq = 0

  function warningMessage(w: MediaBindingWarning): string {
    switch (w.kind) {
      case 'overflow': return t('imageRefs.warnOverflow', { count: w.count, total: w.total })
      case 'noSlots':  return t('imageRefs.warnNoSlots')
    }
  }

  async function recomputeWarnings() {
    const seq = ++warningsSeq
    const count = readMediaTable(getNode()).image.filter(e => e.src !== 'link').length
    if (count === 0) {
      warnings.value = []
      return
    }
    let options: ImageSlotOption[] | null = null
    const wf = workflowRefOfNode(getNode())
    if (wf) {
      try {
        options = await fetchImageSlotOptionsCached(wf.kind, wf.label)
        if (options.length === 0) {
          const meta = await fetchWorkflowMetaCached(wf.kind, wf.label)
          if (meta.mention_style != null) options = null
        }
      } catch {
        options = null
      }
    }
    if (seq !== warningsSeq) return
    const total = readMediaTable(getNode()).image.length
    warnings.value = mediaBindingWarnings(total, options).map(warningMessage)
  }

  const scheduleWarnings = useDebounceFn(() => void recomputeWarnings(), 300)

  watch(() => selectionStore.bindingsVersion, () => void scheduleWarnings())

  function init() {
    assetStore.ensureHydrated()
    void scheduleWarnings()
  }

  return {
    items,
    accepts,
    acceptedTypes,
    acceptedMediaTypes,
    addedIds,
    addedBatchKeys,
    batchGroups,
    onRefreshBatch,
    onUnpinBatch,
    onAddAsset,
    onAddBatchImage,
    importFiles,
    fileDrop,
    remove,
    move,
    warnings,
    init,
  }
}
