import { watch } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { claimStageUid } from '@/composables/stages/stageIdentity'
import {
  isPoolPickerKind,
  type StageKind,
  type StageState,
  type StageVariant,
  useStageStore,
} from '@/stores/stageStore'

type Store = ReturnType<typeof useStageStore>

function inputFileUrl(value: string): string {
  if (!value) return ''
  const slash = value.lastIndexOf('/')
  const subfolder = slash >= 0 ? value.slice(0, slash) : ''
  const filename = slash >= 0 ? value.slice(slash + 1) : value
  const params = new URLSearchParams({ filename, type: 'input' })
  if (subfolder) params.set('subfolder', subfolder)
  return `/view?${params.toString()}`
}

export function bindStageWidgets(opts: {
  node: any
  state: StageState
  store: Store
  kind: StageKind
  variant: StageVariant
  applyPickedIndex: (idx: number) => void
}): void {
  const { node, state, store, kind, variant, applyPickedIndex } = opts

  const usesStageUid = variant !== 'loader' && !isPoolPickerKind(kind)
  if (usesStageUid) {
    claimStageUid(node)
    node.onConfigure = useChainCallback(node.onConfigure, () => {
      claimStageUid(node)
    })
  }

  if (variant === 'generator') {
    const promptWidget = node.widgets?.find((w: any) => w.name === 'main_prompt')
    if (promptWidget) {
      state.mainPrompt = String(promptWidget.value ?? '')
      promptWidget.callback = useChainCallback(promptWidget.callback, () => {
        state.mainPrompt = String(promptWidget.value ?? '')
      })
    }

    if (isPoolPickerKind(kind) || kind === 'image-batch') {
      const idxWidget = node.widgets?.find((w: any) => w.name === 'selected_index')
      if (idxWidget) {
        const initial = Number(idxWidget.value)
        const safe = Number.isFinite(initial) && initial >= 1 ? Math.floor(initial) : 1
        if (idxWidget.value !== safe) idxWidget.value = safe
        state.pickedIndex = safe
        idxWidget.callback = useChainCallback(idxWidget.callback, () => {
          const idx = Number(idxWidget.value) || 1
          if (idx === state.pickedIndex) return
          applyPickedIndex(idx)
        })
      }
    }

    if (isPoolPickerKind(kind)) {
      const poolWidget = node.widgets?.find((w: any) => w.name === 'pool')
      state.pool = poolWidget ? (String(poolWidget.value ?? '') || null) : null
    }
    return
  }

  if (variant !== 'loader') return

  const recipeWidget = node.widgets?.find((w: any) => w.name === 'recipe')
  if (recipeWidget) {
    const kindWidget = node.widgets?.find((w: any) => w.name === 'kind')
    const sync = () => {
      const raw = String(recipeWidget.value ?? '').trim()
      if (!raw) {
        store.setOutputSlot(state, 0, null)
        return
      }
      let params: Record<string, unknown> = {}
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') params = parsed as Record<string, unknown>
      } catch {
        params = {}
      }
      const primKind = String(kindWidget?.value ?? 'cube')
      store.setOutputSlot(state, 0, JSON.stringify({ __prim__: { kind: primKind, ...params } }))
    }
    sync()
    recipeWidget.callback = useChainCallback(recipeWidget.callback, sync)
    if (kindWidget) kindWidget.callback = useChainCallback(kindWidget.callback, sync)
  } else if (kind === 'text') {
    const textWidget = node.widgets?.find((w: any) => w.name === 'text')
    const promptWidget = node.widgets?.find((w: any) => w.name === 'main_prompt')
    const sync = () => {
      const v = String(promptWidget?.value ?? '').trim() || String(textWidget?.value ?? '')
      store.setOutputSlot(state, 0, v ? v : null)
    }
    sync()
    if (textWidget) textWidget.callback = useChainCallback(textWidget.callback, sync)
    if (promptWidget) promptWidget.callback = useChainCallback(promptWidget.callback, sync)
    watch(() => state.mainPrompt, sync)
  } else {
    const widgetName = kind === 'image' ? 'image'
                     : kind === 'video' ? 'video'
                     : kind === 'audio' ? 'audio'
                     : kind === 'model' ? 'model'
                     : null
    const uploadWidget = widgetName
      ? node.widgets?.find((w: any) => w.name === widgetName)
      : null
    if (uploadWidget) {
      const sync = () => {
        const v = String(uploadWidget.value ?? '')
        store.setOutputSlot(state, 0, v ? inputFileUrl(v) : null)
      }
      sync()
      uploadWidget.callback = useChainCallback(uploadWidget.callback, sync)
    }
  }
}
