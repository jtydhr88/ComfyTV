export type Rgb = [number, number, number]

export interface VideoColorParams {
  exposure: number
  black: number
  temperature: number
  tempMix: number
  hue: number
  saturation: number
  vibrance: number
  blackpoint: number
  whitepoint: number
  shadows: Rgb
  midtones: Rgb
  highlights: Rgb
  preserveLightness: boolean
}

export const NEUTRAL_VIDEO_COLOR: VideoColorParams = {
  exposure: 0,
  black: 0,
  temperature: 6500,
  tempMix: 1,
  hue: 0,
  saturation: 0,
  vibrance: 0,
  blackpoint: 0,
  whitepoint: 1,
  shadows: [0, 0, 0],
  midtones: [0, 0, 0],
  highlights: [0, 0, 0],
  preserveLightness: true,
}

function clampF(v: number, lo: number, hi: number, def = 0): number {
  const x = Number.isFinite(v) ? v : def
  return Math.min(hi, Math.max(lo, x))
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function quantRound(v: number): number {
  return Math.round(clamp01(v) * 255) / 255
}

function quantTrunc(v: number): number {
  return Math.min(255, Math.max(0, Math.trunc(v * 255))) / 255
}

function lerpf(v0: number, v1: number, f: number): number {
  return v0 + (v1 - v0) * f
}

function ffsign(v: number): number {
  return v > 0 ? 1 : -1
}

export function normalizeVideoColorParams(
  p: Partial<VideoColorParams>,
): VideoColorParams {
  const wheel = (w: Rgb | undefined): Rgb => [
    clampF(w?.[0] ?? 0, -1, 1),
    clampF(w?.[1] ?? 0, -1, 1),
    clampF(w?.[2] ?? 0, -1, 1),
  ]
  const bp = clampF(p.blackpoint ?? 0, -0.5, 0.5)
  const wp = clampF(p.whitepoint ?? 1, 0.5, 2)
  return {
    exposure: clampF(p.exposure ?? 0, -3, 3),
    black: clampF(p.black ?? 0, -0.1, 0.1),
    temperature: Math.min(40000, Math.max(1000, Math.trunc(p.temperature || 6500))),
    tempMix: clampF(p.tempMix ?? 1, 0, 1, 1),
    hue: clampF(p.hue ?? 0, -180, 180),
    saturation: clampF(p.saturation ?? 0, -1, 1),
    vibrance: clampF(p.vibrance ?? 0, -2, 2),
    blackpoint: bp,
    whitepoint: wp,
    shadows: wheel(p.shadows),
    midtones: wheel(p.midtones),
    highlights: wheel(p.highlights),
    preserveLightness: p.preserveLightness ?? true,
  }
}

export interface VideoColorActive {
  exposure: boolean
  temperature: boolean
  hueSaturation: boolean
  vibrance: boolean
  levels: boolean
  balance: boolean
}

export function activeVideoColorFilters(p: VideoColorParams): VideoColorActive {
  return {
    exposure: p.exposure !== 0 || p.black !== 0,
    temperature: p.temperature !== 6500,
    hueSaturation: p.hue !== 0 || p.saturation !== 0,
    vibrance: p.vibrance !== 0,
    levels: p.blackpoint !== 0 || p.whitepoint !== 1,
    balance: [...p.shadows, ...p.midtones, ...p.highlights].some((v) => v !== 0),
  }
}

export function anyVideoColorActive(p: VideoColorParams): boolean {
  return Object.values(activeVideoColorFilters(p)).some(Boolean)
}

export function exposureScale(exposure: number, black: number): number {
  const diff = Math.abs(Math.pow(2, -exposure) - black)
  return 1 / (diff > 0 ? diff : 1 / 1024)
}

export function applyExposure(rgb: Rgb, exposure: number, black: number): Rgb {
  const scale = exposureScale(exposure, black)
  return [
    (rgb[0] - black) * scale,
    (rgb[1] - black) * scale,
    (rgb[2] - black) * scale,
  ]
}

export function kelvinToRgb(k: number): Rgb {
  const kelvin = k / 100
  let r: number
  let g: number
  let b: number
  if (kelvin <= 66) {
    r = 1
    g = clamp01(0.39008157876901960784 * Math.log(kelvin) - 0.63184144378862745098)
  } else {
    const t = Math.max(kelvin - 60, 0)
    r = clamp01(1.29293618606274509804 * Math.pow(t, -0.1332047592))
    g = clamp01(1.12989086089529411765 * Math.pow(t, -0.0755148492))
  }
  if (kelvin >= 66) b = 1
  else if (kelvin <= 19) b = 0
  else b = clamp01(0.5432067891101960784 * Math.log(kelvin - 10) - 1.19625408914)
  return [r, g, b]
}

export function applyColorTemperature(rgb: Rgb, kelvin: number, mix: number): Rgb {
  const color = kelvinToRgb(kelvin)
  return [
    lerpf(rgb[0], rgb[0] * color[0], mix),
    lerpf(rgb[1], rgb[1] * color[1], mix),
    lerpf(rgb[2], rgb[2] * color[2], mix),
  ]
}

type Mat4 = number[][]

function identityMatrix(): Mat4 {
  return Array.from({ length: 4 }, (_, y) =>
    Array.from({ length: 4 }, (_, x) => (y === x ? 1 : 0)))
}

function matrixMultiply(a: Mat4, b: Mat4, c: Mat4): void {
  const temp: Mat4 = Array.from({ length: 4 }, () => [0, 0, 0, 0])
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      temp[y][x] = b[y][0] * a[0][x] + b[y][1] * a[1][x]
        + b[y][2] * a[2][x] + b[y][3] * a[3][x]
    }
  }
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) c[y][x] = temp[y][x]
  }
}

