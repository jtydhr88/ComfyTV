import { computed, ref, watch } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import type { Bounds } from '@/composables/widgets/useImageCrop'
import { useTransformPipeline } from '@/composables/widgets/useTransformPipeline'
import type { StageState } from '@/stores/stageStore'
import { bindWidgetCallback, onNodeConfigure, readWidgetNum, writeWidget } from '@/utils/widget'

const WIDGETS: Record<keyof Bounds, string> = {
  x: 'crop_x',
  y: 'crop_y',
  width: 'crop_w',
  height: 'crop_h',
}

export interface CropRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

export function clampCropRect(b: Bounds, natW: number, natH: number): CropRect {
  const sx = Math.max(0, Math.min(natW - 1, Math.round(b.x)))
  const sy = Math.max(0, Math.min(natH - 1, Math.round(b.y)))
  const sw = Math.max(1, Math.min(natW - sx, Math.round(b.width)))
  const sh = Math.max(1, Math.min(natH - sy, Math.round(b.height)))
  return { sx, sy, sw, sh }
}

export function cropToCanvas(img: HTMLImageElement, b: Bounds): HTMLCanvasElement {
  const { sx, sy, sw, sh } = clampCropRect(b, img.naturalWidth, img.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  return canvas
}

export function useCropStage(node: LGraphNode, state: StageState) {
  const sourceImageUrl = computed(() => pickSourceImageUrl(state.inputs))

  function readBounds(fallback: Bounds): Bounds {
    return {
      x: readWidgetNum(node, WIDGETS.x, fallback.x),
      y: readWidgetNum(node, WIDGETS.y, fallback.y),
      width: readWidgetNum(node, WIDGETS.width, fallback.width),
      height: readWidgetNum(node, WIDGETS.height, fallback.height),
    }
  }

  const bounds = ref<Bounds>(readBounds({ x: 0, y: 0, width: 0, height: 0 }))

  function setBounds(v: Bounds): void {
    bounds.value = v
  }

  const { computing, requestRecompute } = useTransformPipeline({
    sourceImageUrl,
    state,
    nodeId: node?.id ?? 'unknown',
    filenamePrefix: 'comfytv-crop',
    subfolder: 'comfytv/cropper',
    compute: (img) => cropToCanvas(img, bounds.value),
  })

  watch(bounds, (v) => {
    writeWidget(node, WIDGETS.x, v.x)
    writeWidget(node, WIDGETS.y, v.y)
    writeWidget(node, WIDGETS.width, v.width)
    writeWidget(node, WIDGETS.height, v.height)
    requestRecompute()
  }, { deep: true })

  for (const key of Object.keys(WIDGETS) as Array<keyof Bounds>) {
    bindWidgetCallback(node, WIDGETS[key], (value) => {
      const v = Number(value)
      if (v !== bounds.value[key]) bounds.value = { ...bounds.value, [key]: v }
    })
  }

  onNodeConfigure(node, () => {
    const restored = readBounds(bounds.value)
    if (restored.x !== bounds.value.x || restored.y !== bounds.value.y
      || restored.width !== bounds.value.width || restored.height !== bounds.value.height) {
      bounds.value = restored
    }
  })

  watch(sourceImageUrl, (url) => {
    if (url && bounds.value.width > 0 && bounds.value.height > 0) {
      requestRecompute()
    }
  }, { immediate: true })

  return {
    sourceImageUrl,
    bounds,
    setBounds,
    computing,
  }
}
