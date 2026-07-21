import { describe, expect, it } from 'vitest'

import { brushProfile } from './brushProfile'
import { compositeStroke } from './blendStroke'
import { CoverageBuffer } from './coverage'
import { stepStroke } from './interpolate'

describe('brushProfile (GIMP generated brush)', () => {
  it('is 1 at the centre and 0 at the edge for any hardness', () => {
    for (const h of [0, 0.5, 1]) {
      expect(brushProfile(0, h)).toBeCloseTo(1, 5)
      expect(brushProfile(1, h)).toBe(0)
    }
  })

  it('decreases monotonically with distance', () => {
    let prev = Infinity
    for (let r = 0; r <= 1; r += 0.1) {
      const v = brushProfile(r, 0.5)
      expect(v).toBeLessThanOrEqual(prev + 1e-9)
      prev = v
    }
  })

  it('a harder brush has a fuller interior', () => {
    expect(brushProfile(0.7, 0.9)).toBeGreaterThan(brushProfile(0.7, 0.1))
  })
})

describe('stepStroke (dab spacing)', () => {
  it('places evenly spaced dabs along a segment', () => {
    const { dabs, carry } = stepStroke({ x: 0, y: 0 }, { x: 10, y: 0 }, 5, 0)
    expect(dabs).toEqual([
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ])
    expect(carry).toBe(0)
  })

  it('carries leftover distance across short segments', () => {
    const r = stepStroke({ x: 0, y: 0 }, { x: 4, y: 0 }, 5, 3)
    expect(r.dabs).toEqual([{ x: 2, y: 0 }])
    expect(r.carry).toBe(2)
  })

  it('emits no dabs for a zero-length segment', () => {
    expect(stepStroke({ x: 3, y: 3 }, { x: 3, y: 3 }, 5, 1).dabs).toEqual([])
  })
})

describe('CoverageBuffer — anti-darkening (MAX accumulation)', () => {
  it('overlapping dabs do NOT build up beyond the brush flow', () => {
    const buf = new CoverageBuffer(20, 20)
    buf.stampCircle(10, 10, 4, 1, 0.5)
    buf.stampCircle(10, 10, 4, 1, 0.5)
    expect(buf.maxAt(10, 10)).toBeCloseTo(0.5, 6)
  })

  it('a later higher-flow dab raises coverage to the max', () => {
    const buf = new CoverageBuffer(20, 20)
    buf.stampCircle(10, 10, 4, 1, 0.5)
    buf.stampCircle(10, 10, 4, 1, 0.8)
    expect(buf.maxAt(10, 10)).toBeCloseTo(0.8, 6)
  })

  it('coverage falls off from centre to edge and tracks a dirty rect', () => {
    const buf = new CoverageBuffer(20, 20)
    buf.stampCircle(10, 10, 5, 0.3, 1)
    expect(buf.maxAt(10, 10)).toBeGreaterThan(buf.maxAt(14, 10))
    expect(buf.dirty).not.toBeNull()
  })
})

describe('compositeStroke — apply once at stroke opacity', () => {
  const cov = (v: number) => Float32Array.of(v)

  it('content brush paints colour over a transparent base', () => {
    const out = compositeStroke(Uint8ClampedArray.of(0, 0, 0, 0), cov(1), {
      mode: 'brush',
      channel: 'content',
      color: [255, 0, 0],
      opacity: 1,
    })
    expect([...out]).toEqual([255, 0, 0, 255])
  })

  it('content brush at half coverage over an opaque base is a 50/50 mix', () => {
    const out = compositeStroke(Uint8ClampedArray.of(0, 0, 255, 255), cov(0.5), {
      mode: 'brush',
      channel: 'content',
      color: [255, 0, 0],
      opacity: 1,
    })
    expect(out[0]).toBeCloseTo(128, -0.5)
    expect(out[2]).toBeCloseTo(128, -0.5)
    expect(out[3]).toBe(255)
  })

  it('eraser reduces alpha by the coverage', () => {
    const out = compositeStroke(Uint8ClampedArray.of(10, 20, 30, 255), cov(1), {
      mode: 'eraser',
      channel: 'content',
      color: [0, 0, 0],
      opacity: 1,
    })
    expect(out[3]).toBe(0)
    expect([out[0], out[1], out[2]]).toEqual([10, 20, 30])
  })
})
