import { describe, it, expect } from 'vitest'
import { colorPreviewStyle } from './videoColorPreview'

const NEUTRAL = { exposure: 0, saturation: 0, hue: 0, temperature: 6500 }

describe('colorPreviewStyle', () => {
  it('returns no filter at neutral values', () => {
    expect(colorPreviewStyle(NEUTRAL)).toEqual({})
  })

  it('maps exposure to a 2^x brightness', () => {
    expect(colorPreviewStyle({ ...NEUTRAL, exposure: 1 }))
      .toEqual({ filter: 'brightness(2.000)' })
    expect(colorPreviewStyle({ ...NEUTRAL, exposure: -1 }))
      .toEqual({ filter: 'brightness(0.500)' })
  })

  it('maps saturation to saturate(1 + s)', () => {
    expect(colorPreviewStyle({ ...NEUTRAL, saturation: 0.5 }))
      .toEqual({ filter: 'saturate(1.500)' })
  })

  it('maps hue to hue-rotate degrees', () => {
    expect(colorPreviewStyle({ ...NEUTRAL, hue: 90 }))
      .toEqual({ filter: 'hue-rotate(90deg)' })
  })

  it('maps warm temperature to a capped sepia', () => {
    expect(colorPreviewStyle({ ...NEUTRAL, temperature: 1000 }))
      .toEqual({ filter: 'sepia(0.400)' })
    expect(colorPreviewStyle({ ...NEUTRAL, temperature: 100 }))
      .toEqual({ filter: 'sepia(0.465)' })
  })

  it('maps cool temperature to a negative hue-rotate', () => {
    expect(colorPreviewStyle({ ...NEUTRAL, temperature: 12000 }))
      .toEqual({ filter: 'hue-rotate(-18.0deg)' })
  })

  it('joins multiple filters in order', () => {
    expect(colorPreviewStyle({ exposure: 1, saturation: 0.5, hue: 10, temperature: 12000 }))
      .toEqual({ filter: 'brightness(2.000) saturate(1.500) hue-rotate(10deg) hue-rotate(-18.0deg)' })
  })
})
