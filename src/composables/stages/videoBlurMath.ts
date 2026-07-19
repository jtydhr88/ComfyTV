export type VideoBlurMode = 'gaussian' | 'box' | 'bilateral' | 'sharpen'

export interface VideoBlurParams {
  mode: VideoBlurMode
  amount: number
  size: number
  edgePreserve: number
}

export interface SanitizedBlurParams {
  mode: VideoBlurMode
  amount: number
  size: number
  edgePreserve: number
}

export interface HalfKernel {
  radius: number
  weights: number[]
}

export interface VideoBlurUniforms {
  mode: number
  radius: number
  decay: number
  invSigmaR: number
  sharpenAmount: number
}

export const MAX_BLUR_RADIUS = 64
export const MAX_BILATERAL_RADIUS = 64
const TAIL_EPS = 1e-3

const MODE_INDEX: Record<VideoBlurMode, number> = {
  gaussian: 0,
  box: 1,
  bilateral: 2,
  sharpen: 3,
}

function fin(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return dflt
  return Math.min(hi, Math.max(lo, n))
}

export function sanitizeVideoBlurParams(
  p: Partial<VideoBlurParams>,
): SanitizedBlurParams {
  const mode: VideoBlurMode =
    p.mode === 'box' || p.mode === 'bilateral' || p.mode === 'sharpen'
      ? p.mode
      : 'gaussian'
  let size = Math.trunc(fin(p.size, 0, 99, 5)) || 5
  size += (size + 1) % 2
  size = Math.min(13, Math.max(3, size))
  return {
    mode,
    amount: fin(p.amount, 0, 20, 2),
    size,
    edgePreserve: fin(p.edgePreserve, 0.01, 1, 0.1),
  }
}

export function gblurNu(sigma: number): number {
  if (sigma <= 0) return 0
  const lambda = (sigma * sigma) / 2
  return (1 + 2 * lambda - Math.sqrt(1 + 4 * lambda)) / (2 * lambda)
}

export function decayRadius(decay: number, cap: number): number {
  if (decay <= 0) return 0
  if (decay >= 1) return cap
  return Math.min(cap, Math.max(1, Math.ceil(Math.log(TAIL_EPS) / Math.log(decay))))
}

export function expHalfKernel(decay: number, cap = MAX_BLUR_RADIUS): HalfKernel {
  const radius = decayRadius(decay, cap)
  const weights: number[] = [1]
  let sum = 1
  for (let i = 1; i <= radius; i++) {
    const w = weights[i - 1] * decay
    weights.push(w)
    sum += 2 * w
  }
  return { radius, weights: weights.map((w) => w / sum) }
}

export function boxHalfKernel(radius: number): HalfKernel {
  const r = Math.max(0, Math.trunc(radius))
  const w = 1 / (2 * r + 1)
  return { radius: r, weights: Array.from({ length: r + 1 }, () => w) }
}

export function binomialHalfKernel(steps: number): HalfKernel {
  const s = Math.max(0, Math.trunc(steps))
  let center = 1
  for (let k = 1; k <= s; k++) center *= (2 * k - 1) / (2 * k)
  const weights = [center]
  for (let i = 0; i < s; i++) {
    weights.push((weights[i] * (s - i)) / (s + i + 1))
  }
  return { radius: s, weights }
}

export function bilateralSpatialDecay(sigmaS: number): number {
  if (sigmaS <= 0) return 0
  return Math.exp(-Math.SQRT2 / sigmaS)
}

export function computeVideoBlurUniforms(
  p: Partial<VideoBlurParams>,
): VideoBlurUniforms {
  const s = sanitizeVideoBlurParams(p)
  if (s.mode === 'gaussian') {
    const nu = gblurNu(s.amount)
    return {
      mode: MODE_INDEX.gaussian,
      radius: decayRadius(nu, MAX_BLUR_RADIUS),
      decay: nu,
      invSigmaR: 0,
      sharpenAmount: 0,
    }
  }
  if (s.mode === 'box') {
    return {
      mode: MODE_INDEX.box,
      radius: Math.max(1, Math.trunc(s.amount)),
      decay: 0,
      invSigmaR: 0,
      sharpenAmount: 0,
    }
  }
  if (s.mode === 'bilateral') {
    const sigmaS = Math.max(0.1, s.amount)
    const decay = bilateralSpatialDecay(sigmaS)
    return {
      mode: MODE_INDEX.bilateral,
      radius: decayRadius(decay, MAX_BILATERAL_RADIUS),
      decay,
      invSigmaR: 1 / s.edgePreserve,
      sharpenAmount: 0,
    }
  }
  const amount = fin(s.amount, 0, 5, 1)
  return {
    mode: MODE_INDEX.sharpen,
    radius: (s.size - 1) / 2,
    decay: 0,
    invSigmaR: 0,
    sharpenAmount: Math.trunc(amount * 65536) / 65536,
  }
}

function clampIndex(i: number, n: number): number {
  return i < 0 ? 0 : i >= n ? n - 1 : i
}

