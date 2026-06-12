import { describe, expect, it } from 'vitest'

import {
  captureDimensions,
  DEFAULT_SHORT_SIDE,
  LABELS_4,
  parseAspect,
  RESOLUTION_TO_SHORT_SIDE,
} from './panoramaProjection'

describe('parseAspect', () => {
  it('parses "16:9" into { w: 16, h: 9 }', () => {
    expect(parseAspect('16:9')).toEqual({ w: 16, h: 9 })
  })

  it('parses "1:1" into { w: 1, h: 1 }', () => {
    expect(parseAspect('1:1')).toEqual({ w: 1, h: 1 })
  })

  it('falls back to 16:9 on garbage input', () => {
    expect(parseAspect('bad input')).toEqual({ w: 16, h: 9 })
    expect(parseAspect('')).toEqual({ w: 16, h: 9 })
    expect(parseAspect('foo:bar')).toEqual({ w: 16, h: 9 })
  })

  it('falls back when denominator is zero', () => {
    expect(parseAspect('5:0')).toEqual({ w: 16, h: 9 })
  })
})

describe('captureDimensions', () => {
  it('landscape: short side = resolution chip, long side derived', () => {
    const { w, h } = captureDimensions('16:9', '1K')
    expect(h).toBe(1024)
    expect(w).toBe(1824)
  })

  it('portrait: short side stays on the W axis, H grows', () => {
    const { w, h } = captureDimensions('9:16', '1K')
    expect(w).toBe(1024)
    expect(h).toBe(1824)
  })

  it('square aspect uses the resolution on both sides', () => {
    const { w, h } = captureDimensions('1:1', '2K')
    expect(w).toBe(2048)
    expect(h).toBe(2048)
  })

  it('snaps both sides to multiples of 8', () => {
    const { w, h } = captureDimensions('21:9', '1K')
    expect(w % 8).toBe(0)
    expect(h % 8).toBe(0)
  })

  it('clamps minimum side to 16 px (no zero or negative output)', () => {
    const { w, h } = captureDimensions('1:1000', '1K')
    expect(w).toBeGreaterThanOrEqual(16)
    expect(h).toBeGreaterThanOrEqual(16)
  })

  it('falls back to DEFAULT_SHORT_SIDE for unknown resolution chips', () => {
    const a = captureDimensions('16:9', 'NOPE')
    const b = captureDimensions('16:9', String(DEFAULT_SHORT_SIDE))
    expect(a.h).toBe(1024)
  })

  it('resolution map is consistent with the chips users see', () => {
    expect(RESOLUTION_TO_SHORT_SIDE['1K']).toBe(1024)
    expect(RESOLUTION_TO_SHORT_SIDE['2K']).toBe(2048)
    expect(RESOLUTION_TO_SHORT_SIDE['4K']).toBe(4096)
  })

  it('4-view labels are stable', () => {
    expect(LABELS_4).toEqual(['Front', 'Right', 'Back', 'Left'])
  })
})
