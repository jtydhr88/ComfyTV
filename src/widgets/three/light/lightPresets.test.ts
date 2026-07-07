import { describe, expect, it } from 'vitest'

import { LIGHT_PRESETS } from './lightPresets'
import { normalizeLightsValue } from './lightsValue'

describe('LIGHT_PRESETS', () => {
  it('has unique keys', () => {
    const keys = LIGHT_PRESETS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every preset has at least one light', () => {
    for (const p of LIGHT_PRESETS) {
      expect(p.lights.length).toBeGreaterThan(0)
    }
  })

  it('every preset survives normalization unchanged', () => {
    for (const p of LIGHT_PRESETS) {
      expect(normalizeLightsValue(p.lights)).toEqual(p.lights)
    }
  })

  it('all preset lights sit above the ground plane', () => {
    for (const p of LIGHT_PRESETS) {
      for (const l of p.lights) {
        expect(l.position.y).toBeGreaterThan(-1)
      }
    }
  })
})
