import { buildCurvesLuts, exposureScale, kelvinToRgb } from './colorMath'

import { linearToSrgb, srgbToLinear } from './color'
import type { RGBA } from './blend'

export type AdjustmentOp =
  | 'brightness-contrast'
  | 'hue-saturation'
  | 'invert'
  | 'levels'
  | 'curves'
  | 'temperature'
  | 'exposure'
  | 'color-balance'
  | 'vibrance'
  | 'posterize'
  | 'threshold'
  | 'channel-mixer'
  | 'black-white'
  | 'photo-filter'
  | 'gradient-map'

export const ADJUST_CODE: Record<AdjustmentOp, number> = {
  'brightness-contrast': 0,
  'hue-saturation': 1,
  invert: 2,
  levels: 3,
  temperature: 4,
  exposure: 5,
  'color-balance': 6,
  posterize: 7,
  threshold: 8,
  vibrance: 9,
  curves: 10,
  'channel-mixer': 11,
  'black-white': 12,
  'photo-filter': 13,
  'gradient-map': 14,
}

/** Ops that drive the shared 256-entry LUT texture (curves + gradient map). */
export const LUT_ADJUST_OPS: AdjustmentOp[] = ['curves', 'gradient-map']

export const ADJUST_OPS = Object.keys(ADJUST_CODE) as AdjustmentOp[]

export interface AdjustCurves {
  master?: string
  red?: string
  green?: string
  blue?: string
}

export interface AdjustParamDef {
  key: string
  min: number
  max: number
  default: number
  step?: number
  color?: boolean
}

export const ADJUST_PARAM_DEFS: Record<AdjustmentOp, AdjustParamDef[]> = {
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
  levels: [
    { key: 'inBlack', min: 0, max: 0.99, default: 0 },
    { key: 'inWhite', min: 0.01, max: 1, default: 1 },
    { key: 'gamma', min: 0.1, max: 5, default: 1 },
    { key: 'outBlack', min: 0, max: 1, default: 0 },
    { key: 'outWhite', min: 0, max: 1, default: 1 },
  ],
  curves: [],
  temperature: [
    { key: 'temperature', min: 1000, max: 12000, default: 6500, step: 50 },
    { key: 'mix', min: 0, max: 1, default: 1 },
  ],
  exposure: [
    { key: 'exposure', min: -3, max: 3, default: 0 },
    { key: 'black', min: -0.1, max: 0.1, default: 0, step: 0.001 },
  ],
  'color-balance': [
    { key: 'shadowsR', min: -1, max: 1, default: 0 },
    { key: 'shadowsG', min: -1, max: 1, default: 0 },
    { key: 'shadowsB', min: -1, max: 1, default: 0 },
    { key: 'midtonesR', min: -1, max: 1, default: 0 },
    { key: 'midtonesG', min: -1, max: 1, default: 0 },
    { key: 'midtonesB', min: -1, max: 1, default: 0 },
    { key: 'highlightsR', min: -1, max: 1, default: 0 },
    { key: 'highlightsG', min: -1, max: 1, default: 0 },
    { key: 'highlightsB', min: -1, max: 1, default: 0 },
  ],
  vibrance: [{ key: 'amount', min: -2, max: 2, default: 0 }],
  posterize: [{ key: 'levels', min: 2, max: 32, default: 4, step: 1 }],
  threshold: [{ key: 'level', min: 0, max: 1, default: 0.5 }],
  'channel-mixer': [
    { key: 'rr', min: -2, max: 2, default: 1 },
    { key: 'rg', min: -2, max: 2, default: 0 },
    { key: 'rb', min: -2, max: 2, default: 0 },
    { key: 'gr', min: -2, max: 2, default: 0 },
    { key: 'gg', min: -2, max: 2, default: 1 },
    { key: 'gb', min: -2, max: 2, default: 0 },
    { key: 'br', min: -2, max: 2, default: 0 },
    { key: 'bg', min: -2, max: 2, default: 0 },
    { key: 'bb', min: -2, max: 2, default: 1 },
  ],
  'black-white': [
    { key: 'red', min: -2, max: 3, default: 0.3, step: 0.01 },
    { key: 'yellow', min: -2, max: 3, default: 0, step: 0.01 },
    { key: 'green', min: -2, max: 3, default: 0.59, step: 0.01 },
    { key: 'cyan', min: -2, max: 3, default: 0, step: 0.01 },
    { key: 'blue', min: -2, max: 3, default: 0.11, step: 0.01 },
    { key: 'magenta', min: -2, max: 3, default: 0, step: 0.01 },
  ],
  'photo-filter': [
    { key: 'color', min: 0, max: 0xffffff, default: 0xec8a00, color: true },
    { key: 'density', min: 0, max: 1, default: 0.25, step: 0.01 },
  ],
  'gradient-map': [
    { key: 'from', min: 0, max: 0xffffff, default: 0x000000, color: true },
    { key: 'to', min: 0, max: 0xffffff, default: 0xffffff, color: true },
  ],
}

