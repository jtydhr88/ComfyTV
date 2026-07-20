export const HUE_CHANNELS = [
  'sat', 'lum', 'red', 'green', 'blue', 'r_sup', 'g_sup', 'b_sup', 'hue',
] as const

export type HueChannel = (typeof HUE_CHANNELS)[number]

export type HueCorrectLuts = Record<HueChannel, Float32Array>

export interface VideoHueCorrectParams {
  curves: string
  satThrsh: number
  luminanceMix: number
}

const LUT_SIZE = 256
const NONE = 'none'
const LUMA_R = 0.2126
const LUMA_G = 0.7152
const LUMA_B = 0.0722
const KORNIA_EPS = 1e-8

type Interp = 'none' | 'linear' | 'smooth'

interface CurveKey {
  t: number
  v: number
}

function hermiteToCubic(
  p0: number,
  p0pr: number,
  p3pl: number,
  p3: number,
): [number, number, number, number] {
  return [
    p0,
    p0pr,
    3 * (p3 - p0) - 2 * p0pr - p3pl,
    -2 * (p3 - p0) + p0pr + p3pl,
  ]
}

function cubicEval(
  c0: number,
  c1: number,
  c2: number,
  c3: number,
  t: number,
): number {
  const t2 = t * t
  return c0 + c1 * t + c2 * t2 + c3 * t2 * t
}

function autoDerivs(
  interpPrevIn: Interp,
  interpIn: Interp,
  interpNextIn: Interp,
  tprevIn: number,
  vprev: number,
  tcur: number,
  vcur: number,
  tnextIn: number,
  vnext: number,
  vprevDerivRight: number,
  vnextDerivLeft: number,
): [number, number] {
  let interp = interpIn
  let tprev = tprevIn
  let tnext = tnextIn
  const q0 = vprev
  const q3 = vcur
  const p0 = vcur
  const p3 = vnext

  if (interpPrevIn === NONE) tprev = tcur - 1
  if (interpNextIn === NONE) tnext = tcur + 1
  const p3pl = vnextDerivLeft * (tnext - tcur)
  let p0pr = 0
  let q3pl = 0

  if (interpPrevIn === NONE && interpNextIn === NONE) return [0, 0]

  if (interpPrevIn === NONE || interpNextIn === NONE) interp = 'linear'

  if (interp === 'linear') {
    if (interpNextIn === NONE) p0pr = 0
    else if (interpNextIn === 'linear') p0pr = -p0 + p3
    else p0pr = -1.5 * p0 + 1.5 * p3 - p3pl / 2

    if (interpPrevIn === NONE) q3pl = 0
    else if (interpPrevIn === 'linear') q3pl = -q0 + p0
    else q3pl = -1.5 * q0 - (vprevDerivRight * (tcur - tprev)) / 2 + 1.5 * p0
  } else {
    if ((vprev > vcur && vcur < vnext) || (vprev < vcur && vcur > vnext)) {
      p0pr = 0
      q3pl = 0
    } else {
      const deriv = (vnext - vprev) / (tnext - tprev)
      p0pr = deriv * (tnext - tcur)
      q3pl = deriv * (tcur - tprev)

      let p1 = p0 + p0pr / 3
      let q2 = q3 - q3pl / 3

      const prevMax = Math.max(vprev, vcur)
      const prevMin = Math.min(vprev, vcur)
      if (q2 < prevMin || q2 > prevMax) {
        const q2new = Math.max(prevMin, Math.min(q2, prevMax))
        p1 = p0 + ((p1 - p0) * (q3 - q2new)) / (q3 - q2)
        q2 = q2new
      }

      const nextMax = Math.max(vcur, vnext)
      const nextMin = Math.min(vcur, vnext)
      if (p1 < nextMin || p1 > nextMax) {
        const p1new = Math.max(nextMin, Math.min(p1, nextMax))
        q2 = q3 - ((q3 - q2) * (p1new - p0)) / (p1 - p0)
        p1 = p1new
      }

      p0pr = 3 * (p1 - p0)
      q3pl = 3 * (q3 - q2)
    }
  }

  return [q3pl / (tcur - tprev), p0pr / (tnext - tcur)]
}

