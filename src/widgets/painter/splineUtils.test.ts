import { describe, it, expect } from 'vitest'
import { catmullRomSpline, resampleSegment } from './splineUtils'

describe('catmullRomSpline', () => {
  const p = (x: number, y: number) => ({ x, y })

  it('returns p1 at t=0', () => {
    const out = catmullRomSpline(p(0, 0), p(1, 0), p(2, 0), p(3, 0), 0)
    expect(out.x).toBeCloseTo(1)
    expect(out.y).toBeCloseTo(0)
  })

  it('returns p2 at t=1', () => {
    const out = catmullRomSpline(p(0, 0), p(1, 0), p(2, 0), p(3, 0), 1)
    expect(out.x).toBeCloseTo(2)
    expect(out.y).toBeCloseTo(0)
  })

  it('interpolates linearly when points are colinear', () => {
    const out = catmullRomSpline(p(0, 0), p(1, 0), p(2, 0), p(3, 0), 0.5)
    expect(out.x).toBeCloseTo(1.5, 1)
    expect(out.y).toBeCloseTo(0)
  })

  it('handles coincident points without NaN', () => {
    const out = catmullRomSpline(p(0, 0), p(0, 0), p(0, 0), p(0, 0), 0.5)
    expect(Number.isNaN(out.x)).toBe(false)
    expect(Number.isNaN(out.y)).toBe(false)
  })

  it('produces curvature for non-colinear points', () => {
    const out = catmullRomSpline(p(0, 0), p(1, 0), p(2, 1), p(3, 0), 0.5)
    expect(out.x).toBeGreaterThan(1)
    expect(out.x).toBeLessThan(2)
  })
})

describe('resampleSegment', () => {
  const p = (x: number, y: number) => ({ x, y })

  it('returns empty + startOffset when no points', () => {
    const { points, remainder } = resampleSegment([], 5, 2)
    expect(points).toEqual([])
    expect(remainder).toBe(2)
  })

  it('samples a straight horizontal line at spacing', () => {
    const { points, remainder } = resampleSegment(
      [p(0, 0), p(10, 0)], 2, 0,
    )
    for (let i = 1; i < points.length; i++) {
      expect(points[i].x).toBeGreaterThan(points[i - 1].x)
    }
    expect(remainder).toBeGreaterThanOrEqual(0)
  })

  it('preserves remainder between calls', () => {
    const a = resampleSegment([p(0, 0), p(5, 0)], 3, 0)
    expect(a.remainder).toBeGreaterThanOrEqual(0)
    const b = resampleSegment([p(5, 0), p(10, 0)], 3, a.remainder)
    expect(b.remainder).toBeGreaterThanOrEqual(0)
  })

  it('handles zero-length segments by emitting points at the duplicated point', () => {
    const { points } = resampleSegment(
      [p(0, 0), p(0, 0), p(5, 0)], 2, 0,
    )
    for (const pt of points) {
      expect(Number.isNaN(pt.x)).toBe(false)
      expect(Number.isNaN(pt.y)).toBe(false)
    }
  })
})
