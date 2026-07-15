import { describe, expect, it } from 'vitest'

import {
  artboardToLocal,
  cursorForHandle,
  getHandlePositions,
  hitTestHandle,
  hitTestLayer,
  layerCenter,
  localToArtboard,
  resizeTransform,
  rotateTransform,
} from './transformMath'
import type { Layer, LayerTransform, Point } from './types'

const DEG = Math.PI / 180

function t(x: number, y: number, w: number, h: number, rotation = 0): LayerTransform {
  return { x, y, w, h, rotation }
}

function rasterLayer(id: string, transform: LayerTransform, extra?: Partial<Layer>): Layer {
  return {
    id,
    type: 'raster',
    name: id,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    transform,
    contentId: `c-${id}`,
    naturalWidth: transform.w,
    naturalHeight: transform.h,
    ...extra,
  } as Layer
}

function expectPointClose(actual: Point, expected: Point, digits = 6) {
  expect(actual.x).toBeCloseTo(expected.x, digits)
  expect(actual.y).toBeCloseTo(expected.y, digits)
}

describe('local frame round-trips', () => {
  it('is identity at rotation 0', () => {
    const tr = t(10, 20, 100, 50)
    expectPointClose(artboardToLocal({ x: 10, y: 20 }, tr), { x: -50, y: -25 })
    expectPointClose(localToArtboard({ x: -50, y: -25 }, tr), { x: 10, y: 20 })
  })

  it('round-trips at arbitrary angles', () => {
    const tr = t(-30, 40, 80, 120, 37 * DEG)
    const pts = [{ x: 0, y: 0 }, { x: 17, y: -93 }, { x: -55.5, y: 8.25 }]
    for (const p of pts) {
      expectPointClose(localToArtboard(artboardToLocal(p, tr), tr), p)
    }
  })

  it('maps the top-left corner correctly at 90°', () => {
    const tr = t(0, 0, 100, 100, 90 * DEG)
    expectPointClose(localToArtboard({ x: -50, y: -50 }, tr), { x: 100, y: 0 })
  })
})

describe('hitTestLayer', () => {
  it('hits the topmost visible layer', () => {
    const layers = [
      rasterLayer('bottom', t(0, 0, 100, 100)),
      rasterLayer('top', t(25, 25, 50, 50)),
    ]
    expect(hitTestLayer(layers, { x: 50, y: 50 })).toBe('top')
    expect(hitTestLayer(layers, { x: 10, y: 10 })).toBe('bottom')
    expect(hitTestLayer(layers, { x: 200, y: 200 })).toBeNull()
  })

  it('skips hidden and locked layers', () => {
    const layers = [
      rasterLayer('locked', t(0, 0, 100, 100), { locked: true }),
      rasterLayer('hidden', t(0, 0, 100, 100), { visible: false }),
    ]
    expect(hitTestLayer(layers, { x: 50, y: 50 })).toBeNull()
  })

  it('respects rotation: corners of the AABB miss a rotated box', () => {
    const layers = [rasterLayer('bar', t(0, 40, 100, 20, 90 * DEG))]
    expect(hitTestLayer(layers, { x: 50, y: 5 })).toBe('bar')
    expect(hitTestLayer(layers, { x: 5, y: 50 })).toBeNull()
  })
})

describe('handles', () => {
  it('places the rotate handle above the top edge, following rotation', () => {
    const tr = t(0, 0, 100, 100, 0)
    const rotate = getHandlePositions(tr, 1).find((h) => h.id === 'rotate')!
    expectPointClose({ x: rotate.x, y: rotate.y }, { x: 50, y: -24 })

    const tr90 = t(0, 0, 100, 100, 90 * DEG)
    const rotate90 = getHandlePositions(tr90, 1).find((h) => h.id === 'rotate')!
    expectPointClose({ x: rotate90.x, y: rotate90.y }, { x: 124, y: 50 })
  })

  it('hit-tests corner handles with zoom-compensated radius', () => {
    const tr = t(0, 0, 100, 100, 0)
    expect(hitTestHandle(tr, { x: 0, y: 0 }, 1)).toBe('nw')
    expect(hitTestHandle(tr, { x: 104, y: 104 }, 1)).toBe('se')
    expect(hitTestHandle(tr, { x: 108, y: 108 }, 2)).toBe('')
    expect(hitTestHandle(tr, { x: 103, y: 103 }, 2)).toBe('se')
    expect(hitTestHandle(tr, { x: 50, y: 50 }, 1)).toBe('')
  })

  it('hit-tests handles on a rotated layer', () => {
    const tr = t(0, 0, 100, 100, 90 * DEG)
    expect(hitTestHandle(tr, { x: 100, y: 0 }, 1)).toBe('nw')
  })
})

