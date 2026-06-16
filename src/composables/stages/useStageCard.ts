import { computed, ref, watch } from 'vue'

import { type ImagePreset } from '@/composables/stages/imagePresets'
import { ACTIONS_BY_KIND, type StageAction } from '@/composables/stages/stageActions'
import {
  type ImagePickContext,
  type InputSource,
  type StageState,
} from '@/stores/stageStore'

export function formatSlot(slot: string): string {
  const dot = slot.indexOf('.')
  if (dot < 0) return slot
  const tail = slot.slice(dot + 1)
  const m = tail.match(/^([a-zA-Z_]+)(\d+)$/)
  if (m) return `${m[1]} #${m[2]}`
  return tail
}

export function parsePoolCount(content: string | null | undefined): number {
  try {
    const p = JSON.parse(String(content ?? ''))
    return Array.isArray(p?.images) ? p.images.length : 0
  } catch {
    return 0
  }
}

export function progressPercentOf(
  progress: { value: number; max: number } | null | undefined,
): number {
  if (!progress || !progress.max) return 0
  return Math.max(0, Math.min(100, (progress.value / progress.max) * 100))
}

export function useStageCard(
  getState: () => StageState,
  onAction: (actionId: string, context?: ImagePickContext) => void,
) {
  const stageActions = computed<StageAction[]>(() => ACTIONS_BY_KIND[getState().kind] || [])

  const openActionId = ref<string | null>(null)
  const openPresets = computed<ImagePreset[]>(() => {
    if (!openActionId.value) return []
    return stageActions.value.find(x => x.id === openActionId.value)?.presets ?? []
  })

  function onActionClick(a: StageAction): void {
    if (a.presets && a.presets.length) {
      openActionId.value = openActionId.value === a.id ? null : a.id
      return
    }
    openActionId.value = null
    onAction(a.id)
  }

  function onPresetClick(p: ImagePreset): void {
    if (!openActionId.value) return
    onAction(`${openActionId.value}:${p.id}`)
    openActionId.value = null
  }

  const connectedInputs = computed(() =>
    getState().inputs.filter(
      i => i.source === 'upstream' || i.source === 'upstream-pending',
    ))

  const canRun = computed(() => {
    const s = getState()
    if (s.preparingWorkflow) return false
    const hasPrompt = !!(s.mainPrompt && s.mainPrompt.trim())
    return hasPrompt || connectedInputs.value.length > 0
  })

  const progressPercent = computed(() => progressPercentOf(getState().progress))

  const batchInput = computed(() => getState().inputs.find(i => i.slot === 'batch'))
  const poolContent = computed<string | null>(() =>
    getState().pool ?? batchInput.value?.content ?? null)
  const poolCount = computed(() => parsePoolCount(poolContent.value))
  const pickerSource = computed<InputSource>(() => batchInput.value?.source ?? 'empty')

  const confirmingClear = ref(false)
  watch(poolCount, (n) => { if (n === 0) confirmingClear.value = false })

  function onClearPool(): void {
    onAction('clear-pool')
    confirmingClear.value = false
  }

  return {
    stageActions,
    openActionId,
    openPresets,
    onActionClick,
    onPresetClick,
    connectedInputs,
    canRun,
    progressPercent,
    batchInput,
    poolContent,
    poolCount,
    pickerSource,
    confirmingClear,
    onClearPool,
  }
}
