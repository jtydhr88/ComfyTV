import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = { byId: vi.fn() }
vi.mock('@/stores/assetStore', () => ({ useAssetStore: () => store }))

import { app } from '@/lib/comfyApp'
import { ASSET_DRAG_MIME } from '@/composables/sidebar/assetCanvasDrop'

import { useLoaderFileDrop } from './useLoaderFileDrop'

interface DragEventOpts {
  types?: string[]
  items?: Array<{ kind: string; type: string }>
  files?: File[]
  assetId?: string
}

function dragEvent(opts: DragEventOpts = {}): DragEvent {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      types: opts.types ?? [],
      items: opts.items ?? [],
      files: opts.files ?? [],
      dropEffect: 'none',
      getData: vi.fn((mime: string) => (mime === ASSET_DRAG_MIME ? opts.assetId ?? '' : '')),
    },
  } as any
}

function fileDragEvent(files: File[]): DragEvent {
  return dragEvent({
    types: ['Files'],
    items: files.map((f) => ({ kind: 'file', type: f.type })),
    files,
  })
}

const toastAdd = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(app as any).extensionManager = { toast: { add: toastAdd } }
})

describe('useLoaderFileDrop — drag over', () => {
  it('claims file drags whose MIME matches the loader kind', () => {
    const drop = useLoaderFileDrop({ kind: () => 'image', onFiles: vi.fn() })
    const e = dragEvent({ types: ['Files'], items: [{ kind: 'file', type: 'image/png' }] })
    drop.onDragOver(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.dataTransfer!.dropEffect).toBe('copy')
    expect(drop.dragActive.value).toBe(true)
  })

  it('leaves mismatching file drags untouched so native ComfyUI handling survives', () => {
    const drop = useLoaderFileDrop({ kind: () => 'audio', onFiles: vi.fn() })
    const e = dragEvent({ types: ['Files'], items: [{ kind: 'file', type: 'image/png' }] })
    drop.onDragOver(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(e.stopPropagation).not.toHaveBeenCalled()
    expect(drop.dragActive.value).toBe(false)
  })

  it('leaves non-file drags (text, links) untouched', () => {
    const drop = useLoaderFileDrop({ kind: () => 'image', onFiles: vi.fn() })
    for (const types of [['text/plain'], ['text/uri-list'], []]) {
      const e = dragEvent({ types })
      drop.onDragOver(e)
      expect(e.preventDefault).not.toHaveBeenCalled()
    }
  })

  it('claims unknown-MIME file drags only for the model kind', () => {
    const blank = () => dragEvent({ types: ['Files'], items: [{ kind: 'file', type: '' }] })
    const model = useLoaderFileDrop({ kind: () => 'model', onFiles: vi.fn() })
    const image = useLoaderFileDrop({ kind: () => 'image', onFiles: vi.fn() })
    const e1 = blank()
    model.onDragOver(e1)
    expect(e1.preventDefault).toHaveBeenCalled()
    const e2 = blank()
    image.onDragOver(e2)
    expect(e2.preventDefault).not.toHaveBeenCalled()
  })

  it('claims asset drags only when onAsset is provided', () => {
    const withAsset = useLoaderFileDrop({ kind: () => 'image', onFiles: vi.fn(), onAsset: vi.fn() })
    const without = useLoaderFileDrop({ kind: () => 'image', onFiles: vi.fn() })
    const e1 = dragEvent({ types: [ASSET_DRAG_MIME] })
    withAsset.onDragOver(e1)
    expect(e1.preventDefault).toHaveBeenCalled()
    const e2 = dragEvent({ types: [ASSET_DRAG_MIME] })
    without.onDragOver(e2)
    expect(e2.preventDefault).not.toHaveBeenCalled()
  })

  it('tracks enter/leave depth for the highlight', () => {
    const drop = useLoaderFileDrop({ kind: () => 'image', onFiles: vi.fn() })
    const mk = () => dragEvent({ types: ['Files'], items: [{ kind: 'file', type: 'image/png' }] })
    drop.onDragEnter(mk())
    drop.onDragEnter(mk())
    expect(drop.dragActive.value).toBe(true)
    drop.onDragLeave(mk())
    expect(drop.dragActive.value).toBe(true)
    drop.onDragLeave(mk())
    expect(drop.dragActive.value).toBe(false)
  })
})

describe('useLoaderFileDrop — file drops', () => {
  it('forwards only the files matching the loader kind', () => {
    const onFiles = vi.fn()
    const drop = useLoaderFileDrop({ kind: () => 'image', onFiles })
    const img = new File(['x'], 'a.png', { type: 'image/png' })
    const song = new File(['x'], 'b.mp3', { type: 'audio/mpeg' })
    const e = fileDragEvent([img, song])
    drop.onDrop(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.stopPropagation).toHaveBeenCalled()
    expect(onFiles).toHaveBeenCalledWith([img])
    expect(drop.dragActive.value).toBe(false)
  })

  it('matches 3D models by extension despite an empty MIME', () => {
    const onFiles = vi.fn()
    const drop = useLoaderFileDrop({ kind: () => 'model', onFiles })
    const glb = new File(['x'], 'thing.glb', { type: '' })
    const obj = new File(['x'], 'scan.obj', { type: '' })
    drop.onDrop(fileDragEvent([glb, obj]))
    expect(onFiles).toHaveBeenCalledWith([glb, obj])
  })

  it('toasts instead of loading when a claimed drop has no matching file', () => {
    const onFiles = vi.fn()
    const drop = useLoaderFileDrop({ kind: () => 'model', onFiles })
    const txt = new File(['x'], 'notes.txt', { type: '' })
    const e = fileDragEvent([txt])
    drop.onDrop(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(onFiles).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn' }))
  })

  it('leaves unclaimed drops untouched — no preventDefault, no toast', () => {
    const onFiles = vi.fn()
    const drop = useLoaderFileDrop({ kind: () => 'image', onFiles })
    const e = fileDragEvent([new File(['x'], 'wf.json', { type: 'application/json' })])
    drop.onDrop(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(onFiles).not.toHaveBeenCalled()
    expect(toastAdd).not.toHaveBeenCalled()
  })
})

describe('useLoaderFileDrop — asset drops', () => {
  const asset = { id: 7, media_type: 'image', payload_url: '/u/a.png', category_ids: [] }

  it('selects a matching asset in place', () => {
    store.byId.mockReturnValue(asset)
    const onAsset = vi.fn()
    const drop = useLoaderFileDrop({ kind: () => 'image', onFiles: vi.fn(), onAsset })
    const e = dragEvent({ types: [ASSET_DRAG_MIME], assetId: '7' })
    drop.onDrop(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.stopPropagation).toHaveBeenCalled()
    expect(onAsset).toHaveBeenCalledWith(asset)
  })

  it('toasts on media-type mismatch and does not select', () => {
    store.byId.mockReturnValue(asset)
    const onAsset = vi.fn()
    const drop = useLoaderFileDrop({ kind: () => 'video', onFiles: vi.fn(), onAsset })
    drop.onDrop(dragEvent({ types: [ASSET_DRAG_MIME], assetId: '7' }))
    expect(onAsset).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn' }))
  })

  it('still claims the event but does nothing for unknown asset ids', () => {
    store.byId.mockReturnValue(undefined)
    const onAsset = vi.fn()
    const drop = useLoaderFileDrop({ kind: () => 'image', onFiles: vi.fn(), onAsset })
    const e = dragEvent({ types: [ASSET_DRAG_MIME], assetId: '999' })
    drop.onDrop(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(onAsset).not.toHaveBeenCalled()
  })
})
