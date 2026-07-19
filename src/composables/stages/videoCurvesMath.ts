import {
  VIDEO_CURVES_PRESETS,
  type CurvePoint,
} from '@/composables/stages/videoCurvesPresets'

export type { CurvePoint }

export interface VideoCurvesParams {
  preset: string
  master: string
  red: string
  green: string
  blue: string
}

export const NEUTRAL_VIDEO_CURVES: VideoCurvesParams = {
  preset: 'none',
  master: '',
  red: '',
  green: '',
  blue: '',
}

const LUT_SIZE = 256
const SCALE = LUT_SIZE - 1

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function quant4(v: number): number {
  return Math.round(v * 10000) / 10000
}

function clipTrunc(v: number): number {
  return Math.min(255, Math.max(0, Math.trunc(v)))
}

export function sanitizeCurvePoints(raw: string): CurvePoint[] | null {
  if (!(raw || '').trim()) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const dedup = new Map<number, number>()
  for (const p of parsed) {
    if (!Array.isArray(p) || p.length < 2) continue
    const x = Number(p[0])
    const y = Number(p[1])
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    dedup.set(quant4(clamp01(x)), quant4(clamp01(y)))
  }
  if (dedup.size < 2) return null
  return [...dedup.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([x, y]) => [x, y] as CurvePoint)
}

export interface ResolvedCurveChannels {
  red: CurvePoint[] | null
  green: CurvePoint[] | null
  blue: CurvePoint[] | null
  master: CurvePoint[] | null
}

export function resolveCurveChannels(
  p: Partial<VideoCurvesParams>,
): ResolvedCurveChannels {
  const preset = VIDEO_CURVES_PRESETS[p.preset ?? ''] ?? {}
  const pick = (
    raw: string | undefined,
    fromPreset: CurvePoint[] | undefined,
  ): CurvePoint[] | null => sanitizeCurvePoints(raw ?? '') ?? fromPreset ?? null
  return {
    red: pick(p.red, preset.red),
    green: pick(p.green, preset.green),
    blue: pick(p.blue, preset.blue),
    master: pick(p.master, preset.master),
  }
}

function usablePoints(pts: CurvePoint[] | null): CurvePoint[] | null {
  if (!pts) return null
  const out: CurvePoint[] = []
  let lastIdx = -1
  for (const pt of pts) {
    const idx = Math.trunc(pt[0] * SCALE)
    if (out.length > 0 && idx <= lastIdx) continue
    out.push(pt)
    lastIdx = idx
  }
  return out
}

export function interpolateNatural(points: CurvePoint[] | null): Uint8Array {
  const y = new Uint8Array(LUT_SIZE)
  const n = points?.length ?? 0
  if (!points || n === 0) {
    for (let i = 0; i < LUT_SIZE; i++) y[i] = i
    return y
  }
  if (n === 1) {
    y.fill(clipTrunc(points[0][1] * SCALE))
    return y
  }

  const h = new Float64Array(n - 1)
  for (let i = 0; i < n - 1; i++) h[i] = points[i + 1][0] - points[i][0]

  const r = new Float64Array(n)
  for (let i = 1; i < n - 1; i++) {
    const yp = points[i - 1][1]
    const yc = points[i][1]
    const yn = points[i + 1][1]
    r[i] = 6 * ((yn - yc) / h[i] - (yc - yp) / h[i - 1])
  }

  const bd = new Float64Array(n)
  const md = new Float64Array(n)
  const ad = new Float64Array(n)
  md[0] = 1
  md[n - 1] = 1
  for (let i = 1; i < n - 1; i++) {
    bd[i] = h[i - 1]
    md[i] = 2 * (h[i - 1] + h[i])
    ad[i] = h[i]
  }
  for (let i = 1; i < n; i++) {
    const den = md[i] - bd[i] * ad[i - 1]
    const k = den ? 1 / den : 1
    ad[i] *= k
    r[i] = (r[i] - bd[i] * r[i - 1]) * k
  }
  for (let i = n - 2; i >= 0; i--) r[i] = r[i] - ad[i] * r[i + 1]

  for (let i = 0; i < Math.trunc(points[0][0] * SCALE); i++) {
    y[i] = clipTrunc(points[0][1] * SCALE)
  }

  for (let i = 0; i < n - 1; i++) {
    const yc = points[i][1]
    const yn = points[i + 1][1]
    const a = yc
    const b = (yn - yc) / h[i] - (h[i] * r[i]) / 2 - (h[i] * (r[i + 1] - r[i])) / 6
    const c = r[i] / 2
    const d = (r[i + 1] - r[i]) / (6 * h[i])
    const xStart = Math.trunc(points[i][0] * SCALE)
    const xEnd = Math.trunc(points[i + 1][0] * SCALE)
    for (let x = xStart; x <= xEnd; x++) {
      const xx = (x - xStart) / SCALE
      const yy = a + b * xx + c * xx * xx + d * xx * xx * xx
      y[x] = clipTrunc(yy * SCALE)
    }
  }

  for (let i = Math.trunc(points[n - 1][0] * SCALE); i < LUT_SIZE; i++) {
    y[i] = clipTrunc(points[n - 1][1] * SCALE)
  }

  return y
}

export interface CurvesLuts {
  red: Uint8Array
  green: Uint8Array
  blue: Uint8Array
}

export function buildCurvesLuts(p: Partial<VideoCurvesParams>): CurvesLuts {
  const ch = resolveCurveChannels(p)
  const red = interpolateNatural(usablePoints(ch.red))
  const green = interpolateNatural(usablePoints(ch.green))
  const blue = interpolateNatural(usablePoints(ch.blue))
  const master = usablePoints(ch.master)
  if (master) {
    const m = interpolateNatural(master)
    for (const lut of [red, green, blue]) {
      for (let i = 0; i < LUT_SIZE; i++) lut[i] = m[lut[i]]
    }
  }
  return { red, green, blue }
}

export function applyCurves(
  rgb: [number, number, number],
  luts: CurvesLuts,
): [number, number, number] {
  return [luts.red[rgb[0]], luts.green[rgb[1]], luts.blue[rgb[2]]]
}

export function anyVideoCurvesActive(p: Partial<VideoCurvesParams>): boolean {
  if (VIDEO_CURVES_PRESETS[p.preset ?? '']) return true
  return [p.master, p.red, p.green, p.blue]
    .some((raw) => sanitizeCurvePoints(raw ?? '') !== null)
}
