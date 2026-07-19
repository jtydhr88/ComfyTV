import {
  buildCurvesLuts,
  type CurvesLuts,
} from '@/composables/stages/videoCurvesMath'

export type StylizeEffect =
  | 'vignette'
  | 'grain'
  | 'pixelize'
  | 'edge'
  | 'sepia'
  | 'monochrome'
  | 'old_film'

export const STYLIZE_EFFECTS: StylizeEffect[] = [
  'vignette', 'grain', 'pixelize', 'edge', 'sepia', 'monochrome', 'old_film',
]

export interface VideoStylizeParams {
  effect: StylizeEffect
  strength: number
  block: number
}

const EFFECT_INDEX: Record<StylizeEffect, number> = {
  vignette: 0,
  grain: 1,
  pixelize: 2,
  edge: 3,
  sepia: 4,
  monochrome: 5,
  old_film: 6,
}

function fin(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return dflt
  return Math.min(hi, Math.max(lo, n))
}

export function sanitizeVideoStylizeParams(
  p: Partial<VideoStylizeParams>,
): VideoStylizeParams {
  const effect: StylizeEffect =
    p.effect && STYLIZE_EFFECTS.includes(p.effect) ? p.effect : 'vignette'
  const rawBlock = typeof p.block === 'number' ? p.block : Number(p.block)
  const block = Number.isFinite(rawBlock) && Math.trunc(rawBlock)
    ? Math.trunc(rawBlock)
    : 8
  return {
    effect,
    strength: fin(p.strength, 0, 1, 0.5),
    block: Math.min(64, Math.max(2, block)),
  }
}

function fmt(v: number, digits: number): number {
  return Number.parseFloat(v.toFixed(digits))
}

export function vignetteAngle(s: number): number {
  return fmt(Math.max(0.05, s * 1.5), 4)
}

export function oldFilmVignetteAngle(s: number): number {
  return fmt(Math.max(0.05, s * 1.2), 4)
}

export function grainStrength(s: number): number {
  return Math.max(1, Math.trunc(s * 40))
}

export function oldFilmGrainStrength(s: number): number {
  return Math.max(1, Math.trunc(s * 30))
}

export function edgeThresholds(s: number): { low: number; high: number } {
  return {
    low: fmt(Math.max(0.02, s * 0.3), 3),
    high: fmt(Math.max(0.05, s * 0.6), 3),
  }
}

export function edgeThresholdU8(t: number): number {
  return Math.trunc(t * 255 + 0.5)
}

export const SEPIA_ARGS = '.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0'

export type FilterSpec = [string, string | null]

export function stylizeFilterSpecs(
  raw: Partial<VideoStylizeParams>,
): FilterSpec[] {
  const p = sanitizeVideoStylizeParams(raw)
  const s = p.strength
  if (p.effect === 'vignette') {
    return [['vignette', `angle=${Math.max(0.05, s * 1.5).toFixed(4)}`]]
  }
  if (p.effect === 'grain') {
    return [['noise', `alls=${grainStrength(s)}:allf=t+u`]]
  }
  if (p.effect === 'pixelize') {
    return [['pixelize', `width=${p.block}:height=${p.block}`]]
  }
  if (p.effect === 'edge') {
    const low = Math.max(0.02, s * 0.3).toFixed(3)
    const high = Math.max(0.05, s * 0.6).toFixed(3)
    return [['edgedetect', `low=${low}:high=${high}:mode=colormix`]]
  }
  if (p.effect === 'sepia') {
    return [['colorchannelmixer', SEPIA_ARGS]]
  }
  if (p.effect === 'monochrome') {
    return [['monochrome', null]]
  }
  return [
    ['curves', 'preset=vintage'],
    ['noise', `alls=${oldFilmGrainStrength(s)}:allf=t+u`],
    ['vignette', `angle=${Math.max(0.05, s * 1.2).toFixed(4)}`],
  ]
}

