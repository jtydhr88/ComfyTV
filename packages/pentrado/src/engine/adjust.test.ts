import { describe, expect, it } from 'vitest'

import { applyAdjustment, curvesLutData, defaultParams, gradientMapLutData, packParams } from './adjust'
import { linearToSrgb, srgbToLinear } from './color'
import type { RGBA } from './blend'

const px = (r: number, g: number, b: number, a = 1): RGBA => [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b), a]
const gamma = (out: RGBA): number[] => [linearToSrgb(out[0]), linearToSrgb(out[1]), linearToSrgb(out[2]), out[3]]

describe('new adjustment ops', () => {
  it('levels remaps the input range through gamma to the output range', () => {
    const p = packParams('levels', { inBlack: 0.2, inWhite: 0.8, gamma: 1, outBlack: 0, outWhite: 1 })
    expect(gamma(applyAdjustment('levels', p, px(0.2, 0.5, 0.8)))[0]).toBeCloseTo(0, 4)
    expect(gamma(applyAdjustment('levels', p, px(0.2, 0.5, 0.8)))[1]).toBeCloseTo(0.5, 4)
    expect(gamma(applyAdjustment('levels', p, px(0.2, 0.5, 0.8)))[2]).toBeCloseTo(1, 4)

    const g2 = packParams('levels', { inBlack: 0, inWhite: 1, gamma: 2, outBlack: 0, outWhite: 1 })
    expect(gamma(applyAdjustment('levels', g2, px(0.25, 0.25, 0.25)))[0]).toBeCloseTo(0.5, 4)
  })

  it('neutral temperature (6500K) barely shifts, warm temperature reddens', () => {
    const neutral = packParams('temperature', { temperature: 6500, mix: 1 })
    const out = gamma(applyAdjustment('temperature', neutral, px(0.5, 0.5, 0.5)))
    expect(out[0]).toBeCloseTo(0.5, 1)
    const warm = packParams('temperature', { temperature: 3000, mix: 1 })
    const w = gamma(applyAdjustment('temperature', warm, px(0.5, 0.5, 0.5)))
    expect(w[0]).toBeGreaterThan(w[2])
  })

  it('exposure doubles linear light (GEGL photometric semantics)', () => {
    const p = packParams('exposure', { exposure: 1, black: 0 })
    const out = applyAdjustment('exposure', p, px(0.25, 0.25, 0.25))
    expect(out[0]).toBeCloseTo(srgbToLinear(0.25) * 2, 5)
  })

  it('color-balance shifts shadows more than highlights for a shadow-red push', () => {
    const p = packParams('color-balance', { shadowsR: 0.5, shadowsG: 0, shadowsB: 0, midtonesR: 0, midtonesG: 0, midtonesB: 0, highlightsR: 0, highlightsG: 0, highlightsB: 0 })
    const dark = gamma(applyAdjustment('color-balance', p, px(0.15, 0.15, 0.15)))
    const bright = gamma(applyAdjustment('color-balance', p, px(0.85, 0.85, 0.85)))
    expect(dark[0] - 0.15).toBeGreaterThan(bright[0] - 0.85)
    expect(dark[0]).toBeGreaterThan(dark[2])
  })

  it('posterize quantizes to n levels and threshold splits on luma', () => {
    const p = packParams('posterize', { levels: 2 })
    expect(gamma(applyAdjustment('posterize', p, px(0.4, 0.4, 0.4)))[0]).toBeCloseTo(0, 4)
    expect(gamma(applyAdjustment('posterize', p, px(0.6, 0.6, 0.6)))[0]).toBeCloseTo(1, 4)

    const t = packParams('threshold', { level: 0.5 })
    expect(gamma(applyAdjustment('threshold', t, px(0.4, 0.4, 0.4)))[0]).toBeCloseTo(0, 4)
    expect(gamma(applyAdjustment('threshold', t, px(0.6, 0.6, 0.6)))[0]).toBeCloseTo(1, 4)
  })

  it('vibrance boosts low-saturation colors harder than saturated ones', () => {
    const p = packParams('vibrance', { amount: 1 })
    const dull = gamma(applyAdjustment('vibrance', p, px(0.5, 0.45, 0.45)))
    expect(dull[0]).toBeGreaterThan(dull[1])
    const neutral = gamma(applyAdjustment('vibrance', p, px(0.5, 0.5, 0.5)))
    expect(neutral[0]).toBeCloseTo(0.5, 4)
  })

  it('curvesLutData is identity without curves and follows a master curve', () => {
    const id = curvesLutData(undefined)
    expect(id[0]).toBe(0)
    expect(id[128 * 4 + 1]).toBe(128)
    expect(id[255 * 4 + 2]).toBe(255)

    const boosted = curvesLutData({ master: '[[0,0],[0.5,0.75],[1,1]]' })
    expect(boosted[128 * 4]).toBeGreaterThan(160)
    expect(boosted[128 * 4]).toBe(boosted[128 * 4 + 1])
  })

  it('channel-mixer swaps and scales channels', () => {
    // Route green into red, zero the rest.
    const p = packParams('channel-mixer', { rr: 0, rg: 1, rb: 0, gr: 0, gg: 0, gb: 0, br: 0, bg: 0, bb: 0 })
    const out = gamma(applyAdjustment('channel-mixer', p, px(0.2, 0.9, 0.4)))
    expect(out[0]).toBeCloseTo(0.9, 1)
    expect(out[1]).toBeCloseTo(0, 1)
    expect(out[2]).toBeCloseTo(0, 1)
  })

  it('black-white produces neutral gray weighted toward the sliders', () => {
    const p = packParams('black-white', { red: 1, yellow: 0, green: 0, cyan: 0, blue: 0, magenta: 0 })
    const out = gamma(applyAdjustment('black-white', p, px(0.8, 0.2, 0.2)))
    expect(out[0]).toBeCloseTo(out[1], 3)
    expect(out[1]).toBeCloseTo(out[2], 3)
    // Reds-only weight follows the red channel.
    expect(out[0]).toBeCloseTo(0.8, 1)
  })

  it('photo-filter warms toward its color and density scales the effect', () => {
    const p = packParams('photo-filter', { color: 0xff6600, density: 1 })
    const warm = gamma(applyAdjustment('photo-filter', p, px(0.5, 0.5, 0.5)))
    expect(warm[0]).toBeGreaterThan(warm[2])
    const p0 = packParams('photo-filter', { color: 0xff6600, density: 0 })
    const none = gamma(applyAdjustment('photo-filter', p0, px(0.5, 0.5, 0.5)))
    expect(none[0]).toBeCloseTo(0.5, 2)
  })

  it('gradient-map maps luminance through the from→to gradient', () => {
    const lut = gradientMapLutData({ from: 0x000000, to: 0xff0000 })
    const dark = gamma(applyAdjustment('gradient-map', [], px(0.05, 0.05, 0.05), lut))
    const bright = gamma(applyAdjustment('gradient-map', [], px(0.95, 0.95, 0.95), lut))
    expect(dark[0]).toBeLessThan(0.2)
    expect(bright[0]).toBeGreaterThan(0.8)
    expect(bright[1]).toBeLessThan(0.1)
  })
})

