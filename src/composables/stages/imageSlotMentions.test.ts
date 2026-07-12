import { describe, expect, it } from 'vitest'

import { IMAGE_REFS_PROP } from './imageRefs'
import {
  expandImageTokens,
  imageInputSlotIndex,
  imageSendOrder,
  imageSlotFromLabel,
  imageSlotLabel,
  slotColor,
  SLOT_COLORS,
} from './imageSlotMentions'

describe('imageSlot labels', () => {
  it('round-trips slot ↔ label', () => {
    expect(imageSlotLabel(0)).toBe('image_0')
    expect(imageSlotFromLabel('image_0')).toBe(0)
    expect(imageSlotFromLabel('image_12')).toBe(12)
  })

  it('rejects non-slot labels', () => {
    expect(imageSlotFromLabel('image_')).toBeNull()
    expect(imageSlotFromLabel('image_1x')).toBeNull()
    expect(imageSlotFromLabel('style')).toBeNull()
  })

  it('maps autogrow input names to slot indices', () => {
    expect(imageInputSlotIndex('images.image0')).toBe(0)
    expect(imageInputSlotIndex('images.image10')).toBe(10)
    expect(imageInputSlotIndex('texts.text0')).toBeNull()
    expect(imageInputSlotIndex('batch')).toBeNull()
  })
})

describe('slotColor', () => {
  it('cycles the palette', () => {
    expect(slotColor(0)).toBe(SLOT_COLORS[0])
    expect(slotColor(SLOT_COLORS.length)).toBe(SLOT_COLORS[0])
    expect(slotColor(3)).toBe(SLOT_COLORS[3])
  })
})

function fakeNode(wired: number[], refSlots: number[] = []): any {
  return {
    inputs: [
      ...wired.map(n => ({ name: `images.image${n}`, link: 1 })),
      { name: 'images.image99', link: null },
      { name: 'batch', link: 2 },
    ],
    properties: {
      [IMAGE_REFS_PROP]: refSlots.map((slot, i) => ({ asset_id: i + 1, slot })),
    },
  }
}

describe('imageSendOrder', () => {
  it('unions wired slots and pinned refs, ascending', () => {
    expect(imageSendOrder(fakeNode([2, 0], [5, 0]))).toEqual([0, 2, 5])
  })

  it('is empty for a bare node', () => {
    expect(imageSendOrder(fakeNode([]))).toEqual([])
    expect(imageSendOrder(null)).toEqual([])
  })
})

describe('expandImageTokens', () => {
  const zh = (n: number) => `图${n}`

  it('expands by ordinal position in the send order, not slot number', () => {
    const r = expandImageTokens('以@image_0 为动作参考，以@image_2 为风格参考', [0, 2], zh)
    expect(r.text).toBe('以图1 为动作参考，以图2 为风格参考')
    expect(r.missing).toEqual([])
  })

  it('drops tokens whose slot carries no image and reports them', () => {
    const r = expandImageTokens('用@image_3 的风格', [0], zh)
    expect(r.text).toBe('用 的风格')
    expect(r.missing).toEqual([3])
  })

  it('does not touch longer labels or plain text', () => {
    const r = expandImageTokens('@image_1x @imagery image_0 @image_0', [0], zh)
    expect(r.text).toBe('@image_1x @imagery image_0 图1')
  })

  it('handles multi-digit slots without prefix collisions', () => {
    const order = Array.from({ length: 11 }, (_, i) => i)
    const r = expandImageTokens('@image_10 vs @image_1', order, n => `image ${n}`)
    expect(r.text).toBe('image 11 vs image 2')
  })
})
