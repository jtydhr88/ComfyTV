export type Rgb8 = [number, number, number]

export const SELECTIVE_ZONE_IDS = [
  'reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas',
  'whites', 'neutrals', 'blacks',
] as const

export type SelectiveZone = (typeof SELECTIVE_ZONE_IDS)[number]

export interface SelectiveColorParams {
  scMethod: string
  zones: Partial<Record<SelectiveZone, number>>
}

function midPred(r: number, g: number, b: number): number {
  return r + g + b - Math.min(r, g, b) - Math.max(r, g, b)
}

function zoneScale(zone: SelectiveZone, r: number, g: number, b: number,
                   minC: number, maxC: number): number {
  switch (zone) {
    case 'reds':
    case 'greens':
    case 'blues':
      return maxC - midPred(r, g, b)
    case 'cyans':
    case 'magentas':
    case 'yellows':
      return midPred(r, g, b) - minC
    case 'whites':
      return (minC << 1) - 255
    case 'neutrals':
      return (255 * 2 - (Math.abs((maxC << 1) - 255)
        + Math.abs((minC << 1) - 255)) + 1) >> 1
    case 'blacks':
      return 255 - (maxC << 1)
  }
}

function inZone(zone: SelectiveZone, r: number, g: number, b: number,
                minC: number, maxC: number): boolean {
  switch (zone) {
    case 'reds': return r === maxC
    case 'cyans': return r === minC
    case 'greens': return g === maxC
    case 'magentas': return g === minC
    case 'blues': return b === maxC
    case 'yellows': return b === minC
    case 'whites': return r > 128 && g > 128 && b > 128
    case 'neutrals':
      return (r !== 0 || g !== 0 || b !== 0)
        && (r !== 255 || g !== 255 || b !== 255)
    case 'blacks': return r < 128 && g < 128 && b < 128
  }
}

function rint(x: number): number {
  const f = Math.floor(x)
  const d = x - f
  if (d > 0.5) return f + 1
  if (d < 0.5) return f
  return f % 2 === 0 ? f : f + 1
}

const INV_255 = Math.fround(1 / 255)

function compAdjust(scale: number, value: number, adjust: number,
                    relative: boolean): number {
  const lo = Math.fround(-value)
  const hi = Math.fround(1 - value)
  let res = Math.fround(-Math.fround(adjust))
  if (relative) res = Math.fround(res * hi)
  const clipped = Math.min(hi, Math.max(lo, res))
  return rint(Math.fround(clipped * scale))
}

export function applySelectiveColor(
  rgb: Rgb8, p: SelectiveColorParams,
): Rgb8 {
  const [r, g, b] = rgb
  const minC = Math.min(r, g, b)
  const maxC = Math.max(r, g, b)
  const relative = p.scMethod === 'relative'
  let adjustR = 0
  for (const zone of SELECTIVE_ZONE_IDS) {
    const v = p.zones[zone] ?? 0
    if (!v || !inZone(zone, r, g, b, minC, maxC)) continue
    const scale = zoneScale(zone, r, g, b, minC, maxC)
    if (scale <= 0) continue
    adjustR += compAdjust(scale, Math.fround(r * INV_255), v, relative)
  }
  return [
    Math.max(0, Math.min(255, r + adjustR)),
    g,
    b,
  ]
}