describe('applyAdjustment', () => {
  it('invert flips gamma-space channels and preserves alpha', () => {
    const out = gamma(applyAdjustment('invert', [], px(1, 0, 0.25, 0.5)))
    expect(out[0]).toBeCloseTo(0, 5)
    expect(out[1]).toBeCloseTo(1, 5)
    expect(out[2]).toBeCloseTo(0.75, 5)
    expect(out[3]).toBe(0.5)
  })

  it('brightness runs in LINEAR light with the config value halved (GIMP op)', () => {
    const lin: RGBA = [0.4, 0.4, 0.4, 1]
    const up = applyAdjustment('brightness-contrast', [1, 0, 0, 0], lin)
    expect(up[0]).toBeCloseTo(0.4 + 0.6 * 0.5, 5)
    const down = applyAdjustment('brightness-contrast', [-1, 0, 0, 0], lin)
    expect(down[0]).toBeCloseTo(0.2, 5)
  })

  it('contrast pivots around linear mid-gray and is unclamped (float pipeline)', () => {
    const mid = applyAdjustment('brightness-contrast', [0, 0.5, 0, 0], [0.5, 0.5, 0.5, 1])
    expect(mid[0]).toBeCloseTo(0.5, 5)
    const lo = applyAdjustment('brightness-contrast', [0, 0.5, 0, 0], [0.25, 0.25, 0.25, 1])
    expect(lo[0]).toBeLessThan(0.25)
    const hot = applyAdjustment('brightness-contrast', [0, 0.9, 0, 0], [0.9, 0.9, 0.9, 1])
    expect(hot[0]).toBeGreaterThan(1)
  })

  it('hue-saturation: -100% saturation produces gray, hue 180° swaps red toward cyan', () => {
    const gray = gamma(applyAdjustment('hue-saturation', [0, -1, 0, 0], px(1, 0, 0)))
    expect(gray[0]).toBeCloseTo(gray[1], 5)
    expect(gray[1]).toBeCloseTo(gray[2], 5)

    const shifted = gamma(applyAdjustment('hue-saturation', [0.5, 0, 0, 0], px(1, 0, 0)))
    expect(shifted[1]).toBeGreaterThan(shifted[0])
    expect(shifted[2]).toBeGreaterThan(shifted[0])
  })

  it('lightness pushes toward white or black', () => {
    const brighter = gamma(applyAdjustment('hue-saturation', [0, 0, 0.5, 0], px(0.5, 0.5, 0.5)))
    expect(brighter[0]).toBeCloseTo(0.75, 5)
    const darker = gamma(applyAdjustment('hue-saturation', [0, 0, -0.5, 0], px(0.5, 0.5, 0.5)))
    expect(darker[0]).toBeCloseTo(0.25, 5)
  })
})

describe('param packing', () => {
  it('defaults and packs per op', () => {
    expect(defaultParams('brightness-contrast')).toEqual({ brightness: 0, contrast: 0 })
    expect(packParams('hue-saturation', { hue: 90, saturation: 0.5, lightness: -0.2 })).toEqual([0.25, 0.5, -0.2, 0])
    expect(packParams('invert', {})).toEqual([0, 0, 0, 0])
  })
})