export function defaultParams(op: AdjustmentOp): Record<string, number> {
  const out: Record<string, number> = {}
  for (const def of ADJUST_PARAM_DEFS[op]) out[def.key] = def.default
  return out
}

export function packParams(op: AdjustmentOp, params: Record<string, number>): number[] {
  if (op === 'brightness-contrast') return [params.brightness ?? 0, params.contrast ?? 0, 0, 0]
  if (op === 'hue-saturation') return [(params.hue ?? 0) / 360, params.saturation ?? 0, params.lightness ?? 0, 0]
  if (op === 'levels') {
    return [
      params.inBlack ?? 0, params.inWhite ?? 1, params.gamma ?? 1, params.outBlack ?? 0,
      params.outWhite ?? 1,
    ]
  }
  if (op === 'temperature') {
    const rgb = kelvinToRgb(params.temperature ?? 6500)
    return [rgb[0], rgb[1], rgb[2], params.mix ?? 1]
  }
  if (op === 'exposure') {
    const black = params.black ?? 0
    return [black, exposureScale(params.exposure ?? 0, black), 0, 0]
  }
  if (op === 'color-balance') {
    return [
      params.shadowsR ?? 0, params.shadowsG ?? 0, params.shadowsB ?? 0, params.midtonesR ?? 0,
      params.midtonesG ?? 0, params.midtonesB ?? 0, params.highlightsR ?? 0, params.highlightsG ?? 0,
      params.highlightsB ?? 0,
    ]
  }
  if (op === 'posterize') return [Math.max(2, Math.round(params.levels ?? 4)), 0, 0, 0]
  if (op === 'threshold') return [params.level ?? 0.5, 0, 0, 0]
  if (op === 'vibrance') return [params.amount ?? 0, 0, 0, 0]
  if (op === 'channel-mixer') {
    return [
      params.rr ?? 1, params.rg ?? 0, params.rb ?? 0,
      params.gr ?? 0, params.gg ?? 1, params.gb ?? 0,
      params.br ?? 0, params.bg ?? 0, params.bb ?? 1,
    ]
  }
  if (op === 'black-white') {
    return [
      params.red ?? 0.3, params.yellow ?? 0, params.green ?? 0.59,
      params.cyan ?? 0, params.blue ?? 0.11, params.magenta ?? 0,
    ]
  }
  if (op === 'photo-filter') {
    const c = Math.round(params.color ?? 0xec8a00)
    return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, params.density ?? 0.25]
  }
  return [0, 0, 0, 0]
}

function unpackRgb(v: number): RGB {
  const n = Math.round(v)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Linear from→to gradient as a 256-entry RGBA LUT (for the shared LUT texture). */
export function gradientMapLutData(params: Record<string, number>): Uint8Array {
  const from = unpackRgb(params.from ?? 0x000000)
  const to = unpackRgb(params.to ?? 0xffffff)
  const data = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    data[i * 4] = Math.round((from[0] + (to[0] - from[0]) * t) * 255)
    data[i * 4 + 1] = Math.round((from[1] + (to[1] - from[1]) * t) * 255)
    data[i * 4 + 2] = Math.round((from[2] + (to[2] - from[2]) * t) * 255)
    data[i * 4 + 3] = 255
  }
  return data
}

