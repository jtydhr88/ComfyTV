import { describe, expect, it } from 'vitest'

import { MINIMUM_INCR, RULER_SCALES, computeRulerTicks, markerRect, pickScale } from './rulerTicks'

describe('pickScale', () => {
  it('picks the first scale whose label spacing clears twice the text width', () => {
    const s = pickScale(1, 1024, 7)
    expect(RULER_SCALES[s]! * 1).toBeGreaterThan(2 * (4 * 7 + 1))
    expect(s > 0 ? RULER_SCALES[s - 1]! * 1 : Infinity).not.toBeGreaterThan(2 * (4 * 7 + 1))
  })
  it('zooming in lowers the scale', () => {
    expect(pickScale(8, 1024, 7)).toBeLessThan(pickScale(0.5, 1024, 7))
  })
  it('falls back to the largest scale', () => {
    expect(pickScale(1e-9, 10, 7)).toBe(RULER_SCALES.length - 1)
  })
})

describe('computeRulerTicks', () => {
  it('labels appear exactly once per major unit', () => {
    const { labels } = computeRulerTicks({
      lower: 0, upper: 1000, lengthPx: 1000, breadthPx: 16, maxSize: 1024,
    })
    const step = Number(labels[1]!.text) - Number(labels[0]!.text)
    expect(RULER_SCALES).toContain(step)
    for (let i = 1; i < labels.length; i++) {
      expect(Number(labels[i]!.text) - Number(labels[i - 1]!.text)).toBe(step)
    }
  })
  it('never emits subdivisions tighter than MINIMUM_INCR pixels', () => {
    const { ticks } = computeRulerTicks({
      lower: 0, upper: 10000, lengthPx: 500, breadthPx: 16, maxSize: 10000,
    })
    const positions = [...new Set(ticks.map(t => t.pos))].sort((a, b) => a - b)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]! - positions[i - 1]!).toBeGreaterThan(MINIMUM_INCR - 2)
    }
  })
  it('skips sub-unit subdivisions', () => {
    const { ticks } = computeRulerTicks({
      lower: 0, upper: 10, lengthPx: 1000, breadthPx: 16, maxSize: 1024,
    })
    const positions = [...new Set(ticks.map(t => t.pos))].sort((a, b) => a - b)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]! - positions[i - 1]!).toBeGreaterThanOrEqual(99)
    }
  })
  it('offsets ticks by lower (scrolled view)', () => {
    const a = computeRulerTicks({ lower: 0, upper: 100, lengthPx: 400, breadthPx: 16, maxSize: 1024 })
    const b = computeRulerTicks({ lower: 50, upper: 150, lengthPx: 400, breadthPx: 16, maxSize: 1024 })
    const la = a.labels.find(l => l.text === '50')
    const lb = b.labels.find(l => l.text === '50')
    expect(la).toBeTruthy()
    expect(lb).toBeTruthy()
    expect(lb!.pos).toBeCloseTo(la!.pos - 200, 0)
  })
  it('major ticks are the longest', () => {
    const { ticks, labels } = computeRulerTicks({
      lower: 0, upper: 1000, lengthPx: 1000, breadthPx: 18, maxSize: 1024,
    })
    const maxLen = Math.max(...ticks.map(t => t.len))
    for (const l of labels) {
      expect(ticks.some(t => t.pos === l.pos && t.len === maxLen)).toBe(true)
    }
  })
  it('handles empty span', () => {
    const { ticks, labels } = computeRulerTicks({
      lower: 5, upper: 5, lengthPx: 100, breadthPx: 16, maxSize: 100,
    })
    expect(ticks).toHaveLength(0)
    expect(labels).toHaveLength(0)
  })
})

describe('markerRect', () => {
  it('maps position into ruler pixels with odd triangle width', () => {
    const m = markerRect(50, 0, 100, 400, 16)
    expect(m).toBeTruthy()
    expect(m!.pos).toBe(200)
    expect(m!.width % 2).toBe(1)
  })
  it('returns null when far outside the visible span', () => {
    expect(markerRect(500, 0, 100, 400, 16)).toBeNull()
  })
})
