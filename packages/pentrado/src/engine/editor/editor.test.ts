import { beforeAll, describe, expect, it } from 'vitest'
import { registerBuiltinKinds } from '../kinds'
import { rasterKind } from '../kinds/raster'
import { registerBuiltinTools } from '../tools'
import { createEditor } from './editor'
import { OverlayList } from './overlayList'
import { FakeCompositor, ev, stub2d } from './editorTestHarness'

beforeAll(() => {
  registerBuiltinKinds()
  registerBuiltinTools()
})

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

  it('floating item survives serialize/loadJSON (no data loss on refresh)', () => {
    const editor = setup()
    const canvas = document.createElement('canvas')
    canvas.width = 40
    canvas.height = 30
    const cid = editor.content.register(canvas, { uploadedUrl: 'http://x/float.png' })
    editor.startFloating(cid, 40, 30, 'chunk')
    expect(editor.floating()).not.toBeNull()

    const json = editor.serialize()
    const restored = setup()
    restored.loadJSON(json)
    const f = restored.floating()
    expect(f).not.toBeNull()
    expect(f!.contentId).toBe(cid)
    expect(f!.url).toBe('http://x/float.png')
    expect(f!.transform.w).toBe(40)
    expect(f!.transform.h).toBe(30)
  })

  it('multi-select: selection set is the truth, active derives from its tail', () => {
    const editor = setup()
    const a = rasterKind.create({ name: 'a' })
    const b = rasterKind.create({ name: 'b' })
    editor.addNode(a)
    editor.addNode(b)
    editor.setSelectedNodes([a.id, b.id])
    expect(editor.selectedNodeIds()).toEqual([a.id, b.id])
    expect(editor.activeNodeId()).toBe(b.id)
    editor.setActiveNode(a.id)
    expect(editor.selectedNodeIds()).toEqual([a.id])
  })

  it('multi-select survives undo/redo of structural changes (stale ids filtered on read)', () => {
    const editor = setup()
    const a = rasterKind.create({ name: 'a' })
    editor.addNode(a)
    editor.undo()
    expect(editor.selectedNodeIds()).toEqual([])
    expect(editor.activeNodeId()).toBeNull()
    editor.redo()
    expect(editor.selectedNodeIds()).toEqual([a.id])
  })

  it('removeNodes deletes the whole selection as one undo step', () => {
    const editor = setup()
    const a = rasterKind.create({ name: 'a' })
    const b = rasterKind.create({ name: 'b' })
    const c = rasterKind.create({ name: 'c' })
    editor.addNode(a)
    editor.addNode(b)
    editor.addNode(c)
    expect(editor.removeNodes([a.id, c.id])).toBe(true)
    expect(editor.document().root.children.map((n) => n.id)).toEqual([b.id])
    editor.undo()
    expect(editor.document().root.children.map((n) => n.id)).toEqual([a.id, b.id, c.id])
  })

  it('removeNodes skips descendants of a selected group (topmost filter)', () => {
    const editor = setup()
    const a = rasterKind.create({ name: 'a' })
    editor.addNode(a)
    editor.setSelectedNodes([a.id])
    editor.groupActive()
    const group = editor.document().root.children[0]
    expect(editor.removeNodes([group.id, a.id])).toBe(true)
    expect(editor.document().root.children).toHaveLength(0)
    editor.undo()
    expect(editor.document().root.children.map((n) => n.id)).toEqual([group.id])
  })

  it('groupActive wraps a multi-selection at the topmost original index', () => {
    const editor = setup()
    const a = rasterKind.create({ name: 'a' })
    const b = rasterKind.create({ name: 'b' })
    const c = rasterKind.create({ name: 'c' })
    editor.addNode(a)
    editor.addNode(b)
    editor.addNode(c)
    editor.setSelectedNodes([a.id, c.id])
    expect(editor.groupActive()).toBe(true)
    const children = editor.document().root.children
    expect(children).toHaveLength(2)
    expect(children[0].kind).toBe('group')
    expect((children[0] as import('../node').GroupData).children.map((n) => n.id)).toEqual([a.id, c.id])
    expect(children[1].id).toBe(b.id)
    expect(editor.activeNodeId()).toBe(children[0].id)
    editor.undo()
    expect(editor.document().root.children.map((n) => n.id)).toEqual([a.id, b.id, c.id])
  })

  it('select tool drags every selected layer and undoes as one step', () => {
    const editor = setup()
    const a = rasterKind.create({ transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 } })
    const b = rasterKind.create({ transform: { x: 200, y: 0, w: 100, h: 100, rotation: 0 } })
    editor.addNode(a)
    editor.addNode(b)
    editor.setTool('select')
    editor.setSelectedNodes([a.id, b.id])

    editor.pointerDown(ev, { x: 50, y: 50 })
    editor.pointerMove(ev, { x: 70, y: 60 })
    editor.pointerUp(ev, { x: 70, y: 60 })
    expect(a.transform).toMatchObject({ x: 20, y: 10 })
    expect(b.transform).toMatchObject({ x: 220, y: 10 })

    editor.undo()
    expect(a.transform).toMatchObject({ x: 0, y: 0 })
    expect(b.transform).toMatchObject({ x: 200, y: 0 })
  })

  it('transform commits keep the original pixels: shrink then enlarge loses nothing', () => {
    const restore = stub2d()
    try {
      const editor = setup()
      const canvas = document.createElement('canvas')
      canvas.width = 1000
      canvas.height = 1000
      const cid = editor.content.register(canvas)
      const r = rasterKind.create({
        contentId: cid, naturalWidth: 1000, naturalHeight: 1000,
        transform: { x: 0, y: 0, w: 1000, h: 1000, rotation: 0 },
      })
      editor.addNode(r)
      editor.setTool('transform')

      editor.pointerDown(ev, { x: 1000, y: 1000 })
      editor.pointerMove(ev, { x: 100, y: 100 })
      editor.pointerUp(ev, { x: 100, y: 100 })
      expect(editor.transformApply()).toBe(true)
      expect(r.transform.w).toBeCloseTo(100)
      expect(r.contentId).toBe(cid)
      expect(r.naturalWidth).toBe(1000)

      editor.pointerDown(ev, { x: 100, y: 100 })
      editor.pointerMove(ev, { x: 1000, y: 1000 })
      editor.pointerUp(ev, { x: 1000, y: 1000 })
      expect(editor.transformApply()).toBe(true)
      expect(r.transform.w).toBeCloseTo(1000)
      expect(r.contentId).toBe(cid)
      expect(r.naturalWidth).toBe(1000)
    } finally {
      restore()
    }
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

})
