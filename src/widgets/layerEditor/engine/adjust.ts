import { linearToSrgb, srgbToLinear } from './color'
import type { RGBA } from './blend'

export type AdjustmentOp = 'brightness-contrast' | 'hue-saturation' | 'invert'

export const ADJUST_CODE: Record<AdjustmentOp, number> = {
  'brightness-contrast': 0,
  'hue-saturation': 1,
  invert: 2,
}

export const ADJUST_PARAM_DEFS: Record<AdjustmentOp, Array<{ key: string; min: number; max: number; default: number }>> = {
  'brightness-contrast': [
    { key: 'brightness', min: -1, max: 1, default: 0 },
    { key: 'contrast', min: -1, max: 1, default: 0 },
  ],
  'hue-saturation': [
    { key: 'hue', min: -180, max: 180, default: 0 },
    { key: 'saturation', min: -1, max: 1, default: 0 },
    { key: 'lightness', min: -1, max: 1, default: 0 },
  ],
  invert: [],
}

export function defaultParams(op: AdjustmentOp): Record<string, number> {
  const out: Record<string, number> = {}
  for (const def of ADJUST_PARAM_DEFS[op]) out[def.key] = def.default
  return out
}

export function packParams(op: AdjustmentOp, params: Record<string, number>): number[] {
  if (op === 'brightness-contrast') return [params.brightness ?? 0, params.contrast ?? 0, 0, 0]
  if (op === 'hue-saturation') return [(params.hue ?? 0) / 360, params.saturation ?? 0, params.lightness ?? 0, 0]
  return [0, 0, 0, 0]
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

function brightnessContrast(v: number, brightness: number, contrast: number): number {
  const b = brightness * 0.5
  const out = b < 0 ? v * (1 + b) : v + (1 - v) * b
  const slant = Math.tan(((contrast + 1) * Math.PI) / 4)
  return (out - 0.5) * slant + 0.5
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h / 6, s, l]
}

function hueToRgb(p: number, q: number, t: number): number {
  let x = t
  if (x < 0) x += 1
  if (x > 1) x -= 1
  if (x < 1 / 6) return p + (q - p) * 6 * x
  if (x < 1 / 2) return q
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)]
}

function hueSaturation(
  rgb: [number, number, number],
  hueShift: number,
  saturation: number,
  lightness: number
): [number, number, number] {
  let [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  h = (h + hueShift + 1) % 1
  s = clamp01(s * (1 + saturation))
  l = clamp01(lightness > 0 ? l + lightness * (1 - l) : l + lightness * l)
  return hslToRgb(h, s, l)
}

export function applyAdjustment(op: AdjustmentOp, params: number[], px: RGBA): RGBA {
  if (op === 'brightness-contrast') {
    return [
      brightnessContrast(px[0], params[0], params[1]),
      brightnessContrast(px[1], params[0], params[1]),
      brightnessContrast(px[2], params[0], params[1]),
      px[3],
    ]
  }
  const r = linearToSrgb(clamp01(px[0]))
  const g = linearToSrgb(clamp01(px[1]))
  const b = linearToSrgb(clamp01(px[2]))
  const out =
    op === 'hue-saturation'
      ? hueSaturation([r, g, b], params[0], params[1], params[2])
      : ([1 - r, 1 - g, 1 - b] as [number, number, number])
  return [srgbToLinear(out[0]), srgbToLinear(out[1]), srgbToLinear(out[2]), px[3]]
}
