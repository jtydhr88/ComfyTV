import { describe, expect, it } from 'vitest'

import { normalizeLightsValue, parseLightsData } from './lightsValue'
import { createDefaultLight } from './types'

describe('normalizeLightsValue', () => {
  it('returns an empty list for non-array values', () => {
    expect(normalizeLightsValue(undefined)).toEqual([])
    expect(normalizeLightsValue('junk')).toEqual([])
    expect(normalizeLightsValue({})).toEqual([])
  })

  it('passes through a valid light unchanged', () => {
    const light = createDefaultLight('spot')
    expect(normalizeLightsValue([light])).toEqual([light])
  })

  it('drops entries with unknown or missing types', () => {
    const result = normalizeLightsValue([
      { type: 'laser' },
      null,
      'junk',
      createDefaultLight('point')
    ])
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('point')
  })

  it('fills defaults for missing fields', () => {
    const [light] = normalizeLightsValue([{ type: 'directional' }])
    expect(light.color).toBe('#ffffff')
    expect(light.intensity).toBe(1.5)
    expect(light.target).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('rejects malformed colors and non-finite numbers', () => {
    const [light] = normalizeLightsValue([
      {
        type: 'directional',
        color: 'red',
        intensity: Number.NaN,
        position: { x: Number.POSITIVE_INFINITY, y: 1, z: 2 }
      }
    ])
    expect(light.color).toBe('#ffffff')
    expect(light.intensity).toBe(1.5)
    expect(light.position.x).toBe(createDefaultLight('directional').position.x)
    expect(light.position.y).toBe(1)
  })

  it('strips target from point lights and range from directional lights', () => {
    const [point, directional] = normalizeLightsValue([
      { type: 'point', target: { x: 1, y: 1, z: 1 }, range: 5 },
      { type: 'directional', range: 5 }
    ])
    expect(point.target).toBeUndefined()
    expect(point.range).toBe(5)
    expect(directional.range).toBeUndefined()
  })

  it('omits zero range', () => {
    const [light] = normalizeLightsValue([{ type: 'point', range: 0 }])
    expect(light.range).toBeUndefined()
  })

  it('keeps spot cone angles', () => {
    const [light] = normalizeLightsValue([
      { type: 'spot', innerConeAngle: 12, outerConeAngle: 20 }
    ])
    expect(light.innerConeAngle).toBe(12)
    expect(light.outerConeAngle).toBe(20)
  })

  it('clamps negative intensity to zero', () => {
    const [light] = normalizeLightsValue([
      { type: 'directional', intensity: -2 }
    ])
    expect(light.intensity).toBe(0)
  })
})

describe('parseLightsData', () => {
  it('parses a JSON string of lights', () => {
    const light = createDefaultLight('point')
    expect(parseLightsData(JSON.stringify([light]))).toEqual([light])
  })

  it('returns empty for blank, malformed, or non-string values', () => {
    expect(parseLightsData('')).toEqual([])
    expect(parseLightsData('   ')).toEqual([])
    expect(parseLightsData('{not json')).toEqual([])
    expect(parseLightsData(42)).toEqual([])
    expect(parseLightsData(undefined)).toEqual([])
  })
})
