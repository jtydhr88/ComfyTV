import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import {
  batchItemIndex,
  isBatchItemSelected,
  parsePayloadList,
  shortTypeLabel,
  shotSummary,
  sumShotDurations,
  useValuePreview,
} from './useValuePreview'

describe('parsePayloadList', () => {
  const content = JSON.stringify({ images: [{ index: 1 }, { index: 2 }] })

  it('returns the keyed array when type matches', () => {
    expect(parsePayloadList(content !== '' ? 'COMFYTV_IMAGES' : '', content, 'COMFYTV_IMAGES', 'images'))
      .toHaveLength(2)
  })

  it('returns [] when the type does not match', () => {
    expect(parsePayloadList('COMFYTV_TEXT', content, 'COMFYTV_IMAGES', 'images')).toEqual([])
  })

  it('returns [] for null / empty content', () => {
    expect(parsePayloadList('COMFYTV_IMAGES', null, 'COMFYTV_IMAGES', 'images')).toEqual([])
    expect(parsePayloadList('COMFYTV_IMAGES', '', 'COMFYTV_IMAGES', 'images')).toEqual([])
  })

  it('returns [] on malformed JSON or a non-array key', () => {
    expect(parsePayloadList('COMFYTV_IMAGES', '{bad', 'COMFYTV_IMAGES', 'images')).toEqual([])
    expect(parsePayloadList('COMFYTV_IMAGES', '{"images":42}', 'COMFYTV_IMAGES', 'images')).toEqual([])
  })
})

describe('sumShotDurations', () => {
  it('sums numeric durations, strips a trailing s, rounds', () => {
    expect(sumShotDurations([{ duration: '2s' }, { duration: '3.4S' }, { duration: 1 }] as any)).toBe(6)
  })

  it('ignores null / non-numeric durations', () => {
    expect(sumShotDurations([{ duration: null }, { duration: 'abc' }, { duration: '5' }] as any)).toBe(5)
    expect(sumShotDurations([] as any)).toBe(0)
  })
})

describe('shotSummary', () => {
  it('prefers scene_purpose, collapses whitespace, caps at 60 chars', () => {
    expect(shotSummary({ scene_purpose: '  hero   shot ' } as any)).toBe('hero shot')
    expect(shotSummary({ prompt: 'x'.repeat(80) } as any)).toHaveLength(60)
  })

  it('falls back prompt → image_prompt → empty', () => {
    expect(shotSummary({ prompt: 'p' } as any)).toBe('p')
    expect(shotSummary({ image_prompt: 'ip' } as any)).toBe('ip')
    expect(shotSummary({} as any)).toBe('')
  })
})

describe('shortTypeLabel', () => {
  it('maps known types, passes unknown through', () => {
    expect(shortTypeLabel('COMFYTV_IMAGES')).toBe('BATCH')
    expect(shortTypeLabel('COMFYTV_PANORAMA')).toBe('360°')
    expect(shortTypeLabel('WHATEVER')).toBe('WHATEVER')
  })
})

describe('batchItemIndex / isBatchItemSelected', () => {
  it('uses img.index, falls back to 1-based position', () => {
    expect(batchItemIndex({ index: 7 } as any, 0)).toBe(7)
    expect(batchItemIndex({} as any, 2)).toBe('3')
  })

  it('selection matches by numeric equality, false when no selection', () => {
    expect(isBatchItemSelected({ index: 3 } as any, 0, 3)).toBe(true)
    expect(isBatchItemSelected({ index: 3 } as any, 0, '3')).toBe(true)
    expect(isBatchItemSelected({} as any, 2, 3)).toBe(true)
    expect(isBatchItemSelected({ index: 3 } as any, 0, 4)).toBe(false)
    expect(isBatchItemSelected({ index: 3 } as any, 0, null)).toBe(false)
  })
})

describe('useValuePreview', () => {
  it('derives parsed lists reactively from type + content', () => {
    const type = ref('COMFYTV_IMAGES')
    const content = ref<string | null>(JSON.stringify({ images: [{ index: 1 }] }))
    const vp = useValuePreview(() => type.value, () => content.value)

    expect(vp.hasContent.value).toBe(true)
    expect(vp.shortType.value).toBe('BATCH')
    expect(vp.batchImages.value).toHaveLength(1)
    expect(vp.storyboardShots.value).toEqual([])

    type.value = 'COMFYTV_STORYBOARD'
    content.value = JSON.stringify({ shots: [{ duration: '2s' }, { duration: '3s' }] })
    expect(vp.batchImages.value).toEqual([])
    expect(vp.storyboardShots.value).toHaveLength(2)
    expect(vp.storyboardTotalSec.value).toBe(5)
  })

  it('hasContent is false for null/empty', () => {
    const vp = useValuePreview(() => 'COMFYTV_TEXT', () => null)
    expect(vp.hasContent.value).toBe(false)
  })
})
