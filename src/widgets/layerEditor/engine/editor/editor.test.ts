import { beforeAll, describe, expect, it } from 'vitest'

import type { Compositor, CompositeInput, FBOHandle } from '../compositor'
import { registerBuiltinKinds } from '../kinds'
import { rasterKind } from '../kinds/raster'
import { registerBuiltinTools } from '../tools'
import { createEditor } from './editor'
import { OverlayList } from './overlayList'

beforeAll(() => {
  registerBuiltinKinds()
  registerBuiltinTools()
})

class FakeCompositor implements Compositor {
  init() {
    return true
  }
  resize() {}
  composite(_inputs: CompositeInput[], _t?: FBOHandle | null) {}
  allocTarget(width: number, height: number): FBOHandle {
    return { id: 1, width, height }
  }
  freeTarget() {}
  targetTexture(): WebGLTexture {
    return {} as WebGLTexture
  }
  upload(): WebGLTexture {
    return {} as WebGLTexture
  }
  readback(): ImageData {
    return new ImageData(1, 1)
  }
  async toBlob(): Promise<Blob> {
    return new Blob()
  }
  getCanvas() {
    return null
  }
  dispose() {}
}

const ev = { pressure: 0.5, shiftKey: false } as unknown as PointerEvent

function stub2d(): () => void {
  const orig = HTMLCanvasElement.prototype.getContext
  ;(HTMLCanvasElement.prototype as any).getContext = function (kind: string) {
    if (kind !== '2d') return null
    return {
      canvas: this,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      globalCompositeOperation: 'source-over',
      fillStyle: '',
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      drawImage: () => {},
      fillRect: () => {},
      clearRect: () => {},
      putImageData: () => {},
      getImageData: (_x: number, _y: number, w: number, h: number) => new ImageData(w, h),
      createImageData: (w: number, h: number) => new ImageData(w, h),
    } as unknown as CanvasRenderingContext2D
  }
  return () => {
    HTMLCanvasElement.prototype.getContext = orig
  }
}

describe('OverlayList', () => {
  it('hit-tests handles and batches redraws with pause/resume', () => {
    let redraws = 0
    const o = new OverlayList(() => (redraws += 1))
    o.add({ type: 'handle', pos: { x: 10, y: 10 }, shape: 'square', id: 'se' })
    o.add({ type: 'handle', pos: { x: 50, y: 50 }, shape: 'square', id: 'nw' })
    expect(o.hitHandle({ x: 11, y: 11 }, 4)).toBe('se')
    expect(o.hitHandle({ x: 30, y: 30 }, 4)).toBeNull()

    o.pause()
    o.pause()
    o.resume()
    expect(redraws).toBe(0)
    o.resume()
    expect(redraws).toBe(1)
  })
})

