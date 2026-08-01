export interface ColorStop {
  offset: number
  color: [number, number, number]
}

const GRAY: [number, number, number] = [128, 128, 128]
const BLACK: [number, number, number] = [0, 0, 0]
const WHITE: [number, number, number] = [255, 255, 255]

export const LUMA_STOPS: ColorStop[] = [
  { offset: 0, color: BLACK },
  { offset: 1, color: WHITE },
]

export const GAMMA_STOPS: ColorStop[] = [
  { offset: 0, color: BLACK },
  { offset: 0.5, color: GRAY },
  { offset: 1, color: WHITE },
]

export const CONTRAST_STOPS: ColorStop[] = [
  { offset: 0, color: [136, 136, 136] },
  { offset: 0.4, color: [68, 68, 68] },
  { offset: 0.6, color: [187, 187, 187] },
  { offset: 0.8, color: BLACK },
  { offset: 1, color: WHITE },
]

export const SAT_STOPS: ColorStop[] = [
  { offset: 0, color: GRAY },
  { offset: 1, color: [255, 0, 0] },
]

export const TEMP_STOPS: ColorStop[] = [
  { offset: 0, color: [68, 136, 255] },
  { offset: 0.5, color: WHITE },
  { offset: 1, color: [255, 136, 0] },
]

export const TEMP_KELVIN_STOPS: ColorStop[] = [
  { offset: 0, color: [255, 136, 0] },
  { offset: 0.5, color: WHITE },
  { offset: 1, color: [68, 136, 255] },
]

export const TINT_STOPS: ColorStop[] = [
  { offset: 0, color: [255, 0, 255] },
  { offset: 0.5, color: WHITE },
  { offset: 1, color: [0, 255, 0] },
]

export const HUE_STOPS: ColorStop[] = [
  { offset: 0, color: [255, 0, 0] },
  { offset: 1 / 6, color: [255, 255, 0] },
  { offset: 2 / 6, color: [0, 255, 0] },
  { offset: 3 / 6, color: [0, 255, 255] },
  { offset: 4 / 6, color: [0, 0, 255] },
  { offset: 5 / 6, color: [255, 0, 255] },
  { offset: 1, color: [255, 0, 0] },
]

export const CR_STOPS: ColorStop[] = [
  { offset: 0, color: [0, 255, 255] },
  { offset: 0.5, color: GRAY },
  { offset: 1, color: [255, 0, 0] },
]

export const MG_STOPS: ColorStop[] = [
  { offset: 0, color: [255, 0, 255] },
  { offset: 0.5, color: GRAY },
  { offset: 1, color: [0, 255, 0] },
]

export const YB_STOPS: ColorStop[] = [
  { offset: 0, color: [255, 255, 0] },
  { offset: 0.5, color: GRAY },
  { offset: 1, color: [0, 0, 255] },
]

export const CHANNEL_STOPS: Record<string, ColorStop[]> = {
  red: [{ offset: 0, color: GRAY }, { offset: 1, color: [255, 0, 0] }],
  green: [{ offset: 0, color: GRAY }, { offset: 1, color: [0, 255, 0] }],
  blue: [{ offset: 0, color: GRAY }, { offset: 1, color: [0, 0, 255] }],
  cyan: [{ offset: 0, color: GRAY }, { offset: 1, color: [0, 255, 255] }],
  magenta: [{ offset: 0, color: GRAY }, { offset: 1, color: [255, 0, 255] }],
  yellow: [{ offset: 0, color: GRAY }, { offset: 1, color: [255, 255, 0] }],
  white: [{ offset: 0, color: GRAY }, { offset: 1, color: WHITE }],
  black: [{ offset: 0, color: GRAY }, { offset: 1, color: BLACK }],
  neutral: [{ offset: 0, color: [96, 96, 96] }, { offset: 1, color: [192, 192, 192] }],
}

export function channelStops(name: string): ColorStop[] {
  const key = name.replace(/s$/, '')
  return CHANNEL_STOPS[key] ?? LUMA_STOPS
}

export function stopsToGradient(stops: ColorStop[]): string {
  if (!stops.length) return 'transparent'
  const colors = stops.map(
    ({ offset, color: [r, g, b] }) => `rgb(${r},${g},${b}) ${offset * 100}%`
  )
  return `linear-gradient(to right, ${colors.join(', ')})`
}

export function interpolateStops(stops: ColorStop[], t: number): string {
  if (!stops.length) return 'transparent'
  const c = Math.max(0, Math.min(1, t))
  if (c <= stops[0].offset) {
    const [r, g, b] = stops[0].color
    return `rgb(${r},${g},${b})`
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const { offset: o1, color: [r1, g1, b1] } = stops[i]
    const { offset: o2, color: [r2, g2, b2] } = stops[i + 1]
    if (c >= o1 && c <= o2) {
      const f = o2 === o1 ? 0 : (c - o1) / (o2 - o1)
      return `rgb(${Math.round(r1 + (r2 - r1) * f)},${Math.round(g1 + (g2 - g1) * f)},${Math.round(b1 + (b2 - b1) * f)})`
    }
  }
  const [r, g, b] = stops[stops.length - 1].color
  return `rgb(${r},${g},${b})`
}
