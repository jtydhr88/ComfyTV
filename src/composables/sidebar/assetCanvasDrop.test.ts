import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/comfyApp', () => ({ app: {} }))
vi.mock('@/stores/assetStore', () => ({ useAssetStore: vi.fn() }))
vi.mock('@/composables/stages/assetLoaderNode', () => ({
  clientToCanvasPos: vi.fn(() => [100, 200]),
  createAssetLoaderNode: vi.fn(),
}))

import { clientToCanvasPos, createAssetLoaderNode } from '@/composables/stages/assetLoaderNode'

import { ASSET_DRAG_MIME, handleAssetDragOver, handleAssetDrop } from './assetCanvasDrop'

function dragEvent(types: string[], data = ''): DragEvent {
  return {
    clientX: 300,
    clientY: 400,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      types,
      dropEffect: 'none',
      getData: vi.fn((mime: string) => (mime === ASSET_DRAG_MIME ? data : '')),
    },
  } as any
}

const asset = { id: 7, media_type: 'image', payload_url: '/u/a.png', category_ids: [] } as any
const resolveAsset = vi.fn((id: number) => (id === 7 ? asset : null))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleAssetDragOver', () => {
  it('never touches foreign drags (OS files, workflows, models)', () => {
    for (const types of [['Files'], ['text/plain'], ['text/uri-list'], []]) {
      const e = dragEvent(types)
      handleAssetDragOver(e)
      expect(e.preventDefault).not.toHaveBeenCalled()
      expect(e.stopPropagation).not.toHaveBeenCalled()
      expect(e.dataTransfer!.dropEffect).toBe('none')
    }
  })

  it('allows drop + copy cursor for asset drags', () => {
    const e = dragEvent([ASSET_DRAG_MIME])
    handleAssetDragOver(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.dataTransfer!.dropEffect).toBe('copy')
  })

  it('handles a missing dataTransfer without throwing', () => {
    expect(() => handleAssetDragOver({ preventDefault: vi.fn() } as any)).not.toThrow()
  })
})

describe('handleAssetDrop', () => {
  it('never touches foreign drops — native ComfyUI file/workflow drop stays intact', () => {
    const e = dragEvent(['Files'])
    handleAssetDrop(e, resolveAsset)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(e.stopPropagation).not.toHaveBeenCalled()
    expect(createAssetLoaderNode).not.toHaveBeenCalled()
  })

  it('creates a loader node centered at the drop point for asset drags', () => {
    const e = dragEvent([ASSET_DRAG_MIME], '7')
    handleAssetDrop(e, resolveAsset)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.stopPropagation).toHaveBeenCalled()
    expect(clientToCanvasPos).toHaveBeenCalledWith(300, 400)
    expect(createAssetLoaderNode).toHaveBeenCalledWith(asset, [100, 200], {
      anchor: 'center',
      select: true,
    })
  })

  it('still claims the event but creates nothing when the id is bad or unknown', () => {
    for (const data of ['not-a-number', '999']) {
      const e = dragEvent([ASSET_DRAG_MIME], data)
      handleAssetDrop(e, resolveAsset)
      expect(e.preventDefault).toHaveBeenCalled()
      expect(e.stopPropagation).toHaveBeenCalled()
    }
    expect(createAssetLoaderNode).not.toHaveBeenCalled()
  })
})
