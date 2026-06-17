import { describe, expect, it } from 'vitest'

import { outputTypeForKind } from './stageOutputType'

describe('outputTypeForKind', () => {
  it('maps image-batch to images and image-picker to image', () => {
    expect(outputTypeForKind('image-batch')).toBe('images')
    expect(outputTypeForKind('image-picker')).toBe('image')
  })

  it('passes other kinds through unchanged', () => {
    expect(outputTypeForKind('text')).toBe('text')
    expect(outputTypeForKind('image')).toBe('image')
    expect(outputTypeForKind('video')).toBe('video')
    expect(outputTypeForKind('storyboard')).toBe('storyboard')
  })
})
