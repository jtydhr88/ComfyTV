import { describe, expect, it } from 'vitest'

import {
  createInterpolator,
  createLinearInterpolator,
  createMonotoneInterpolator,
  curveDataToFloatLUT,
  isCurveData,
} from './curveUtils'
import type { CurveData, CurvePoint } from './types'

describe('isCurveData', () => {
  it('accepts a well-formed curve', () => {
    expect(
      isCurveData({ points: [[0, 0], [1, 1]], interpolation: 'linear' }),
    ).toBe(true)
    expect(
      isCurveData({ points: [[0, 0]], interpolation: 'monotone_cubic' }),
    ).toBe(true)
  })

  it('rejects non-objects, arrays and null', () => {
    expect(isCurveData(null)).toBe(false)
    expect(isCurveData(42)).toBe(false)
    expect(isCurveData('x')).toBe(false)
    expect(isCurveData([])).toBe(false)
  })

  it('rejects bad points or unknown interpolation', () => {
    expect(isCurveData({ points: 'nope', interpolation: 'linear' })).toBe(false)
    expect(isCurveData({ points: [[0]], interpolation: 'linear' })).toBe(false)
    expect(isCurveData({ points: [['a', 1]], interpolation: 'linear' })).toBe(false)
    expect(isCurveData({ points: [[0, 0]], interpolation: 'wat' })).toBe(false)
    expect(isCurveData({ points: [[0, 0]], interpolation: 5 })).toBe(false)
  })
})

describe('createLinearInterpolator', () => {
  it('returns 0 for empty points', () => {
    expect(createLinearInterpolator([]) (0.5)).toBe(0)
  })

  it('returns the single point y everywhere', () => {
    const f = createLinearInterpolator([[0.3, 0.7]])
    expect(f(0)).toBe(0.7)
    expect(f(1)).toBe(0.7)
  })

  it('clamps below first and above last x', () => {
    const f = createLinearInterpolator([[0, 0], [1, 10]])
    expect(f(-5)).toBe(0)
    expect(f(99)).toBe(10)
  })

  it('interpolates linearly between points', () => {
    const f = createLinearInterpolator([[0, 0], [1, 10]])
    expect(f(0.5)).toBeCloseTo(5)
    expect(f(0.25)).toBeCloseTo(2.5)
  })

  it('sorts unsorted input and handles multiple segments', () => {
    const f = createLinearInterpolator([[1, 10], [0, 0], [2, 30]])
    expect(f(0.5)).toBeCloseTo(5)
    expect(f(1.5)).toBeCloseTo(20)
  })

  it('handles duplicate x (zero-width segment)', () => {
    const f = createLinearInterpolator([[0, 0], [0.5, 5], [0.5, 9], [1, 10]])
    // querying exactly at the duplicated x is well-defined and finite
    expect(Number.isFinite(f(0.5))).toBe(true)
  })
})

describe('createMonotoneInterpolator', () => {
  it('returns 0 for empty and constant for single point', () => {
    expect(createMonotoneInterpolator([])(0.5)).toBe(0)
    const f = createMonotoneInterpolator([[0.2, 0.9]])
    expect(f(0)).toBe(0.9)
  })

  it('clamps and passes through endpoints', () => {
    const pts: CurvePoint[] = [[0, 0], [0.5, 0.5], [1, 1]]
    const f = createMonotoneInterpolator(pts)
    expect(f(-1)).toBe(0)
    expect(f(2)).toBe(1)
    expect(f(0)).toBeCloseTo(0)
    expect(f(1)).toBeCloseTo(1)
  })

  it('stays monotone (no overshoot) for a step-like curve', () => {
    const f = createMonotoneInterpolator([[0, 0], [0.5, 0], [0.6, 1], [1, 1]])
    for (let x = 0; x <= 1; x += 0.05) {
      const y = f(x)
      expect(y).toBeGreaterThanOrEqual(-1e-9)
      expect(y).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('flattens around a local plateau (delta === 0 branch)', () => {
    const f = createMonotoneInterpolator([[0, 5], [0.5, 5], [1, 5]])
    expect(f(0.5)).toBeCloseTo(5)
  })
})

describe('createInterpolator', () => {
  it('dispatches to linear vs monotone', () => {
    const pts: CurvePoint[] = [[0, 0], [1, 1]]
    expect(createInterpolator(pts, 'linear')(0.5)).toBeCloseTo(0.5)
    expect(typeof createInterpolator(pts, 'monotone_cubic')(0.5)).toBe('number')
  })
})

describe('curveDataToFloatLUT', () => {
  it('produces a LUT of the requested size with clamped endpoints', () => {
    const curve: CurveData = { points: [[0, 0], [1, 1]], interpolation: 'linear' }
    const lut = curveDataToFloatLUT(curve, 8)
    expect(lut).toBeInstanceOf(Float32Array)
    expect(lut.length).toBe(8)
    expect(lut[0]).toBeCloseTo(0)
    expect(lut[7]).toBeCloseTo(1)
  })

  it('defaults to size 256', () => {
    const curve: CurveData = { points: [[0, 0], [1, 1]], interpolation: 'monotone_cubic' }
    expect(curveDataToFloatLUT(curve).length).toBe(256)
  })
})
