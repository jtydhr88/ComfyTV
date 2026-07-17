import { describe, expect, it } from 'vitest'
import { clampOffset, fmtOffset, offsetsToPuck, puckToOffsets } from './colorWheelMath'

describe('clampOffset', () => {
  it('rounds to 3 decimals and clamps to [-1, 1]', () => {
    expect(clampOffset(0.12345)).toBe(0.123)
    expect(clampOffset(1.5)).toBe(1)
    expect(clampOffset(-1.5)).toBe(-1)
    expect(clampOffset(0)).toBe(0)
  })
})

describe('fmtOffset', () => {
  it('formats with an explicit sign and 2 decimals', () => {
    expect(fmtOffset(0.5)).toBe('+0.50')
    expect(fmtOffset(-0.25)).toBe('-0.25')
    expect(fmtOffset(0)).toBe('+0.00')
    expect(fmtOffset(1)).toBe('+1.00')
  })
})

describe('offsetsToPuck', () => {
  it('maps neutral offsets to the center', () => {
    const p = offsetsToPuck({ r: 0, g: 0, b: 0 })
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
  })

  it('pushes a pure red offset straight up', () => {
    const p = offsetsToPuck({ r: 1, g: 0, b: 0 })
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(-2 / 3)
  })

  it('cancels equal offsets on all three axes', () => {
    const p = offsetsToPuck({ r: 0.5, g: 0.5, b: 0.5 })
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
  })
})

describe('puckToOffsets', () => {
  it('maps the top of the wheel to +red and -green/-blue', () => {
    expect(puckToOffsets(0, -1)).toEqual({ r: 1, g: -0.5, b: -0.5 })
  })

  it('maps the lower-left toward green', () => {
    const o = puckToOffsets(Math.cos((210 * Math.PI) / 180), -Math.sin((210 * Math.PI) / 180))
    expect(o.g).toBeCloseTo(1, 2)
    expect(o.r).toBeCloseTo(-0.5, 2)
    expect(o.b).toBeCloseTo(-0.5, 2)
  })

  it('normalizes puck positions outside the unit circle', () => {
    expect(puckToOffsets(0, -5)).toEqual(puckToOffsets(0, -1))
  })

  it('round-trips through offsetsToPuck', () => {
    const o = puckToOffsets(0.3, -0.4)
    const p = offsetsToPuck(o)
    expect(p.x).toBeCloseTo(0.3, 2)
    expect(p.y).toBeCloseTo(-0.4, 2)
  })
})
