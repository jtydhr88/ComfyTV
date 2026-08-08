import { describe, expect, it } from 'vitest'

import { IMAGE_REFS_PROP } from './imageRefs'
import {
  audioSendOrder,
  expandImageTokens,
  expandMentionTokens,
  hasRawMentionTokens,
  nonSlotMentionLabels,
  imageInputSlotIndex,
  imageSendOrder,
  imageSlotFromLabel,
  imageSlotLabel,
  mentionOrdinalText,
  minimaxAudioOffset,
  mentionSlotFromLabel,
  mentionSlotLabel,
  normalizeMentionStyle,
  normalizeMentionText,
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

describe('normalizeMentionText', () => {
  it('converts the zh chip display format', () => {
    expect(normalizeMentionText('以@图片#0 为主体，背景来自@图片#13'))
      .toBe('以@image_0 为主体，背景来自@image_13')
  })

  it('converts en chip formats with space and hash', () => {
    expect(normalizeMentionText('use @image #2 and @Image_3 and @IMAGE4'))
      .toBe('use @image_2 and @image_3 and @image_4')
  })

  it('converts video and audio in both languages', () => {
    expect(normalizeMentionText('动作学@视频#0，配音用@音频 1，also @video#1 @audio 0'))
      .toBe('动作学@video_0，配音用@audio_1，also @video_1 @audio_0')
  })

  it('handles full-width at, hash and digits', () => {
    expect(normalizeMentionText('＠图片＃３ 站在中间')).toBe('@image_3 站在中间')
  })

  it('strips leading zeros', () => {
    expect(normalizeMentionText('@图片#007')).toBe('@image_7')
  })

  it('is idempotent on canonical tokens', () => {
    const s = 'person from @image_0 with @video_1 and @audio_0'
    expect(normalizeMentionText(s)).toBe(s)
  })

  it('matches tokens glued to CJK prose (real LLM output)', () => {
    expect(normalizeMentionText('@图片#0入夜月色清冷，冷白光铺满石板庭院'))
      .toBe('@image_0入夜月色清冷，冷白光铺满石板庭院')
    expect(normalizeMentionText('@图片#13肩扛同款大号纸箱紧随其后'))
      .toBe('@image_13肩扛同款大号纸箱紧随其后')
    expect(normalizeMentionText('@图片#4说:"哟，大半夜扛啥宝贝?"'))
      .toBe('@image_4说:"哟，大半夜扛啥宝贝?"')
    expect(normalizeMentionText('二人视线同时锁定@图片#3与@图片#13。'))
      .toBe('二人视线同时锁定@image_3与@image_13。')
  })

  it('leaves non-slot mentions and lookalikes alone', () => {
    const s = '@imagery @style @图1 email@example.com @image_2x @劳拉'
    expect(normalizeMentionText(s)).toBe(s)
  })
})

describe('hasRawMentionTokens', () => {
  it('detects raw forms and not canonical ones', () => {
    expect(hasRawMentionTokens('看@图片#0')).toBe(true)
    expect(hasRawMentionTokens('看@image_0')).toBe(false)
    expect(hasRawMentionTokens('plain text')).toBe(false)
  })
})

describe('nonSlotMentionLabels', () => {
  it('returns entry labels but not slot tokens', () => {
    expect(nonSlotMentionLabels('a @image_0 and @style plus @video_1 and @劳拉'))
      .toEqual(['style', '劳拉'])
  })

  it('dedupes and returns empty for slot-only or plain text', () => {
    expect(nonSlotMentionLabels('@style twice @style')).toEqual(['style'])
    expect(nonSlotMentionLabels('@image_0 @audio_2 中文正文')).toEqual([])
    expect(nonSlotMentionLabels('no tokens')).toEqual([])
  })

  it('treats slot lookalikes with trailing chars as entry labels', () => {
    expect(nonSlotMentionLabels('@image_2x')).toEqual(['image_2x'])
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
  function node(names: Array<[string, boolean]>, refs: any[] = []): any {
    return {
      inputs: names.map(([name, wired]) => ({ name, link: wired ? 1 : null })),
      properties: { [IMAGE_REFS_PROP]: refs },
    }
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

  it('pinned video/audio asset refs count into their send orders', () => {
    const refs = [
      { asset_id: 1, slot: 1, type: 'video' },
      { asset_id: 2, slot: 0, type: 'audio' },
      { asset_id: 3, slot: 5 },
    ]
    expect(videoSendOrder(node([['videos.video0', true]], refs))).toEqual([0, 1])
    expect(audioSendOrder(node([['audio', false]], refs))).toEqual([0])
    expect(imageSendOrder(node([], refs))).toEqual([5])
  })

  it('collects wired audio.audioN autogrow slots ascending', () => {
    expect(audioSendOrder(node([
      ['audio.audio2', true], ['audio.audio0', true], ['audio.audio1', false],
    ]))).toEqual([0, 2])
  })

  it('audio refs merge with autogrow wiring', () => {
    const refs = [{ asset_id: 2, slot: 1, type: 'audio' }]
    expect(audioSendOrder(node([['audio.audio0', true]], refs))).toEqual([0, 1])
  })
})

describe('minimaxAudioOffset', () => {
  it('equals the number of videos being sent', () => {
    expect(minimaxAudioOffset({ image: [0], video: [0, 1], audio: [0] })).toBe(2)
    expect(minimaxAudioOffset({ image: [], video: [], audio: [0] })).toBe(0)
  })

  it('mentionOrdinalText applies the offset in both styles', () => {
    const zh = (n: number) => `音频 ${n}`
    expect(mentionOrdinalText('minimax_tags', zh, 'audio', 2)(1)).toBe('<Audio 3>')
    expect(mentionOrdinalText('natural', zh, 'audio', 2)(1)).toBe('音频 3')
    expect(mentionOrdinalText('natural', zh, 'audio')(1)).toBe('音频 1')
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

  it('expands tokens glued to CJK prose', () => {
    const r = expandMentionTokens(
      '@image_0入夜月色，@image_13肩扛纸箱，动作学@video_0结尾',
      { image: [0, 13], video: [0], audio: [] },
      texts,
    )
    expect(r.text).toBe('<Picture 1>入夜月色，<Picture 2>肩扛纸箱，动作学<Video 1>结尾')
    expect(r.missing).toEqual([])
  })
})
