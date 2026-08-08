import { describe, expect, it } from 'vitest'

import { batchImageUrls } from '@/stores/stageStore'

import {
  IMAGE_REFS_PROP,
  isBatchRef,
  readImageRefs,
  refKey,
  refType,
  writeImageRefs,
} from './imageRefs'

describe('imageRefs', () => {
  it('reads an empty list when nothing is stored', () => {
    expect(readImageRefs(null)).toEqual([])
    expect(readImageRefs({})).toEqual([])
    expect(readImageRefs({ properties: {} })).toEqual([])
    expect(readImageRefs({ properties: { [IMAGE_REFS_PROP]: 'nope' } })).toEqual([])
  })

  it('round-trips refs through write/read', () => {
    const node: any = {}
    writeImageRefs(node, [{ asset_id: 3, slot: 0 }, { asset_id: 7, slot: 2 }])
    expect(node.properties[IMAGE_REFS_PROP]).toEqual([
      { asset_id: 3, slot: 0 },
      { asset_id: 7, slot: 2 },
    ])
    expect(readImageRefs(node)).toEqual([
      { asset_id: 3, slot: 0 },
      { asset_id: 7, slot: 2 },
    ])
  })

  it('drops entries without a valid integer asset_id and slot', () => {
    const node = {
      properties: {
        [IMAGE_REFS_PROP]: [
          { asset_id: 5, slot: 1 },
          { asset_id: 'bad', slot: 0 },
          { asset_id: 9 },
          { asset_id: 4, slot: 'x' },
          { asset_id: 6, slot: null },
          { slot: 2 },
        ],
      },
    }
    expect(readImageRefs(node)).toEqual([{ asset_id: 5, slot: 1 }])
  })

  it('writeImageRefs is a no-op on a null node', () => {
    expect(() => writeImageRefs(null, [{ asset_id: 1, slot: 0 }])).not.toThrow()
  })

  it('parses batch refs, requiring a batch_id and a non-negative index', () => {
    const node = {
      properties: {
        [IMAGE_REFS_PROP]: [
          { batch_index: 2, batch_id: 'abc', slot: 0 },
          { batch_index: -1, batch_id: 'abc', slot: 1 },
          { batch_index: 3, slot: 2 },
        ],
      },
    }
    const refs = readImageRefs(node)
    expect(refs).toEqual([{ batch_index: 2, batch_id: 'abc', slot: 0 }])
    expect(isBatchRef(refs[0])).toBe(true)
    expect(refType(refs[0])).toBe('image')
  })

  it('round-trips typed and batch refs together', () => {
    const node: any = {}
    const refs = [
      { asset_id: 1, slot: 0 },
      { asset_id: 2, slot: 1, type: 'video' as const },
      { batch_index: 3, batch_id: 'abc', slot: 2 },
    ]
    writeImageRefs(node, refs)
    expect(readImageRefs(node)).toEqual(refs)
  })

  it('refKey distinguishes batch and asset refs', () => {
    expect(refKey({ asset_id: 5, slot: 0 })).toBe('asset:5')
    expect(refKey({ batch_index: 5, batch_id: 'abc', slot: 0 })).toBe('batch:abc:5')
  })
})

describe('batchImageUrls', () => {
  it('extracts urls in order and skips empty entries', () => {
    const json = JSON.stringify({ images: [
      { index: '1', image_url: '/view?a.png' },
      { index: '2', image_url: '' },
      { index: '3', image_url: '/view?c.png' },
    ] })
    expect(batchImageUrls(json)).toEqual(['/view?a.png', '/view?c.png'])
  })

  it('returns empty for null, garbage and non-batch json', () => {
    expect(batchImageUrls(null)).toEqual([])
    expect(batchImageUrls('not json')).toEqual([])
    expect(batchImageUrls('{"clips": []}')).toEqual([])
  })
})
