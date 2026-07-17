import { computed } from 'vue'

import type { EqBand } from '@/composables/widgets/fx/eqMath'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'
import type { LGraphNode } from '@/lib/comfyApp'

export const QUICK_BANDS: { label: string; band: EqBand }[] = [
  { label: '+Peak', band: { type: 'peak', f: 1000, g: 3, q: 1 } },
  { label: '+HPF', band: { type: 'highpass', f: 80, g: 0, q: 0.7 } },
  { label: '+LPF', band: { type: 'lowpass', f: 12000, g: 0, q: 0.7 } },
  { label: '+LoShelf', band: { type: 'lowshelf', f: 150, g: 3, q: 0.7 } },
  { label: '+HiShelf', band: { type: 'highshelf', f: 8000, g: 3, q: 0.7 } },
]

export function parseEqBands(raw: string): EqBand[] {
  try {
    const p = JSON.parse(raw || '[]')
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

export function serializeEqBands(bands: EqBand[]): string {
  return bands.length ? JSON.stringify(bands) : ''
}

export function useEqBands(node: LGraphNode) {
  const bandsRaw = useStrWidget(node, 'bands', '')

  const bands = computed<EqBand[]>({
    get: () => parseEqBands(bandsRaw.value),
    set: (v: EqBand[]) => {
      bandsRaw.value = serializeEqBands(v)
    },
  })

  function addBand(b: EqBand): void {
    bands.value = [...bands.value, { ...b }]
  }

  function removeBand(i: number): void {
    const next = bands.value.slice()
    next.splice(i, 1)
    bands.value = next
  }

  return { bands, addBand, removeBand }
}
