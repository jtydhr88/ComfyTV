import {
  setWidget,
  spawnAssetImageLoader,
  spawnFollowUpStage,
} from '@/composables/stages/spawnFollowUp'
import {
  computePickedImageUrl,
  imagePoolCount,
  isPoolPickerKind,
  removeImageFromPool,
  type ImagePickContext,
  type StageKind,
  type StageState,
  useStageStore,
} from '@/stores/stageStore'

type Store = ReturnType<typeof useStageStore>

export function createStageNodeActions(opts: {
  node: any
  state: StageState
  store: Store
  kind: StageKind
  applyPickedIndex: (idx: number) => void
}) {
  const { node, state, store, kind, applyPickedIndex } = opts

  const onDisconnect = (slotName: string) => {
    const idx = (node.inputs || []).findIndex((i: any) => i.name === slotName)
    if (idx < 0) return
    node.disconnectInput(idx)
  }

  const onAction = (actionId: string, context?: ImagePickContext) => {
    if (actionId === 'load-asset') {
      const url = context?.imageUrl
      if (url) void spawnAssetImageLoader(node, url, context?.label, context?.mediaType || 'image')
      return
    }
    if (actionId === 'model-capture-view') {
      const url = context?.imageUrl
      if (kind === 'model' && url) {
        setWidget(node, 'captured_image', url)
        store.setOutputSlot(state, 1, url)
      }
      return
    }
    if (actionId === 'clear-pool' && isPoolPickerKind(kind)) {
      store.clearPickerPool(node, state)
      return
    }
    if (actionId === 'remove-pool-item' && context && isPoolPickerKind(kind)) {
      const removedIndex = Number(context.index) || 0
      const merged = removeImageFromPool(state.pool, context.imageUrl ?? '')
      const count = imagePoolCount(merged)
      if (count === 0) {
        store.clearPickerPool(node, state)
        return
      }
      store.setPickerPool(node, state, merged)
      let idx = state.pickedIndex ?? 1
      if (removedIndex && removedIndex < idx) idx -= 1
      idx = Math.max(1, Math.min(count, idx))
      state.pickedIndex = idx
      setWidget(node, 'selected_index', idx)
      const out = computePickedImageUrl(state)
      if (out !== state.output) store.setOutputSlot(state, 0, out)
      return
    }
    if (actionId === 'pick-item' && context && (isPoolPickerKind(kind) || kind === 'image-batch')) {
      const newIdx = Number(context.index) || 1
      applyPickedIndex(newIdx)
      setWidget(node, 'selected_index', newIdx)
      return
    }
    spawnFollowUpStage(node, kind, actionId, context)
  }

  return { onAction, onDisconnect }
}
