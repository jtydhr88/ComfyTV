import { describe, expect, it } from 'vitest'

import { IMAGE_REFS_PROP, readImageRefs, writeImageRefs } from './imageRefs'

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
})