function keyDerivs(
  keys: CurveKey[],
  i: number,
  depth: number,
): [number, number] {
  const n = keys.length
  const k = keys[i]
  const prev = i > 0 ? keys[i - 1] : null
  const next = i < n - 1 ? keys[i + 1] : null
  let interpPrev: Interp = prev ? 'smooth' : NONE
  let interpNext: Interp = next ? 'smooth' : NONE
  if (prev && i - 1 === 0) interpPrev = 'linear'
  if (next && i + 1 === n - 1) interpNext = 'linear'
  const tprev = prev ? prev.t : k.t - 1
  const vprev = prev ? prev.v : k.v
  const tnext = next ? next.t : k.t + 1
  const vnext = next ? next.v : k.v

  let vprevDr = 0
  let vnextDl = 0
  if (depth > 0) {
    if (prev) vprevDr = keyDerivs(keys, i - 1, depth - 1)[1]
    if (next) vnextDl = keyDerivs(keys, i + 1, depth - 1)[0]
  }

  return autoDerivs(
    interpPrev, 'smooth', interpNext,
    tprev, vprev, k.t, k.v, tnext, vnext,
    vprevDr, vnextDl,
  )
}

export function smoothCurveValue(keys: CurveKey[], t: number): number {
  const n = keys.length
  if (n === 0) return NaN
  if (n === 1) return keys[0].v
  if (t <= keys[0].t) return keys[0].v
  if (t >= keys[n - 1].t) return keys[n - 1].v

  let i = 0
  while (i + 1 < n && keys[i + 1].t <= t) i++
  i = Math.min(i, n - 2)
  const cur = keys[i]
  const nxt = keys[i + 1]
  const curRight = keyDerivs(keys, i, 1)[1]
  const nxtLeft = keyDerivs(keys, i + 1, 1)[0]

  const dt = nxt.t - cur.t
  const [c0, c1, c2, c3] = hermiteToCubic(
    cur.v, curRight * dt, nxtLeft * dt, nxt.v,
  )
  return cubicEval(c0, c1, c2, c3, (t - cur.t) / dt)
}

export function bakeHueLut(
  points: unknown,
  defaultValue: number,
): Float32Array {
  const lut = new Float32Array(LUT_SIZE)
  if (!Array.isArray(points) || points.length < 2) {
    lut.fill(defaultValue)
    return lut
  }
  const keys: CurveKey[] = points
    .map((p) => ({ t: Number(p[0]), v: Number(p[1]) }))
    .sort((a, b) => a.t - b.t || a.v - b.v)
  for (let i = 0; i < LUT_SIZE; i++) {
    lut[i] = smoothCurveValue(keys, i / (LUT_SIZE - 1))
  }
  return lut
}

export function parseHueCurves(raw: string): Record<string, unknown> {
  try {
    const o = JSON.parse(raw || '{}')
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      return o as Record<string, unknown>
    }
  } catch {
    void 0
  }
  return {}
}

export function buildHueCorrectLuts(curvesRaw: string): HueCorrectLuts {
  const curves = parseHueCurves(curvesRaw)
  const out = {} as HueCorrectLuts
  for (const ch of HUE_CHANNELS) {
    out[ch] = bakeHueLut(curves[ch], 1)
  }
  return out
}

export function anyHueCorrectActive(curvesRaw: string): boolean {
  const curves = parseHueCurves(curvesRaw)
  return Object.values(curves).some(
    (v) => Array.isArray(v) && v.length >= 2,
  )
}

export function sampleLut(lut: Float32Array, coord: number): number {
  const idx = Math.min(1, Math.max(0, coord)) * (lut.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, lut.length - 1)
  const f = idx - lo
  return lut[lo] * (1 - f) + lut[hi] * f
}

export function lutDeviates(lut: Float32Array): boolean {
  for (let i = 0; i < lut.length; i++) {
    if (Math.abs(lut[i] - 1) > 1e-6) return true
  }
  return false
}