export function lutDataFor(op: AdjustmentOp, params: Record<string, number>, curves?: AdjustCurves): Uint8Array | undefined {
  if (op === 'curves') return curvesLutData(curves)
  if (op === 'gradient-map') return gradientMapLutData(params)
  return undefined
}

export function curvesLutData(curves: AdjustCurves | undefined): Uint8Array {
  const luts = buildCurvesLuts({
    master: curves?.master ?? '',
    red: curves?.red ?? '',
    green: curves?.green ?? '',
    blue: curves?.blue ?? '',
  })
  const data = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    data[i * 4] = luts.red[i]
    data[i * 4 + 1] = luts.green[i]
    data[i * 4 + 2] = luts.blue[i]
    data[i * 4 + 3] = 255
  }
  return data
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

type RGB = [number, number, number]

function levelsChannel(v: number, p: number[]): number {
  const t = clamp01((v - p[0]) / Math.max(p[1] - p[0], 1e-4))
  return p[3] + Math.pow(t, 1 / Math.max(p[2], 1e-4)) * (p[4] - p[3])
}

function balanceComponent(v: number, l: number, s: number, m: number, h: number): number {
  const a = 4
  const b = 0.333
  const sc = 0.7
  const sw = s * clamp01((b - l) * a + 0.5) * sc
  const mw = m * clamp01((l - b) * a + 0.5) * clamp01((1 - l - b) * a + 0.5) * sc
  const hw = h * clamp01((l + b - 1) * a + 0.5) * sc
  return clamp01(v + sw + mw + hw)
}

function hfun(n: number, h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l)
  const k = (n + h / 30) % 12
  return clamp01(l - a * Math.max(Math.min(Math.min(k - 3, 9 - k), 1), -1))
}

function preservel(c: RGB, l: number): RGB {
  const mx = Math.max(c[0], c[1], c[2])
  const mn = Math.min(c[0], c[1], c[2])
  let h: number
  if (c[0] === c[1] && c[1] === c[2]) h = 0
  else if (mx === c[0]) h = 60 * ((c[1] - c[2]) / (mx - mn))
  else if (mx === c[1]) h = 60 * (2 + (c[2] - c[0]) / (mx - mn))
  else h = 60 * (4 + (c[0] - c[1]) / (mx - mn))
  if (h < 0) h += 360
  const lOut = (mx + mn) / 2
  const denom = 1 - Math.abs(2 * lOut - 1)
  const s = denom <= 1e-6 ? 0 : (mx - mn) / denom
  return [hfun(0, h, s, l), hfun(8, h, s, l), hfun(4, h, s, l)]
}

function colorBalance(c: RGB, p: number[]): RGB {
  const l = (Math.max(c[0], c[1], c[2]) + Math.min(c[0], c[1], c[2])) / 2
  const out: RGB = [
    balanceComponent(c[0], l, p[0], p[3], p[6]),
    balanceComponent(c[1], l, p[1], p[4], p[7]),
    balanceComponent(c[2], l, p[2], p[5], p[8]),
  ]
  return preservel(out, l)
}

function vibrance(c: RGB, intensity: number): RGB {
  const sat = Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])
  const luma = c[1] * 0.715158 + c[0] * 0.212656 + c[2] * 0.072186
  const k = 1 + intensity * (1 + Math.sign(intensity) * sat)
  return [
    clamp01(luma + (c[0] - luma) * k),
    clamp01(luma + (c[1] - luma) * k),
    clamp01(luma + (c[2] - luma) * k),
  ]
}

function channelMixer(c: RGB, p: number[]): RGB {
  return [
    clamp01(c[0] * p[0] + c[1] * p[1] + c[2] * p[2]),
    clamp01(c[0] * p[3] + c[1] * p[4] + c[2] * p[5]),
    clamp01(c[0] * p[6] + c[1] * p[7] + c[2] * p[8]),
  ]
}

