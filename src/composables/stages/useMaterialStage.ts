import { reactive, watch } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import { useStageStore, type StageState } from '@/stores/stageStore'
import { uploadCanvas } from '@/utils/uploadCanvas'
import { onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'
import {
  normalizeMaterial,
  parseMaterialState,
  serializeMaterialState,
  type MaterialParams,
  type MaterialPreset,
} from '@/widgets/material/types'

export const CAPTURE_SIZE = 512
export const CAPTURE_DELAY_MS = 700

export type MaterialSliderKey =
  | 'metalness'
  | 'roughness'
  | 'transmission'
  | 'opacity'
  | 'clearcoat'
  | 'ior'

export const MATERIAL_SLIDERS: { key: MaterialSliderKey; min: number; max: number; step: number }[] = [
  { key: 'metalness',    min: 0, max: 1,     step: 0.01 },
  { key: 'roughness',    min: 0, max: 1,     step: 0.01 },
  { key: 'transmission', min: 0, max: 1,     step: 0.01 },
  { key: 'opacity',      min: 0, max: 1,     step: 0.01 },
  { key: 'clearcoat',    min: 0, max: 1,     step: 0.01 },
  { key: 'ior',          min: 1, max: 2.333, step: 0.001 },
]

export interface UseMaterialStageOptions {
  getState: () => StageState
  captureCanvas: () => HTMLCanvasElement | null
}

export function useMaterialStage(node: LGraphNode, opts: UseMaterialStageOptions) {
  const stageStore = useStageStore()

  const params = reactive<MaterialParams>(
    parseMaterialState(readWidgetStr(node, 'material_state', '')),
  )

  function setParam(key: MaterialSliderKey, value: number): void {
    params[key] = value
  }

  function setColor(value: string): void {
    params.color = normalizeMaterial({ ...params, color: value }).color
  }

  function applyPreset(p: MaterialPreset): void {
    Object.assign(params, p.params)
  }

  function syncOutputSlots(): void {
    const json = serializeMaterialState(params)
    writeWidget(node, 'material_state', json)
    stageStore.setOutputSlot(opts.getState(), 0, json)
  }

  watch(() => opts.getState().output, (payload) => {
    if (!payload) return
    const incoming = parseMaterialState(payload)
    if (serializeMaterialState(incoming) !== serializeMaterialState(params)) {
      Object.assign(params, incoming)
    }
  })

  let captureTimer: number | null = null
  let captureSeq = 0

  function scheduleCapture(): void {
    if (captureTimer != null) window.clearTimeout(captureTimer)
    captureTimer = window.setTimeout(() => {
      captureTimer = null
      void runCapture()
    }, CAPTURE_DELAY_MS)
  }

  async function runCapture(): Promise<void> {
    const canvas = opts.captureCanvas()
    if (!canvas) return
    const mySeq = ++captureSeq
    try {
      const url = await uploadCanvas(canvas, {
        subfolder: 'material',
        filename: `comfytv-material-${Date.now()}.png`,
      })
      if (mySeq !== captureSeq) return
      writeWidget(node, 'captured_image', url)
      stageStore.setOutputSlot(opts.getState(), 1, url)
    } catch (e) {
      console.error('[ComfyTV/material] preview capture upload failed', e)
    }
  }

  watch(() => ({ ...params }), syncOutputSlots, { deep: true })

  onNodeConfigure(node, () => {
    Object.assign(params, parseMaterialState(readWidgetStr(node, 'material_state', '')))
    syncOutputSlots()
    const captured = readWidgetStr(node, 'captured_image', '')
    stageStore.setOutputSlot(opts.getState(), 1, captured || null)
  })

  syncOutputSlots()

  function teardown(): void {
    captureSeq++
    if (captureTimer != null) window.clearTimeout(captureTimer)
    captureTimer = null
  }

  return {
    params,
    setParam,
    setColor,
    applyPreset,
    syncOutputSlots,
    scheduleCapture,
    teardown,
  }
}
