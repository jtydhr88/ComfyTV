import { describe, expect, it } from 'vitest'

import { applyAdjustment, defaultParams, packParams } from './adjust'
import { linearToSrgb, srgbToLinear } from './color'
import type { RGBA } from './blend'

const px = (r: number, g: number, b: number, a = 1): RGBA => [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b), a]
const gamma = (out: RGBA): number[] => [linearToSrgb(out[0]), linearToSrgb(out[1]), linearToSrgb(out[2]), out[3]]

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
