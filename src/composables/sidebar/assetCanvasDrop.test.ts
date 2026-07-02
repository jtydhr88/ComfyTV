import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/comfyApp', () => ({ app: { canvas: { canvas: undefined } } }))
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

describe('installAssetCanvasDrop', () => {
  it('attaches dragover + drop listeners once the graph canvas exists', async () => {
    vi.resetModules()
    const { app } = await import('@/lib/comfyApp')
    const el = { addEventListener: vi.fn() }
    ;(app as any).canvas.canvas = el
    const mod = await import('./assetCanvasDrop')

    mod.installAssetCanvasDrop({} as any)

    expect(el.addEventListener).toHaveBeenCalledWith('dragover', expect.any(Function))
    expect(el.addEventListener).toHaveBeenCalledWith('drop', expect.any(Function))
  })

  it('is idempotent — a second call attaches nothing more', async () => {
    vi.resetModules()
    const { app } = await import('@/lib/comfyApp')
    const el = { addEventListener: vi.fn() }
    ;(app as any).canvas.canvas = el
    const mod = await import('./assetCanvasDrop')

    mod.installAssetCanvasDrop({} as any)
    el.addEventListener.mockClear()
    mod.installAssetCanvasDrop({} as any)

    expect(el.addEventListener).not.toHaveBeenCalled()
  })

  it('retries on the next frame while the canvas is absent', async () => {
    vi.resetModules()
    const { app } = await import('@/lib/comfyApp')
    ;(app as any).canvas.canvas = undefined
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(0 as any)
    const mod = await import('./assetCanvasDrop')

    mod.installAssetCanvasDrop({} as any)

    expect(raf).toHaveBeenCalledWith(expect.any(Function))
    raf.mockRestore()
  })

  it('resolves the dropped asset through the store on a real drop', async () => {
    vi.resetModules()
    const storeMod = await import('@/stores/assetStore')
    const byId = vi.fn(() => asset)
    ;(storeMod.useAssetStore as any).mockReturnValue({ byId })
    const { app } = await import('@/lib/comfyApp')
    let dropHandler: ((e: DragEvent) => void) | undefined
    const el = {
      addEventListener: vi.fn((type: string, fn: any) => {
        if (type === 'drop') dropHandler = fn
      }),
    }
    ;(app as any).canvas.canvas = el
    const mod = await import('./assetCanvasDrop')

    mod.installAssetCanvasDrop({} as any)
    dropHandler?.(dragEvent([mod.ASSET_DRAG_MIME], '7'))

    expect(byId).toHaveBeenCalledWith(7)
  })
})