function clipByte(v: number): number {
  return Math.min(255, Math.max(0, v))
}

function rne(v: number): number {
  const f = Math.floor(v)
  const d = v - f
  if (d < 0.5) return f
  if (d > 0.5) return f + 1
  return f % 2 === 0 ? f : f + 1
}

export function vignetteFactor(
  x: number, y: number, w: number, h: number, angle: number,
): number {
  const a = Math.min(Math.PI / 2, Math.max(0, angle))
  const xx = Math.trunc(x - w / 2)
  const yy = Math.trunc(y - h / 2)
  const dnorm = Math.hypot(xx, yy) / Math.hypot(w / 2, h / 2)
  if (dnorm > 1) return 0
  const c = Math.cos(a * dnorm)
  return Math.fround(c * c * (c * c))
}

export function vignetteLumaByte(v: number, f: number): number {
  return clipByte(Math.trunc(Math.fround(v * f)))
}

export function vignetteChromaByte(v: number, f: number): number {
  return clipByte(
    Math.trunc(Math.fround(Math.fround(f * (v - 127)) + 127)),
  )
}

export interface YuvPlanes {
  y: Uint8Array
  u: Uint8Array
  v: Uint8Array
}

export function applyVignetteYuv(
  src: YuvPlanes, w: number, h: number, angle: number,
): YuvPlanes {
  const out: YuvPlanes = {
    y: new Uint8Array(w * h),
    u: new Uint8Array(w * h),
    v: new Uint8Array(w * h),
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const f = vignetteFactor(x, y, w, h, angle)
      out.y[i] = vignetteLumaByte(src.y[i], f)
      out.u[i] = vignetteChromaByte(src.u[i], f)
      out.v[i] = vignetteChromaByte(src.v[i], f)
    }
  }
  return out
}

export function applyVignetteRgb(
  src: ArrayLike<number>, w: number, h: number, angle: number,
): Uint8Array {
  const out = new Uint8Array(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const f = vignetteFactor(x, y, w, h, angle)
      const i = (y * w + x) * 3
      out[i] = vignetteLumaByte(src[i], f)
      out[i + 1] = vignetteLumaByte(src[i + 1], f)
      out[i + 2] = vignetteLumaByte(src[i + 2], f)
    }
  }
  return out
}

const IMAX = Math.fround(1 / 255)

export function monochromeLuma(y: number, u: number, v: number): number {
  const fr = Math.fround
  const yf = fr(y * IMAX)
  const uf = fr(fr(u * IMAX) - 0.5)
  const vf = fr(fr(v * IMAX) - 0.5)
  const du = fr(fr(0 - uf) * fr(0 - uf))
  const dv = fr(fr(0 - vf) * fr(0 - vf))
  const dist = Math.min(1, Math.max(0, fr(fr(du + dv) * 1)))
  const ny = fr(Math.exp(-dist))
  return clipByte(rne(fr(fr(ny * yf) * 255)))
}

export function applyMonochromeYuv(src: YuvPlanes): YuvPlanes {
  const n = src.y.length
  const out: YuvPlanes = {
    y: new Uint8Array(n),
    u: new Uint8Array(n).fill(128),
    v: new Uint8Array(n).fill(128),
  }
  for (let i = 0; i < n; i++) {
    out.y[i] = monochromeLuma(src.y[i], src.u[i], src.v[i])
  }
  return out
}

export function applySepiaPixel(
  r: number, g: number, b: number,
): [number, number, number] {
  return [
    clipByte(rne(r * 0.393) + rne(g * 0.769) + rne(b * 0.189)),
    clipByte(rne(r * 0.349) + rne(g * 0.686) + rne(b * 0.168)),
    clipByte(rne(r * 0.272) + rne(g * 0.534) + rne(b * 0.131)),
  ]
}

