import { describe, it, expect } from 'vitest'
import fixture from './videoColorMath.fixtures.json'
import {
  NEUTRAL_VIDEO_COLOR,
  activeVideoColorFilters,
  anyVideoColorActive,
  applyColorBalance,
  applyColorLevels,
  applyExposure,
  applyHueSaturation,
  applyVibrance,
  applyVideoColor,
  applyVideoColorFrame,
  colorLevelsFor,
  colorLevelsForFloat,
  frameMinOf,
  levelsNeedsFrameMin,
  levelsRunsInFloat,
  computeVideoColorUniforms,
  exposureScale,
  hueSaturationMatrix,
  kelvinToRgb,
  normalizeVideoColorParams,
  type Rgb,
  type VideoColorParams,
} from './videoColorMath'

const TOLERANCE = 2

interface FixtureCase {
  id: string
  params: Partial<VideoColorParams> & {
    shadows: number[]
    midtones: number[]
    highlights: number[]
  }
  filters: string[]
  expected: number[]
}

function caseParams(c: FixtureCase): Partial<VideoColorParams> {
  return {
    ...c.params,
    shadows: c.params.shadows as Rgb,
    midtones: c.params.midtones as Rgb,
    highlights: c.params.highlights as Rgb,
  }
}

const HARD_CAP = 3

interface CaseStats {
  maxErr: number
  outliers: number
  p99: number
  uncappedOutliers: number
}

function isGrayTriple(bytes: number[]): boolean {
  return bytes[0] === bytes[1] && bytes[1] === bytes[2]
}

function caseStats(c: FixtureCase): CaseStats {
  const input = fixture.input
  const pixels: Rgb[] = []
  for (let i = 0; i < input.length; i += 3) {
    pixels.push([input[i] / 255, input[i + 1] / 255, input[i + 2] / 255])
  }
  const params = caseParams(c)
  const out = applyVideoColorFrame(pixels, params)
  const grayCollapseProne = c.filters.includes('colorbalance')
    && params.preserveLightness === true
  const errs: number[] = []
  let uncappedOutliers = 0
  for (let px = 0; px < out.length; px++) {
    const got = out[px].map((v) => Math.round(v * 255))
    const want = c.expected.slice(px * 3, px * 3 + 3)
    let e = 0
    for (let ch = 0; ch < 3; ch++) e = Math.max(e, Math.abs(got[ch] - want[ch]))
    errs.push(e)
    if (e > HARD_CAP) {
      const grayCollapseFlip = grayCollapseProne
        && isGrayTriple(got) !== isGrayTriple(want)
      if (!grayCollapseFlip) uncappedOutliers++
    }
  }
  const sorted = [...errs].sort((a, b) => b - a)
  return {
    maxErr: sorted[0],
    outliers: errs.filter((e) => e > TOLERANCE).length,
    p99: sorted[Math.floor(sorted.length * 0.01)],
    uncappedOutliers,
  }
}

describe('applyVideoColor matches FFmpeg reference output', () => {
  const cases = fixture.cases as FixtureCase[]

  it('fixture covers every filter alone plus combined chains', () => {
    const singles = new Set(
      cases.filter((c) => c.filters.length === 1).map((c) => c.filters[0]),
    )
    expect([...singles].sort()).toEqual([
      'colorbalance', 'colorlevels', 'colortemperature',
      'exposure', 'huesaturation', 'vibrance',
    ])
    expect(cases.some((c) => c.filters.length === 6)).toBe(true)
  })

  for (const c of fixture.cases as FixtureCase[]) {
    it(`matches FFmpeg within ±${TOLERANCE}/255 (99th pct): ${c.id}`, () => {
      const stats = caseStats(c)
      expect(stats.p99).toBeLessThanOrEqual(TOLERANCE)
      expect(stats.outliers).toBeLessThanOrEqual(Math.ceil(fixture.input.length / 3 * 0.01))
      expect(stats.uncappedOutliers).toBe(0)
    })
  }

  it('single-filter cases stay within the hard cap everywhere', () => {
    for (const c of cases.filter((x) => x.filters.length === 1)) {
      expect(caseStats(c).maxErr, c.id).toBeLessThanOrEqual(HARD_CAP)
    }
  })

  it('most cases match within the strict tolerance everywhere', () => {
    const strict = cases.filter((c) => caseStats(c).maxErr <= TOLERANCE)
    expect(strict.length).toBeGreaterThanOrEqual(cases.length - 3)
  })
})