function saturationMatrix(
  matrix: Mat4, saturation: number,
  rlw: number, glw: number, blw: number,
): void {
  const s = 1 - saturation
  const m: Mat4 = [
    [s * rlw + saturation, s * rlw, s * rlw, 0],
    [s * glw, s * glw + saturation, s * glw, 0],
    [s * blw, s * blw, s * blw + saturation, 0],
    [0, 0, 0, 1],
  ]
  matrixMultiply(m, matrix, matrix)
}

function xRotateMatrix(matrix: Mat4, rs: number, rc: number): void {
  const m: Mat4 = [
    [1, 0, 0, 0],
    [0, rc, rs, 0],
    [0, -rs, rc, 0],
    [0, 0, 0, 1],
  ]
  matrixMultiply(m, matrix, matrix)
}

function yRotateMatrix(matrix: Mat4, rs: number, rc: number): void {
  const m: Mat4 = [
    [rc, 0, -rs, 0],
    [0, 1, 0, 0],
    [rs, 0, rc, 0],
    [0, 0, 0, 1],
  ]
  matrixMultiply(m, matrix, matrix)
}

function zRotateMatrix(matrix: Mat4, rs: number, rc: number): void {
  const m: Mat4 = [
    [rc, rs, 0, 0],
    [-rs, rc, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ]
  matrixMultiply(m, matrix, matrix)
}

function shueRotateMatrix(matrix: Mat4, rotation: number): void {
  let mag = Math.SQRT2
  const xrs = 1 / mag
  const xrc = 1 / mag
  xRotateMatrix(matrix, xrs, xrc)

  mag = Math.sqrt(3)
  const yrs = -1 / mag
  const yrc = Math.SQRT2 / mag
  yRotateMatrix(matrix, yrs, yrc)

  const zrs = Math.sin((rotation * Math.PI) / 180)
  const zrc = Math.cos((rotation * Math.PI) / 180)
  zRotateMatrix(matrix, zrs, zrc)

  yRotateMatrix(matrix, -yrs, yrc)
  xRotateMatrix(matrix, -xrs, xrc)
}

export function hueSaturationMatrix(hue: number, saturation: number): number[] {
  const matrix = identityMatrix()
  saturationMatrix(matrix, 1 + saturation, 0.333, 0.334, 0.333)
  shueRotateMatrix(matrix, hue)
  return [
    matrix[0][0], matrix[0][1], matrix[0][2],
    matrix[1][0], matrix[1][1], matrix[1][2],
    matrix[2][0], matrix[2][1], matrix[2][2],
  ]
}

function fastDiv255(x: number): number {
  return ((x + 128) * 257) >> 16
}

export function applyHueSaturation(rgb: Rgb, matrix: number[]): Rgb {
  const r = Math.round(clamp01(rgb[0]) * 255)
  const g = Math.round(clamp01(rgb[1]) * 255)
  const b = Math.round(clamp01(rgb[2]) * 255)
  const m = matrix.map((v) => Math.round(v * 65536))
  let f = 0
  f = Math.max(f, r - Math.max(g, b))
  f = Math.max(f, Math.min(r, g) - b)
  f = Math.max(f, g - Math.max(r, b))
  f = Math.max(f, Math.min(g, b) - r)
  f = Math.max(f, b - Math.max(r, g))
  f = Math.max(f, Math.min(r, b) - g)
  f = Math.min(f, 255)
  const tr = Math.floor((r * m[0] + g * m[3] + b * m[6]) / 65536)
  const tg = Math.floor((r * m[1] + g * m[4] + b * m[7]) / 65536)
  const tb = Math.floor((r * m[2] + g * m[5] + b * m[8]) / 65536)
  const or = r + fastDiv255((tr - r) * f)
  const og = g + fastDiv255((tg - g) * f)
  const ob = b + fastDiv255((tb - b) * f)
  return [
    Math.min(255, Math.max(0, or)) / 255,
    Math.min(255, Math.max(0, og)) / 255,
    Math.min(255, Math.max(0, ob)) / 255,
  ]
}

export function applyVibrance(rgb: Rgb, intensity: number): Rgb {
  const [r, g, b] = rgb
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  const luma = g * 0.715158 + r * 0.212656 + b * 0.072186
  const c = 1 + intensity * (1 + ffsign(intensity) * sat)
  return [
    quantTrunc(lerpf(luma, r, c)),
    quantTrunc(lerpf(luma, g, c)),
    quantTrunc(lerpf(luma, b, c)),
  ]
}

export interface ColorLevels {
  imin: Rgb
  coeff: Rgb
}

export function colorLevelsFor(
  blackpoint: number, whitepoint: number, frameMin: Rgb = [0, 0, 0],
): ColorLevels {
  const bp = blackpoint
  const wp = Math.max(bp + 0.01, whitepoint)
  const imax = Math.round(Math.min(wp, 1) * 255) / 255
  const omax = Math.round((wp > 1 ? (1 - bp) / (wp - bp) : 1) * 255) / 255
  const iminFixed = Math.round(bp * 255) / 255
  const imin: Rgb = bp < 0 ? [...frameMin] : [iminFixed, iminFixed, iminFixed]
  return {
    imin,
    coeff: [
      omax / (imax - imin[0]),
      omax / (imax - imin[1]),
      omax / (imax - imin[2]),
    ],
  }
}

export function applyColorLevels(rgb: Rgb, levels: ColorLevels): Rgb {
  return [
    quantTrunc((rgb[0] - levels.imin[0]) * levels.coeff[0]),
    quantTrunc((rgb[1] - levels.imin[1]) * levels.coeff[1]),
    quantTrunc((rgb[2] - levels.imin[2]) * levels.coeff[2]),
  ]
}

function getComponent(v: number, l: number, s: number, m: number, h: number): number {
  const a = 4
  const b = 0.333
  const scale = 0.7
  const sw = s * clamp01((b - l) * a + 0.5) * scale
  const mw = m * clamp01((l - b) * a + 0.5) * clamp01((1 - l - b) * a + 0.5) * scale
  const hw = h * clamp01((l + b - 1) * a + 0.5) * scale
  return clamp01(v + sw + mw + hw)
}

function hfun(n: number, h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l)
  const k = ((n + h / 30) % 12 + 12) % 12
  return clamp01(l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))
}

