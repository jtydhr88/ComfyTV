import { useDebounceFn } from '@vueuse/core'
import { computed, getCurrentScope, onScopeDispose, type Ref, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Asset } from '@/api/schemas'
import {
  assetChipLabel,
  fetchImageSlotOptions,
  fetchImageSlotOptionsCached,
  type ImageSlotOption,
  nodeAcceptsAudioInput,
  nodeAcceptsAutogrowImages,
  nodeAcceptsAutogrowVideos,
  type RefSlotWarning,
  refSlotWarnings,
  wiredAudioSlots,
  wiredImageSlots,
  wiredVideoSlots,
  workflowRefOfNode,
} from '@/composables/stages/assetSlots'
import {
  type AssetRefType,
  type ImageRef,
  isBatchRef,
  readImageRefs,
  refKey,
  refType,
  subscribeImageRefs,
  writeImageRefs,
} from '@/composables/stages/imageRefs'
import { importAssetFiles } from '@/composables/sidebar/assetImport'
import { toastLoaderUploadFailed, useLoaderFileDrop } from '@/composables/stages/useLoaderFileDrop'
import { app, type LGraphNode } from '@/lib/comfyApp'
import { useAssetStore } from '@/stores/assetStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { usePinnedBatchStore } from '@/stores/pinnedBatchStore'
import { useProjectStore } from '@/stores/projectStore'

export interface BatchGroup {
  id: string
  label: string
  urls: string[]
  canRefresh: boolean
}

export interface SlotPickerState {
  index: number
  currentSlot: number | null
  x: number
  y: number
  loading: boolean
  error: string | null
  options: ImageSlotOption[]
  wiredSlots: number[]
  claimedSlots: number[]
}