describe('normalizeVideoColorParams', () => {
  it('clamps every field to the backend ranges', () => {
    const p = normalizeVideoColorParams({
      exposure: 99, black: -99, temperature: 100, tempMix: 7,
      hue: 999, saturation: -5, vibrance: 9,
      blackpoint: -3, whitepoint: 9,
      shadows: [5, -5, 0.5], midtones: [0, 0, 0], highlights: [0, 0, 0],
      preserveLightness: false,
    })
    expect(p.exposure).toBe(3)
    expect(p.black).toBe(-0.1)
    expect(p.temperature).toBe(1000)
    expect(p.tempMix).toBe(1)
    expect(p.hue).toBe(180)
    expect(p.saturation).toBe(-1)
    expect(p.vibrance).toBe(2)
    expect(p.blackpoint).toBe(-0.5)
    expect(p.whitepoint).toBe(2)
    expect(p.shadows).toEqual([1, -1, 0.5])
    expect(p.preserveLightness).toBe(false)
  })

  it('fills defaults for missing fields and zero temperature', () => {
    const p = normalizeVideoColorParams({ temperature: 0 })
    expect(p).toEqual(NEUTRAL_VIDEO_COLOR)
  })

  it('recovers from non-finite input like the backend _f helper', () => {
    const p = normalizeVideoColorParams({ exposure: Number.NaN, tempMix: Number.NaN })
    expect(p.exposure).toBe(0)
    expect(p.tempMix).toBe(1)
  })
})

describe('activation mirrors VideoColorStage.execute', () => {
  it('reports everything inactive at neutral', () => {
    expect(anyVideoColorActive(NEUTRAL_VIDEO_COLOR)).toBe(false)
  })

  it('activates exposure on black alone and levels on whitepoint alone', () => {
    const a = activeVideoColorFilters({ ...NEUTRAL_VIDEO_COLOR, black: 0.01 })
    expect(a.exposure).toBe(true)
    const b = activeVideoColorFilters({ ...NEUTRAL_VIDEO_COLOR, whitepoint: 1.2 })
    expect(b.levels).toBe(true)
    expect(b.exposure).toBe(false)
  })

  it('activates balance when any single wheel channel moves', () => {
    const a = activeVideoColorFilters({
      ...NEUTRAL_VIDEO_COLOR, midtones: [0, -0.2, 0],
    })
    expect(a.balance).toBe(true)
    expect(anyVideoColorActive({ ...NEUTRAL_VIDEO_COLOR, midtones: [0, -0.2, 0] })).toBe(true)
  })
})

