import { describe, it, expect } from 'vitest'
import {
  MAX_BLUR_RADIUS,
  applyBilateralPlane,
  applySeparablePlane,
  applySharpenPlane,
  applyVideoBlurPlane,
  bilateralSpatialDecay,
  binomialHalfKernel,
  boxHalfKernel,
  computeVideoBlurUniforms,
  decayRadius,
  expHalfKernel,
  gblurNu,
  sanitizeVideoBlurParams,
  type HalfKernel,
} from './videoBlurMath'

function kernelSum(k: HalfKernel): number {
  return k.weights.reduce((a, w, i) => a + (i === 0 ? w : 2 * w), 0)
}

describe('sanitizeVideoBlurParams', () => {
  it('fills defaults for empty input', () => {
    expect(sanitizeVideoBlurParams({})).toEqual({
      mode: 'gaussian', amount: 2, size: 5, edgePreserve: 0.1,
    })
  })

  it('falls back to gaussian for unknown modes', () => {
    expect(sanitizeVideoBlurParams({ mode: 'nope' as never }).mode).toBe('gaussian')
    expect(sanitizeVideoBlurParams({ mode: 'sharpen' }).mode).toBe('sharpen')
  })

  it('clamps amount to 0..20 and defaults non-finite values', () => {
    expect(sanitizeVideoBlurParams({ amount: -3 }).amount).toBe(0)
    expect(sanitizeVideoBlurParams({ amount: 99 }).amount).toBe(20)
    expect(sanitizeVideoBlurParams({ amount: Number.NaN }).amount).toBe(2)
  })

  it('rounds size up to odd and clamps to 3..13', () => {
    expect(sanitizeVideoBlurParams({ size: 4 }).size).toBe(5)
    expect(sanitizeVideoBlurParams({ size: 7 }).size).toBe(7)
    expect(sanitizeVideoBlurParams({ size: 1 }).size).toBe(3)
    expect(sanitizeVideoBlurParams({ size: 40 }).size).toBe(13)
    expect(sanitizeVideoBlurParams({ size: 0 }).size).toBe(5)
  })

  it('clamps edgePreserve to 0.01..1', () => {
    expect(sanitizeVideoBlurParams({ edgePreserve: 0 }).edgePreserve).toBe(0.01)
    expect(sanitizeVideoBlurParams({ edgePreserve: 4 }).edgePreserve).toBe(1)
  })
})

describe('kernel builders', () => {
  it('computes gblur nu exactly for sigma 2', () => {
    expect(gblurNu(2)).toBeCloseTo(0.5, 12)
    expect(gblurNu(0)).toBe(0)
    expect(gblurNu(-1)).toBe(0)
  })

  it('derives a truncation radius from the decay factor', () => {
    expect(decayRadius(0, 64)).toBe(0)
    expect(decayRadius(0.5, 64)).toBe(10)
    expect(decayRadius(0.99999, 64)).toBe(64)
    expect(decayRadius(1, 64)).toBe(64)
  })

  it('builds a normalized exponential half kernel', () => {
    const k = expHalfKernel(0.5)
    expect(k.radius).toBe(10)
    expect(kernelSum(k)).toBeCloseTo(1, 12)
    expect(k.weights[1] / k.weights[0]).toBeCloseTo(0.5, 12)
    expect(expHalfKernel(0)).toEqual({ radius: 0, weights: [1] })
  })

  it('builds a uniform box half kernel', () => {
    const k = boxHalfKernel(3)
    expect(k.radius).toBe(3)
    expect(k.weights).toHaveLength(4)
    k.weights.forEach((w) => expect(w).toBeCloseTo(1 / 7, 12))
    expect(kernelSum(k)).toBeCloseTo(1, 12)
  })

  it('builds exact binomial half kernels', () => {
    expect(binomialHalfKernel(1).weights).toEqual([0.5, 0.25])
    expect(binomialHalfKernel(2).weights).toEqual([0.375, 0.25, 0.0625])
    const k6 = binomialHalfKernel(6)
    expect(k6.radius).toBe(6)
    expect(kernelSum(k6)).toBeCloseTo(1, 12)
    expect(k6.weights[6]).toBeCloseTo(1 / 4096, 15)
  })

  it('computes the bilateral spatial decay', () => {
    expect(bilateralSpatialDecay(2)).toBeCloseTo(Math.exp(-Math.SQRT2 / 2), 12)
    expect(bilateralSpatialDecay(0)).toBe(0)
  })
})

