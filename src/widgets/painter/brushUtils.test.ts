import { describe, it, expect } from 'vitest'
import { getEffectiveBrushSize, getEffectiveHardness } from './brushUtils'

describe('getEffectiveBrushSize', () => {
  it('equals base size at hardness=1', () => {
    expect(getEffectiveBrushSize(10, 1)).toBe(10)
  })
  it('scales up at hardness=0 (max scale=1.5)', () => {
    expect(getEffectiveBrushSize(10, 0)).toBeCloseTo(15)
  })
  it('interpolates linearly', () => {
    expect(getEffectiveBrushSize(10, 0.5)).toBeCloseTo(12.5)
  })
})

describe('getEffectiveHardness', () => {
  it('zero when effective size is zero', () => {
    expect(getEffectiveHardness(10, 0.5, 0)).toBe(0)
  })
  it('preserves the physical hard-core radius', () => {
    const eff = getEffectiveBrushSize(10, 0.5)
    expect(getEffectiveHardness(10, 0.5, eff)).toBeCloseTo(5 / eff, 5)
  })
  it('handles full hardness', () => {
    const eff = getEffectiveBrushSize(10, 1)
    expect(getEffectiveHardness(10, 1, eff)).toBeCloseTo(1, 5)
  })
})
