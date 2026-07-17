import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'

export type CurvePts = [number, number][]

export function parseCurve(raw: string): CurvePts {
  try {
    const p = JSON.parse(raw || '[]')
    if (Array.isArray(p) && p.length >= 2) return p as CurvePts
  } catch {  }
  return [[0, 0], [1, 1]]
}

export function serializeCurve(pts: CurvePts): string {
  const isIdentity = pts.length === 2
    && pts[0][0] === 0 && pts[0][1] === 0 && pts[1][0] === 1 && pts[1][1] === 1
  return isIdentity ? '' : JSON.stringify(pts.map(([x, y]) =>
    [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]))
}

export function useCurveChannels(node: LGraphNode) {
  const channel = ref('master')

  const widgets = {
    master: useStrWidget(node, 'master_pts', ''),
    red: useStrWidget(node, 'red_pts', ''),
    green: useStrWidget(node, 'green_pts', ''),
    blue: useStrWidget(node, 'blue_pts', ''),
  }

  const activeCurve = computed({
    get: () => parseCurve(widgets[channel.value as keyof typeof widgets].value),
    set: (pts: CurvePts) => {
      widgets[channel.value as keyof typeof widgets].value = serializeCurve(pts)
    },
  })

  function resetActive(): void {
    widgets[channel.value as keyof typeof widgets].value = ''
  }

  return { channel, activeCurve, resetActive }
}
