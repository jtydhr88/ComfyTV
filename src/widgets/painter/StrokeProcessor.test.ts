import { describe, it, expect } from 'vitest'
import { StrokeProcessor } from './StrokeProcessor'

const p = (x: number, y: number) => ({ x, y })

describe('StrokeProcessor', () => {
  it('first point produces no samples', () => {
    const sp = new StrokeProcessor(2)
    expect(sp.addPoint(p(0, 0))).toEqual([])
  })

  it('second addPoint still no segment (only 3 control points after p0=p1 seed)', () => {
    const sp = new StrokeProcessor(2)
    sp.addPoint(p(0, 0))
    expect(sp.addPoint(p(5, 0))).toEqual([])
  })

  it('third addPoint produces a segment (4 control points)', () => {
    const sp = new StrokeProcessor(2)
    sp.addPoint(p(0, 0))
    sp.addPoint(p(5, 0))
    const out = sp.addPoint(p(10, 0))
    expect(out.length).toBeGreaterThan(0)
  })

  it('endStroke flushes remaining control points', () => {
    const sp = new StrokeProcessor(2)
    sp.addPoint(p(0, 0))
    sp.addPoint(p(5, 0))
    sp.addPoint(p(10, 0))
    sp.addPoint(p(15, 0))
    const out = sp.endStroke()
    expect(out.length).toBeGreaterThan(0)
  })

  it('single addPoint then endStroke emits the single dot via zero-length segment', () => {
    const sp = new StrokeProcessor(2)
    sp.addPoint(p(5, 5))
    const out = sp.endStroke()
    expect(out.length).toBeGreaterThan(0)
    for (const pt of out) {
      expect(pt.x).toBe(5)
      expect(pt.y).toBe(5)
    }
  })

  it('processed segments produce monotonically-spaced points along a line', () => {
    const sp = new StrokeProcessor(2)
    sp.addPoint(p(0, 0))
    sp.addPoint(p(5, 0))
    sp.addPoint(p(10, 0))
    const a = sp.addPoint(p(15, 0))
    const b = sp.addPoint(p(20, 0))
    const c = sp.endStroke()
    const all = [...a, ...b, ...c]
    for (let i = 1; i < all.length; i++) {
      expect(all[i].x).toBeGreaterThanOrEqual(all[i - 1].x)
    }
  })
})
