import { describe, it, expect } from 'vitest'
import fixture from './videoStylizeMath.fixtures.json'
import {
  STYLIZE_EFFECTS,
  applyEdgeRgb,
  applyGrainYuv,
  applyMonochromeYuv,
  applyOldFilmRgb,
  applyPixelizeRgb,
  applySepiaPixel,
  applySepiaRgb,
  applyVignetteRgb,
  applyVignetteYuv,
  computeStylizeUniforms,
  edgeThresholdU8,
  edgeThresholds,
  grainStrength,
  hashNoise01,
  noiseOffset,
  oldFilmGrainStrength,
  oldFilmVignetteAngle,
  rgbToYuv601,
  sanitizeVideoStylizeParams,
  stylizeFilterSpecs,
  stylizeUsesCurves,
  stylizeUsesTemporalNoise,
  vignetteAngle,
  vignetteFactor,
  yuv601ToRgb,
  type YuvPlanes,
} from './videoStylizeMath'

interface FixtureCase {
  id: string
  effect: string
  params: { strength?: number; block?: number }
  filterSpecs: [string, string | null][]
  domain: string
  expected: number[] | { y: number[]; u: number[]; v: number[] }
}

interface Fixture {
  width: number
  height: number
  rgbInput: number[]
  yuvInput: { y: number[]; u: number[]; v: number[] }
  cases: FixtureCase[]
  grain: {
    strength: number
    frames: number
    means: number[]
    stds: number[]
    framePairCorr: number
    theoreticalStd: number
  }
}

const fix = fixture as unknown as Fixture
const W = fix.width
const H = fix.height

function yuvInput(): YuvPlanes {
  return {
    y: Uint8Array.from(fix.yuvInput.y),
    u: Uint8Array.from(fix.yuvInput.u),
    v: Uint8Array.from(fix.yuvInput.v),
  }
}

function caseById(id: string): FixtureCase {
  const c = fix.cases.find((x) => x.id === id)
  if (!c) throw new Error(`missing fixture case ${id}`)
  return c
}

function maxErrFlat(got: ArrayLike<number>, want: number[]): number {
  expect(got.length).toBe(want.length)
  let err = 0
  for (let i = 0; i < want.length; i++) {
    err = Math.max(err, Math.abs((got[i] as number) - want[i]))
  }
  return err
}

function maxErrYuv(
  got: YuvPlanes, want: { y: number[]; u: number[]; v: number[] },
): number {
  return Math.max(
    maxErrFlat(got.y, want.y),
    maxErrFlat(got.u, want.u),
    maxErrFlat(got.v, want.v),
  )
}

describe('vignette matches FFmpeg vf_vignette on YUV planes', () => {
  for (const [s, id] of [[0.5, 'vignette_s0.5'], [1.0, 'vignette_s1.0']] as const) {
    it(`stays within the dither budget (<=1/255) at strength ${s}`, () => {
      const c = caseById(id)
      const got = applyVignetteYuv(yuvInput(), W, H, vignetteAngle(s))
      expect(maxErrYuv(got, c.expected as { y: number[]; u: number[]; v: number[] }))
        .toBeLessThanOrEqual(1)
    })
  }

  it('zeroes the factor outside the unit distance and clamps the angle', () => {
    expect(vignetteFactor(0, 0, 64, 64, 0.75)).toBeGreaterThan(0)
    expect(vignetteFactor(0, 0, 64, 64, Math.PI)).toBeCloseTo(
      vignetteFactor(0, 0, 64, 64, Math.PI / 2), 12,
    )
    expect(vignetteFactor(32, 32, 64, 64, 0.75)).toBe(1)
  })
})

describe('monochrome matches FFmpeg vf_monochrome default path', () => {
  it('reproduces the luma curve within 1/255 and clears chroma', () => {
    const c = caseById('monochrome_default')
    const want = c.expected as { y: number[]; u: number[]; v: number[] }
    const got = applyMonochromeYuv(yuvInput())
    expect(maxErrFlat(got.y, want.y)).toBeLessThanOrEqual(1)
    expect(want.u.every((v) => v === 128)).toBe(true)
    expect(want.v.every((v) => v === 128)).toBe(true)
    expect(got.u.every((v) => v === 128)).toBe(true)
    expect(got.v.every((v) => v === 128)).toBe(true)
  })
})

describe('sepia matches FFmpeg colorchannelmixer integer LUT rounding', () => {
  it('is bit-exact on the RGB fixture', () => {
    const c = caseById('sepia')
    const got = applySepiaRgb(fix.rgbInput)
    expect(maxErrFlat(got, c.expected as number[])).toBe(0)
  })

  it('clips the summed channels to 255', () => {
    expect(applySepiaPixel(255, 255, 255)).toEqual([255, 255, 238])
  })
})