describe('per-filter primitives', () => {
  it('exposureScale uses 1/1024 floor when 2^-exposure equals black', () => {
    expect(exposureScale(0, 1)).toBe(1024)
    expect(exposureScale(1, 0)).toBeCloseTo(2, 6)
  })

  it('applyExposure lifts blacks with negative black offset', () => {
    const [r] = applyExposure([0, 0, 0], 0.55, -0.047)
    expect(r).toBeGreaterThan(0)
  })

  it('kelvinToRgb is neutral-ish at 6500K and warm at low kelvin', () => {
    const neutral = kelvinToRgb(6500)
    expect(neutral[0]).toBe(1)
    expect(neutral[2]).toBeGreaterThan(0.97)
    const warm = kelvinToRgb(2000)
    expect(warm[2]).toBeLessThan(warm[0])
    expect(kelvinToRgb(1500)[2]).toBe(0)
    expect(kelvinToRgb(40000)[2]).toBe(1)
  })

  it('hueSaturationMatrix is identity at hue=0 saturation=0', () => {
    const m = hueSaturationMatrix(0, 0)
    const id = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    m.forEach((v, i) => expect(v).toBeCloseTo(id[i], 5))
  })

  it('applyHueSaturation leaves gray untouched', () => {
    const m = hueSaturationMatrix(90, 0.8)
    const gray: Rgb = [128 / 255, 128 / 255, 128 / 255]
    expect(applyHueSaturation(gray, m)).toEqual(gray)
  })

  it('applyVibrance pushes saturated colors harder than muted ones', () => {
    const muted = applyVibrance([0.5, 0.45, 0.4], 1)
    const gray: Rgb = [128 / 255, 128 / 255, 128 / 255]
    expect(applyVibrance(gray, 1)).toEqual(gray)
    expect(muted[0] - muted[2]).toBeGreaterThan(0.1)
  })

  it('colorLevelsFor snaps thresholds to the 8-bit grid like FFmpeg', () => {
    const plain = colorLevelsFor(0.1, 0.9)
    expect(plain.imin[0]).toBeCloseTo(26 / 255, 10)
    expect(plain.coeff[0]).toBeCloseTo(255 / 204, 10)
    const wide = colorLevelsFor(0.2, 1.5)
    expect(wide.coeff[0]).toBeCloseTo(157 / 204, 10)
  })

  it('colorLevelsFor with negative blackpoint uses the detected frame minimum', () => {
    const l = colorLevelsFor(-0.22, 1.16, [0.1, 0, 0.05])
    expect(l.imin).toEqual([0.1, 0, 0.05])
    const omax = 225 / 255
    expect(l.coeff[0]).toBeCloseTo(omax / 0.9, 10)
    expect(l.coeff[1]).toBeCloseTo(omax, 10)
  })

  it('colorLevelsForFloat keeps exact thresholds for the float domain', () => {
    const l = colorLevelsForFloat(-0.22, 1.16, [0.1, 0, 0.05])
    const omax = (1 + 0.22) / (1.16 + 0.22)
    expect(l.imin).toEqual([0.1, 0, 0.05])
    expect(l.coeff[1]).toBeCloseTo(omax, 10)
  })

  it('levelsRunsInFloat only when exposure leads straight into levels', () => {
    const base = activeVideoColorFilters(normalizeVideoColorParams({
      exposure: 0.5, blackpoint: 0.1,
    }))
    expect(levelsRunsInFloat(base)).toBe(true)
    const broken = activeVideoColorFilters(normalizeVideoColorParams({
      exposure: 0.5, blackpoint: 0.1, vibrance: 0.3,
    }))
    expect(levelsRunsInFloat(broken)).toBe(false)
  })

  it('levelsNeedsFrameMin flags only active negative blackpoints', () => {
    expect(levelsNeedsFrameMin({ blackpoint: -0.2 })).toBe(true)
    expect(levelsNeedsFrameMin({ blackpoint: 0.2 })).toBe(false)
    expect(levelsNeedsFrameMin({})).toBe(false)
  })

  it('frameMinOf finds per-channel minima', () => {
    expect(frameMinOf([[0.5, 0.2, 1], [0.1, 0.9, 0.7]])).toEqual([0.1, 0.2, 0.7])
  })

  it('applyColorLevels clamps outside the input range', () => {
    const l = colorLevelsFor(0.2, 0.8)
    expect(applyColorLevels([0.1, 0.2, 0.9], l)).toEqual([0, 0, 1])
  })

  it('applyColorBalance with preserve keeps lightness of a pushed pixel', () => {
    const input: Rgb = [0.5, 0.5, 0.5]
    const out = applyColorBalance(input, [0, 0, 0], [0, 0, 0], [0.3, 0, 0], true)
    const l = Math.max(...out) + Math.min(...out)
    expect(l).toBeCloseTo(1, 2)
    expect(out[0]).toBeGreaterThan(out[2])
  })
})

describe('computeVideoColorUniforms', () => {
  it('bundles precomputed uniforms consistent with the primitives', () => {
    const u = computeVideoColorUniforms({
      exposure: 0.55, black: -0.047, temperature: 5700,
      hue: -35, saturation: -0.28, vibrance: 0.57,
      blackpoint: -0.22, whitepoint: 1.16,
      shadows: [0.39, -0.44, -0.83],
    })
    expect(u.active).toEqual({
      exposure: true, temperature: true, hueSaturation: true,
      vibrance: true, levels: true, balance: true,
    })
    expect(u.scale).toBeCloseTo(exposureScale(0.55, -0.047), 10)
    expect(u.tempColor).toEqual(kelvinToRgb(5700))
    expect(u.hsMatrix).toEqual(hueSaturationMatrix(-35, -0.28))
    expect(u.levelsMin).toEqual([0, 0, 0])
    expect(u.preserveLightness).toBe(true)
  })
})
