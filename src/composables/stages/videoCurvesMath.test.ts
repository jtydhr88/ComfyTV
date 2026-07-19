import { describe, it, expect } from 'vitest'
import fixture from './videoCurvesMath.fixtures.json'
import {
  NEUTRAL_VIDEO_CURVES,
  anyVideoCurvesActive,
  applyCurves,
  buildCurvesLuts,
  interpolateNatural,
  resolveCurveChannels,
  sanitizeCurvePoints,
  type VideoCurvesParams,
} from './videoCurvesMath'
import {
  VIDEO_CURVES_PRESETS,
  VIDEO_CURVES_PRESET_NAMES,
} from './videoCurvesPresets'

interface FixtureCase {
  id: string
  params: VideoCurvesParams
  filterArgs: string
  expected: number[]
}

describe('buildCurvesLuts matches FFmpeg vf_curves reference output', () => {
  const cases = fixture.cases as FixtureCase[]

  it('fixture covers presets, dedupe, master composition, and extremes', () => {
    const ids = cases.map((c) => c.id)
    expect(ids).toContain('identity_master')
    expect(ids).toContain('duplicate_x_dedupe')
    expect(ids.filter((i) => i.startsWith('preset_')).length)
      .toBeGreaterThanOrEqual(3)
    expect(ids).toContain('master_plus_green')
    expect(ids).toContain('extreme_overshoot')
  })

  for (const c of fixture.cases as FixtureCase[]) {
    it(`matches FFmpeg exactly: ${c.id}`, () => {
      const luts = buildCurvesLuts(c.params)
      const input = fixture.input
      let maxErr = 0
      for (let i = 0; i < input.length; i += 3) {
        const got = applyCurves([input[i], input[i + 1], input[i + 2]], luts)
        for (let ch = 0; ch < 3; ch++) {
          maxErr = Math.max(maxErr, Math.abs(got[ch] - c.expected[i + ch]))
        }
      }
      expect(maxErr).toBe(0)
    })
  }
})

describe('sanitizeCurvePoints mirrors backend _curve_points_arg', () => {
  it('returns null for empty, invalid, or single-point input', () => {
    expect(sanitizeCurvePoints('')).toBeNull()
    expect(sanitizeCurvePoints('   ')).toBeNull()
    expect(sanitizeCurvePoints('oops')).toBeNull()
    expect(sanitizeCurvePoints('[[0,0]]')).toBeNull()
    expect(sanitizeCurvePoints('[["a","b"],[1,1]]')).toBeNull()
  })

  it('clamps to [0,1] and quantizes to 4 decimals', () => {
    expect(sanitizeCurvePoints('[[-0.5,2],[1.5,-1]]'))
      .toEqual([[0, 1], [1, 0]])
    expect(sanitizeCurvePoints('[[0.12345,0.99999],[1,1]]'))
      .toEqual([[0.1235, 1], [1, 1]])
  })

  it('dedupes equal 4-decimal x keeping the last y, then sorts', () => {
    expect(sanitizeCurvePoints('[[1,1],[0.5,0.2],[0.50004,0.9],[0,0]]'))
      .toEqual([[0, 0], [0.5, 0.9], [1, 1]])
  })
})

describe('resolveCurveChannels preset composition', () => {
  it('fills unset channels from the preset, user channels win', () => {
    const r = resolveCurveChannels({ preset: 'vintage', red: '[[0,1],[1,0]]' })
    expect(r.red).toEqual([[0, 1], [1, 0]])
    expect(r.green).toEqual(VIDEO_CURVES_PRESETS.vintage.green)
    expect(r.blue).toEqual(VIDEO_CURVES_PRESETS.vintage.blue)
    expect(r.master).toBeNull()
  })

  it('user master overrides a master-only preset', () => {
    const r = resolveCurveChannels({ preset: 'darker', master: '[[0,0.2],[1,0.8]]' })
    expect(r.master).toEqual([[0, 0.2], [1, 0.8]])
    expect(r.red).toBeNull()
  })

  it('returns all null for neutral params', () => {
    const r = resolveCurveChannels(NEUTRAL_VIDEO_CURVES)
    expect([r.red, r.green, r.blue, r.master]).toEqual([null, null, null, null])
  })
})

describe('interpolateNatural', () => {
  it('produces the identity LUT with no points', () => {
    const lut = interpolateNatural(null)
    for (let i = 0; i < 256; i++) expect(lut[i]).toBe(i)
  })

  it('produces a constant LUT with a single point', () => {
    const lut = interpolateNatural([[0.5, 0.498]])
    expect(new Set(lut).size).toBe(1)
    expect(lut[0]).toBe(Math.trunc(0.498 * 255))
  })

  it('pads flat outside the endpoint range', () => {
    const lut = interpolateNatural([[0.2, 0], [0.8, 1]])
    expect(lut[0]).toBe(0)
    expect(lut[Math.trunc(0.2 * 255) - 1]).toBe(0)
    expect(lut[255]).toBe(255)
    expect(lut[Math.trunc(0.8 * 255) + 1]).toBe(255)
  })

  it('clips spline overshoot to the byte range', () => {
    const lut = interpolateNatural([[0, 0], [0.1, 1], [1, 1]])
    for (let i = 0; i < 256; i++) {
      expect(lut[i]).toBeGreaterThanOrEqual(0)
      expect(lut[i]).toBeLessThanOrEqual(255)
    }
    expect(lut[Math.trunc(0.1 * 255)]).toBe(255)
  })

  it('drops points colliding at the same LUT index instead of failing', () => {
    const luts = buildCurvesLuts({ master: '[[0,0],[0.5,0.5],[0.5001,1],[1,1]]' })
    expect(luts.red[0]).toBe(0)
    expect(luts.red[255]).toBe(255)
  })
})

describe('anyVideoCurvesActive', () => {
  it('is false for neutral params', () => {
    expect(anyVideoCurvesActive(NEUTRAL_VIDEO_CURVES)).toBe(false)
    expect(anyVideoCurvesActive({})).toBe(false)
  })

  it('is true with a preset or any bent channel', () => {
    expect(anyVideoCurvesActive({ preset: 'darker' })).toBe(true)
    expect(anyVideoCurvesActive({ green: '[[0,0],[0.5,0.7],[1,1]]' })).toBe(true)
  })
})

describe('videoCurvesPresets', () => {
  it('lists the exact vf_curves preset names', () => {
    expect(VIDEO_CURVES_PRESET_NAMES).toEqual([
      'none', 'color_negative', 'cross_process', 'darker',
      'increase_contrast', 'lighter', 'linear_contrast',
      'medium_contrast', 'negative', 'strong_contrast', 'vintage',
    ])
  })

  it('keeps every preset point inside the unit square', () => {
    for (const preset of Object.values(VIDEO_CURVES_PRESETS)) {
      for (const pts of Object.values(preset)) {
        for (const [x, y] of pts) {
          expect(x).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThanOrEqual(1)
          expect(y).toBeGreaterThanOrEqual(0)
          expect(y).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})