function convolvePass(
  src: Float64Array,
  w: number,
  h: number,
  k: HalfKernel,
  horizontal: boolean,
): Float64Array {
  const out = new Float64Array(w * h)
  const { radius, weights } = k
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = src[y * w + x] * weights[0]
      for (let i = 1; i <= radius; i++) {
        const a = horizontal
          ? src[y * w + clampIndex(x + i, w)]
          : src[clampIndex(y + i, h) * w + x]
        const b = horizontal
          ? src[y * w + clampIndex(x - i, w)]
          : src[clampIndex(y - i, h) * w + x]
        acc += weights[i] * (a + b)
      }
      out[y * w + x] = acc
    }
  }
  return out
}

export function applySeparablePlane(
  src: ArrayLike<number>,
  w: number,
  h: number,
  k: HalfKernel,
): Float64Array {
  const f = Float64Array.from(src)
  return convolvePass(convolvePass(f, w, h, k, true), w, h, k, false)
}

function bilateralPass(
  values: Float64Array,
  factors: Float64Array | null,
  texture: Float64Array,
  w: number,
  h: number,
  decay: number,
  radius: number,
  invRange: number,
  horizontal: boolean,
): { values: Float64Array; factors: Float64Array } {
  const outV = new Float64Array(w * h)
  const outF = new Float64Array(w * h)
  const at = (x: number, y: number): number =>
    clampIndex(y, h) * w + clampIndex(x, w)
  const stepW = (xa: number, ya: number, xb: number, yb: number): number =>
    decay * Math.exp(-Math.abs(texture[at(xb, yb)] - texture[at(xa, ya)]) * invRange)
  const dx = horizontal ? 1 : 0
  const dy = horizontal ? 0 : 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      let accV = 2 * values[idx]
      let accF = 2 * (factors ? factors[idx] : 1)
      let prodA = 1
      let prodB = 1
      for (let d = 1; d <= radius; d++) {
        const xa = x + dx * d
        const ya = y + dy * d
        const xb = x - dx * d
        const yb = y - dy * d
        prodA *= stepW(xa - dx, ya - dy, xa, ya)
        prodB *= stepW(xb + dx, yb + dy, xb, yb)
        const ia = at(xa, ya)
        const ib = at(xb, yb)
        accV += prodA * values[ia] + prodB * values[ib]
        accF += prodA * (factors ? factors[ia] : 1) + prodB * (factors ? factors[ib] : 1)
      }
      outV[idx] = accV
      outF[idx] = accF
    }
  }
  return { values: outV, factors: outF }
}

export function applyBilateralPlane(
  src: ArrayLike<number>,
  w: number,
  h: number,
  sigmaS: number,
  sigmaR: number,
  maxValue = 255,
): Float64Array {
  const decay = bilateralSpatialDecay(Math.max(0.1, sigmaS))
  const radius = decayRadius(decay, MAX_BILATERAL_RADIUS)
  const invRange = 1 / (sigmaR * maxValue)
  const tex = Float64Array.from(src)
  const hPass = bilateralPass(tex, null, tex, w, h, decay, radius, invRange, true)
  const vPass = bilateralPass(
    hPass.values, hPass.factors, tex, w, h, decay, radius, invRange, false,
  )
  const out = new Float64Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = vPass.values[i] / vPass.factors[i]
  return out
}

export function applySharpenPlane(
  src: ArrayLike<number>,
  w: number,
  h: number,
  size: number,
  amount: number,
): Float64Array {
  const steps = (Math.min(13, Math.max(3, size + ((size + 1) % 2)) ) - 1) / 2
  const amountInt = Math.trunc(fin(amount, 0, 5, 1) * 65536)
  const scale = Math.pow(2, 4 * steps)
  const half = scale / 2
  const binom: number[] = [1]
  for (let i = 1; i <= 2 * steps; i++) {
    const next: number[] = [1]
    for (let j = 1; j < i; j++) next.push(binom[j - 1] + binom[j])
    next.push(1)
    binom.length = 0
    binom.push(...next)
  }
  const hSum = new Float64Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let i = -steps; i <= steps; i++) {
        acc += binom[i + steps] * (src[y * w + clampIndex(x + i, w)] as number)
      }
      hSum[y * w + x] = acc
    }
  }
  const out = new Float64Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let i = -steps; i <= steps; i++) {
        acc += binom[i + steps] * hSum[clampIndex(y + i, h) * w + x]
      }
      const blur = Math.floor((acc + half) / scale)
      const s = src[y * w + x] as number
      const delta = Math.floor(((s - blur) * amountInt) / 65536)
      out[y * w + x] = Math.min(255, Math.max(0, s + delta))
    }
  }
  return out
}

export function applyVideoBlurPlane(
  src: ArrayLike<number>,
  w: number,
  h: number,
  params: Partial<VideoBlurParams>,
  maxValue = 255,
): Float64Array {
  const s = sanitizeVideoBlurParams(params)
  if (s.mode === 'gaussian') {
    if (s.amount <= 0) return Float64Array.from(src)
    return applySeparablePlane(src, w, h, expHalfKernel(gblurNu(s.amount)))
  }
  if (s.mode === 'box') {
    return applySeparablePlane(
      src, w, h, boxHalfKernel(Math.max(1, Math.trunc(s.amount))),
    )
  }
  if (s.mode === 'bilateral') {
    return applyBilateralPlane(
      src, w, h, Math.max(0.1, s.amount), s.edgePreserve, maxValue,
    )
  }
  return applySharpenPlane(src, w, h, s.size, s.amount)
}
