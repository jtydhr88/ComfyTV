import { describe, expect, it } from 'vitest'
import fixtures from './videoHueCorrectMath.fixtures.json'
import {
  anyHueCorrectActive,
  applyHueCorrect,
  bakeHueLut,
  buildHueCorrectLuts,
  HUE_CHANNELS,
  hsvToRgbKornia,
  lutDeviates,
  parseHueCurves,
  rgbToHsvKornia,
  sampleLut,
  smoothCurveValue,
} from './videoHueCorrectMath'

const LUT_TOL = 1e-5
const PIXEL_TOL = 1e-4

describe('bakeHueLut fixtures', () => {
  fixtures.luts.forEach((c, i) => {
    it(`case ${i} (${c.points.length} points)`, () => {
      const lut = bakeHueLut(c.points, c.default)
      expect(lut.length).toBe(256)
      for (let j = 0; j < 256; j++) {
        expect(Math.abs(lut[j] - c.expected[j]),
          `case ${i} idx ${j}: ${lut[j]} vs ${c.expected[j]}`)
          .toBeLessThan(LUT_TOL)
      }
    })
  })
})

describe('applyHueCorrect fixtures', () => {
  fixtures.pixels.forEach((p, i) => {
    it(`param set ${i}`, () => {
      const luts = buildHueCorrectLuts(JSON.stringify(p.curves))
      p.input.forEach((rgb, j) => {
        const out = applyHueCorrect(
          rgb as [number, number, number],
          luts,
          p.sat_thrsh,
          p.luminance_mix,
        )
        for (let ch = 0; ch < 3; ch++) {
          expect(Math.abs(out[ch] - p.expected[j][ch]),
            `set ${i} pixel ${j} ch ${ch}: in=${JSON.stringify(rgb)} ` +
            `got=${out[ch]} want=${p.expected[j][ch]}`)
            .toBeLessThan(PIXEL_TOL)
        }
      })
    })
  })
})

describe('smoothCurveValue', () => {
  it('constant extrapolation outside key range', () => {
    const keys = [{ t: 0.2, v: 0.5 }, { t: 0.6, v: 1.5 }]
    expect(smoothCurveValue(keys, 0)).toBe(0.5)
    expect(smoothCurveValue(keys, 0.1)).toBe(0.5)
    expect(smoothCurveValue(keys, 0.9)).toBe(1.5)
  })

  it('single key is flat', () => {
    expect(smoothCurveValue([{ t: 0.5, v: 0.7 }], 0)).toBe(0.7)
    expect(smoothCurveValue([{ t: 0.5, v: 0.7 }], 1)).toBe(0.7)
  })

  it('empty keys give NaN', () => {
    expect(smoothCurveValue([], 0.5)).toBeNaN()
  })

  it('passes through keyframes', () => {
    const keys = [
      { t: 0, v: 1 }, { t: 0.3, v: 1.4 }, { t: 0.7, v: 0.8 }, { t: 1, v: 1 },
    ]
    for (const k of keys) {
      expect(smoothCurveValue(keys, k.t)).toBeCloseTo(k.v, 10)
    }
  })
})

describe('bakeHueLut basics', () => {
  it('fills default when points missing or too few', () => {
    expect([...bakeHueLut(undefined, 1)].every((v) => v === 1)).toBe(true)
    expect([...bakeHueLut([[0.5, 0.7]], 1)].every((v) => v === 1)).toBe(true)
    expect([...bakeHueLut('nope', 0.5)].every((v) => v === 0.5)).toBe(true)
  })

  it('sorts unordered points', () => {
    const lut = bakeHueLut([[0.7, 0.3], [0.1, 0.9]], 1)
    expect(lut[0]).toBeCloseTo(0.9, 5)
    expect(lut[255]).toBeCloseTo(0.3, 5)
  })
})

describe('sampleLut', () => {
  it('interpolates linearly and clamps', () => {
    const lut = new Float32Array(256)
    for (let i = 0; i < 256; i++) lut[i] = i / 255
    expect(sampleLut(lut, 0.5)).toBeCloseTo(0.5, 6)
    expect(sampleLut(lut, -1)).toBe(0)
    expect(sampleLut(lut, 2)).toBe(1)
  })
})

describe('lutDeviates', () => {
  it('detects non-neutral LUTs', () => {
    const flat = new Float32Array(256).fill(1)
    expect(lutDeviates(flat)).toBe(false)
    flat[128] = 1.01
    expect(lutDeviates(flat)).toBe(true)
  })
})

describe('kornia HSV roundtrip', () => {
  it('matches known hues', () => {
    expect(rgbToHsvKornia(1, 0, 0)[0]).toBeCloseTo(0, 6)
    expect(rgbToHsvKornia(0, 1, 0)[0]).toBeCloseTo(1 / 3, 6)
    expect(rgbToHsvKornia(0, 0, 1)[0]).toBeCloseTo(2 / 3, 6)
    expect(rgbToHsvKornia(0.5, 0.5, 0.5)[0]).toBe(0)
  })

  it('roundtrips within eps', () => {
    const cases: [number, number, number][] = [
      [0.9, 0.05, 0.02], [0.123, 0.456, 0.789], [0.7, 0.7, 0.69],
      [0, 0, 0], [1, 1, 1],
    ]
    for (const [r, g, b] of cases) {
      const [h, s, v] = rgbToHsvKornia(r, g, b)
      const [r2, g2, b2] = hsvToRgbKornia(h, s, v)
      expect(r2).toBeCloseTo(r, 6)
      expect(g2).toBeCloseTo(g, 6)
      expect(b2).toBeCloseTo(b, 6)
    }
  })
})

describe('parseHueCurves / anyHueCorrectActive', () => {
  it('parses objects and rejects junk', () => {
    expect(parseHueCurves('{"sat":[[0,1],[1,1]]}')).toHaveProperty('sat')
    expect(parseHueCurves('')).toEqual({})
    expect(parseHueCurves('[1,2]')).toEqual({})
    expect(parseHueCurves('{bad')).toEqual({})
  })

  it('active only with a >=2 point channel', () => {
    expect(anyHueCorrectActive('')).toBe(false)
    expect(anyHueCorrectActive('{"sat":[[0,1]]}')).toBe(false)
    expect(anyHueCorrectActive('{"hue":[[0,1],[0.5,1.2]]}')).toBe(true)
  })
})

describe('buildHueCorrectLuts', () => {
  it('bakes all nine channels with neutral defaults', () => {
    const luts = buildHueCorrectLuts('')
    for (const ch of HUE_CHANNELS) {
      expect(luts[ch].length).toBe(256)
      expect(lutDeviates(luts[ch])).toBe(false)
    }
  })
})