function preservel(rgb: Rgb, l: number): Rgb {
  const [r, g, b] = rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const hl = l * 0.5
  let h: number
  if (r === g && g === b) h = 0
  else if (max === r) h = 60 * (0 + (g - b) / (max - min))
  else if (max === g) h = 60 * (2 + (b - r) / (max - min))
  else h = 60 * (4 + (r - g) / (max - min))
  if (h < 0) h += 360
  const s = max === 1 || min === 0
    ? 0
    : (max - min) / (1 - Math.abs(2 * hl - 1))
  return [hfun(0, h, s, hl), hfun(8, h, s, hl), hfun(4, h, s, hl)]
}

export function applyColorBalance(
  rgb: Rgb,
  shadows: Rgb, midtones: Rgb, highlights: Rgb,
  preserveLightness: boolean,
): Rgb {
  const l = Math.max(...rgb) + Math.min(...rgb)
  let out: Rgb = [
    getComponent(rgb[0], l, shadows[0], midtones[0], highlights[0]),
    getComponent(rgb[1], l, shadows[1], midtones[1], highlights[1]),
    getComponent(rgb[2], l, shadows[2], midtones[2], highlights[2]),
  ]
  if (preserveLightness) out = preservel(out, l)
  return [quantRound(out[0]), quantRound(out[1]), quantRound(out[2])]
}

