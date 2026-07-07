import { useDebounceFn } from '@vueuse/core'
import { computed, type Ref, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Asset } from '@/api/schemas'
import {
  assetChipLabel,
  fetchImageSlotOptions,
  fetchImageSlotOptionsCached,
  type ImageSlotOption,
  nodeAcceptsAutogrowImages,
  type RefSlotWarning,
  refSlotWarnings,
  wiredImageSlots,
  workflowRefOfNode,
} from '@/composables/stages/assetSlots'
import {
  type ImageRef,
  readImageRefs,
  writeImageRefs,
} from '@/composables/stages/imageRefs'
import type { LGraphNode } from '@/lib/comfyApp'
import { useAssetStore } from '@/stores/assetStore'
import { useSelectionStore } from '@/stores/selectionStore'

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
) {
  const { t } = useI18n()
  const assetStore = useAssetStore()
  const selectionStore = useSelectionStore()

  const refs = ref<ImageRef[]>(readImageRefs(getNode()))
  const pickerOpen = ref(false)
  const slotPicker = ref<SlotPickerState | null>(null)
  const slotWarnings = ref<string[]>([])

  const accepts = computed(() => nodeAcceptsAutogrowImages(getNode()))

  function assetOf(ref: ImageRef): Asset | undefined {
    return assetStore.byId(ref.asset_id)
  }

  function assetLabel(ref: ImageRef): string {
    return assetChipLabel(assetOf(ref), ref.asset_id)
  }

  function tileTooltip(ref: ImageRef): string {
    return `${assetLabel(ref)} · ${t('promptAssets.slotShort', { n: ref.slot })}`
  }

  function nextFreeSlot(): number {
    const taken = new Set<number>([
      ...wiredImageSlots(getNode()),
      ...refs.value.map(r => r.slot).filter((s): s is number => s != null),
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
    if (refs.value.some(r => r.asset_id === asset.id)) return
    setRefs([...refs.value, { asset_id: asset.id, slot: nextFreeSlot() }])
  }

  function removeRef(index: number) {
    setRefs(refs.value.filter((_, i) => i !== index))
  }

  function openSlotPicker(index: number, e: MouseEvent) {
    const rootRect = rootEl.value?.getBoundingClientRect()
    if (!rootRect) return
    const tile = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = Math.max(0, Math.min(tile.left - rootRect.left, rootRect.width - 260))
    const y = tile.bottom - rootRect.top + 4

    const wired = wiredImageSlots(getNode())

    slotPicker.value = {
      index,
      currentSlot: refs.value[index]?.slot ?? null,
      x, y,
      loading: true,
      error: null,
      options: [],
      wiredSlots: wired,
      claimedSlots: refs.value
        .filter((_, i) => i !== index)
        .map(r => r.slot),
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
    const list = refs.value
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
    pickerOpen,
    slotPicker,
    slotWarnings,
    assetOf,
    assetLabel,
    tileTooltip,
    onAddAsset,
    removeRef,
    openSlotPicker,
    onSlotPick,
    closeSlotPicker,
    init,
  }
}
