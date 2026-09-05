import { describe, expect, it } from 'vitest'

import { mediaItems, pickedMediaIndex, pickedMediaItem } from './mediaItems'

const batch = JSON.stringify({
  images: [
    { image_url: '/view?filename=a.png', label: 'A' },
    { image_url: '/view?filename=b.png' },
    { image_url: '' },
  ],
})

describe('mediaItems', () => {
  it('parses batch JSON and drops empty urls', () => {
    expect(mediaItems({ output: batch, pool: null }, 'batch')).toEqual([
      { url: '/view?filename=a.png', label: 'A' },
      { url: '/view?filename=b.png', label: '' },
    ])
  })

  it('treats a plain output url as a single batch item', () => {
    expect(mediaItems({ output: '/view?filename=x.mp4', pool: null }, 'batch'))
      .toEqual([{ url: '/view?filename=x.mp4', label: '' }])
  })

  it('pool source reads state.pool and never falls back to raw strings', () => {
    expect(mediaItems({ output: '/view?x', pool: batch }, 'pool')).toHaveLength(2)
    expect(mediaItems({ output: null, pool: '/view?x' }, 'pool')).toEqual([])
    expect(mediaItems({ output: null, pool: '' }, 'pool')).toEqual([])
  })
})

describe('pickedMediaIndex / pickedMediaItem', () => {
  it('clamps to [1, count] and defaults to 1', () => {
    expect(pickedMediaIndex({ pickedIndex: undefined }, 3)).toBe(1)
    expect(pickedMediaIndex({ pickedIndex: 9 }, 3)).toBe(3)
    expect(pickedMediaIndex({ pickedIndex: 0 }, 0)).toBe(1)
  })

  it('returns the picked item or null', () => {
    expect(pickedMediaItem({ output: batch, pool: null, pickedIndex: 2 }, 'batch')?.url)
      .toBe('/view?filename=b.png')
    expect(pickedMediaItem({ output: null, pool: null, pickedIndex: 2 }, 'batch')).toBeNull()
  })
})