export interface VideoColorUniforms {
  active: VideoColorActive
  black: number
  scale: number
  tempColor: Rgb
  tempMix: number
  hsMatrix: number[]
  vibrance: number
  levelsMin: Rgb
  levelsCoeff: Rgb
  shadows: Rgb
  midtones: Rgb
  highlights: Rgb
  preserveLightness: boolean
  floatLevels: boolean
}

export function computeVideoColorUniforms(
  raw: Partial<VideoColorParams>,
  frameMin: Rgb = [0, 0, 0],
): VideoColorUniforms {
  const p = normalizeVideoColorParams(raw)
  const active = activeVideoColorFilters(p)
  const levels = levelsRunsInFloat(active)
    ? colorLevelsForFloat(p.blackpoint, p.whitepoint, frameMin)
    : colorLevelsFor(p.blackpoint, p.whitepoint, frameMin)
  return {
    active,
    black: p.black,
    scale: exposureScale(p.exposure, p.black),
    tempColor: kelvinToRgb(p.temperature),
    tempMix: p.tempMix,
    hsMatrix: hueSaturationMatrix(p.hue, p.saturation),
    vibrance: p.vibrance,
    levelsMin: levels.imin,
    levelsCoeff: levels.coeff,
    shadows: p.shadows,
    midtones: p.midtones,
    highlights: p.highlights,
    preserveLightness: p.preserveLightness,
    floatLevels: levelsRunsInFloat(active),
  }
}

export function levelsNeedsFrameMin(raw: Partial<VideoColorParams>): boolean {
  const p = normalizeVideoColorParams(raw)
  return activeVideoColorFilters(p).levels && p.blackpoint < 0
}

export function levelsRunsInFloat(active: VideoColorActive): boolean {
  return active.exposure && !active.hueSaturation && !active.vibrance
}

export const FLOAT_ENTRY_SCALE = 65280 / 65535

export function floatExit8(v: number): number {
  const v16 = Math.round(clamp01(v) * 65535)
  return Math.min(255, (v16 + 128) >> 8) / 255
}

export function colorLevelsForFloat(
  blackpoint: number, whitepoint: number, frameMin: Rgb = [0, 0, 0],
): ColorLevels {
  const bp = blackpoint
  const wp = Math.max(bp + 0.01, whitepoint)
  const imax = Math.min(wp, 1)
  const omax = wp > 1 ? (1 - bp) / (wp - bp) : 1
  const imin: Rgb = bp < 0 ? [...frameMin] : [bp, bp, bp]
  return {
    imin,
    coeff: [
      omax / (imax - imin[0]),
      omax / (imax - imin[1]),
      omax / (imax - imin[2]),
    ],
  }
}

function applyColorLevelsFloat(rgb: Rgb, levels: ColorLevels): Rgb {
  return [
    (rgb[0] - levels.imin[0]) * levels.coeff[0],
    (rgb[1] - levels.imin[1]) * levels.coeff[1],
    (rgb[2] - levels.imin[2]) * levels.coeff[2],
  ]
}

export function frameMinOf(pixels: readonly Rgb[]): Rgb {
  const min: Rgb = [1, 1, 1]
  for (const px of pixels) {
    min[0] = Math.min(min[0], px[0])
    min[1] = Math.min(min[1], px[1])
    min[2] = Math.min(min[2], px[2])
  }
  return min
}

