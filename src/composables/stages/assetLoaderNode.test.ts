import { beforeEach, describe, expect, it, vi } from 'vitest'

import { assetLoaderClass, canvasCenter, createAssetLoaderNode } from './assetLoaderNode'

function makeNode() {
  return {
    widgets: [
      { name: 'category', value: '' },
      { name: 'asset_url', value: '' },
      { name: 'asset_id', value: 0 },
    ],
    size: [300, 200],
    pos: [0, 0],
  }
}

function asset(over: Record<string, unknown> = {}): any {
  return {
    id: 7,
    name: 'pic',
    media_type: 'image',
    payload_url: '/u/p.png',
    category_ids: [],
    metadata: {},
    ...over,
  }
}

beforeEach(() => {
  ;(window as any).LiteGraph = { createNode: vi.fn(() => makeNode()) }
})

describe('assetLoaderClass', () => {
  it('maps each media type to its loader node class', () => {
    expect(assetLoaderClass('image')).toBe('ComfyTV.AssetImageLoaderStage')
    expect(assetLoaderClass('video')).toBe('ComfyTV.AssetVideoLoaderStage')
    expect(assetLoaderClass('audio')).toBe('ComfyTV.AssetAudioLoaderStage')
  })

  it('falls back to the image loader for unknown media types', () => {
    expect(assetLoaderClass('weird')).toBe('ComfyTV.AssetImageLoaderStage')
  })
})

describe('createAssetLoaderNode', () => {
  it('creates the matching node and writes the asset widgets (uncategorized → none)', () => {
    const node = createAssetLoaderNode(asset(), [10, 20])
    expect((window as any).LiteGraph.createNode).toHaveBeenCalledWith('ComfyTV.AssetImageLoaderStage')
    const w = (n: string) => node.widgets.find((x: any) => x.name === n).value
    expect(w('asset_url')).toBe('/u/p.png')
    expect(w('asset_id')).toBe(7)
    expect(w('category')).toBe('none')
    expect(node.pos).toEqual([10, 20])
  })

  it('defaults the category filter to the first group when the asset is categorized', () => {
    const node = createAssetLoaderNode(asset({ category_ids: [5, 9] }), [0, 0])
    expect(node.widgets.find((x: any) => x.name === 'category').value).toBe('5')
  })

  it('picks the loader class from the asset media type', () => {
    createAssetLoaderNode(asset({ media_type: 'video' }), [0, 0])
    expect((window as any).LiteGraph.createNode).toHaveBeenCalledWith('ComfyTV.AssetVideoLoaderStage')
  })

  it('center anchor offsets the node by half its size', () => {
    const node = createAssetLoaderNode(asset(), [100, 100], { anchor: 'center' })
    expect(node.pos).toEqual([100 - 150, 100 - 100])
  })

  it('returns null when LiteGraph is unavailable', () => {
    delete (window as any).LiteGraph
    expect(createAssetLoaderNode(asset(), [0, 0])).toBeNull()
  })
})

describe('canvasCenter', () => {
  it('falls back to the origin when canvas geometry is unavailable', () => {
    expect(canvasCenter()).toEqual([0, 0])
  })
})
