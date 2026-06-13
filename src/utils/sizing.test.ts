import { describe, expect, it } from 'vitest'

import {
  ASPECT_RATIOS,
  RESOLUTIONS,
  SHORT_SIDE_BY_TIER,
} from './sizing'

describe('sizing constants', () => {
  it('maps each tier to its short-side px', () => {
    expect(SHORT_SIDE_BY_TIER).toEqual({
      '480P': 480,
      '720P': 720,
      '1K': 1024,
      '1080P': 1080,
      '1440P': 1440,
      '2K': 2048,
      '2160P': 2160,
      '4K': 4096,
    })
  })

  it('every resolution option has a short-side mapping (no drift)', () => {
    expect(Object.keys(SHORT_SIDE_BY_TIER)).toEqual([...RESOLUTIONS])
  })

  it('tiers are ordered by ascending short side', () => {
    const sides = RESOLUTIONS.map(t => SHORT_SIDE_BY_TIER[t])
    expect(sides).toEqual([...sides].sort((a, b) => a - b))
  })

  it('aspect ratios are the 10-entry superset', () => {
    expect(ASPECT_RATIOS).toContain('3:2')
    expect(ASPECT_RATIOS).toContain('2:3')
    expect(ASPECT_RATIOS.length).toBe(10)
  })
})