/** 6-slider black & white: primaries R/G/B plus secondaries Y/C/M by pair-min. */
function blackWhite(c: RGB, p: number[]): RGB {
  const [r, g, b] = c
  const gray = clamp01(
    r * p[0] + (r + g) * 0.5 * p[1] + g * p[2] + (g + b) * 0.5 * p[3] + b * p[4] + (r + b) * 0.5 * p[5]
  )
  return [gray, gray, gray]
}

const PF_W: RGB = [0.2126, 0.7152, 0.0722]

function photoFilter(c: RGB, p: number[]): RGB {
  const density = p[3]
  const filtered: RGB = [c[0] * p[0], c[1] * p[1], c[2] * p[2]]
  const lo = c[0] * PF_W[0] + c[1] * PF_W[1] + c[2] * PF_W[2]
  const ln = filtered[0] * PF_W[0] + filtered[1] * PF_W[1] + filtered[2] * PF_W[2]
  const k = ln > 1e-4 ? lo / ln : 1
  return [
    clamp01(c[0] + (filtered[0] * k - c[0]) * density),
    clamp01(c[1] + (filtered[1] * k - c[1]) * density),
    clamp01(c[2] + (filtered[2] * k - c[2]) * density),
  ]
}

function applySrgbOp(op: AdjustmentOp, params: number[], c: RGB, lut?: Uint8Array): RGB {
  switch (op) {
    case 'hue-saturation':
      return hueSaturation(c, params[0], params[1], params[2])
    case 'channel-mixer':
      return channelMixer(c, params)
    case 'black-white':
      return blackWhite(c, params)
    case 'photo-filter':
      return photoFilter(c, params)
    case 'gradient-map': {
      if (!lut) return c
      const y = c[0] * PF_W[0] + c[1] * PF_W[1] + c[2] * PF_W[2]
      const i = Math.round(clamp01(y) * 255) * 4
      return [lut[i] / 255, lut[i + 1] / 255, lut[i + 2] / 255]
    }
    case 'invert':
      return [1 - c[0], 1 - c[1], 1 - c[2]]
    case 'levels':
      return [levelsChannel(c[0], params), levelsChannel(c[1], params), levelsChannel(c[2], params)]
    case 'temperature':
      return [
        c[0] + (c[0] * params[0] - c[0]) * params[3],
        c[1] + (c[1] * params[1] - c[1]) * params[3],
        c[2] + (c[2] * params[2] - c[2]) * params[3],
      ]
    case 'color-balance':
      return colorBalance(c, params)
    case 'posterize': {
      const n = Math.max(2, params[0]) - 1
      return [Math.round(c[0] * n) / n, Math.round(c[1] * n) / n, Math.round(c[2] * n) / n]
    }
    case 'threshold': {
      const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
      const v = y >= params[0] ? 1 : 0
      return [v, v, v]
    }
    case 'vibrance':
      return vibrance(c, params[0])
    default:
      return c
  }
}

export function applyAdjustment(op: AdjustmentOp, params: number[], px: RGBA, lut?: Uint8Array): RGBA {
  if (op === 'brightness-contrast') {
    return [
      brightnessContrast(px[0], params[0], params[1]),
      brightnessContrast(px[1], params[0], params[1]),
      brightnessContrast(px[2], params[0], params[1]),
      px[3],
    ]
  }
  if (op === 'exposure') {
    return [
      clamp01((px[0] - params[0]) * params[1]),
      clamp01((px[1] - params[0]) * params[1]),
      clamp01((px[2] - params[0]) * params[1]),
      px[3],
    ]
  }
  const srgb: RGB = [
    linearToSrgb(clamp01(px[0])),
    linearToSrgb(clamp01(px[1])),
    linearToSrgb(clamp01(px[2])),
  ]
  const out = applySrgbOp(op, params, srgb, lut)
  return [srgbToLinear(clamp01(out[0])), srgbToLinear(clamp01(out[1])), srgbToLinear(clamp01(out[2])), px[3]]
}