export function applySepiaRgb(src: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(src.length)
  for (let i = 0; i < src.length; i += 3) {
    const [r, g, b] = applySepiaPixel(src[i], src[i + 1], src[i + 2])
    out[i] = r
    out[i + 1] = g
    out[i + 2] = b
  }
  return out
}

export function pixelizePlane(
  src: ArrayLike<number>, w: number, h: number, block: number,
): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let by = 0; by < h; by += block) {
    const bh = Math.min(block, h - by)
    for (let bx = 0; bx < w; bx += block) {
      const bw = Math.min(block, w - bx)
      let sum = 0
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) sum += src[(by + y) * w + bx + x] as number
      }
      const fill = Math.trunc(sum / (bw * bh))
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) out[(by + y) * w + bx + x] = fill
      }
    }
  }
  return out
}

export function applyPixelizeRgb(
  src: ArrayLike<number>, w: number, h: number, block: number,
): Uint8Array {
  const n = w * h
  const planes = [new Uint8Array(n), new Uint8Array(n), new Uint8Array(n)]
  for (let i = 0; i < n; i++) {
    planes[0][i] = src[i * 3] as number
    planes[1][i] = src[i * 3 + 1] as number
    planes[2][i] = src[i * 3 + 2] as number
  }
  const done = planes.map((p) => pixelizePlane(p, w, h, block))
  const out = new Uint8Array(n * 3)
  for (let i = 0; i < n; i++) {
    out[i * 3] = done[0][i]
    out[i * 3 + 1] = done[1][i]
    out[i * 3 + 2] = done[2][i]
  }
  return out
}

export function gaussianBlurPlane(
  src: ArrayLike<number>, w: number, h: number,
): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    const edgeRow = j < 2 || j >= h - 2
    for (let i = 0; i < w; i++) {
      const idx = j * w + i
      if (edgeRow || i < 2 || i >= w - 2) {
        out[idx] = src[idx] as number
        continue
      }
      const at = (dy: number, dx: number): number =>
        src[(j + dy) * w + i + dx] as number
      const sum =
        (at(-2, -2) + at(2, -2)) * 2 +
        (at(-2, -1) + at(2, -1)) * 4 +
        (at(-2, 0) + at(2, 0)) * 5 +
        (at(-2, 1) + at(2, 1)) * 4 +
        (at(-2, 2) + at(2, 2)) * 2 +
        (at(-1, -2) + at(1, -2)) * 4 +
        (at(-1, -1) + at(1, -1)) * 9 +
        (at(-1, 0) + at(1, 0)) * 12 +
        (at(-1, 1) + at(1, 1)) * 9 +
        (at(-1, 2) + at(1, 2)) * 4 +
        at(0, -2) * 5 +
        at(0, -1) * 12 +
        at(0, 0) * 15 +
        at(0, 1) * 12 +
        at(0, 2) * 5
      out[idx] = Math.trunc(sum / 159)
    }
  }
  return out
}

const DIR_45UP = 0
const DIR_45DOWN = 1
const DIR_HORIZONTAL = 2
const DIR_VERTICAL = 3

function roundedDirection(gx: number, gy: number): number {
  if (gx) {
    if (gx < 0) {
      gx = -gx
      gy = -gy
    }
    gy *= 1 << 16
    const tanPi8Gx = 27146 * gx
    const tan3Pi8Gx = 158218 * gx
    if (gy > -tan3Pi8Gx && gy < -tanPi8Gx) return DIR_45UP
    if (gy > -tanPi8Gx && gy < tanPi8Gx) return DIR_HORIZONTAL
    if (gy > tanPi8Gx && gy < tan3Pi8Gx) return DIR_45DOWN
  }
  return DIR_VERTICAL
}

export interface SobelResult {
  mag: Uint16Array
  dir: Int8Array
}

