import { describe, expect, it } from 'vitest'
import {
  CURVES_H,
  CURVES_PAD,
  CURVES_W,
  evalSpline,
  fromPx,
  normalizeCurvePoints,
  splineM,
  toPx,
  type CurvePoints,
} from './curvesMath'

describe('normalizeCurvePoints', () => {
  it('falls back to the identity diagonal when fewer than two points', () => {
    expect(normalizeCurvePoints(undefined)).toEqual([[0, 0], [1, 1]])
    expect(normalizeCurvePoints(null)).toEqual([[0, 0], [1, 1]])
    expect(normalizeCurvePoints([[0.5, 0.5]])).toEqual([[0, 0], [1, 1]])
  })

  it('sorts points by x without mutating the input', () => {
    const raw: [number, number][] = [[1, 1], [0, 0], [0.5, 0.8]]
    const out = normalizeCurvePoints(raw)
    expect(out).toEqual([[0, 0], [0.5, 0.8], [1, 1]])
    expect(raw[0]).toEqual([1, 1])
  })
})

describe('splineM', () => {
  it('returns zero moments for fewer than three points', () => {
    expect(splineM([[0, 0], [1, 1]])).toEqual([0, 0])
  })

  it('returns zero interior moments for collinear points', () => {
    const m = splineM([[0, 0], [0.5, 0.5], [1, 1]])
    expect(m[0]).toBe(0)
    expect(m[1]).toBeCloseTo(0, 10)
    expect(m[2]).toBe(0)
  })

  it('produces a negative moment under a convex bump', () => {
    const m = splineM([[0, 0], [0.5, 1], [1, 0]])
    expect(m[1]).toBeLessThan(0)
  })
})

describe('evalSpline', () => {
  const line: CurvePoints = [[0, 0], [1, 1]]

  it('clamps to endpoint values outside the domain', () => {
    const m = splineM(line)
    expect(evalSpline(line, m, -1)).toBe(0)
    expect(evalSpline(line, m, 2)).toBe(1)
  })

  it('interpolates linearly with two points', () => {
    const m = splineM(line)
    expect(evalSpline(line, m, 0.25)).toBeCloseTo(0.25)
    expect(evalSpline(line, m, 0.5)).toBeCloseTo(0.5)
    expect(evalSpline(line, m, 0.75)).toBeCloseTo(0.75)
  })

  it('passes through every control point', () => {
    const p: CurvePoints = [[0, 0.1], [0.3, 0.7], [0.6, 0.4], [1, 0.9]]
    const m = splineM(p)
    for (const [x, y] of p) {
      expect(evalSpline(p, m, x)).toBeCloseTo(y, 6)
    }
  })

  it('overshoots between points of an S-bend but clamps output to [0,1]', () => {
    const p: CurvePoints = [[0, 0], [0.4, 1], [0.6, 0], [1, 1]]
    const m = splineM(p)
    for (let i = 0; i <= 50; i++) {
      const y = evalSpline(p, m, i / 50)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
    }
  })

  it('bulges above the chord for a symmetric bump', () => {
    const p: CurvePoints = [[0, 0], [0.5, 1], [1, 0]]
    const m = splineM(p)
    expect(evalSpline(p, m, 0.25)).toBeGreaterThan(0.5)
    expect(evalSpline(p, m, 0.75)).toBeGreaterThan(0.5)
  })
})

describe('toPx / fromPx', () => {
  it('maps curve space corners to padded canvas corners', () => {
    expect(toPx(0, 0)).toEqual([CURVES_PAD, CURVES_H - CURVES_PAD])
    expect(toPx(1, 1)).toEqual([CURVES_W - CURVES_PAD, CURVES_PAD])
  })

  it('round-trips interior points', () => {
    const [px, py] = toPx(0.3, 0.6)
    const [x, y] = fromPx(px, py)
    expect(x).toBeCloseTo(0.3)
    expect(y).toBeCloseTo(0.6)
  })

  it('clamps out-of-canvas pixels to [0,1]', () => {
    expect(fromPx(-100, 10000)).toEqual([0, 0])
    expect(fromPx(10000, -100)).toEqual([1, 1])
  })
})