interface PipelinePlan {
  p: VideoColorParams
  active: VideoColorActive
  matrix: number[] | null
  floatLevels: boolean
}

function planPipeline(raw: Partial<VideoColorParams>): PipelinePlan {
  const p = normalizeVideoColorParams(raw)
  const active = activeVideoColorFilters(p)
  return {
    p,
    active,
    matrix: active.hueSaturation ? hueSaturationMatrix(p.hue, p.saturation) : null,
    floatLevels: levelsRunsInFloat(active),
  }
}

function runPreLevels(rgb: Rgb, plan: PipelinePlan): { c: Rgb; float: boolean } {
  const { p, active, matrix, floatLevels } = plan
  let c: Rgb = [rgb[0], rgb[1], rgb[2]]
  let inFloat = false
  if (active.exposure) {
    c = [c[0] * FLOAT_ENTRY_SCALE, c[1] * FLOAT_ENTRY_SCALE, c[2] * FLOAT_ENTRY_SCALE]
    c = applyExposure(c, p.exposure, p.black)
    inFloat = true
    if (active.temperature) c = applyColorTemperature(c, p.temperature, p.tempMix)
  } else if (active.temperature) {
    c = applyColorTemperature(c, p.temperature, p.tempMix)
    c = [quantTrunc(c[0]), quantTrunc(c[1]), quantTrunc(c[2])]
  }
  if (inFloat && !floatLevels) {
    c = [floatExit8(c[0]), floatExit8(c[1]), floatExit8(c[2])]
    inFloat = false
  }
  if (matrix) c = applyHueSaturation(c, matrix)
  if (active.vibrance) c = applyVibrance(c, p.vibrance)
  return { c, float: inFloat }
}

function runPostLevels(
  rgb: Rgb, inFloat: boolean, plan: PipelinePlan, levels: ColorLevels,
): Rgb {
  const { p, active } = plan
  let c = rgb
  if (active.levels) {
    c = inFloat ? applyColorLevelsFloat(c, levels) : applyColorLevels(c, levels)
  }
  if (active.balance) {
    if (inFloat) {
      c = [floatExit8(c[0]), floatExit8(c[1]), floatExit8(c[2])]
      inFloat = false
    }
    c = applyColorBalance(c, p.shadows, p.midtones, p.highlights, p.preserveLightness)
  }
  if (inFloat) c = [floatExit8(c[0]), floatExit8(c[1]), floatExit8(c[2])]
  return c
}

function levelsForPlan(plan: PipelinePlan, frameMin: Rgb): ColorLevels {
  const { p, floatLevels } = plan
  return floatLevels
    ? colorLevelsForFloat(p.blackpoint, p.whitepoint, frameMin)
    : colorLevelsFor(p.blackpoint, p.whitepoint, frameMin)
}

export function applyVideoColor(
  rgb: Rgb, raw: Partial<VideoColorParams>, frameMin: Rgb = [0, 0, 0],
): Rgb {
  const plan = planPipeline(raw)
  const levels = levelsForPlan(plan, frameMin)
  const { c, float } = runPreLevels(rgb, plan)
  return runPostLevels(c, float, plan, levels)
}

export function videoColorFrameMin(
  pixels: readonly Rgb[], raw: Partial<VideoColorParams>,
): Rgb {
  if (!levelsNeedsFrameMin(raw)) return [0, 0, 0]
  const plan = planPipeline(raw)
  return frameMinOf(pixels.map((px) => runPreLevels(px, plan).c))
}

export function applyVideoColorFrame(
  pixels: readonly Rgb[], raw: Partial<VideoColorParams>,
): Rgb[] {
  const plan = planPipeline(raw)
  const pre = pixels.map((px) => runPreLevels(px, plan))
  const frameMin = plan.active.levels && plan.p.blackpoint < 0
    ? frameMinOf(pre.map((r) => r.c))
    : [0, 0, 0] as Rgb
  const levels = levelsForPlan(plan, frameMin)
  return pre.map((r) => runPostLevels(r.c, r.float, plan, levels))
}