describe('pixelize matches FFmpeg vf_pixelize avg mode', () => {
  for (const b of [8, 5]) {
    it(`is bit-exact for block ${b} including partial edge blocks`, () => {
      const c = caseById(`pixelize_b${b}`)
      const got = applyPixelizeRgb(fix.rgbInput, W, H, b)
      expect(maxErrFlat(got, c.expected as number[])).toBe(0)
    })
  }
})

describe('edge matches FFmpeg vf_edgedetect colormix pipeline', () => {
  for (const [s, id] of [[0.5, 'edge_s0.5'], [0.0, 'edge_s0.0']] as const) {
    it(`is bit-exact at strength ${s}`, () => {
      const c = caseById(id)
      const { low, high } = edgeThresholds(s)
      const got = applyEdgeRgb(
        fix.rgbInput, W, H, edgeThresholdU8(low), edgeThresholdU8(high),
      )
      expect(maxErrFlat(got, c.expected as number[])).toBe(0)
    })
  }
})

describe('old_film composition matches curves->vignette FFmpeg chain', () => {
  it('stays within the dither budget with grain disabled', () => {
    const c = caseById('oldfilm_curves_vignette_s0.5')
    const got = applyOldFilmRgb(fix.rgbInput, W, H, 0.5, 0, undefined, false)
    expect(maxErrFlat(got, c.expected as number[])).toBeLessThanOrEqual(1)
  })
})

