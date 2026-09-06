import { watch } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { setWidget } from '@/composables/stages/spawnFollowUp'
import {
  useStageStore,
  computePickedImageUrl,
  computePickedFromBatch,
  imagePoolCount,
  nextPickerPool,
  toImagePoolJson,
  isPoolPickerKind,
  type StageKind,
  type StageVariant,
  type ImagePickContext,
} from '@/stores/stageStore'
import { useAssetStore } from '@/stores/assetStore'
import {
  validateNode as validateWorkflowInputs,
  applySlotWarnings,
  type SlotWarningMap,
} from '@/composables/stages/useWorkflowValidator'
import {
  prepareWorkflow,
  subscribePrepState,
} from '@/composables/stages/useWorkflowPrep'
import { getStageMeta } from '@/composables/stages/stageMeta'
import { addWorkflowUploadButton } from '@/composables/stages/workflowUpload'
import { releaseStageUid } from '@/composables/stages/stageIdentity'
import { createStageNodeActions } from '@/composables/stages/stageNodeActions'
import { bindOutputRestore } from '@/composables/stages/stageRestore'
import { createStageRun } from '@/composables/stages/stageRun'
import { bindStageWidgets } from '@/composables/stages/stageWidgetSync'
import { postPickedIndex } from '@/composables/stages/stageApi'
import { useSelectionStore } from '@/stores/selectionStore'
import { app } from '@/lib/comfyApp'

export interface UseStageNodeResult {
  state: ReturnType<ReturnType<typeof useStageStore>['registerStage']>
  onRunRequest: () => Promise<void>
  onCancelRequest: () => Promise<void>
  onDisconnect: (slotName: string) => void
  onAction: (actionId: string, context?: ImagePickContext) => void
  registerPreRun: (fn: () => unknown) => () => void
}

export function useStageNode(
  node: any,
  kind: StageKind,
  variant: StageVariant = 'generator',
): UseStageNodeResult {
  const store = useStageStore()
  const state = store.registerStage(node, kind, variant)

  const applyPickedIndex = (idx: number) => {
    state.pickedIndex = idx
    if (kind === 'image-batch') {
      const picked = computePickedFromBatch(toImagePoolJson(state.output), idx)
      store.setOutputSlot(state, 1, picked)
      if (state.outputId != null && state.outputId > 0) {
        void postPickedIndex(state.outputId, idx)
      }
    }
  }

  bindStageWidgets({ node, state, store, kind, variant, applyPickedIndex })

  const refresh = () => store.refreshStageInputs(node, state, app as any)

  const reValidate = () => {
    const assetStore = useAssetStore()
    assetStore.hydrate()
      .then(() => validateWorkflowInputs(node, kind, {
        assetExists: (id: number) => !!assetStore.byId(id),
      }))
      .then((map: SlotWarningMap) => {
        node._comfytvSlotWarnings = map
        applySlotWarnings(node)
        ;(app as any)?.graph?.setDirtyCanvas?.(true, true)
      })
  }

  const _selectionStore = useSelectionStore()
  const stopBindingsWatch = watch(
    () => _selectionStore.bindingsVersion,
    () => { if (variant === 'generator') queueMicrotask(reValidate) },
  )
  let _prepUnsub: (() => void) | null = null
  const meta = getStageMeta(node.comfyClass)
  const workflowKind = meta?.workflow_kind || null

  function triggerPrepForCurrentWorkflow(): void {
    if (!workflowKind) return
    const wfWidget = node.widgets?.find((w: any) => w.name === 'workflow')
    const label = wfWidget ? String(wfWidget.value ?? '') : ''
    if (!label) return
    _prepUnsub?.()
    _prepUnsub = subscribePrepState(workflowKind, label, (ps) => {
      state.preparingWorkflow = ps.busy
    })
    void prepareWorkflow(workflowKind, label).catch(() => { /* error already on state */ })
  }

  if (variant === 'generator') {
    const wfWidget = node.widgets?.find((w: any) => w.name === 'workflow')
    if (wfWidget) {
      const selectionStore = useSelectionStore()
      wfWidget.callback = useChainCallback(wfWidget.callback, () => {
        queueMicrotask(reValidate)
        queueMicrotask(triggerPrepForCurrentWorkflow)
        queueMicrotask(() => selectionStore.refreshFromCanvas())
        queueMicrotask(() => selectionStore.bumpBindings())
      })
      if (workflowKind) addWorkflowUploadButton(node, wfWidget, workflowKind)
    }
    queueMicrotask(triggerPrepForCurrentWorkflow)
  }

  store.setRefresher(node, refresh)
  node.onConnectionsChange = useChainCallback(node.onConnectionsChange, () => {
    queueMicrotask(refresh)
    queueMicrotask(() => store.notifyConsumers(state))
    if (variant === 'generator') queueMicrotask(reValidate)
  })

  queueMicrotask(refresh)
  if (variant === 'generator') queueMicrotask(reValidate)

  const stopTickWatch = watch(
    () => store.stateTick,
    () => { refresh() },
  )

  let lastMergedBatch = ''
  const stopPickerWatch = isPoolPickerKind(kind)
    ? watch(
        () => {
          const inp = state.inputs.find(i => i.slot === 'batch')
          return [inp?.source ?? '', inp?.content ?? '', state.pickedIndex ?? 0] as const
        },
        () => {
          const inp = state.inputs.find(i => i.slot === 'batch')

          if (inp && inp.source === 'upstream' && inp.content && inp.content !== lastMergedBatch) {
            lastMergedBatch = inp.content
            const appendW = node.widgets?.find((w: any) => w.name === 'append_results')
            const append = !appendW || appendW.value !== false
            const before = imagePoolCount(state.pool)
            const merged = nextPickerPool(state.pool, toImagePoolJson(inp.content), append)
            store.setPickerPool(node, state, merged)
            const added = imagePoolCount(merged) - before

            if (!append || added > 0) {
              state.pickedIndex = 1
              setWidget(node, 'selected_index', 1)
            }
          }
          const after: string | null = state.pool
            ? computePickedImageUrl(state)
            : (inp && inp.source === 'empty' ? null : computePickedImageUrl(state))
          if (after !== state.output) {
            store.setOutputSlot(state, 0, after)
          }
        },
        { immediate: true },
      )
    : null

  const run = createStageRun({ node, state, store, kind, variant, refresh })
  const { onAction, onDisconnect } = createStageNodeActions({ node, state, store, kind, applyPickedIndex })
  const stopRestore = bindOutputRestore({ node, state, store, kind, variant })

  node.onRemoved = useChainCallback(node.onRemoved, () => {
    stopTickWatch()
    stopPickerWatch?.()
    stopRestore()
    stopBindingsWatch()
    run.dispose()
    _prepUnsub?.()
    releaseStageUid(node)
    store.unregisterStage(node)
  })

  return {
    state,
    onRunRequest: run.onRunRequest,
    onCancelRequest: run.onCancelRequest,
    onDisconnect,
    onAction,
    registerPreRun: run.registerPreRun,
  }
}