export function useImageReferences(
  getNode: () => LGraphNode | undefined,
  rootEl: Ref<HTMLElement | null>,
  opts?: { forceTypes?: AssetRefType[] },
) {
  const { t } = useI18n()
  const assetStore = useAssetStore()
  const selectionStore = useSelectionStore()

  const refs = ref<ImageRef[]>(readImageRefs(getNode()))
  const stopRefSync = subscribeImageRefs(getNode(), () => {
    const current = readImageRefs(getNode())
    if (JSON.stringify(current) !== JSON.stringify(refs.value)) {
      refs.value = current
    }
  })
  if (getCurrentScope()) onScopeDispose(stopRefSync)
  const pickerOpen = ref(false)
  const slotPicker = ref<SlotPickerState | null>(null)
  const slotWarnings = ref<string[]>([])

  const acceptedTypes = computed<Record<AssetRefType, boolean>>(() =>
    opts?.forceTypes
      ? {
          image: opts.forceTypes.includes('image'),
          video: opts.forceTypes.includes('video'),
          audio: opts.forceTypes.includes('audio'),
        }
      : {
          image: nodeAcceptsAutogrowImages(getNode()),
          video: nodeAcceptsAutogrowVideos(getNode()),
          audio: nodeAcceptsAudioInput(getNode()),
        })
  const accepts = computed(() =>
    acceptedTypes.value.image || acceptedTypes.value.video || acceptedTypes.value.audio,
  )
  const acceptedMediaTypes = computed<string[]>(() =>
    (['image', 'video', 'audio'] as const).filter(k => acceptedTypes.value[k]),
  )

  const pinnedStore = usePinnedBatchStore()
  const projectStore = useProjectStore()
  const projectId = computed(() => projectStore.currentProjectId || '')

  const batchGroups = computed<BatchGroup[]>(() =>
    pinnedStore.list(projectId.value).map(b => ({
      id: b.id, label: b.label, urls: b.urls, canRefresh: !!b.source_uid,
    })),
  )

  function batchUrlOf(ref: ImageRef): string | null {
    if (!isBatchRef(ref) || !ref.batch_id) return null
    const urls = pinnedStore.byId(projectId.value, ref.batch_id)?.urls ?? []
    return urls[ref.batch_index!] ?? null
  }

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

  function assetOf(ref: ImageRef): Asset | undefined {
    return ref.asset_id != null ? assetStore.byId(ref.asset_id) : undefined
  }

  function assetLabel(ref: ImageRef): string {
    if (isBatchRef(ref)) {
      const item = t('imageRefs.batchItem', { n: (ref.batch_index ?? 0) + 1 })
      if (!ref.batch_id) return item
      const group = pinnedStore.byId(projectId.value, ref.batch_id)
      return group ? `${group.label} · ${item}` : item
    }
    return assetChipLabel(assetOf(ref), ref.asset_id!)
  }

  function tileTooltip(ref: ImageRef): string {
    return `${assetLabel(ref)} · ${t('promptAssets.slotShort', { n: ref.slot })}`
  }

  function nextFreeSlot(type: AssetRefType): number {
    const wired = type === 'video' ? wiredVideoSlots(getNode())
      : type === 'audio' ? wiredAudioSlots(getNode())
      : wiredImageSlots(getNode())
    const taken = new Set<number>([
      ...wired,
      ...refs.value.filter(r => refType(r) === type).map(r => r.slot),
    ])
    let i = 0
    while (taken.has(i)) i++
    return i
  }

  function setRefs(next: ImageRef[]) {
    refs.value = next
    writeImageRefs(getNode(), next)
    void scheduleSlotWarnings()
    selectionStore.bumpBindings()
  }

  function onAddAsset(asset: Asset) {
    const type: AssetRefType =
      asset.media_type === 'video' ? 'video'
      : asset.media_type === 'audio' ? 'audio'
      : 'image'
    if (!acceptedTypes.value[type]) return
    if (refs.value.some(r => r.asset_id === asset.id && refType(r) === type)) return
    const entry: ImageRef = type === 'image'
      ? { asset_id: asset.id, slot: nextFreeSlot(type) }
      : { asset_id: asset.id, slot: nextFreeSlot(type), type }
    setRefs([...refs.value, entry])
  }

  function onAddBatchImage(groupId: string, index: number) {
    if (!acceptedTypes.value.image) return
    if (refs.value.some(r => r.batch_index === index && r.batch_id === groupId)) return
    setRefs([...refs.value, { batch_index: index, batch_id: groupId, slot: nextFreeSlot('image') }])
  }

  async function importFiles(files: File[]): Promise<void> {
    try {
      const created = await importAssetFiles(files)
      for (const asset of created) onAddAsset(asset)
    } catch (e) {
      console.error('[ComfyTV/image-refs] import failed', e)
      toastLoaderUploadFailed(e)
    }
  }

  const fileDrop = useLoaderFileDrop({
    kind: () => 'image',
    onAsset: onAddAsset,
    onFiles: importFiles,
  })

  function removeRef(index: number) {
    setRefs(refs.value.filter((_, i) => i !== index))
  }

  function openSlotPicker(index: number, e: MouseEvent) {
    const target = refs.value[index]
    if (!target) return
    const type = refType(target)
    const rootRect = rootEl.value?.getBoundingClientRect()
    if (!rootRect) return
    const tile = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = Math.max(0, Math.min(tile.left - rootRect.left, rootRect.width - 260))
    const y = tile.bottom - rootRect.top + 4

    const wired = type === 'video' ? wiredVideoSlots(getNode())
      : type === 'audio' ? wiredAudioSlots(getNode())
      : wiredImageSlots(getNode())

    slotPicker.value = {
      index,
      currentSlot: target.slot ?? null,
      x, y,
      loading: true,
      error: null,
      options: [],
      wiredSlots: wired,
      claimedSlots: refs.value
        .filter((r, i) => i !== index && refType(r) === type)
        .map(r => r.slot),
    }

    if (type === 'video' || type === 'audio') {
      const slots = type === 'video' ? [0, 1, 2, 3] : [0, 1, 2]
      Object.assign(slotPicker.value, {
        loading: false,
        options: slots.map(slot => ({ slot, nodeTitles: [] })),
      })
      return
    }

    const wf = workflowRefOfNode(getNode())
    if (!wf) {
      slotPicker.value.loading = false
      return
    }
    fetchImageSlotOptions(wf.kind, wf.label)
      .then((options) => {
        if (slotPicker.value?.index === index) Object.assign(slotPicker.value, { loading: false, options })
      })
      .catch((err) => {
        if (slotPicker.value?.index === index) {
          Object.assign(slotPicker.value, { loading: false, error: String(err?.message || err) })
        }
      })
  }

  function onSlotPick(slot: number) {
    const picker = slotPicker.value
    slotPicker.value = null
    if (!picker) return
    const next = refs.value.slice()
    if (!next[picker.index]) return
    next[picker.index] = { ...next[picker.index], slot }
    setRefs(next)
  }

  function closeSlotPicker() {
    slotPicker.value = null
  }

  let warningsSeq = 0

  function warningMessage(w: RefSlotWarning): string {
    switch (w.kind) {
      case 'duplicate': return t('imageRefs.warnDuplicate', { n: w.slot })
      case 'override':  return t('imageRefs.warnOverride', { n: w.slot })
      case 'overflow':  return t('imageRefs.warnOverflow', { count: w.count, total: w.total })
      case 'noSlots':   return t('imageRefs.warnNoSlots')
    }
  }

  async function recomputeSlotWarnings() {
    const seq = ++warningsSeq
    const list = refs.value.filter(r => refType(r) === 'image')
    if (list.length === 0) {
      slotWarnings.value = []
      return
    }
    const wired = wiredImageSlots(getNode())

    let options: ImageSlotOption[] | null = null
    const wf = workflowRefOfNode(getNode())
    if (wf) {
      try {
        options = await fetchImageSlotOptionsCached(wf.kind, wf.label)
      } catch {
        options = null
      }
    }
    if (seq !== warningsSeq) return
    slotWarnings.value = refSlotWarnings(list, wired, options).map(warningMessage)
  }

  const scheduleSlotWarnings = useDebounceFn(() => void recomputeSlotWarnings(), 300)

  watch(() => selectionStore.bindingsVersion, () => void scheduleSlotWarnings())

  function init() {
    assetStore.ensureHydrated()
    void scheduleSlotWarnings()
  }

  return {
    refs,
    accepts,
    acceptedMediaTypes,
    batchGroups,
    batchUrlOf,
    onRefreshBatch,
    onUnpinBatch,
    pickerOpen,
    slotPicker,
    slotWarnings,
    assetOf,
    assetLabel,
    tileTooltip,
    onAddAsset,
    onAddBatchImage,
    importFiles,
    fileDrop,
    removeRef,
    openSlotPicker,
    onSlotPick,
    closeSlotPicker,
    init,
  }
}
