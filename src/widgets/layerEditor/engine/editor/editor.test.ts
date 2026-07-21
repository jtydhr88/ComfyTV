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
})
