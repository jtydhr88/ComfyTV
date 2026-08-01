import { describe, expect, it } from 'vitest'

import {
  DEFAULT_COLORS,
  MIN_WH,
  applyDrag,
  cursorFor,
  elementProp,
  layoutColor,
  mergedElements,
  newElementDef,
  nextElementId,
  parseLayout,
  type PosterElement,
} from './usePosterStage'

describe('parseLayout', () => {
  it('parses a valid blob', () => {
    expect(parseLayout('{"a":{"x":0.1}}')).toEqual({ a: { x: 0.1 } })
  })
  it('returns empty object on junk', () => {
    expect(parseLayout('not json')).toEqual({})
    expect(parseLayout('')).toEqual({})
    expect(parseLayout('42')).toEqual({})
  })
})

describe('mergedElements', () => {
  const defs: PosterElement[] = [
    { id: 'title', type: 'text' },
    { id: 'visual', type: 'image' },
  ]
  it('appends added elements', () => {
    const out = mergedElements(defs, { __added__: [{ id: 'u1', type: 'shape' }] })
    expect(out.map(e => e.id)).toEqual(['title', 'visual', 'u1'])
  })
  it('drops removed template defaults', () => {
    const out = mergedElements(defs, { __removed__: ['visual'] })
    expect(out.map(e => e.id)).toEqual(['title'])
  })
  it('passes through with an empty layout', () => {
    expect(mergedElements(defs, {})).toHaveLength(2)
  })
})

describe('layoutColor', () => {
  it('reads a valid layout color', () => {
    expect(layoutColor({ __colors__: { bg_color: '#ffffff' } }, 'bg_color')).toBe('#ffffff')
  })
  it('falls back to defaults on missing or invalid values', () => {
    expect(layoutColor({}, 'bg_color')).toBe(DEFAULT_COLORS.bg_color)
    expect(layoutColor({ __colors__: { bg_color: 'red' } }, 'bg_color')).toBe(DEFAULT_COLORS.bg_color)
  })
})

describe('elementProp', () => {
  const el: PosterElement = { id: 'a', type: 'text', font_size: 20 }
  it('override beats element beats default', () => {
    expect(elementProp(el, { a: { font_size: 40 } }, 'font_size', 32)).toBe(40)
    expect(elementProp(el, {}, 'font_size', 32)).toBe(20)
    expect(elementProp(el, {}, 'align', 'left')).toBe('left')
  })
})

describe('newElementDef', () => {
  it('builds per-type defaults', () => {
    expect(newElementDef('image', 'i').type).toBe('image')
    expect(newElementDef('shape', 's').shape).toBe('rect')
    const t = newElementDef('text', 't')
    expect(t.type).toBe('text')
    expect(t.text).toBeTruthy()
  })
})

describe('nextElementId', () => {
  it('is unique across calls', () => {
    expect(nextElementId()).not.toBe(nextElementId())
  })
})

describe('applyDrag', () => {
  const start = { x: 0.2, y: 0.2, w: 0.4, h: 0.3 }
  it('moves and clamps to the canvas', () => {
    const m = applyDrag('move', start, 0.1, -0.1)
    expect(m.x).toBeCloseTo(0.3, 6)
    expect(m.y).toBeCloseTo(0.1, 6)
    expect(m.w).toBe(0.4)
    expect(m.h).toBe(0.3)
    const r = applyDrag('move', start, 9, 9)
    expect(r.x).toBeCloseTo(1 - start.w, 6)
    expect(r.y).toBeCloseTo(1 - start.h, 6)
  })
  it('resizes east/south from the fixed corner', () => {
    const r = applyDrag('se', start, 0.1, 0.1)
    expect(r).toEqual({ x: 0.2, y: 0.2, w: 0.5, h: 0.4 })
  })
  it('resizes west keeping the right edge fixed', () => {
    const r = applyDrag('w', start, 0.1, 0)
    expect(r.x).toBeCloseTo(0.3, 6)
    expect(r.w).toBeCloseTo(0.3, 6)
    expect(r.x + r.w).toBeCloseTo(start.x + start.w, 6)
  })
  it('enforces the minimum size', () => {
    const r = applyDrag('e', start, -9, 0)
    expect(r.w).toBeGreaterThanOrEqual(MIN_WH)
  })
})

describe('cursorFor', () => {
  it('maps modes to cursors', () => {
    expect(cursorFor(null)).toBe('default')
    expect(cursorFor({ mode: 'move' })).toBe('move')
    expect(cursorFor({ mode: 'n' })).toBe('ns-resize')
    expect(cursorFor({ mode: 'se' })).toBe('nwse-resize')
    expect(cursorFor({ mode: 'ne' })).toBe('nesw-resize')
  })
})
