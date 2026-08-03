import { describe, expect, it } from 'vitest'

import { IMAGE_REFS_PROP } from './imageRefs'
import {
  audioSendOrder,
  expandImageTokens,
  expandMentionTokens,
  imageInputSlotIndex,
  imageSendOrder,
  imageSlotFromLabel,
  imageSlotLabel,
  mentionOrdinalText,
  mentionSlotFromLabel,
  mentionSlotLabel,
  normalizeMentionStyle,
  slotColor,
  videoSendOrder,
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

describe('mention style', () => {
  const zh = (n: number) => `图${n}`

  it('normalizes unknown values to natural', () => {
    expect(normalizeMentionStyle(undefined)).toBe('natural')
    expect(normalizeMentionStyle('bogus')).toBe('natural')
    expect(normalizeMentionStyle('minimax_tags')).toBe('minimax_tags')
  })

  it('natural style keeps the locale text', () => {
    const f = mentionOrdinalText('natural', zh)
    expect(f(1)).toBe('图1')
  })

  it('minimax_tags emits literal <Picture n> tags', () => {
    const f = mentionOrdinalText('minimax_tags', zh)
    expect(f(1)).toBe('<Picture 1>')
    expect(f(9)).toBe('<Picture 9>')
  })

  it('minimax_tags emits per-type tags for video and audio', () => {
    expect(mentionOrdinalText('minimax_tags', zh, 'video')(2)).toBe('<Video 2>')
    expect(mentionOrdinalText('minimax_tags', zh, 'audio')(1)).toBe('<Audio 1>')
  })

  it('expands to H3 tags by send-order ordinal', () => {
    const f = mentionOrdinalText('minimax_tags', zh)
    const r = expandImageTokens('person from @image_0 in the scene of @image_4', [0, 2, 4], f)
    expect(r.text).toBe('person from <Picture 1> in the scene of <Picture 3>')
    expect(r.missing).toEqual([])
  })
})

describe('mention slot labels (typed)', () => {
  it('round-trips typed labels', () => {
    expect(mentionSlotLabel('video', 1)).toBe('video_1')
    expect(mentionSlotFromLabel('video_1')).toEqual({ type: 'video', slot: 1 })
    expect(mentionSlotFromLabel('audio_0')).toEqual({ type: 'audio', slot: 0 })
    expect(mentionSlotFromLabel('image_3')).toEqual({ type: 'image', slot: 3 })
    expect(mentionSlotFromLabel('model_0')).toBeNull()
    expect(mentionSlotFromLabel('video_')).toBeNull()
  })
})

describe('videoSendOrder / audioSendOrder', () => {
  function node(names: Array<[string, boolean]>): any {
    return { inputs: names.map(([name, wired]) => ({ name, link: wired ? 1 : null })) }
  }

  it('collects wired videos.videoN slots ascending', () => {
    expect(videoSendOrder(node([
      ['videos.video2', true], ['videos.video0', true], ['videos.video1', false],
    ]))).toEqual([0, 2])
    expect(videoSendOrder(null)).toEqual([])
  })

  it('audio is slot 0 when the single audio input is wired', () => {
    expect(audioSendOrder(node([['audio', true]]))).toEqual([0])
    expect(audioSendOrder(node([['audio', false]]))).toEqual([])
    expect(audioSendOrder(null)).toEqual([])
  })
})

describe('expandMentionTokens', () => {
  const texts = {
    image: (n: number) => `<Picture ${n}>`,
    video: (n: number) => `<Video ${n}>`,
    audio: (n: number) => `<Audio ${n}>`,
  }

  it('expands all three token types by per-type send order', () => {
    const r = expandMentionTokens(
      'copy @image_2 style, motion of @video_0 and @video_3, voice from @audio_0',
      { image: [0, 2], video: [0, 3], audio: [0] },
      texts,
    )
    expect(r.text).toBe('copy <Picture 2> style, motion of <Video 1> and <Video 2>, voice from <Audio 1>')
    expect(r.missing).toEqual([])
  })

  it('reports missing tokens with their type and drops them', () => {
    const r = expandMentionTokens(
      '@video_1 then @audio_2 with @image_0',
      { image: [0], video: [], audio: [] },
      texts,
    )
    expect(r.text).toBe(' then  with <Picture 1>')
    expect(r.missing).toEqual([
      { type: 'video', slot: 1 },
      { type: 'audio', slot: 2 },
    ])
  })

  it('does not cross-match between types or longer labels', () => {
    const r = expandMentionTokens(
      '@video_0x @videos @image_0 @audio_5',
      { image: [0], video: [0], audio: [0] },
      texts,
    )
    expect(r.text).toBe('@video_0x @videos <Picture 1> ')
    expect(r.missing).toEqual([{ type: 'audio', slot: 5 }])
  })
})
