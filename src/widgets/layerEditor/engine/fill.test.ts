import { describe, expect, it } from 'vitest'

import {
  cloneFillSpec,
  defaultGradientStops,
  fillSpecStamp,
  linearEndpoints,
  normalizeFillSpec,
} from './fill'

describe('normalizeFillSpec', () => {
  it('falls back to solid gray for junk', () => {
    expect(normalizeFillSpec(null)).toEqual({ type: 'solid', color: '#808080' })
    expect(normalizeFillSpec({ type: 'weird' })).toEqual({ type: 'solid', color: '#808080' })
  })

  it('keeps solid color', () => {
    expect(normalizeFillSpec({ type: 'solid', color: '#123456' })).toEqual({ type: 'solid', color: '#123456' })
  })

  it('sorts and clamps gradient stops, requiring at least two', () => {
    const spec = normalizeFillSpec({
      type: 'linear',
      angle: 45,
      stops: [
        { offset: 2, color: '#ffffff' },
        { offset: -1, color: '#000000' },
      ],
    })
    expect(spec).toEqual({
      type: 'linear',
      angle: 45,
      stops: [
        { offset: 0, color: '#000000', alpha: undefined },
        { offset: 1, color: '#ffffff', alpha: undefined },
      ],
    })
    const bad = normalizeFillSpec({ type: 'linear', angle: 0, stops: [{ offset: 0, color: '#fff' }] })
    expect(bad.type === 'linear' && bad.stops).toEqual(defaultGradientStops())
  })

  it('clamps radial center and radius', () => {
    const spec = normalizeFillSpec({ type: 'radial', cx: 2, cy: -1, radius: 99, stops: defaultGradientStops() })
    expect(spec).toMatchObject({ type: 'radial', cx: 1, cy: 0, radius: 4 })
  })
})

describe('linearEndpoints', () => {
  it('angle 0 spans left → right through the center', () => {
    const { from, to } = linearEndpoints(0, 100, 50)
    expect(from).toEqual({ x: 0, y: 25 })
    expect(to).toEqual({ x: 100, y: 25 })
  })

  it('angle 90 spans top → bottom', () => {
    const { from, to } = linearEndpoints(90, 100, 50)
    expect(from.x).toBeCloseTo(50, 5)
    expect(from.y).toBeCloseTo(0, 5)
    expect(to.y).toBeCloseTo(50, 5)
  })

  it('diagonal covers the projected extent of the rect', () => {
    const { from, to } = linearEndpoints(45, 100, 100)
    const len = Math.hypot(to.x - from.x, to.y - from.y)
    expect(len).toBeCloseTo(Math.SQRT2 * 100, 5)
  })
})

describe('cloneFillSpec / stamp', () => {
  it('clone is deep for stops', () => {
    const spec = normalizeFillSpec({ type: 'linear', angle: 0, stops: defaultGradientStops() })
    const copy = cloneFillSpec(spec)
    if (copy.type === 'linear') copy.stops[0].color = '#ff0000'
    expect(spec.type === 'linear' && spec.stops[0].color).toBe('#000000')
  })

  it('stamp changes with params', () => {
    const a = fillSpecStamp({ type: 'solid', color: '#000000' })
    const b = fillSpecStamp({ type: 'solid', color: '#000001' })
    expect(a).not.toBe(b)
  })
})
