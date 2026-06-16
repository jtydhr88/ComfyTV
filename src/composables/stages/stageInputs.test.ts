import { describe, expect, it } from 'vitest'

import type { ResolvedInput } from '@/stores/stageStore'

import { pickSourceImageUrl } from './stageInputs'

function input(p: Partial<ResolvedInput>): ResolvedInput {
  return { slot: 'image', type: 'COMFYTV_IMAGE', source: 'upstream', content: '/img.png', ...p }
}

describe('pickSourceImageUrl', () => {
  it('returns the content of a resolved upstream image input', () => {
    expect(pickSourceImageUrl([input({ content: '/a.png' })])).toBe('/a.png')
  })

  it('returns null when the image slot is absent', () => {
    expect(pickSourceImageUrl([input({ slot: 'mask' })])).toBeNull()
  })

  it('returns null when the source is not upstream', () => {
    expect(pickSourceImageUrl([input({ source: 'empty' })])).toBeNull()
    expect(pickSourceImageUrl([input({ source: 'upstream-pending', content: null })])).toBeNull()
  })

  it('returns null when content is empty or null', () => {
    expect(pickSourceImageUrl([input({ content: null })])).toBeNull()
    expect(pickSourceImageUrl([input({ content: '' })])).toBeNull()
  })

  it('honors a custom slot name', () => {
    const inputs = [input({ slot: 'image', content: '/main.png' }), input({ slot: 'ref', content: '/ref.png' })]
    expect(pickSourceImageUrl(inputs, 'ref')).toBe('/ref.png')
  })

  it('returns null for an empty input list', () => {
    expect(pickSourceImageUrl([])).toBeNull()
  })
})
