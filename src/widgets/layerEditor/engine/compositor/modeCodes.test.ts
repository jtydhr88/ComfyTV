import { describe, expect, it } from 'vitest'

import { LAYER_MODES } from '../mode'
import { BLEND_CODE, COMPOSITE_CODE, SPACE_CODE } from './modeCodes'

describe('mode codes', () => {
  it('assigns a code to every blend mode in the table', () => {
    for (const blend of Object.keys(LAYER_MODES)) {
      expect(BLEND_CODE[blend as keyof typeof BLEND_CODE]).toBeTypeOf('number')
    }
  })

  it('blend codes are unique', () => {
    const codes = Object.values(BLEND_CODE)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('composite and space codes are unique', () => {
    expect(new Set(Object.values(COMPOSITE_CODE)).size).toBe(Object.keys(COMPOSITE_CODE).length)
    expect(new Set(Object.values(SPACE_CODE)).size).toBe(Object.keys(SPACE_CODE).length)
  })
})
