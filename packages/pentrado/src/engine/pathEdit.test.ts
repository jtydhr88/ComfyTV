import { describe, expect, it } from 'vitest'

import {
  flattenStrokeAdaptive,
  hitAnchor,
  insertAnchorOnSegment,
  moveAnchorTriple,
  moveControl,
  nearestPointOnPath,
  removeAnchorTriple,
} from './pathEdit'
import { linePath, rectPath, strokeFromTriples, type PathData } from './vector'

function curveStroke() {
  return strokeFromTriples(
    [
      { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 50, y: -80 },
      { x: 150, y: -80 }, { x: 200, y: 0 }, { x: 200, y: 0 },
    ],
    false
  )
}

describe('flattenStrokeAdaptive', () => {
  it('keeps straight segments to a couple of points', () => {
    const stroke = linePath(0, 0, 100, 0).strokes[0]
    const pts = flattenStrokeAdaptive(stroke, 0.25)
    expect(pts.length).toBeLessThanOrEqual(3)
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    expect(pts[pts.length - 1]).toEqual({ x: 100, y: 0 })
  })

  it('subdivides curves until they are flat within tolerance', () => {
    const pts = flattenStrokeAdaptive(curveStroke(), 0.25)
    expect(pts.length).toBeGreaterThan(8)
    let maxJump = 0
    for (let i = 1; i < pts.length; i++) {
      maxJump = Math.max(maxJump, Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
    }
    expect(maxJump).toBeLessThan(60)
    const minY = Math.min(...pts.map((p) => p.y))
    expect(minY).toBeLessThan(-40)
  })
})

describe('nearestPointOnPath', () => {
  it('projects onto a straight segment', () => {
    const path = linePath(0, 0, 100, 0)
    const hit = nearestPointOnPath(path, { x: 40, y: 10 })!
    expect(hit.point.x).toBeCloseTo(40, 1)
    expect(hit.point.y).toBeCloseTo(0, 1)
    expect(hit.dist).toBeCloseTo(10, 1)
  })

  it('finds the closest of several segments', () => {
    const path = rectPath(0, 0, 100, 100)
    const hit = nearestPointOnPath(path, { x: 102, y: 50 })!
    expect(hit.point.x).toBeCloseTo(100, 1)
    expect(hit.point.y).toBeCloseTo(50, 1)
  })
})

describe('hitAnchor', () => {
  it('prefers anchors and reports triple index and slot', () => {
    const path = rectPath(0, 0, 100, 100)
    const hit = hitAnchor(path, { x: 99, y: 2 }, 6)!
    expect(hit.slot).toBe('anchor')
    expect(hit.tripleIndex).toBe(1)
    expect(hitAnchor(path, { x: 50, y: 50 }, 6)).toBeNull()
  })
})

describe('anchor editing ops', () => {
  it('insertAnchorOnSegment preserves the curve shape at the split point', () => {
    const stroke = curveStroke()
    const before = flattenStrokeAdaptive(stroke, 0.1)
    const next = insertAnchorOnSegment(stroke, 0, 0.5)
    expect(next.anchors.length).toBe(stroke.anchors.length + 3)
    const after = flattenStrokeAdaptive(next, 0.1)
    for (const t of [0.1, 0.5, 0.9]) {
      const bi = before[Math.floor(t * (before.length - 1))]
      let best = Infinity
      for (const p of after) best = Math.min(best, Math.hypot(p.x - bi.x, p.y - bi.y))
      expect(best).toBeLessThan(1.5)
    }
  })

  it('moveAnchorTriple shifts anchor and both handles together', () => {
    const stroke = curveStroke()
    const next = moveAnchorTriple(stroke, 1, 10, 20)
    expect(next.anchors[4].pos).toEqual({ x: 210, y: 20 })
    expect(next.anchors[3].pos).toEqual({ x: 160, y: -60 })
    expect(stroke.anchors[4].pos).toEqual({ x: 200, y: 0 })
  })

  it('moveControl mirrors the opposite handle unless broken', () => {
    const stroke = curveStroke()
    const mirrored = moveControl(stroke, 0, 'trailing', { x: 30, y: 40 }, true)
    expect(mirrored.anchors[2].pos).toEqual({ x: 30, y: 40 })
    expect(mirrored.anchors[0].pos).toEqual({ x: -30, y: -40 })
    const broken = moveControl(stroke, 0, 'trailing', { x: 30, y: 40 }, false)
    expect(broken.anchors[0].pos).toEqual(stroke.anchors[0].pos)
  })

  it('removeAnchorTriple drops one triple', () => {
    const path: PathData = rectPath(0, 0, 100, 100)
    const next = removeAnchorTriple(path.strokes[0], 2)
    expect(next.anchors.length).toBe(9)
  })
})
