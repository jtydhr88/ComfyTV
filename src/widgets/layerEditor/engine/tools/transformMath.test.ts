import { describe, expect, it } from 'vitest'

import type { Transform } from '../node'
import {
  applyMove,
  applyResize,
  applyRotate,
  handlePos,
  hitHandle,
  insideBox,
  toLocalFrame,
} from './transformMath'

const box: Transform = { x: 10, y: 20, w: 100, h: 60, rotation: 0 }

describe('handlePos / hitHandle (axis-aligned)', () => {
  it('places corner + edge handles on the box', () => {
    expect(handlePos(box, 'nw')).toEqual({ x: 10, y: 20 })
    expect(handlePos(box, 'se')).toEqual({ x: 110, y: 80 })
    expect(handlePos(box, 'n')).toEqual({ x: 60, y: 20 })
  })

  it('hits the nearest handle within tolerance', () => {
    expect(hitHandle(box, { x: 111, y: 81 }, 4)).toBe('se')
    expect(hitHandle(box, { x: 60, y: 50 }, 4)).toBeNull()
  })
})

describe('insideBox / toLocalFrame with rotation', () => {
  it('maps a doc point into the centre-origin local frame', () => {
    const p = toLocalFrame(box, { x: 60, y: 50 })
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
  })

  it('respects rotation for containment', () => {
    const rotated: Transform = { x: 0, y: 0, w: 100, h: 20, rotation: Math.PI / 2 }

    expect(insideBox(rotated, { x: 50, y: 50 })).toBe(true)
    const cen = { x: 50, y: 10 }
    expect(insideBox(rotated, { x: cen.x, y: cen.y + 40 })).toBe(true)
  })
})

describe('applyMove', () => {
  it('translates the box', () => {
    expect(applyMove(box, 5, -3)).toMatchObject({ x: 15, y: 17, w: 100, h: 60 })
  })
})

describe('applyResize (axis-aligned reduces to simple)', () => {
  it('dragging SE keeps NW anchored', () => {
    const r = applyResize(box, 'se', { x: 10 + 200, y: 20 + 120 })
    expect(r).toMatchObject({ x: 10, y: 20, w: 200, h: 120 })
  })

  it('dragging E changes only width, keeps height + y', () => {
    const r = applyResize(box, 'e', { x: 310, y: 999 })
    expect(r.w).toBeCloseTo(300)
    expect(r.h).toBeCloseTo(60)
    expect(r.y).toBeCloseTo(20)
  })

  it('clamps to a minimum size', () => {
    const r = applyResize(box, 'se', { x: 10, y: 20 }, 1)
    expect(r.w).toBe(1)
    expect(r.h).toBe(1)
  })
})

describe('applyRotate', () => {
  it('adds the pointer-angle delta to the base rotation', () => {
    const grab = 0

    const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    const r = applyRotate(box, 0, grab, { x: c.x, y: c.y + 50 })
    expect(r.rotation).toBeCloseTo(Math.PI / 2)
  })

  it('snaps to 15° increments when requested', () => {
    const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
    const r = applyRotate(box, 0, 0, { x: c.x + 100, y: c.y + 10 }, Math.PI / 12)
    expect((r.rotation / (Math.PI / 12)) % 1).toBeCloseTo(0)
  })
})