describe('resizeTransform', () => {
  it('se drag at 0° grows right/down keeping nw pinned', () => {
    const start = t(10, 20, 100, 50)
    const next = resizeTransform(start, 'se', { x: 150, y: 110 })
    expect(next).toMatchObject({ x: 10, y: 20, w: 140, h: 90, rotation: 0 })
  })

  it('nw drag at 0° keeps se pinned', () => {
    const start = t(10, 20, 100, 50)
    const next = resizeTransform(start, 'nw', { x: 0, y: 0 })
    expectPointClose({ x: next.x + next.w, y: next.y + next.h }, { x: 110, y: 70 })
    expect(next.w).toBeCloseTo(110)
    expect(next.h).toBeCloseTo(70)
  })

  it('edge handles change one dimension only', () => {
    const start = t(0, 0, 100, 100)
    const next = resizeTransform(start, 'e', { x: 130, y: 999 })
    expect(next.w).toBeCloseTo(130)
    expect(next.h).toBeCloseTo(100)
    expect(next.y).toBeCloseTo(0)
  })

  it('clamps to minSize', () => {
    const start = t(0, 0, 100, 100)
    const next = resizeTransform(start, 'se', { x: -500, y: -500 }, { minSize: 8 })
    expect(next.w).toBe(8)
    expect(next.h).toBe(8)
  })

  it('aspect lock keeps the start ratio', () => {
    const start = t(0, 0, 100, 50)
    const next = resizeTransform(start, 'se', { x: 200, y: 60 }, { aspectLock: true })
    expect(next.w / next.h).toBeCloseTo(2)
    expect(next.w).toBeCloseTo(200)
  })

  it('keeps the anchor fixed under rotation', () => {
    const start = t(0, 0, 100, 60, 33 * DEG)
    const anchorBefore = localToArtboard({ x: -50, y: -30 }, start)
    const next = resizeTransform(start, 'se', { x: 140, y: 120 })
    const anchorAfter = localToArtboard({ x: -next.w / 2, y: -next.h / 2 }, next)
    expectPointClose(anchorAfter, anchorBefore, 4)
    expect(next.rotation).toBeCloseTo(start.rotation)
  })

  it('resize at 90° follows the rotated axes', () => {
    const start = t(0, 0, 100, 100, 90 * DEG)
    const next = resizeTransform(start, 'se', { x: 0, y: 140 })
    expect(next.w).toBeCloseTo(140)
    expect(next.h).toBeCloseTo(100)
  })
})

describe('rotateTransform', () => {
  it('accumulates the angle swept around the center', () => {
    const start = t(0, 0, 100, 100)
    const c = layerCenter(start)
    const from = { x: c.x + 100, y: c.y }
    const to = { x: c.x, y: c.y + 100 }
    const next = rotateTransform(start, from, to)
    expect(next.rotation).toBeCloseTo(90 * DEG)
    expect(next.x).toBe(start.x)
    expect(next.w).toBe(start.w)
  })

  it('snaps to 15° when requested', () => {
    const start = t(0, 0, 100, 100)
    const c = layerCenter(start)
    const from = { x: c.x + 100, y: c.y }
    const to = { x: c.x + 100 * Math.cos(52 * DEG), y: c.y + 100 * Math.sin(52 * DEG) }
    const next = rotateTransform(start, from, to, true)
    expect(next.rotation).toBeCloseTo(45 * DEG)
  })

  it('normalizes into (-π, π]', () => {
    const start = t(0, 0, 100, 100, 170 * DEG)
    const c = layerCenter(start)
    const from = { x: c.x + 100, y: c.y }
    const to = { x: c.x, y: c.y + 100 }
    const next = rotateTransform(start, from, to)
    expect(next.rotation).toBeCloseTo(-100 * DEG)
  })
})

describe('cursorForHandle', () => {
  it('picks axis cursors at 0°', () => {
    expect(cursorForHandle('e', 0)).toBe('ew-resize')
    expect(cursorForHandle('se', 0)).toBe('nwse-resize')
    expect(cursorForHandle('s', 0)).toBe('ns-resize')
    expect(cursorForHandle('sw', 0)).toBe('nesw-resize')
  })

  it('rotates cursor selection with the layer', () => {
    expect(cursorForHandle('e', 90 * DEG)).toBe('ns-resize')
    expect(cursorForHandle('n', 90 * DEG)).toBe('ew-resize')
  })
})
