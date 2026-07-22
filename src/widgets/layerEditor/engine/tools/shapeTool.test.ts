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
