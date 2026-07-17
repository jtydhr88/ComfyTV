import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { evenDim, presetDims, resolveTarget } from '@/composables/stages/videoResizeMath'
import { useNumWidget } from '@/composables/widgets/useWidgetModel'

export function useVideoResize(node: LGraphNode) {
  const width = useNumWidget(node, 'width', 1280)
  const height = useNumWidget(node, 'height', 720)
  const lockRatio = ref(true)

  const srcW = ref(0)
  const srcH = ref(0)

  function onMeta(v: { width: number; height: number }): void {
    srcW.value = v.width
    srcH.value = v.height
  }

  function setDim(which: 'width' | 'height', raw: string): void {
    const v = Number(raw)
    if (!Number.isFinite(v)) return
    const n = v <= 0 ? -1 : evenDim(v)
    const ar = srcW.value > 0 && srcH.value > 0 ? srcW.value / srcH.value : 0
    if (which === 'width') {
      width.value = n
      if (lockRatio.value && n > 0 && ar > 0) height.value = evenDim(n / ar)
    } else {
      height.value = n
      if (lockRatio.value && n > 0 && ar > 0) width.value = evenDim(n * ar)
    }
  }

  function applyPreset(short: number): void {
    const dims = presetDims(short, srcW.value, srcH.value)
    if (!dims) return
    width.value = dims.width
    height.value = dims.height
  }

  function applySource(): void {
    if (srcW.value <= 0 || srcH.value <= 0) return
    width.value = evenDim(srcW.value)
    height.value = evenDim(srcH.value)
  }

  const targetLabel = computed(() => {
    const t = resolveTarget(width.value, height.value, srcW.value, srcH.value)
    return t ? `${t.width}×${t.height}` : '—'
  })

  return {
    width,
    height,
    lockRatio,
    srcW,
    srcH,
    onMeta,
    setDim,
    applyPreset,
    applySource,
    targetLabel,
  }
}
