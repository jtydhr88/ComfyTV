import { useResizeObserver } from '@vueuse/core'
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { bindWidgetCallback, getWidget, onNodeConfigure, readWidgetNum, writeWidget } from '@/utils/widget'

export function rotationStyle(
  deg: number,
  flipH: boolean,
  flipV: boolean,
  boxRatio: number,
): Record<string, string> {
  const rotated = deg === 90 || deg === 270
  const scale = rotated ? Math.min(1, boxRatio) : 1
  return {
    transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`
      + ` scale(${scale}) rotate(${deg}deg)`,
    transition: 'transform 0.15s ease',
  }
}

export function useVideoRotate(node: LGraphNode, boxEl: () => HTMLElement | null) {
  const rotateDeg = ref(readWidgetNum(node, 'rotate_deg', 0))
  const flipH = ref(Boolean(getWidget(node, 'flip_h')?.value))
  const flipV = ref(Boolean(getWidget(node, 'flip_v')?.value))

  function rotateBy(delta: number): void {
    rotateDeg.value = ((rotateDeg.value + delta) % 360 + 360) % 360
    writeWidget(node, 'rotate_deg', rotateDeg.value)
  }

  function setFlipH(v: boolean): void {
    flipH.value = v
    writeWidget(node, 'flip_h', v)
  }

  function setFlipV(v: boolean): void {
    flipV.value = v
    writeWidget(node, 'flip_v', v)
  }

  bindWidgetCallback(node, 'rotate_deg', (value) => {
    const v = Number(value)
    if (Number.isFinite(v) && v !== rotateDeg.value) rotateDeg.value = ((v % 360) + 360) % 360
  })
  bindWidgetCallback(node, 'flip_h', (value) => { flipH.value = Boolean(value) })
  bindWidgetCallback(node, 'flip_v', (value) => { flipV.value = Boolean(value) })

  onNodeConfigure(node, () => {
    rotateDeg.value = readWidgetNum(node, 'rotate_deg', rotateDeg.value)
    flipH.value = Boolean(getWidget(node, 'flip_h')?.value)
    flipV.value = Boolean(getWidget(node, 'flip_v')?.value)
  })

  const boxRatio = ref(0.5)
  useResizeObserver(boxEl, (entries) => {
    const r = entries[0]?.contentRect
    if (r && r.width > 0) boxRatio.value = r.height / r.width
  })

  const videoStyle = computed<Record<string, string>>(() =>
    rotationStyle(rotateDeg.value, flipH.value, flipV.value, boxRatio.value))

  return { rotateDeg, flipH, flipV, boxRatio, rotateBy, setFlipH, setFlipV, videoStyle }
}
