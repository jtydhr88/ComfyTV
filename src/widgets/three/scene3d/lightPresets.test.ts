import { describe, expect, it } from 'vitest'

import { LIGHT_PRESET_NAMES, createLightPreset } from './lightPresets'
import { normalizeSceneValue } from './sceneValue'

describe('createLightPreset', () => {
  it('every preset survives scene normalization unchanged', () => {
    for (const name of LIGHT_PRESET_NAMES) {
      const lights = createLightPreset(name, [])
      const scene = normalizeSceneValue({ characters: [], lights })
      expect(scene.lights).toEqual(lights)
    }
  })

  it('generates ids unique against existing scene objects', () => {
    const lights = createLightPreset('studio', ['light_1', 'char_1'])
    const ids = lights.map((light) => light.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('light_1')
  })

  it('none clears all lights', () => {
    expect(createLightPreset('none', [])).toEqual([])
  })

  it('returns fresh objects on every call', () => {
    const first = createLightPreset('outdoor', [])
    const second = createLightPreset('outdoor', [])
    expect(first[0]).not.toBe(second[0])
    expect(first[0].position).not.toBe(second[0].position)
  })
})
