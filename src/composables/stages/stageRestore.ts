import { watch } from 'vue'

import { ensureStageUid, stageClassName } from '@/composables/stages/stageIdentity'
import { outputTypeForKind } from '@/composables/stages/stageOutputType'
import { useProjectStore } from '@/stores/projectStore'
import {
  computePickedFromBatch,
  isPoolPickerKind,
  toImagePoolJson,
  type StageKind,
  type StageState,
  type StageVariant,
  useStageStore,
} from '@/stores/stageStore'

type Store = ReturnType<typeof useStageStore>

export function bindOutputRestore(opts: {
  node: any
  state: StageState
  store: Store
  kind: StageKind
  variant: StageVariant
}): () => void {
  const { node, state, store, kind, variant } = opts
  const projectStore = useProjectStore()
  const projectIdWidget = node.widgets?.find((w: any) => w.name === 'project_id')

  if (projectIdWidget) {
    projectIdWidget.value = projectStore.currentProjectId
  }

  const stopProjectWatch = watch(
    () => projectStore.currentProjectId,
    (newId) => {
      if (projectIdWidget) projectIdWidget.value = newId
      void restoreLatestOutput(newId)
    },
  )

  const stopTagWatch = watch(
    () => state.outputId,
    (oid) => {
      if (oid && oid > 0) {
        void projectStore.tagOutputStageUid(Number(oid), ensureStageUid(node))
      }
    },
  )

  function applyRestoredOutput(latest: any) {
    const pj = latest.payload_json
    const restored = latest.payload_url
      ? String(latest.payload_url)
      : typeof pj === 'string'
        ? pj
        : (pj != null ? JSON.stringify(pj) : '')
    if (latest.id != null && state.outputId !== latest.id) {
      state.outputId = Number(latest.id)
    }
    state.durationMs = latest.duration_ms != null ? Number(latest.duration_ms) : null
    if (restored && restored !== state.output) {
      store.setOutputSlot(state, 0, restored)
    }
    if (kind === 'image-batch' && restored) {
      const widget = node.widgets?.find((wi: any) => wi.name === 'selected_index')
      const fromDb = Number(latest.picked_index)
      const fromWidget = Number(widget?.value)
      const idx = Number.isFinite(fromDb) && fromDb >= 1 ? Math.floor(fromDb)
                : Number.isFinite(fromWidget) && fromWidget >= 1 ? Math.floor(fromWidget)
                : 1
      state.pickedIndex = idx
      if (widget && widget.value !== idx) widget.value = idx
      const picked = computePickedFromBatch(toImagePoolJson(restored), idx)
      store.setOutputSlot(state, 1, picked ?? null)
    }
  }

  let adoptionTried = false
  async function restoreLatestOutput(projectId: string) {
    if (variant === 'loader') return
    if (isPoolPickerKind(kind)) return
    if (!node.id || node.id < 0) return
    const uid = ensureStageUid(node)
    try {
      let latest = await projectStore.fetchLatestOutput(projectId, uid, outputTypeForKind(kind))

      if (!latest && node.__comfytvFromSave && !adoptionTried) {
        adoptionTried = true
        latest = await projectStore.adoptOutputs(
          projectId, String(node.id), stageClassName(node), uid, outputTypeForKind(kind),
        )
      }
      if (!latest) {
        if (state.output != null) {
          store.setOutputSlot(state, 0, null)
          if (state.outputs.length > 1) state.outputs[1] = null
        }
        return
      }

      applyRestoredOutput(latest)
    } catch (e) {
      console.warn(`[ComfyTV/stage] restoreLatestOutput failed for node ${node.id}`, e)
    }
  }

  let restoreAttempts = 0
  const attemptRestore = () => {
    if (node.id != null && node.id >= 0) {
      void restoreLatestOutput(projectStore.currentProjectId)
      return
    }
    if (++restoreAttempts < 20) {
      setTimeout(attemptRestore, 80)
    }
  }
  queueMicrotask(attemptRestore)

  return () => {
    stopProjectWatch()
    stopTagWatch()
  }
}
