import { describe, expect, it } from 'vitest'

import { renderGradientPixels } from '../tools/gradientTool'
import { CoverageBuffer } from './coverage'
import { dodgeBurnValue, getCloneSource, setCloneSource } from './pixelPaintCore'
import { symmetryTransforms } from './symmetry'

describe('symmetryTransforms', () => {
  it('none yields just the identity', () => {
    const t = symmetryTransforms(undefined)
    expect(t).toHaveLength(1)
    expect(t[0]({ x: 3, y: 4 })).toEqual({ x: 3, y: 4 })
  })

  it('mirror-h reflects across the vertical centre axis', () => {
    const [, m] = symmetryTransforms({ mode: 'mirror-h', cx: 100, cy: 100 })
    expect(m({ x: 30, y: 40 })).toEqual({ x: 170, y: 40 })
  })

  it('mirror-both yields four transforms covering all quadrants', () => {
    const t = symmetryTransforms({ mode: 'mirror-both', cx: 50, cy: 50 })
    expect(t).toHaveLength(4)
    const pts = t.map((f) => f({ x: 10, y: 20 }))
    expect(pts).toContainEqual({ x: 10, y: 20 })
    expect(pts).toContainEqual({ x: 90, y: 20 })
    expect(pts).toContainEqual({ x: 10, y: 80 })
    expect(pts).toContainEqual({ x: 90, y: 80 })
  })

  it('mandala rotates around the centre by equal sectors', () => {
    const t = symmetryTransforms({ mode: 'mandala', sectors: 4, cx: 0, cy: 0 })
    expect(t).toHaveLength(4)
    const p = t[1]({ x: 10, y: 0 })
    expect(p.x).toBeCloseTo(0, 6)
    expect(p.y).toBeCloseTo(10, 6)
  })
})

describe('dodgeBurnValue (GIMP midtones transfer)', () => {
  it('dodge brightens and burn darkens midtones', () => {
    expect(dodgeBurnValue(0.5, 0.5, false)).toBeGreaterThan(0.5)
    expect(dodgeBurnValue(0.5, 0.5, true)).toBeLessThan(0.5)
  })
  it('preserves black and white', () => {
    for (const burn of [true, false]) {
      expect(dodgeBurnValue(0, 0.8, burn)).toBe(0)
      expect(dodgeBurnValue(1, 0.8, burn)).toBeCloseTo(1, 9)
    }
  })
})

describe('clone source registry', () => {
  it('stores a copy of the picked source point', () => {
    setCloneSource({ x: 5, y: 6 })
    expect(getCloneSource()).toEqual({ x: 5, y: 6 })
    setCloneSource(null)
    expect(getCloneSource()).toBeNull()
  })
})

describe('CoverageBuffer rect lists (symmetric strokes)', () => {
  it('far-apart dabs stay separate rects instead of one huge union', () => {
    const buf = new CoverageBuffer(2048, 2048)
    // Four quadrant clusters, like mirror-both painting.
    buf.stampCircle(200, 200, 20, 1, 1)
    buf.stampCircle(1800, 200, 20, 1, 1)
    buf.stampCircle(200, 1800, 20, 1, 1)
    buf.stampCircle(1800, 1800, 20, 1, 1)
    const rects = buf.dirtyRects()
    expect(rects.length).toBe(4)
    let area = 0
    for (const r of rects) area += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)
    expect(area).toBeLessThan(4 * 80 * 80)
    const recent = buf.takeRecentRects()
    expect(recent.length).toBe(4)
    expect(buf.takeRecentRects()).toEqual([])
  })

  it('nearby dabs merge into one rect', () => {
    const buf = new CoverageBuffer(512, 512)
    buf.stampCircle(100, 100, 10, 1, 1)
    buf.stampCircle(120, 100, 10, 1, 1)
    expect(buf.dirtyRects().length).toBe(1)
  })
})

describe('CoverageBuffer additive mode (airbrush)', () => {
  it('repeated dabs build up toward full coverage', () => {
    const buf = new CoverageBuffer(40, 40)
    buf.stampCircle(20, 20, 6, 1, 0.2, false, true)
    const once = buf.valueAt(20, 20)
    buf.stampCircle(20, 20, 6, 1, 0.2, false, true)
    buf.stampCircle(20, 20, 6, 1, 0.2, false, true)
    expect(buf.valueAt(20, 20)).toBeCloseTo(Math.min(1, once * 3), 5)
    for (let i = 0; i < 20; i++) buf.stampCircle(20, 20, 6, 1, 0.2, false, true)
    expect(buf.valueAt(20, 20)).toBe(1)
  })
})

describe('renderGradientPixels', () => {
  const opts = { shape: 'linear' as const, color: '#ff0000', endColor: null, reverse: false }

  it('linear FG-to-transparent ramps alpha along the drag line', () => {
    const base = new Uint8ClampedArray(10 * 1 * 4)
    const out = renderGradientPixels(base, 10, 1, { x: 0, y: 0.5 }, { x: 10, y: 0.5 }, opts)
    expect(out[3]).toBeGreaterThan(220)
    expect(out[(5 * 4) + 3]).toBeGreaterThan(90)
    expect(out[(5 * 4) + 3]).toBeLessThan(170)
    expect(out[(9 * 4) + 3]).toBeLessThan(40)
    expect(out[0]).toBe(255)
  })

  it('reverse flips the ramp', () => {
    const base = new Uint8ClampedArray(10 * 1 * 4)
    const out = renderGradientPixels(base, 10, 1, { x: 0, y: 0.5 }, { x: 10, y: 0.5 }, { ...opts, reverse: true })
    expect(out[3]).toBeLessThan(40)
    expect(out[(9 * 4) + 3]).toBeGreaterThan(220)
  })

  it('two-color gradient interpolates rgb at full alpha', () => {
    const base = new Uint8ClampedArray(11 * 1 * 4)
    const out = renderGradientPixels(base, 11, 1, { x: 0, y: 0.5 }, { x: 11, y: 0.5 }, { ...opts, endColor: '#0000ff' })
    expect(out[(5 * 4) + 3]).toBe(255)
    expect(out[5 * 4]).toBeGreaterThan(90)
    expect(out[5 * 4]).toBeLessThan(170)
    expect(out[(5 * 4) + 2]).toBeGreaterThan(90)
  })

  it('radial ramps outward from the start point', () => {
    const base = new Uint8ClampedArray(21 * 1 * 4)
    const out = renderGradientPixels(base, 21, 1, { x: 10, y: 0.5 }, { x: 20, y: 0.5 }, { ...opts, shape: 'radial' })
    expect(out[(10 * 4) + 3]).toBeGreaterThan(220)
    expect(out[(20 * 4) + 3]).toBeLessThan(50)
    expect(out[3]).toBeLessThan(50)
  })

  it('selection clips the gradient and it composites over the base', () => {
    const base = new Uint8ClampedArray(4 * 1 * 4)
    base.set([0, 255, 0, 255], 0)
    base.set([0, 255, 0, 255], 4)
    const sel = Float32Array.of(0, 1, 1, 1)
    const out = renderGradientPixels(base, 4, 1, { x: 0, y: 0.5 }, { x: 4, y: 0.5 }, { ...opts }, sel)
    expect([out[0], out[1]]).toEqual([0, 255])
    expect(out[4]).toBeGreaterThan(150)
  })
})
