import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import {
  batchItemIndex,
  batchItemPayload,
  batchItemTag,
  batchLightboxItems,
  canRemoveBatchItem,
  isActivationKey,
  isBatchItemSelected,
  isUpstreamBatchItem,
  materialSwatchStyleOf,
  parsePayloadList,
  previewMediaTypeOf,
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

describe('previewMediaTypeOf', () => {
  it('maps audio/video/model types, defaults to image', () => {
    expect(previewMediaTypeOf('COMFYTV_AUDIO')).toBe('audio')
    expect(previewMediaTypeOf('COMFYTV_AUDIOS')).toBe('audio')
    expect(previewMediaTypeOf('COMFYTV_VIDEO')).toBe('video')
    expect(previewMediaTypeOf('COMFYTV_VIDEOS')).toBe('video')
    expect(previewMediaTypeOf('COMFYTV_MODEL')).toBe('model')
    expect(previewMediaTypeOf('COMFYTV_IMAGE')).toBe('image')
    expect(previewMediaTypeOf('COMFYTV_TEXT')).toBe('image')
  })
})

describe('batchItemTag / batchItemPayload', () => {
  it('prefers label, falls back to indexed hash tag', () => {
    expect(batchItemTag({ label: 'hero', image_url: '/x' } as any, 0)).toBe('hero')
    expect(batchItemTag({ index: '7', image_url: '/x' } as any, 0)).toBe('#7')
    expect(batchItemTag({ image_url: '/x' } as any, 2)).toBe('#3')
  })

  it('builds the click payload with a 1-based fallback index', () => {
    expect(batchItemPayload({ index: '4', label: 'l', prompt: 'p', image_url: '/a' } as any, 0))
      .toEqual({ index: '4', label: 'l', prompt: 'p', imageUrl: '/a' })
    expect(batchItemPayload({ image_url: '/b' } as any, 2))
      .toEqual({ index: '3', label: undefined, prompt: undefined, imageUrl: '/b' })
  })
})

describe('isActivationKey', () => {
  it('accepts Enter and Space variants only', () => {
    expect(isActivationKey('Enter')).toBe(true)
    expect(isActivationKey(' ')).toBe(true)
    expect(isActivationKey('Spacebar')).toBe(true)
    expect(isActivationKey('Escape')).toBe(false)
    expect(isActivationKey('a')).toBe(false)
  })
})

describe('isUpstreamBatchItem / canRemoveBatchItem', () => {
  const img = { index: '1', image_url: '/a.png' } as any

  it('detects upstream membership by url', () => {
    expect(isUpstreamBatchItem(img, ['/a.png'])).toBe(true)
    expect(isUpstreamBatchItem(img, ['/b.png'])).toBe(false)
    expect(isUpstreamBatchItem(img, undefined)).toBe(false)
  })

  it('removable only when enabled, not selected and not upstream', () => {
    expect(canRemoveBatchItem(img, 0, { removable: true })).toBe(true)
    expect(canRemoveBatchItem(img, 0, {})).toBe(false)
    expect(canRemoveBatchItem(img, 0, { removable: true, selectedIndex: 1 })).toBe(false)
    expect(canRemoveBatchItem(img, 0, { removable: true, upstreamUrls: ['/a.png'] })).toBe(false)
  })
})

describe('batchLightboxItems', () => {
  it('labels fall back label → prompt → derived name', () => {
    const items = batchLightboxItems([
      { image_url: '/1', label: 'L' },
      { image_url: '/2', prompt: 'P' },
      { image_url: '/3' },
    ] as any, url => `name:${url}`)
    expect(items).toEqual([
      { url: '/1', label: 'L' },
      { url: '/2', label: 'P' },
      { url: '/3', label: 'name:/3' },
    ])
  })
})

describe('materialSwatchStyleOf', () => {
  it('uses opacity when opaque, floors at 0.35', () => {
    const s = materialSwatchStyleOf({ color: '#ff0000', transmission: 0, opacity: 0.1 })
    expect(s.opacity).toBe('0.35')
    expect(s.background).toContain('#ff0000')
    expect(s.boxShadow).toBe('inset 0 -4px 8px rgb(0 0 0 / 0.35)')
  })

  it('uses the 0.55 glass alpha when transmissive', () => {
    const s = materialSwatchStyleOf({ color: '#00ff00', transmission: 1, opacity: 1 })
    expect(s.opacity).toBe('0.55')
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
