import { computed, type Ref, type WritableComputedRef } from 'vue'

export type HueCurvePoints = [number, number][]

export const DEFAULT_HUE_CURVE: HueCurvePoints = [[0, 1], [1, 1]]

export function parseCurves(raw: string): Record<string, HueCurvePoints> {
  try {
    const o = JSON.parse(raw || '{}')
    if (o && typeof o === 'object' && !Array.isArray(o)) return o
  } catch {
    void 0
  }
  return {}
}

export interface UseHueCorrectCurvesOptions {
  curves: Ref<string>
  channel: Ref<string>
}

export function useHueCorrectCurves(opts: UseHueCorrectCurvesOptions): {
  activeCurve: WritableComputedRef<HueCurvePoints>
} {
  const activeCurve = computed({
    get: () => {
      const c = parseCurves(opts.curves.value)[opts.channel.value]
      if (Array.isArray(c) && c.length >= 2) return c
      return DEFAULT_HUE_CURVE.map((p) => p.slice()) as HueCurvePoints
    },
    set: (pts: HueCurvePoints) => {
      const obj = parseCurves(opts.curves.value)
      const rounded = pts.map(([x, y]) =>
        [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000] as [number, number])
      const isDefault = rounded.length === 2
        && rounded[0][0] === 0 && rounded[0][1] === 1
        && rounded[1][0] === 1 && rounded[1][1] === 1
      if (isDefault) delete obj[opts.channel.value]
      else obj[opts.channel.value] = rounded
      opts.curves.value = Object.keys(obj).length ? JSON.stringify(obj) : ''
    },
  })
  return { activeCurve }
}
