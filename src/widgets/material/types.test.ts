import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MATERIAL,
  MATERIAL_PRESETS,
  normalizeMaterial,
  parseMaterialState,
  serializeMaterialState,
} from './types'

describe('normalizeMaterial', () => {
  it('fills defaults for an empty object', () => {
    expect(normalizeMaterial({})).toEqual(DEFAULT_MATERIAL)
  })

  it('clamps numeric params to their ranges', () => {
    const m = normalizeMaterial({ metalness: 5, roughness: -1, ior: 99 })
    expect(m.metalness).toBe(1)
    expect(m.roughness).toBe(0)
    expect(m.ior).toBe(2.333)
  })

  it('rejects malformed colors and lowercases valid ones', () => {
    expect(normalizeMaterial({ color: 'red' }).color).toBe(DEFAULT_MATERIAL.color)
    expect(normalizeMaterial({ color: '#E6B553' }).color).toBe('#e6b553')
  })

  it('ignores non-object input', () => {
    expect(normalizeMaterial(null)).toEqual(DEFAULT_MATERIAL)
    expect(normalizeMaterial('junk')).toEqual(DEFAULT_MATERIAL)
  })
})

describe('parseMaterialState / serializeMaterialState', () => {
  it('round-trips a material', () => {
    const m = normalizeMaterial({ color: '#123abc', metalness: 0.5, transmission: 1 })
    expect(parseMaterialState(serializeMaterialState(m))).toEqual(m)
  })

  it('falls back to defaults on invalid JSON', () => {
    expect(parseMaterialState('{oops')).toEqual(DEFAULT_MATERIAL)
    expect(parseMaterialState('')).toEqual(DEFAULT_MATERIAL)
    expect(parseMaterialState(undefined)).toEqual(DEFAULT_MATERIAL)
  })
})

describe('MATERIAL_PRESETS', () => {
  it('every preset normalizes without change', () => {
    for (const p of MATERIAL_PRESETS) {
      const merged = { ...DEFAULT_MATERIAL, ...p.params }
      expect(normalizeMaterial(merged)).toEqual(merged)
    }
  })

  it('presets never touch color', () => {
    for (const p of MATERIAL_PRESETS) {
      expect('color' in p.params).toBe(false)
    }
  })
})