export function sobelPlane(
  src: ArrayLike<number>, w: number, h: number,
): SobelResult {
  const mag = new Uint16Array(w * h)
  const dir = new Int8Array(w * h)
  const at = (y: number, x: number): number => src[y * w + x] as number
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const gx =
        -at(j - 1, i - 1) + at(j - 1, i + 1) -
        2 * at(j, i - 1) + 2 * at(j, i + 1) -
        at(j + 1, i - 1) + at(j + 1, i + 1)
      const gy =
        -at(j - 1, i - 1) + at(j + 1, i - 1) -
        2 * at(j - 1, i) + 2 * at(j + 1, i) -
        at(j - 1, i + 1) + at(j + 1, i + 1)
      mag[j * w + i] = Math.abs(gx) + Math.abs(gy)
      dir[j * w + i] = roundedDirection(gx, gy)
    }
  }
  return { mag, dir }
}

export function nonMaximumSuppression(
  sob: SobelResult, w: number, h: number,
): Uint8Array {
  const out = new Uint8Array(w * h)
  const NEIGHBORS: Record<number, [number, number, number, number]> = {
    [DIR_45UP]: [1, -1, -1, 1],
    [DIR_45DOWN]: [-1, -1, 1, 1],
    [DIR_HORIZONTAL]: [0, -1, 0, 1],
    [DIR_VERTICAL]: [-1, 0, 1, 0],
  }
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const idx = j * w + i
      const [ay, ax, by, bx] = NEIGHBORS[sob.dir[idx]]
      const c = sob.mag[idx]
      if (c > sob.mag[(j + ay) * w + i + ax] &&
          c > sob.mag[(j + by) * w + i + bx]) {
        out[idx] = Math.min(255, c)
      }
    }
  }
  return out
}

export function doubleThreshold(
  src: ArrayLike<number>, w: number, h: number, low: number, high: number,
): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i
      const v = src[idx] as number
      if (v > high) {
        out[idx] = v
        continue
      }
      const interior = i > 0 && i < w - 1 && j > 0 && j < h - 1
      if (interior && v > low && (
        (src[idx - w - 1] as number) > high ||
        (src[idx - w] as number) > high ||
        (src[idx - w + 1] as number) > high ||
        (src[idx - 1] as number) > high ||
        (src[idx + 1] as number) > high ||
        (src[idx + w - 1] as number) > high ||
        (src[idx + w] as number) > high ||
        (src[idx + w + 1] as number) > high
      )) {
        out[idx] = v
      }
    }
  }
  return out
}

export function edgeColormixPlane(
  src: ArrayLike<number>, w: number, h: number, lowU8: number, highU8: number,
): Uint8Array {
  const blur = gaussianBlurPlane(src, w, h)
  const sob = sobelPlane(blur, w, h)
  const nms = nonMaximumSuppression(sob, w, h)
  const edges = doubleThreshold(nms, w, h, lowU8, highU8)
  const out = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    out[i] = (edges[i] + (src[i] as number)) >> 1
  }
  return out
}

export function applyEdgeRgb(
  src: ArrayLike<number>, w: number, h: number, lowU8: number, highU8: number,
): Uint8Array {
  const n = w * h
  const out = new Uint8Array(n * 3)
  for (let ch = 0; ch < 3; ch++) {
    const plane = new Uint8Array(n)
    for (let i = 0; i < n; i++) plane[i] = src[i * 3 + ch] as number
    const mixed = edgeColormixPlane(plane, w, h, lowU8, highU8)
    for (let i = 0; i < n; i++) out[i * 3 + ch] = mixed[i]
  }
  return out
}

export function hashNoise01(
  x: number, y: number, frame: number, plane: number,
): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) +
    Math.imul(frame, 2246822519 | 0) + Math.imul(plane, 3266489917 | 0)) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  h = Math.imul(h, 2654435761 | 0) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h, 2246822519 | 0) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h / 4294967296
}

export function noiseOffset(u01: number, strength: number): number {
  return Math.floor(u01 * strength) - Math.trunc(strength / 2)
}

