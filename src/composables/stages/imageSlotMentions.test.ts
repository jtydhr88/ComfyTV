import { describe, expect, it } from 'vitest'

import { MEDIA_PROP } from './mediaOrder'
import {
  citedPositions,
  expandMentionTokens,
  hasRawMentionTokens,
  nonSlotMentionLabels,
  mentionOrdinalText,
  mentionSendOrderOf,
  mentionSendOrders,
  minimaxAudioOffset,
  mentionSlotFromLabel,
  mentionSlotLabel,
  normalizeMentionStyle,
  normalizeMentionText,
  remapMentionTokens,
  slotColor,
  SLOT_COLORS,
} from './imageSlotMentions'

describe('mention slot labels', () => {
  it('round-trips typed labels', () => {
    expect(mentionSlotLabel('image', 1)).toBe('image_1')
    expect(mentionSlotLabel('video', 1)).toBe('video_1')
    expect(mentionSlotFromLabel('video_1')).toEqual({ type: 'video', slot: 1 })
    expect(mentionSlotFromLabel('audio_0')).toEqual({ type: 'audio', slot: 0 })
    expect(mentionSlotFromLabel('image_12')).toEqual({ type: 'image', slot: 12 })
  })

  it('rejects non-slot labels', () => {
    expect(mentionSlotFromLabel('image_')).toBeNull()
    expect(mentionSlotFromLabel('image_1x')).toBeNull()
    expect(mentionSlotFromLabel('model_0')).toBeNull()
    expect(mentionSlotFromLabel('style')).toBeNull()
  })
})

describe('slotColor', () => {
  it('cycles the palette from position 1', () => {
    expect(slotColor(1)).toBe(SLOT_COLORS[0])
    expect(slotColor(SLOT_COLORS.length + 1)).toBe(SLOT_COLORS[0])
    expect(slotColor(4)).toBe(SLOT_COLORS[3])
  })
})

function tableNode(image: number, video = 0, audio = 0): any {
  const entries = (n: number) => Array.from({ length: n }, (_, i) => ({ src: 'asset', asset_id: i + 1 }))
  return { properties: { [MEDIA_PROP]: { image: entries(image), video: entries(video), audio: entries(audio) } } }
}

describe('mentionSendOrders', () => {
  it('lists 1-based positions per type from the media table', () => {
    expect(mentionSendOrders(tableNode(3, 1, 2))).toEqual({ image: [1, 2, 3], video: [1], audio: [1, 2] })
    expect(mentionSendOrderOf(tableNode(2), 'image')).toEqual([1, 2])
  })

  it('is empty for a bare node', () => {
    expect(mentionSendOrders({})).toEqual({ image: [], video: [], audio: [] })
    expect(mentionSendOrderOf(null, 'image')).toEqual([])
  })
})

describe('normalizeMentionText', () => {
  it('converts the zh chip display format', () => {
    expect(normalizeMentionText('用@图片#1 做参考')).toBe('用@image_1 做参考')
    expect(normalizeMentionText('用@图片1 做参考')).toBe('用@image_1 做参考')
  })

  it('converts en chip formats with space and hash', () => {
    expect(normalizeMentionText('use @image #2 here')).toBe('use @image_2 here')
    expect(normalizeMentionText('use @image 2 here')).toBe('use @image_2 here')
    expect(normalizeMentionText('use @Image#2 here')).toBe('use @image_2 here')
  })

  it('converts video and audio in both languages', () => {
    expect(normalizeMentionText('@视频#1 @音频 2 @video 1 @Audio#3'))
      .toBe('@video_1 @audio_2 @video_1 @audio_3')
  })

  it('handles full-width at, hash and digits', () => {
    expect(normalizeMentionText('＠图片＃１２')).toBe('@image_12')
  })

  it('strips leading zeros', () => {
    expect(normalizeMentionText('@image 007')).toBe('@image_7')
  })

  it('is idempotent on canonical tokens', () => {
    expect(normalizeMentionText('@image_1 @video_2')).toBe('@image_1 @video_2')
  })

  it('matches tokens glued to CJK prose (real LLM output)', () => {
    expect(normalizeMentionText('@图片1入夜月色，@图片2肩扛纸箱'))
      .toBe('@image_1入夜月色，@image_2肩扛纸箱')
  })

  it('leaves non-slot mentions and lookalikes alone', () => {
    expect(normalizeMentionText('@style @imagery @image_1x')).toBe('@style @imagery @image_1x')
  })
})

describe('hasRawMentionTokens', () => {
  it('detects raw forms and not canonical ones', () => {
    expect(hasRawMentionTokens('@图片#1')).toBe(true)
    expect(hasRawMentionTokens('@image_1')).toBe(false)
    expect(hasRawMentionTokens('plain')).toBe(false)
  })
})