describe('createEditor — end-to-end orchestration', () => {
  function setup() {
    const editor = createEditor({ compositor: new FakeCompositor() })
    return editor
  }

  it('adds a layer, records history, and makes it active', () => {
    const editor = setup()
    const r = rasterKind.create({ name: 'L1' })
    editor.addNode(r)
    expect(editor.activeNodeId()).toBe(r.id)
    expect(editor.document().root.children).toHaveLength(1)
    expect(editor.history.canUndo()).toBe(true)
  })

  it('routes pointer events through the select tool to move + undo a layer', () => {
    const editor = setup()
    const r = rasterKind.create({ transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 } })
    editor.addNode(r)
    editor.setTool('select')
    editor.setActiveNode(r.id)

    editor.pointerDown(ev, { x: 50, y: 50 })
    editor.pointerMove(ev, { x: 70, y: 50 })
    editor.pointerUp(ev, { x: 70, y: 50 })
    expect(r.transform.x).toBe(20)

    editor.undo()
    expect(r.transform.x).toBe(0)
  })

  it('removes the active layer and restores it on undo', () => {
    const editor = setup()
    const r = rasterKind.create({ name: 'gone' })
    editor.addNode(r)
    editor.setActiveNode(r.id)
    editor.removeActive()
    expect(editor.document().root.children).toHaveLength(0)
    editor.undo()
    expect(editor.document().root.children).toHaveLength(1)
  })

  it('flipImage mirrors transforms, swaps raster content, and undoes as one step', () => {
    const restore = stub2d()
    try {
      const editor = setup()
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 32
      const cid = editor.content.register(canvas)
      const r = rasterKind.create({
        name: 'photo', contentId: cid, naturalWidth: 64, naturalHeight: 32,
        transform: { x: 100, y: 40, w: 200, h: 80, rotation: 0.5 },
      })
      editor.addNode(r)

      expect(editor.flipImage('h')).toBe(true)
      expect(r.transform.x).toBe(1024 - 100 - 200)
      expect(r.transform.y).toBe(40)
      expect(r.transform.rotation).toBe(-0.5)
      expect(r.contentId).not.toBe(cid)
      expect(editor.content.get(r.contentId)).toBeDefined()

      editor.undo()
      expect(r.transform.x).toBe(100)
      expect(r.transform.rotation).toBe(0.5)
      expect(r.contentId).toBe(cid)

      editor.redo()
      expect(r.transform.x).toBe(724)
    } finally {
      restore()
    }
  })

  it('flipImage twice restores geometry (involution) and flips vertically', () => {
    const restore = stub2d()
    try {
      const editor = setup()
      const canvas = document.createElement('canvas')
      canvas.width = 8
      canvas.height = 8
      const r = rasterKind.create({
        contentId: editor.content.register(canvas), naturalWidth: 8, naturalHeight: 8,
        transform: { x: 10, y: 20, w: 50, h: 60, rotation: 0 },
      })
      editor.addNode(r)

      editor.flipImage('v')
      expect(r.transform.y).toBe(1024 - 20 - 60)
      expect(r.transform.x).toBe(10)
      editor.flipImage('v')
      expect(r.transform.y).toBe(20)
    } finally {
      restore()
    }
  })

  it('flipImage on an empty document is a no-op', () => {
    const editor = setup()
    expect(editor.flipImage('h')).toBe(false)
    expect(editor.history.canUndo()).toBe(false)
  })

  it('serializes the full document (width/height/root/channels)', () => {
    const editor = setup()
    editor.addNode(rasterKind.create({ name: 'L1' }))
    const s = editor.serialize() as { width: number; height: number; root: { kind: string; children: unknown[] } }
    expect(s.width).toBe(1024)
    expect(s.root.kind).toBe('group')
    expect(s.root.children).toHaveLength(1)
  })

  it('round-trips through serialize → loadJSON (the layer_state contract)', () => {
    const a = setup()
    a.addNode(rasterKind.create({ name: 'Keep', contentId: 'c1', naturalWidth: 32, naturalHeight: 16 }))
    const json = JSON.stringify(a.serialize())

    const b = setup()
    b.loadJSON(json)
    expect(b.document().root.children).toHaveLength(1)
    expect(b.document().root.children[0].name).toBe('Keep')
  })

  it('hydrates referenced bitmaps into the content store', async () => {
    const editor = setup()
    editor.loadJSON(
      JSON.stringify({
        width: 64,
        height: 64,
        root: {
          kind: 'group',
          children: [{ kind: 'raster', contentId: 'cid', url: 'http://x/y.png', naturalWidth: 10, naturalHeight: 10 }],
        },
      })
    )
    const canvas = document.createElement('canvas')
    canvas.width = 10
    canvas.height = 10
    await editor.hydrate(async () => canvas)
    expect(editor.content.has('cid')).toBe(true)
  })

  it('switches tools', () => {
    const editor = setup()
    editor.setTool('brush')
    expect(editor.activeToolId()).toBe('brush')
  })

  it('floating: start centers on the canvas, anchor-as-new creates a layer, undo removes it', () => {
    const editor = setup()
    editor.loadJSON(JSON.stringify({ width: 200, height: 200, root: { kind: 'group', children: [] } }))
    const img = document.createElement('canvas')
    img.width = 40
    img.height = 20
    const cid = editor.content.register(img, { uploadedUrl: 'http://x/f.png' })

    editor.startFloating(cid, 40, 20)
    const f = editor.floating()
    expect(f).not.toBeNull()
    expect(f!.transform).toMatchObject({ x: 80, y: 90, w: 40, h: 20, rotation: 0 })
    expect(editor.document().root.children).toHaveLength(0)

    editor.anchorFloating('new')
    expect(editor.floating()).toBeNull()
    const layer = editor.document().root.children[0] as { contentId: string; url?: string; transform: { x: number } }
    expect(layer.contentId).toBe(cid)
    expect(layer.url).toBe('http://x/f.png')
    expect(layer.transform.x).toBe(80)

    editor.undo()
    expect(editor.document().root.children).toHaveLength(0)
  })

  it('floating: anchor into the active layer merges and grows the buffer to the union', () => {
    const orig = HTMLCanvasElement.prototype.getContext
    ;(HTMLCanvasElement.prototype as any).getContext = function (kind: string) {
      if (kind !== '2d') return null
      return {
        canvas: this,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
        drawImage: () => {}, clearRect: () => {},
      } as unknown as CanvasRenderingContext2D
    }
    try {
      const editor = setup()
      editor.loadJSON(JSON.stringify({ width: 200, height: 200, root: { kind: 'group', children: [] } }))
      const base = document.createElement('canvas')
      base.width = 100
      base.height = 100
      const baseId = editor.content.register(base)
      const layer = rasterKind.create({
        name: 'target', contentId: baseId, naturalWidth: 100, naturalHeight: 100,
        transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
      })
      editor.addNode(layer)

      const img = document.createElement('canvas')
      img.width = 40
      img.height = 40
      const fid = editor.content.register(img)
      editor.startFloating(fid, 40, 40)
      editor.floating()!.transform.x = 120
      editor.floating()!.transform.y = 120

      editor.anchorFloating('active')
      expect(editor.floating()).toBeNull()
      expect(editor.document().root.children).toHaveLength(1)
      expect(layer.contentId).not.toBe(baseId)
      expect(layer.url).toBeUndefined()
      expect(layer.naturalWidth).toBe(160)
      expect(layer.naturalHeight).toBe(160)
      expect(layer.transform).toMatchObject({ x: 0, y: 0, w: 160, h: 160, rotation: 0 })

      editor.undo()
      expect(layer.contentId).toBe(baseId)
      expect(layer.naturalWidth).toBe(100)
    } finally {
      HTMLCanvasElement.prototype.getContext = orig
    }
  })

  it('floating: cancel discards and frees the content', () => {
    const editor = setup()
    const img = document.createElement('canvas')
    img.width = 10
    img.height = 10
    const cid = editor.content.register(img)
    editor.startFloating(cid, 10, 10)
    editor.cancelFloating()
    expect(editor.floating()).toBeNull()
    expect(editor.content.has(cid)).toBe(false)
  })

  it('selection: setRect/selectNone are undoable and expose bounds', () => {
    const restore = stub2d()
    try {
    const editor = setup()
    editor.loadJSON(JSON.stringify({ width: 100, height: 100, root: { kind: 'group', children: [] } }))
    expect(editor.selectionBounds()).toBeNull()

    expect(editor.setRectSelection({ x: 10, y: 20, w: 30, h: 40 })).toBe(true)
    expect(editor.selectionBounds()).toEqual({ x: 10, y: 20, w: 30, h: 40 })
    expect(editor.document().selectionId).toBeTruthy()

    expect(editor.selectNone()).toBe(true)
    expect(editor.selectionBounds()).toBeNull()

    editor.undo()
    expect(editor.selectionBounds()).toEqual({ x: 10, y: 20, w: 30, h: 40 })
    editor.undo()
    expect(editor.selectionBounds()).toBeNull()
    } finally { restore() }
  })

  it('selection: rect is clamped to the document and serialized', () => {
    const restore = stub2d()
    try {
    const editor = setup()
    editor.loadJSON(JSON.stringify({ width: 100, height: 100, root: { kind: 'group', children: [] } }))
    editor.setRectSelection({ x: -10, y: 50, w: 50, h: 200 })
    expect(editor.selectionBounds()).toEqual({ x: 0, y: 50, w: 40, h: 50 })
    const s = editor.serialize() as { channels: unknown[]; selectionId?: string }
    expect(s.channels).toHaveLength(1)
    expect(s.selectionId).toBe(editor.document().selectionId)
    } finally { restore() }
  })

  it('selection: selectAll covers the canvas; floating centers on the selection', () => {
    const restore = stub2d()
    try {
    const editor = setup()
    editor.loadJSON(JSON.stringify({ width: 200, height: 200, root: { kind: 'group', children: [] } }))
    editor.setRectSelection({ x: 100, y: 100, w: 80, h: 80 })
    const img = document.createElement('canvas')
    img.width = 20
    img.height = 20
    const cid = editor.content.register(img)
    editor.startFloating(cid, 20, 20)
    expect(editor.floating()!.transform).toMatchObject({ x: 130, y: 130 })
    editor.cancelFloating()

    editor.selectAll()
    expect(editor.selectionBounds()).toEqual({ x: 0, y: 0, w: 200, h: 200 })
    } finally { restore() }
  })

  it('deleting a layer keeps its pixels alive for undo (structure commands hold refs)', () => {
    const editor = setup()
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 8
    const cid = editor.content.register(c)
    const layer = rasterKind.create({ name: 'L', contentId: cid, naturalWidth: 8, naturalHeight: 8 })
    editor.addNode(layer)
    editor.setActiveNode(layer.id)

    editor.removeActive()
    expect(editor.content.has(cid)).toBe(true)

    editor.undo()
    expect(editor.document().root.children).toHaveLength(1)
    expect(editor.content.has(cid)).toBe(true)
  })

  it('collects content unreferenced by the document or history', async () => {
    const { SetContentCommand } = await import('../commands/setContent')
    const editor = setup()
    const c = () => {
      const el = document.createElement('canvas')
      el.width = 4
      el.height = 4
      return el
    }
    const a = editor.content.register(c())
    const raster = rasterKind.create({ name: 'L', contentId: a })
    editor.addNode(raster)

    const b = editor.content.register(c())
    raster.contentId = b
    editor.history.push(new SetContentCommand('Paint', raster, a, b, editor.content))
    expect(editor.content.has(a)).toBe(true)

    editor.history.clear()
    expect(editor.content.has(a)).toBe(false)
    expect(editor.content.has(b)).toBe(true)
  })
})