describe('computeVideoBlurUniforms', () => {
  it('maps gaussian mode with nu decay', () => {
    const u = computeVideoBlurUniforms({ mode: 'gaussian', amount: 2 })
    expect(u.mode).toBe(0)
    expect(u.decay).toBeCloseTo(0.5, 12)
    expect(u.radius).toBe(10)
  })

  it('collapses gaussian amount 0 to an identity radius', () => {
    const u = computeVideoBlurUniforms({ mode: 'gaussian', amount: 0 })
    expect(u.radius).toBe(0)
    expect(u.decay).toBe(0)
  })

  it('maps box mode with a floor of radius 1 like the backend', () => {
    expect(computeVideoBlurUniforms({ mode: 'box', amount: 0 }).radius).toBe(1)
    expect(computeVideoBlurUniforms({ mode: 'box', amount: 8.9 }).radius).toBe(8)
    expect(computeVideoBlurUniforms({ mode: 'box', amount: 8.9 }).mode).toBe(1)
  })

  it('maps bilateral mode with sigmaS floor and inverse sigmaR', () => {
    const u = computeVideoBlurUniforms({
      mode: 'bilateral', amount: 0, edgePreserve: 0.25,
    })
    expect(u.mode).toBe(2)
    expect(u.decay).toBeCloseTo(Math.exp(-Math.SQRT2 / 0.1), 12)
    expect(u.invSigmaR).toBeCloseTo(4, 12)
    expect(u.radius).toBe(1)
  })

  it('caps the bilateral radius at the documented window', () => {
    const u = computeVideoBlurUniforms({
      mode: 'bilateral', amount: 20, edgePreserve: 0.3,
    })
    expect(u.radius).toBe(64)
  })

  it('maps sharpen mode with steps and truncated fixed-point amount', () => {
    const u = computeVideoBlurUniforms({ mode: 'sharpen', amount: 2.5, size: 5 })
    expect(u.mode).toBe(3)
    expect(u.radius).toBe(2)
    expect(u.sharpenAmount).toBe(Math.trunc(2.5 * 65536) / 65536)
  })

  it('clamps sharpen amount to 5 like the backend', () => {
    const u = computeVideoBlurUniforms({ mode: 'sharpen', amount: 20, size: 3 })
    expect(u.sharpenAmount).toBe(5)
  })
})

describe('applySeparablePlane', () => {
  it('keeps a constant plane constant', () => {
    const src = new Float64Array(25).fill(80)
    const out = applySeparablePlane(src, 5, 5, expHalfKernel(0.5))
    out.forEach((v) => expect(v).toBeCloseTo(80, 10))
  })

  it('spreads an impulse as the separable outer product', () => {
    const src = new Float64Array(49)
    src[3 * 7 + 3] = 1
    const k = boxHalfKernel(1)
    const out = applySeparablePlane(src, 7, 7, k)
    expect(out[3 * 7 + 3]).toBeCloseTo(1 / 9, 12)
    expect(out[2 * 7 + 3]).toBeCloseTo(1 / 9, 12)
    expect(out[2 * 7 + 2]).toBeCloseTo(1 / 9, 12)
    expect(out[3 * 7 + 5]).toBeCloseTo(0, 12)
  })

  it('replicates edges like the backend filters', () => {
    const src = Float64Array.from({ length: 5 }, (_, x) => (x === 0 ? 10 : 0))
    const out = applySeparablePlane(src, 5, 1, boxHalfKernel(1))
    expect(out[0]).toBeCloseTo(20 / 3, 12)
  })
})