export function grainByte(
  v: number, x: number, y: number, frame: number, plane: number,
  strength: number,
): number {
  return clipByte(v + noiseOffset(hashNoise01(x, y, frame, plane), strength))
}

export function applyGrainYuv(
  src: YuvPlanes, w: number, h: number, strength: number, frame: number,
): YuvPlanes {
  const out: YuvPlanes = {
    y: new Uint8Array(w * h),
    u: new Uint8Array(w * h),
    v: new Uint8Array(w * h),
  }
  const planes: [Uint8Array, Uint8Array][] = [
    [src.y, out.y], [src.u, out.u], [src.v, out.v],
  ]
  for (let p = 0; p < 3; p++) {
    const [s, d] = planes[p]
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        d[y * w + x] = grainByte(s[y * w + x], x, y, frame, p, strength)
      }
    }
  }
  return out
}

export function oldFilmLuts(): CurvesLuts {
  return buildCurvesLuts({ preset: 'vintage' })
}

export function applyOldFilmRgb(
  src: ArrayLike<number>, w: number, h: number, strength: number,
  frame: number, luts: CurvesLuts = oldFilmLuts(), withGrain = true,
): Uint8Array {
  const angle = oldFilmVignetteAngle(fin(strength, 0, 1, 0.5))
  const gs = oldFilmGrainStrength(fin(strength, 0, 1, 0.5))
  const chans = [luts.red, luts.green, luts.blue]
  const out = new Uint8Array(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const f = vignetteFactor(x, y, w, h, angle)
      for (let ch = 0; ch < 3; ch++) {
        const i = (y * w + x) * 3 + ch
        let v: number = chans[ch][src[i] as number]
        if (withGrain) v = grainByte(v, x, y, frame, ch, gs)
        out[i] = vignetteLumaByte(v, f)
      }
    }
  }
  return out
}

export type Rgb = [number, number, number]

export function rgbToYuv601(r: number, g: number, b: number): Rgb {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  return [
    16 + 65.481 * rn + 128.553 * gn + 24.966 * bn,
    128 - 37.797 * rn - 74.203 * gn + 112.0 * bn,
    128 + 112.0 * rn - 93.786 * gn - 18.214 * bn,
  ]
}

export function yuv601ToRgb(y: number, u: number, v: number): Rgb {
  const yn = (y - 16) / 219
  const pb = (u - 128) / 224
  const pr = (v - 128) / 224
  return [
    clipByte((yn + 1.402 * pr) * 255),
    clipByte((yn - 0.344136 * pb - 0.714136 * pr) * 255),
    clipByte((yn + 1.772 * pb) * 255),
  ]
}

export interface VideoStylizeUniforms {
  effect: number
  angle: number
  grain: number
  block: number
  edgeLow: number
  edgeHigh: number
}

export function computeStylizeUniforms(
  raw: Partial<VideoStylizeParams>,
): VideoStylizeUniforms {
  const p = sanitizeVideoStylizeParams(raw)
  const s = p.strength
  const { low, high } = edgeThresholds(s)
  return {
    effect: EFFECT_INDEX[p.effect],
    angle: p.effect === 'old_film' ? oldFilmVignetteAngle(s) : vignetteAngle(s),
    grain: p.effect === 'old_film' ? oldFilmGrainStrength(s) : grainStrength(s),
    block: p.block,
    edgeLow: edgeThresholdU8(low),
    edgeHigh: edgeThresholdU8(high),
  }
}

export function stylizeUsesCurves(raw: Partial<VideoStylizeParams>): boolean {
  return sanitizeVideoStylizeParams(raw).effect === 'old_film'
}

export function stylizeUsesTemporalNoise(
  raw: Partial<VideoStylizeParams>,
): boolean {
  const effect = sanitizeVideoStylizeParams(raw).effect
  return effect === 'grain' || effect === 'old_film'
}