describe('nonSlotMentionLabels / citedPositions', () => {
  it('returns entry labels but not slot tokens', () => {
    expect(nonSlotMentionLabels('@style and @image_1 with @hero-2')).toEqual(['style', 'hero-2'])
  })

  it('dedupes and returns empty for slot-only or plain text', () => {
    expect(nonSlotMentionLabels('@a @a @b')).toEqual(['a', 'b'])
    expect(nonSlotMentionLabels('@image_1 plain')).toEqual([])
  })

  it('collects cited positions per type, sorted and unique', () => {
    expect(citedPositions('@image_3 @image_1 @image_3 @video_2', 'image')).toEqual([1, 3])
    expect(citedPositions('@image_3 @video_2', 'video')).toEqual([2])
    expect(citedPositions('@image_3', 'audio')).toEqual([])
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
    expect(mentionOrdinalText('natural', zh)(1)).toBe('图1')
  })

  it('minimax_tags emits literal per-type tags', () => {
    expect(mentionOrdinalText('minimax_tags', zh)(1)).toBe('<Picture 1>')
    expect(mentionOrdinalText('minimax_tags', zh)(9)).toBe('<Picture 9>')
    expect(mentionOrdinalText('minimax_tags', zh, 'video')(2)).toBe('<Video 2>')
    expect(mentionOrdinalText('minimax_tags', zh, 'audio')(1)).toBe('<Audio 1>')
  })
})

describe('minimaxAudioOffset', () => {
  it('equals the number of videos being sent', () => {
    expect(minimaxAudioOffset({ image: [1], video: [1, 2], audio: [1] })).toBe(2)
    expect(minimaxAudioOffset({ image: [], video: [], audio: [1] })).toBe(0)
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
  const orders = (image: number, video = 0, audio = 0) => mentionSendOrders(tableNode(image, video, audio))

  it('expands all three token types by position', () => {
    const r = expandMentionTokens(
      'copy @image_2 style, motion of @video_1 and @video_2, voice from @audio_1',
      orders(2, 2, 1),
      texts,
    )
    expect(r.text).toBe('copy <Picture 2> style, motion of <Video 1> and <Video 2>, voice from <Audio 1>')
    expect(r.missing).toEqual([])
  })

  it('reports missing tokens with their type and drops them', () => {
    const r = expandMentionTokens('@video_1 then @audio_2 with @image_1 or @image_0', orders(1), texts)
    expect(r.text).toBe(' then  with <Picture 1> or ')
    expect(r.missing).toEqual([
      { type: 'image', slot: 0 },
      { type: 'video', slot: 1 },
      { type: 'audio', slot: 2 },
    ])
  })

  it('does not cross-match between types or longer labels', () => {
    const r = expandMentionTokens('@video_1x @videos @image_1 @audio_5', orders(1, 1, 1), texts)
    expect(r.text).toBe('@video_1x @videos <Picture 1> ')
    expect(r.missing).toEqual([{ type: 'audio', slot: 5 }])
  })

  it('handles multi-digit positions and CJK prose', () => {
    const r = expandMentionTokens(
      '@image_1入夜月色，@image_11肩扛纸箱，动作学@video_1结尾',
      orders(11, 1),
      texts,
    )
    expect(r.text).toBe('<Picture 1>入夜月色，<Picture 11>肩扛纸箱，动作学<Video 1>结尾')
    expect(r.missing).toEqual([])
  })
})

describe('remapMentionTokens', () => {
  it('renumbers tokens by the position map and leaves others alone', () => {
    const r = remapMentionTokens('@image_1 wears @image_3 on @image_2, @video_1 stays', {
      image: new Map([[1, 2], [2, 3], [3, 1]]),
    })
    expect(r.text).toBe('@image_2 wears @image_1 on @image_3, @video_1 stays')
    expect(r.removed).toEqual([])
  })

  it('drops removed positions together with one trailing space', () => {
    const r = remapMentionTokens('use @image_2 and @image_1 for the look', {
      image: new Map([[1, null], [2, 1]]),
    })
    expect(r.text).toBe('use @image_1 and for the look')
    expect(r.removed).toEqual([{ type: 'image', position: 1 }])
  })

  it('does not chain replacements', () => {
    const r = remapMentionTokens('@image_1 @image_2', { image: new Map([[1, 2], [2, 1]]) })
    expect(r.text).toBe('@image_2 @image_1')
  })

  it('is a no-op for empty maps and untouched types', () => {
    expect(remapMentionTokens('@image_1 @audio_1', {}).text).toBe('@image_1 @audio_1')
    expect(remapMentionTokens('@image_5', { image: new Map([[1, 2]]) }).text).toBe('@image_5')
  })
})
