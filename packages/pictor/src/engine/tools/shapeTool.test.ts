import { describe, expect, it } from 'vitest'

import { vectorKind } from '../kinds/vector'
import { pathBounds, rectPath, strokeSegments } from '../vector'
import { appendShapeToVector, buildShapePath, DEFAULT_SHAPE_OPTIONS, resolveShapeStyles } from './shapeTool'

describe('buildShapePath', () => {
  it('rect spans the drag rectangle regardless of drag direction', () => {
    const path = buildShapePath('rect', { x: 110, y: 70 }, { x: 10, y: 20 }, false)
    expect(path).not.toBeNull()
    expect(pathBounds(path!)).toEqual({ x: 10, y: 20, w: 100, h: 50 })
  })

  it('rejects degenerate drags', () => {
    expect(buildShapePath('rect', { x: 0, y: 0 }, { x: 1, y: 40 }, false)).toBeNull()
    expect(buildShapePath('line', { x: 0, y: 0 }, { x: 1, y: 1 }, false)).toBeNull()
  })

  it('shift constrains rect to a square', () => {
    const path = buildShapePath('rect', { x: 0, y: 0 }, { x: 100, y: 30 }, true)
    expect(pathBounds(path!)).toEqual({ x: 0, y: 0, w: 100, h: 100 })
  })

  it('ellipse is centered in the drag rectangle', () => {
    const path = buildShapePath('ellipse', { x: 0, y: 0 }, { x: 80, y: 40 }, false)
    expect(pathBounds(path!)).toEqual({ x: 0, y: 0, w: 80, h: 40 })
    const seg = path!.strokes[0]
    expect(seg.closed).toBe(true)
    expect(strokeSegments(seg)).toHaveLength(4)
  })

  it('shift snaps line angle to 45° steps', () => {
    const path = buildShapePath('line', { x: 0, y: 0 }, { x: 100, y: 8 }, true)
    const segs = strokeSegments(path!.strokes[0])
    expect(segs[0].to.y).toBeCloseTo(0, 5)
    expect(segs[0].to.x).toBeCloseTo(Math.hypot(100, 8), 5)
  })

  it('polygon is a closed n-gon centered on the drag start with the first vertex at the cursor', () => {
    const path = buildShapePath('polygon', { x: 50, y: 50 }, { x: 90, y: 50 }, false, { sides: 5 })
    const stroke = path!.strokes[0]
    expect(stroke.closed).toBe(true)
    const anchors = stroke.anchors.filter((a) => a.type === 'anchor')
    expect(anchors).toHaveLength(5)
    expect(anchors[0].pos.x).toBeCloseTo(90, 5)
    expect(anchors[0].pos.y).toBeCloseTo(50, 5)
    for (const a of anchors) {
      expect(Math.hypot(a.pos.x - 50, a.pos.y - 50)).toBeCloseTo(40, 5)
    }
  })

  it('star alternates outer and inner radii', () => {
    const path = buildShapePath('star', { x: 0, y: 0 }, { x: 100, y: 0 }, false, { sides: 5, starRatio: 0.5 })
    const anchors = path!.strokes[0].anchors.filter((a) => a.type === 'anchor')
    expect(anchors).toHaveLength(10)
    const radii = anchors.map((a) => Math.hypot(a.pos.x, a.pos.y))
    for (let i = 0; i < radii.length; i++) {
      expect(radii[i]).toBeCloseTo(i % 2 === 0 ? 100 : 50, 5)
    }
  })

  it('arc is an open semicircle whose chord is the drag segment', () => {
    const path = buildShapePath('arc', { x: 0, y: 0 }, { x: 100, y: 0 }, false)
    const stroke = path!.strokes[0]
    expect(stroke.closed).toBe(false)
    const anchors = stroke.anchors.filter((a) => a.type === 'anchor')
    expect(anchors).toHaveLength(3)
    expect(anchors[0].pos.x).toBeCloseTo(0, 5)
    expect(anchors[0].pos.y).toBeCloseTo(0, 5)
    expect(anchors[2].pos.x).toBeCloseTo(100, 5)
    expect(anchors[2].pos.y).toBeCloseTo(0, 5)
    expect(Math.abs(anchors[1].pos.y)).toBeCloseTo(50, 5)
    expect(anchors[1].pos.x).toBeCloseTo(50, 5)
  })

  it('spiral is an open curve ending at the cursor', () => {
    const path = buildShapePath('spiral', { x: 0, y: 0 }, { x: 80, y: 0 }, false, { turns: 2 })
    const stroke = path!.strokes[0]
    expect(stroke.closed).toBe(false)
    const anchors = stroke.anchors.filter((a) => a.type === 'anchor')
    expect(anchors[0].pos.x).toBeCloseTo(0, 5)
    expect(anchors[0].pos.y).toBeCloseTo(0, 5)
    const last = anchors[anchors.length - 1].pos
    expect(last.x).toBeCloseTo(80, 5)
    expect(last.y).toBeCloseTo(0, 5)
  })

  it('rejects degenerate center-out drags', () => {
    expect(buildShapePath('polygon', { x: 0, y: 0 }, { x: 1, y: 1 }, false)).toBeNull()
    expect(buildShapePath('spiral', { x: 0, y: 0 }, { x: 0, y: 0 }, false)).toBeNull()
  })
})

describe('appendShapeToVector', () => {
  it('appends strokes to the layer path and re-derives the transform (undoable)', () => {
    const node = vectorKind.create({ path: rectPath(0, 0, 20, 20), fill: { color: '#ff0000' } })
    const cmd = appendShapeToVector(node, rectPath(40, 40, 20, 20))
    expect(node.path.strokes).toHaveLength(2)
    expect(node.transform).toEqual({ x: 0, y: 0, w: 60, h: 60, rotation: 0 })

    cmd.apply('undo')
    expect(node.path.strokes).toHaveLength(1)
    expect(node.transform).toEqual({ x: 0, y: 0, w: 20, h: 20, rotation: 0 })
    cmd.apply('redo')
    expect(node.path.strokes).toHaveLength(2)
  })
})

describe('resolveShapeStyles', () => {
  it('line always strokes and never fills', () => {
    const styles = resolveShapeStyles({ shape: 'line', fill: { color: '#123456' }, stroke: null })
    expect(styles.fill).toBeNull()
    expect(styles.stroke).toMatchObject({ color: '#123456', width: 2 })
  })

  it('arc and spiral are stroke-only like line', () => {
    for (const shape of ['arc', 'spiral'] as const) {
      const styles = resolveShapeStyles({ shape, fill: { color: '#123456' }, stroke: null })
      expect(styles.fill).toBeNull()
      expect(styles.stroke).toMatchObject({ color: '#123456', width: 2 })
    }
  })

  it('falls back to the default fill when both styles are off', () => {
    const styles = resolveShapeStyles({ shape: 'rect', fill: null, stroke: null })
    expect(styles.fill).toEqual(DEFAULT_SHAPE_OPTIONS.fill)
    expect(styles.stroke).toBeNull()
  })

  it('passes through explicit styles', () => {
    const styles = resolveShapeStyles({
      shape: 'ellipse',
      fill: { color: '#ff0000' },
      stroke: { color: '#00ff00', width: 6, cap: 'round', join: 'round' },
    })
    expect(styles.fill).toEqual({ color: '#ff0000' })
    expect(styles.stroke).toMatchObject({ color: '#00ff00', width: 6 })
  })
})
