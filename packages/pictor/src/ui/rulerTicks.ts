export const RULER_SCALES = [
  1, 2, 5, 10, 25, 50, 100, 250, 500, 1000,
  2500, 5000, 10000, 25000, 50000, 100000,
] as const

export const RULER_SUBDIVIDE = [1, 5, 10, 50, 100] as const

export const MINIMUM_INCR = 5

export interface RulerTick { pos: number; len: number }
export interface RulerLabel { pos: number; text: string }

export interface RulerTickOpts {
  lower: number
  upper: number
  lengthPx: number
  breadthPx: number
  maxSize: number
  digitWidth?: number
}

export function pickScale(increment: number, maxSize: number, digitWidth: number): number {
  const digits = Math.max(1, Math.abs(Math.round(maxSize)).toString().length)
  const textSize = digits * digitWidth + 1
  for (let s = 0; s < RULER_SCALES.length; s++) {
    if (RULER_SCALES[s]! * Math.abs(increment) > 2 * textSize) return s
  }
  return RULER_SCALES.length - 1
}

export function computeRulerTicks(opts: RulerTickOpts): { ticks: RulerTick[]; labels: RulerLabel[] } {
  const { lower, upper, lengthPx, breadthPx, maxSize } = opts
  const digitWidth = opts.digitWidth ?? 7
  const ticks: RulerTick[] = []
  const labels: RulerLabel[] = []
  const span = upper - lower
  if (!(span > 0) || !(lengthPx > 0)) return { ticks, labels }

  const increment = lengthPx / span
  const scale = pickScale(increment, maxSize, digitWidth)

  let length = 0
  for (let i = RULER_SUBDIVIDE.length - 1; i >= 0; i--) {
    const subdIncr = RULER_SCALES[scale]! / RULER_SUBDIVIDE[i]!
    if (subdIncr * Math.abs(increment) <= MINIMUM_INCR) continue
    if (subdIncr < 1) continue

    const idealLength = breadthPx / (i + 1) - 1
    length = Math.max(length, idealLength)

    const start = Math.floor(lower / subdIncr) * subdIncr
    const end = Math.ceil(upper / subdIncr) * subdIncr
    for (let cur = start; cur <= end + 1e-9; cur += subdIncr) {
      const pos = Math.round((cur - lower) * increment)
      if (pos < -1 || pos > lengthPx + 1) continue
      ticks.push({ pos, len: Math.max(1, Math.round(length)) })
      if (i === 0) labels.push({ pos, text: String(Math.round(cur)) })
    }
  }
  return { ticks, labels }
}

export function markerRect(
  position: number, lower: number, upper: number, lengthPx: number, breadthPx: number,
): { pos: number; width: number; height: number } | null {
  const span = upper - lower
  if (!(span > 0)) return null
  let width = Math.floor(breadthPx / 2 + 2)
  width |= 1
  const height = Math.floor(width / 2 + 1)
  const pos = Math.round((position - lower) * (lengthPx / span))
  if (pos < -width || pos > lengthPx + width) return null
  return { pos, width, height }
}
