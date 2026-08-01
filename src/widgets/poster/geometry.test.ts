import { describe, expect, it } from 'vitest'
import { clamp, eff, handlePts, hitTest, rectPx } from './geometry'

describe('eff', () => {
  it('uses defaults when no override', () => {
    expect(eff({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 })
  })
  it('override wins, untouched fields preserved', () => {
    expect(eff({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, { x: 0.5 })).toEqual({ x: 0.5, y: 0.2, w: 0.3, h: 0.4 })
  })
  it('falls back to sane defaults for missing fields', () => {
    expect(eff({})).toEqual({ x: 0, y: 0, w: 0.2, h: 0.2 })
  })
  it('ignores non-finite override values', () => {
    expect(eff({ x: 0.1 }, { x: NaN as unknown as number })).toEqual({ x: 0.1, y: 0, w: 0.2, h: 0.2 })
  })
})

describe('rectPx', () => {
  it('scales normalized rect to canvas px', () => {
    expect(rectPx({ x: 0.5, y: 0.25, w: 0.5, h: 0.5 }, 200, 400)).toEqual({ x: 100, y: 100, w: 100, h: 200 })
  })
})

describe('handlePts', () => {
  it('returns 8 points in NW,N,NE,W,E,SW,S,SE order', () => {
    const pts = handlePts({ x: 0, y: 0, w: 10, h: 20 })
    expect(pts).toHaveLength(8)
    expect(pts[0]).toEqual([0, 0])
    expect(pts[1]).toEqual([5, 0])
    expect(pts[7]).toEqual([10, 20])
  })
})

describe('hitTest', () => {
  const rects = [
    { x: 0, y: 0, w: 100, h: 100 },
    { x: 50, y: 50, w: 100, h: 100 },
  ]
  it("hits the active element's handle first", () => {
    const hit = hitTest(150, 150, rects, 1, 7)
    expect(hit).toEqual({ idx: 1, mode: 'se' })
  })
  it('hits topmost body when no handle', () => {
    const hit = hitTest(75, 75, rects, -1, 7)
    expect(hit).toEqual({ idx: 1, mode: 'move' })
  })
  it('returns null outside all rects', () => {
    expect(hitTest(500, 500, rects, -1, 7)).toBeNull()
  })
  it('edge-midpoint handle resolves to its mode', () => {
    const hit = hitTest(0, 50, [{ x: 0, y: 0, w: 100, h: 100 }], 0, 7)
    expect(hit).toEqual({ idx: 0, mode: 'w' })
  })
})

describe('clamp', () => {
  it('clamps within range', () => {
    expect(clamp(-1, 0, 1)).toBe(0)
    expect(clamp(2, 0, 1)).toBe(1)
    expect(clamp(0.5, 0, 1)).toBe(0.5)
  })
})