describe('applyBilateralPlane', () => {
  it('keeps a constant plane constant', () => {
    const src = new Float64Array(64).fill(120)
    const out = applyBilateralPlane(src, 8, 8, 4, 0.1)
    out.forEach((v) => expect(v).toBeCloseTo(120, 8))
  })

  it('preserves a hard edge better than a box blur of similar reach', () => {
    const w = 16
    const src = new Float64Array(w * w)
    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) src[y * w + x] = x < 8 ? 0 : 255
    }
    const bil = applyBilateralPlane(src, w, w, 3, 0.05)
    const box = applySeparablePlane(src, w, w, boxHalfKernel(3))
    const i = 8 * w + 7
    expect(Math.abs(bil[i] - src[i])).toBeLessThan(Math.abs(box[i] - src[i]))
    expect(bil[i]).toBeLessThan(20)
  })

  it('smooths within flat-ish regions', () => {
    const w = 12
    const src = new Float64Array(w * w).fill(100)
    src[6 * w + 6] = 110
    const out = applyBilateralPlane(src, w, w, 4, 0.5)
    expect(out[6 * w + 6]).toBeLessThan(109)
    expect(out[6 * w + 6]).toBeGreaterThan(100)
  })
})

describe('applySharpenPlane', () => {
  it('keeps a flat plane unchanged', () => {
    const src = new Float64Array(49).fill(90)
    const out = applySharpenPlane(src, 7, 7, 5, 2.5)
    out.forEach((v) => expect(v).toBe(90))
  })

  it('amplifies an edge with the exact fixed-point rounding', () => {
    const src = new Float64Array(49).fill(100)
    src[3 * 7 + 3] = 140
    const out = applySharpenPlane(src, 7, 7, 3, 1)
    const acc = 100 * 16 + 40 * 4
    const blur = Math.floor((acc + 8) / 16)
    expect(out[3 * 7 + 3]).toBe(140 + (140 - blur))
  })

  it('is identity when amount is zero and clamps to 0..255', () => {
    const src = new Float64Array(49).fill(30)
    src[3 * 7 + 3] = 255
    expect(applySharpenPlane(src, 7, 7, 5, 0)).toEqual(src)
    const out = applySharpenPlane(src, 7, 7, 3, 5)
    expect(out[3 * 7 + 3]).toBe(255)
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0)
  })
})

describe('applyVideoBlurPlane', () => {
  const src = Float64Array.from({ length: 64 }, (_, i) => (i * 37) % 256)

  it('is identity for gaussian with amount 0', () => {
    expect(applyVideoBlurPlane(src, 8, 8, { mode: 'gaussian', amount: 0 }))
      .toEqual(src)
  })

  it('dispatches gaussian to the exponential kernel', () => {
    const out = applyVideoBlurPlane(src, 8, 8, { mode: 'gaussian', amount: 2 })
    const ref = applySeparablePlane(src, 8, 8, expHalfKernel(gblurNu(2)))
    expect(Array.from(out)).toEqual(Array.from(ref))
  })

  it('dispatches box to a floored radius', () => {
    const out = applyVideoBlurPlane(src, 8, 8, { mode: 'box', amount: 2.7 })
    const ref = applySeparablePlane(src, 8, 8, boxHalfKernel(2))
    expect(Array.from(out)).toEqual(Array.from(ref))
  })

  it('dispatches bilateral and sharpen', () => {
    const bil = applyVideoBlurPlane(src, 8, 8, {
      mode: 'bilateral', amount: 2, edgePreserve: 0.2,
    })
    expect(Array.from(bil)).toEqual(
      Array.from(applyBilateralPlane(src, 8, 8, 2, 0.2)),
    )
    const sh = applyVideoBlurPlane(src, 8, 8, {
      mode: 'sharpen', amount: 1.5, size: 5,
    })
    expect(Array.from(sh)).toEqual(
      Array.from(applySharpenPlane(src, 8, 8, 5, 1.5)),
    )
  })

  it('caps kernel radii at MAX_BLUR_RADIUS', () => {
    expect(expHalfKernel(0.999999).radius).toBe(MAX_BLUR_RADIUS)
  })
})