export function rgbToHsvKornia(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  let argmax = 0
  let maxc = r
  if (g > maxc) {
    maxc = g
    argmax = 1
  }
  if (b > maxc) {
    maxc = b
    argmax = 2
  }
  const minc = Math.min(r, g, b)
  const deltac = maxc - minc
  const s = deltac / (maxc + KORNIA_EPS)
  const dc = deltac === 0 ? 1 : deltac
  const rc = maxc - r
  const gc = maxc - g
  const bc = maxc - b
  let h: number
  if (argmax === 0) h = bc - gc
  else if (argmax === 1) h = rc - bc + 2 * dc
  else h = gc - rc + 4 * dc
  h /= dc
  h /= 6
  h = ((h % 1) + 1) % 1
  return [h, s, maxc]
}

export function hsvToRgbKornia(
  h: number,
  s: number,
  v: number,
): [number, number, number] {
  const h6 = ((h % 1) + 1) % 1 * 6
  const hi = Math.floor(h6) % 6
  const f = h6 - Math.floor(h6)
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  const table: [number, number, number][] = [
    [v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q],
  ]
  return table[hi]
}

function luma(r: number, g: number, b: number): number {
  return r * LUMA_R + g * LUMA_G + b * LUMA_B
}

export function applyHueCorrect(
  rgb: [number, number, number],
  luts: HueCorrectLuts,
  satThrsh: number,
  luminanceMix: number,
): [number, number, number] {
  const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
  const cr = clamp01(rgb[0])
  const cg = clamp01(rgb[1])
  const cb = clamp01(rgb[2])
  const [h0, s, v] = rgbToHsvKornia(cr, cg, cb)
  let hx = h0 * 6 + 1
  hx = (hx > 6 ? hx - 6 : hx) / 6
  const lumIn = luma(rgb[0], rgb[1], rgb[2])

  let out: [number, number, number] = [cr, cg, cb]
  if (lutDeviates(luts.hue)) {
    const hueShift = sampleLut(luts.hue, hx)
    let h1 = h0 + (hueShift - 1) / 2
    h1 = h1 - Math.floor(h1)
    out = hsvToRgbKornia(h1, s, v)
  }

  const sup = (
    ch: 0 | 1 | 2,
    o1: 0 | 1 | 2,
    o2: 0 | 1 | 2,
    key: HueChannel,
  ): void => {
    const g = sampleLut(luts[key], hx)
    const mn = Math.min(out[o1], out[o2])
    if (out[ch] > mn) out[ch] = mn + g * (out[ch] - mn)
  }
  sup(0, 1, 2, 'r_sup')
  sup(1, 0, 2, 'g_sup')
  sup(2, 0, 1, 'b_sup')

  const lumGain = sampleLut(luts.lum, hx)
  const thr = Math.min(1, Math.max(0, satThrsh))
  const chans: HueChannel[] = ['red', 'green', 'blue']
  for (let ch = 0; ch < 3; ch++) {
    const gain = sampleLut(luts[chans[ch]], hx) * lumGain
    if (thr > 0) {
      const factor =
        s > thr ? (thr + (s - thr) * gain) / Math.max(s, 1e-6) : 1
      out[ch] *= factor
    } else {
      out[ch] *= gain
    }
  }

  const satGain = sampleLut(luts.sat, hx)
  const lSat = luma(out[0], out[1], out[2])
  for (let ch = 0; ch < 3; ch++) {
    out[ch] = lSat * (1 - satGain) + out[ch] * satGain
  }

  const mixv = Math.min(1, Math.max(0, luminanceMix))
  if (mixv > 0) {
    const lumOut = Math.max(luma(out[0], out[1], out[2]), 1e-6)
    const f = 1 + mixv * (lumIn / lumOut - 1)
    for (let ch = 0; ch < 3; ch++) out[ch] *= f
  }

  return [clamp01(out[0]), clamp01(out[1]), clamp01(out[2])]
}
