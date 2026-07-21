import { describe, expect, it } from 'vitest'

import { blendComposite, blendPixel, type RGBA } from './blend'
import { luminance } from './color'
import { defaultMode, resolveMode, type EffectiveMode } from './mode'

const eff = (over: Partial<EffectiveMode> = {}): EffectiveMode => ({
  ...resolveMode(defaultMode('normal')),
  ...over,
})

const close = (a: number, b: number, eps = 1e-5) => expect(Math.abs(a - b)).toBeLessThan(eps)
const closeRGBA = (a: RGBA, b: RGBA, eps = 1e-5) => a.forEach((v, i) => close(v, b[i], eps))

describe('blendPixel — GIMP formulas', () => {
  it('multiply is per-channel product', () => {
    expect(blendPixel('multiply', [0.5, 0.4, 0.2], [0.5, 0.5, 0.5])).toEqual([0.25, 0.2, 0.1])
  })

  it('screen', () => {
    const [r] = blendPixel('screen', [0.5, 0, 0], [0.5, 0, 0])
    close(r, 0.75)
  })

  it('normal returns the layer colour', () => {
    expect(blendPixel('normal', [1, 0, 0], [0.2, 0.3, 0.4])).toEqual([0.2, 0.3, 0.4])
  })

  it('difference is abs', () => {
    expect(blendPixel('difference', [0.7, 0.2, 0.5], [0.2, 0.5, 0.5])).toEqual([
      expect.closeTo(0.5, 5),
      expect.closeTo(0.3, 5),
      0,
    ])
  })

  it('overlay branches on the backdrop', () => {
    const [lo] = blendPixel('overlay', [0.25, 0, 0], [0.6, 0, 0])
    close(lo, 2 * 0.25 * 0.6)
    const [hi] = blendPixel('overlay', [0.75, 0, 0], [0.6, 0, 0])
    close(hi, 1 - 2 * (1 - 0.6) * (1 - 0.75))
  })

  it('color-burn / color-dodge use safe division (guards div by zero)', () => {
    expect(blendPixel('color-dodge', [0.5, 0, 0], [1, 0, 0])[0]).toBe(0)
    expect(blendPixel('color-burn', [0.5, 0, 0], [0, 0, 0])[0]).toBe(1)
  })

  it('exclusion midpoint', () => {
    expect(blendPixel('exclusion', [0.5, 0, 0], [0.5, 0, 0])[0]).toBe(0.5)
  })
})

describe('blendComposite — coverage & Porter-Duff union', () => {
  const normal = eff()

  it('opaque layer fully replaces the backdrop', () => {
    closeRGBA(blendComposite(normal, [1, 0, 0, 1], [0, 0, 1, 1], 1), [0, 0, 1, 1])
  })

  it('half-alpha layer is a 50/50 mix over an opaque backdrop', () => {
    closeRGBA(blendComposite(normal, [1, 0, 0, 1], [0, 0, 1, 0.5], 1), [0.5, 0, 0.5, 1])
  })

  it('opacity multiplies into coverage identically to alpha', () => {
    const viaOpacity = blendComposite(normal, [1, 0, 0, 1], [0, 0, 1, 1], 0.5)
    const viaAlpha = blendComposite(normal, [1, 0, 0, 1], [0, 0, 1, 0.5], 1)
    closeRGBA(viaOpacity, viaAlpha)
  })

  it('mask multiplies into coverage identically to alpha', () => {
    const viaMask = blendComposite(normal, [1, 0, 0, 1], [0, 0, 1, 1], 1, 0.5)
    const viaAlpha = blendComposite(normal, [1, 0, 0, 1], [0, 0, 1, 0.5], 1)
    closeRGBA(viaMask, viaAlpha)
  })

  it('over an empty backdrop, the raw layer colour shows through', () => {
    closeRGBA(blendComposite(normal, [0, 0, 0, 0], [0.2, 0.4, 0.6, 0.5], 1), [0.2, 0.4, 0.6, 0.5])
  })

  it('zero coverage leaves the backdrop untouched', () => {
    closeRGBA(blendComposite(normal, [0.3, 0.3, 0.3, 1], [1, 1, 1, 1], 0), [0.3, 0.3, 0.3, 1])
  })

  it('multiply darkens where both are opaque', () => {
    const m = eff({ blend: 'multiply' })
    closeRGBA(blendComposite(m, [0.6, 0.6, 0.6, 1], [0.5, 0.5, 0.5, 1], 1), [0.3, 0.3, 0.3, 1])
  })
})

describe('GIMP default mode table (cross-check)', () => {
  it('non-normal modes composite CLIP_TO_BACKDROP; normal is UNION', () => {
    expect(resolveMode(defaultMode('normal')).composite).toBe('union')
    expect(resolveMode(defaultMode('multiply')).composite).toBe('clip-to-backdrop')
    expect(resolveMode(defaultMode('difference')).composite).toBe('clip-to-backdrop')
    expect(resolveMode(defaultMode('luminosity')).composite).toBe('clip-to-backdrop')
  })

  it('blend spaces match GIMP (multiply linear, screen/difference/dodge perceptual)', () => {
    expect(resolveMode(defaultMode('multiply')).blendSpace).toBe('linear')
    expect(resolveMode(defaultMode('linear-dodge')).blendSpace).toBe('linear')
    expect(resolveMode(defaultMode('screen')).blendSpace).toBe('perceptual')
    expect(resolveMode(defaultMode('difference')).blendSpace).toBe('perceptual')
    expect(resolveMode(defaultMode('color-dodge')).blendSpace).toBe('perceptual')
  })

  it('clip-to-backdrop: a multiply layer over a transparent backdrop stays transparent', () => {
    const m = resolveMode(defaultMode('multiply'))
    const out = blendComposite(m, [0, 0, 0, 0], [0.5, 0.5, 0.5, 1], 1)
    expect(out[3]).toBe(0)
  })

  it('colours are not clamped between layers (addition can exceed 1)', () => {
    const add = resolveMode(defaultMode('linear-dodge'))
    const out = blendComposite(add, [0.8, 0, 0, 1], [0.5, 0, 0, 1], 1)
    expect(out[0]).toBeGreaterThan(1)
  })
})

describe('blendComposite — HSL luminosity invariant', () => {
  it('luminosity transfers the layer luminance onto the backdrop', () => {
    const mode = eff({ blend: 'luminosity' })
    const out = blendComposite(mode, [0.3, 0.2, 0.1, 1], [0.15, 0.15, 0.15, 1], 1)
    close(luminance(out[0], out[1], out[2]), luminance(0.15, 0.15, 0.15), 1e-4)
  })
})
