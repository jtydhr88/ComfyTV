import { describe, expect, it } from 'vitest'

import {
  AZIMUTH_OPTIONS,
  DISTANCE_OPTIONS,
  ELEVATION_OPTIONS,
  findClosestDistanceOption,
  findClosestOption,
} from './cameraViewOptions'

describe('findClosestOption', () => {
  it('returns an exact match', () => {
    expect(findClosestOption(90, AZIMUTH_OPTIONS, true)).toBe(90)
    expect(findClosestOption(0, ELEVATION_OPTIONS)).toBe(0)
  })

  it('snaps to the nearest option', () => {
    expect(findClosestOption(200, AZIMUTH_OPTIONS, true)).toBe(180)
    expect(findClosestOption(20, ELEVATION_OPTIONS)).toBe(30)
    expect(findClosestOption(-20, ELEVATION_OPTIONS)).toBe(-30)
  })

  it('wraps around 360° for azimuth so 350 snaps to 0, not 315', () => {
    expect(findClosestOption(350, AZIMUTH_OPTIONS, true)).toBe(0)
    expect(findClosestOption(10, AZIMUTH_OPTIONS, true)).toBe(0)
  })

  it('does not wrap when isAzimuth is false', () => {
    const ring = [{ key: 'a', value: 0 }, { key: 'b', value: 315 }]
    expect(findClosestOption(350, ring, false)).toBe(315)
  })

  it('clamps beyond the range to the nearest endpoint', () => {
    expect(findClosestOption(100, ELEVATION_OPTIONS)).toBe(60)
    expect(findClosestOption(-100, ELEVATION_OPTIONS)).toBe(-30)
  })
})

describe('findClosestDistanceOption', () => {
  it('maps by threshold (<2 → 1, <6 → 4, else 8)', () => {
    expect(findClosestDistanceOption(0)).toBe(1)
    expect(findClosestDistanceOption(1.9)).toBe(1)
    expect(findClosestDistanceOption(2)).toBe(4)
    expect(findClosestDistanceOption(5.9)).toBe(4)
    expect(findClosestDistanceOption(6)).toBe(8)
    expect(findClosestDistanceOption(20)).toBe(8)
  })
})

describe('option catalogs', () => {
  it('expose the expected view counts', () => {
    expect(AZIMUTH_OPTIONS).toHaveLength(8)
    expect(ELEVATION_OPTIONS).toHaveLength(4)
    expect(DISTANCE_OPTIONS).toHaveLength(3)
  })
})