describe('grain reproduces FFmpeg vf_noise alls amplitude statistics', () => {
  it('matches mean shift, stddev, and temporal decorrelation', () => {
    const g = fix.grain
    const flat: YuvPlanes = {
      y: new Uint8Array(W * H).fill(128),
      u: new Uint8Array(W * H).fill(128),
      v: new Uint8Array(W * H).fill(128),
    }
    const deltas: Float64Array[] = []
    for (let frame = 0; frame < g.frames; frame++) {
      const out = applyGrainYuv(flat, W, H, g.strength, frame)
      const d = new Float64Array(W * H * 3)
      const planes = [out.y, out.u, out.v]
      for (let p = 0; p < 3; p++) {
        for (let i = 0; i < W * H; i++) d[p * W * H + i] = planes[p][i] - 128
      }
      deltas.push(d)
    }
    for (let frame = 0; frame < g.frames; frame++) {
      const d = deltas[frame]
      const mean = d.reduce((a, v) => a + v, 0) / d.length
      const std = Math.sqrt(
        d.reduce((a, v) => a + (v - mean) * (v - mean), 0) / d.length,
      )
      expect(Math.abs(mean - g.means[frame])).toBeLessThanOrEqual(0.35)
      expect(Math.abs(std - g.stds[frame]) / g.stds[frame]).toBeLessThan(0.15)
      expect(Math.abs(std - g.theoreticalStd) / g.theoreticalStd)
        .toBeLessThan(0.15)
    }
    const a = deltas[0]
    const b = deltas[1]
    const meanA = a.reduce((x, v) => x + v, 0) / a.length
    const meanB = b.reduce((x, v) => x + v, 0) / b.length
    let cov = 0
    let varA = 0
    let varB = 0
    for (let i = 0; i < a.length; i++) {
      cov += (a[i] - meanA) * (b[i] - meanB)
      varA += (a[i] - meanA) ** 2
      varB += (b[i] - meanB) ** 2
    }
    expect(Math.abs(cov / Math.sqrt(varA * varB))).toBeLessThan(0.05)
    expect(Math.abs(g.framePairCorr)).toBeLessThan(0.05)
  })

  it('noiseOffset spans exactly the FFmpeg uniform range', () => {
    const s = 20
    expect(noiseOffset(0, s)).toBe(-10)
    expect(noiseOffset(0.9999999, s)).toBe(9)
    expect(noiseOffset(0.5, s)).toBe(0)
    expect(noiseOffset(0, 1)).toBe(0)
    expect(noiseOffset(0.999, 1)).toBe(0)
  })

  it('hashNoise01 is deterministic and stays in [0,1)', () => {
    expect(hashNoise01(3, 5, 7, 1)).toBe(hashNoise01(3, 5, 7, 1))
    expect(hashNoise01(3, 5, 7, 1)).not.toBe(hashNoise01(3, 5, 8, 1))
    for (let i = 0; i < 200; i++) {
      const v = hashNoise01(i, i * 3, i * 7, i % 3)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('stylizeFilterSpecs mirrors backend VideoStylizeStage.execute', () => {
  it('reproduces the exact fixture filter arguments', () => {
    for (const c of fix.cases) {
      if (c.effect === 'old_film') continue
      expect(stylizeFilterSpecs({
        effect: c.effect as never,
        strength: c.params.strength ?? 0.5,
        block: c.params.block ?? 8,
      })).toEqual(c.filterSpecs)
    }
  })

  it('builds the full old_film chain in backend order', () => {
    expect(stylizeFilterSpecs({ effect: 'old_film', strength: 0.5 })).toEqual([
      ['curves', 'preset=vintage'],
      ['noise', 'alls=15:allf=t+u'],
      ['vignette', 'angle=0.6000'],
    ])
  })

  it('applies backend floors and minimums', () => {
    expect(stylizeFilterSpecs({ effect: 'vignette', strength: 0 }))
      .toEqual([['vignette', 'angle=0.0500']])
    expect(stylizeFilterSpecs({ effect: 'grain', strength: 0 }))
      .toEqual([['noise', 'alls=1:allf=t+u']])
    expect(stylizeFilterSpecs({ effect: 'edge', strength: 0 }))
      .toEqual([['edgedetect', 'low=0.020:high=0.050:mode=colormix']])
    expect(stylizeFilterSpecs({ effect: 'pixelize', block: 999 }))
      .toEqual([['pixelize', 'width=64:height=64']])
    expect(stylizeFilterSpecs({ effect: 'monochrome' }))
      .toEqual([['monochrome', null]])
  })
})

describe('sanitizeVideoStylizeParams', () => {
  it('defaults invalid values like the backend', () => {
    expect(sanitizeVideoStylizeParams({})).toEqual({
      effect: 'vignette', strength: 0.5, block: 8,
    })
    expect(sanitizeVideoStylizeParams({
      effect: 'nope' as never, strength: Number.NaN, block: 0,
    })).toEqual({ effect: 'vignette', strength: 0.5, block: 8 })
    expect(sanitizeVideoStylizeParams({ strength: 9, block: 3.9 }).strength)
      .toBe(1)
    expect(sanitizeVideoStylizeParams({ block: 3.9 }).block).toBe(3)
  })

  it('accepts every catalog effect', () => {
    for (const effect of STYLIZE_EFFECTS) {
      expect(sanitizeVideoStylizeParams({ effect }).effect).toBe(effect)
    }
  })
})

describe('computeStylizeUniforms', () => {
  it('derives per-effect parameters from the formatted backend args', () => {
    const u = computeStylizeUniforms({ effect: 'edge', strength: 0.5 })
    expect(u.effect).toBe(3)
    expect(u.edgeLow).toBe(38)
    expect(u.edgeHigh).toBe(77)
    expect(computeStylizeUniforms({ effect: 'vignette', strength: 0.5 }).angle)
      .toBe(0.75)
    expect(computeStylizeUniforms({ effect: 'old_film', strength: 0.5 }))
      .toMatchObject({ effect: 6, angle: 0.6, grain: 15 })
    expect(computeStylizeUniforms({ effect: 'grain', strength: 0.5 }).grain)
      .toBe(20)
    expect(computeStylizeUniforms({ effect: 'pixelize', block: 12 }).block)
      .toBe(12)
  })

  it('flags curve and temporal-noise usage per effect', () => {
    expect(stylizeUsesCurves({ effect: 'old_film' })).toBe(true)
    expect(stylizeUsesCurves({ effect: 'vignette' })).toBe(false)
    expect(stylizeUsesTemporalNoise({ effect: 'grain' })).toBe(true)
    expect(stylizeUsesTemporalNoise({ effect: 'old_film' })).toBe(true)
    expect(stylizeUsesTemporalNoise({ effect: 'sepia' })).toBe(false)
  })

  it('backend strength helpers truncate like Python int()', () => {
    expect(grainStrength(0.99)).toBe(39)
    expect(oldFilmGrainStrength(0.99)).toBe(29)
    expect(vignetteAngle(1)).toBe(1.5)
    expect(oldFilmVignetteAngle(1)).toBe(1.2)
  })
})

describe('BT.601 conversion glue', () => {
  it('round-trips bytes within 1/255', () => {
    for (const [r, g, b] of [
      [0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 255, 0],
      [0, 0, 255], [128, 128, 128], [10, 200, 60],
    ]) {
      const [y, u, v] = rgbToYuv601(r, g, b)
      const [r2, g2, b2] = yuv601ToRgb(y, u, v)
      expect(Math.abs(r2 - r)).toBeLessThanOrEqual(1)
      expect(Math.abs(g2 - g)).toBeLessThanOrEqual(1)
      expect(Math.abs(b2 - b)).toBeLessThanOrEqual(1)
    }
  })

  it('maps studio-swing extremes to the expected code points', () => {
    expect(rgbToYuv601(0, 0, 0)[0]).toBeCloseTo(16, 6)
    expect(rgbToYuv601(255, 255, 255)[0]).toBeCloseTo(235, 4)
    expect(rgbToYuv601(128, 128, 128)[1]).toBeCloseTo(128, 6)
  })
})

describe('vignette RGB path (old_film domain)', () => {
  it('scales all channels by the factor without chroma recentering', () => {
    const flat = new Uint8Array(4 * 4 * 3).fill(200)
    const out = applyVignetteRgb(flat, 4, 4, 1.5)
    expect(out[(2 * 4 + 2) * 3]).toBeGreaterThan(out[0])
    expect(out[0]).toBe(out[1])
    expect(out[1]).toBe(out[2])
  })
})
