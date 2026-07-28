import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { Compositor } from '../compositor'
import type { Document } from '../document'
import { History } from '../history'
import { DefaultContentStore } from '../impl/contentStore'
import { registerBuiltinKinds } from '../kinds'
import { groupKind } from '../kinds/group'
import { rasterKind } from '../kinds/raster'
import type { GroupData, RasterData } from '../node'
import type { PaintCore } from '../paint'
import { defaultMode } from '../mode'
import type { Overlay, ToolContext } from '../tool'
import { makePaintToolDef } from './paintTool'
import { makeSelectToolDef } from './selectTool'
import { makeTransformToolDef } from './transformTool'

beforeAll(() => registerBuiltinKinds())

function root(children: RasterData[]): GroupData {
  return {
    kind: 'group',
    id: 'root',
    name: 'root',
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    children,
    passThrough: false,
  }
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

const ev = { pressure: 0.5, shiftKey: false } as unknown as PointerEvent

interface Harness {
  ctx: ToolContext
  history: History
  previews: Map<string, HTMLCanvasElement>
}

function harness(doc: Document, content: DefaultContentStore, createPaintCore: () => PaintCore): Harness {
  const history = new History()
  const overlay: Overlay = { clear: vi.fn(), add: vi.fn(), pause: vi.fn(), resume: vi.fn(), hitHandle: () => null }
  const state = { selected: [] as string[] }
  const previews = new Map<string, HTMLCanvasElement>()
  const ctx: ToolContext = {
    document: () => doc,
    history,
    compositor: {} as Compositor,
    content,
    overlay,
    activeNodeId: () => (state.selected.length ? state.selected[state.selected.length - 1] : null),
    setActiveNode: (id) => (state.selected = id ? [id] : []),
    selectedNodeIds: () => [...state.selected],
    setSelectedNodes: (ids) => (state.selected = [...ids]),
    createPaintCore: () => createPaintCore(),
    setPaintPreview: (key, canvas) => {
      if (canvas) previews.set(key, canvas)
      else previews.delete(key)
    },
    selection: { combineShape: vi.fn(), currentMask: () => null, none: vi.fn() },
    compositePixels: () => null,
    floatSelection: () => false,
    zoom: () => 1,
    requestRender: vi.fn(),
    options: <T,>() => ({}) as T,
  }
  return { ctx, history, previews }
}

describe('PaintTool — tool ⟂ core seam', () => {
  it('translates press/motion/release into PaintCore calls and pushes the returned command', () => {
    const content = new DefaultContentStore()
    const cid = content.register(canvas(64, 64))
    const raster = rasterKind.create({ contentId: cid, naturalWidth: 64, naturalHeight: 64 })

    const previewCanvas = document.createElement('canvas')
    const core = {
      start: vi.fn(),
      motion: vi.fn(),
      finish: vi.fn(() => ({ label: 'Brush', dirtyMask: 1, apply() {}, sizeBytes: () => 0 })),
      cancel: vi.fn(),
      preview: vi.fn(() => previewCanvas),
    }
    const doc: Document = { version: 2, width: 128, height: 128, root: root([raster]), channels: [] }
    const h = harness(doc, content, () => core)
    h.ctx.setActiveNode(raster.id)

    const tool = makePaintToolDef('brush', 'brush', 'content').create(h.ctx)
    tool.onButtonPress(ev, { x: 10, y: 10 })
    expect(core.start).toHaveBeenCalledOnce()
    expect(core.start.mock.calls[0][0].slot).toBe(raster)

    expect(h.previews.get(`content:${raster.id}`)).toBe(previewCanvas)

    tool.onMotion(ev, { x: 20, y: 20 })
    expect(core.motion).toHaveBeenCalledOnce()
    expect(core.preview.mock.calls.length).toBeGreaterThanOrEqual(2)

    tool.onButtonRelease(ev, { x: 20, y: 20 })
    expect(core.finish).toHaveBeenCalledOnce()
    expect(h.previews.has(`content:${raster.id}`)).toBe(false)
    expect(h.history.canUndo()).toBe(true)
  })

  it('does nothing when there is no paintable active node', () => {
    const content = new DefaultContentStore()
    const doc: Document = { version: 2, width: 128, height: 128, root: root([]), channels: [] }
    const core = { start: vi.fn(), motion: vi.fn(), finish: vi.fn(), cancel: vi.fn(), preview: vi.fn() }
    const h = harness(doc, content, () => core as unknown as PaintCore)
    const tool = makePaintToolDef('brush', 'brush', 'content').create(h.ctx)
    tool.onButtonPress(ev, { x: 5, y: 5 })
    expect(core.start).not.toHaveBeenCalled()
  })
})

describe('SelectTool — pure select + move, no handles', () => {
  function setup() {
    const content = new DefaultContentStore()
    const raster = rasterKind.create({ transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 } })
    const doc: Document = { version: 2, width: 200, height: 200, root: root([raster]), channels: [] }
    const h = harness(doc, content, () => ({}) as PaintCore)
    h.ctx.setActiveNode(raster.id)
    return { h, raster, tool: makeSelectToolDef().create(h.ctx) }
  }

  it('moves the active node and records one command', () => {
    const { h, raster, tool } = setup()
    tool.onButtonPress(ev, { x: 50, y: 50 })
    tool.onMotion(ev, { x: 60, y: 55 })
    tool.onButtonRelease(ev, { x: 60, y: 55 })
    expect(raster.transform).toMatchObject({ x: 10, y: 5 })
    expect(h.history.canUndo()).toBe(true)
    h.history.undo()
    expect(raster.transform).toMatchObject({ x: 0, y: 0 })
  })

  it('never resizes: dragging on the box corner just moves', () => {
    const { raster, tool } = setup()
    tool.onButtonPress(ev, { x: 100, y: 100 })
    tool.onMotion(ev, { x: 200, y: 150 })
    tool.onButtonRelease(ev, { x: 200, y: 150 })
    expect(raster.transform).toMatchObject({ x: 100, y: 50, w: 100, h: 100 })
  })

  it('does not record a command when nothing moved', () => {
    const { h, tool } = setup()
    tool.onButtonPress(ev, { x: 50, y: 50 })
    tool.onButtonRelease(ev, { x: 50, y: 50 })
    expect(h.history.canUndo()).toBe(false)
  })

  it('moving a group translates all its children', () => {
    const content = new DefaultContentStore()
    const a = rasterKind.create({ transform: { x: 0, y: 0, w: 50, h: 50, rotation: 0 } })
    const b = rasterKind.create({ transform: { x: 60, y: 0, w: 50, h: 50, rotation: 0 } })
    const group = groupKind.create({ children: [a, b] })
    const doc: Document = { version: 2, width: 200, height: 200, root: root([group as unknown as RasterData]), channels: [] }
    const h = harness(doc, content, () => ({}) as PaintCore)
    h.ctx.setActiveNode(group.id)
    const tool = makeSelectToolDef().create(h.ctx)

    tool.onButtonPress(ev, { x: 55, y: 25 })
    tool.onMotion(ev, { x: 75, y: 35 })
    tool.onButtonRelease(ev, { x: 75, y: 35 })
    expect(a.transform).toMatchObject({ x: 20, y: 10 })
    expect(b.transform).toMatchObject({ x: 80, y: 10 })

    h.history.undo()
    expect(a.transform).toMatchObject({ x: 0, y: 0 })
    expect(b.transform).toMatchObject({ x: 60, y: 0 })
  })
})

describe('TransformTool — explicit session with apply/cancel', () => {
  function setup() {
    const content = new DefaultContentStore()
    const raster = rasterKind.create({ transform: { x: 0, y: 0, w: 100, h: 100, rotation: 0 } })
    const doc: Document = { version: 2, width: 200, height: 200, root: root([raster]), channels: [] }
    const h = harness(doc, content, () => ({}) as PaintCore)
    h.ctx.setActiveNode(raster.id)
    const tool = makeTransformToolDef().create(h.ctx)
    tool.onActivate?.()
    return { h, raster, tool }
  }

  it('resizes via handle, commits one undo step on apply', () => {
    const { h, raster, tool } = setup()
    tool.onButtonPress(ev, { x: 100, y: 100 })
    tool.onMotion(ev, { x: 200, y: 150 })
    tool.onButtonRelease(ev, { x: 200, y: 150 })
    expect(raster.transform).toMatchObject({ w: 200, h: 150 })
    expect(h.history.canUndo()).toBe(false)
    expect((tool as unknown as { isDirty(): boolean }).isDirty()).toBe(true)

    expect((tool as unknown as { apply(): boolean }).apply()).toBe(true)
    expect(h.history.canUndo()).toBe(true)
    h.history.undo()
    expect(raster.transform).toMatchObject({ w: 100, h: 100 })
  })

  it('shift-resize keeps the aspect ratio', () => {
    const { raster, tool } = setup()
    const evShift = { pressure: 0.5, shiftKey: true } as unknown as PointerEvent
    tool.onButtonPress(evShift, { x: 100, y: 100 })
    tool.onMotion(evShift, { x: 300, y: 120 })
    tool.onButtonRelease(evShift, { x: 300, y: 120 })
    expect(raster.transform.w / raster.transform.h).toBeCloseTo(1)
    expect(raster.transform.w).toBeCloseTo(210)
  })

  it('cancel restores the pre-session transform without touching history', () => {
    const { h, raster, tool } = setup()
    tool.onButtonPress(ev, { x: 100, y: 100 })
    tool.onMotion(ev, { x: 200, y: 150 })
    tool.onButtonRelease(ev, { x: 200, y: 150 })
    expect((tool as unknown as { cancel(): boolean }).cancel()).toBe(true)
    expect(raster.transform).toMatchObject({ x: 0, y: 0, w: 100, h: 100 })
    expect(h.history.canUndo()).toBe(false)
  })

  it('deactivating the tool auto-commits a dirty session', () => {
    const { h, raster, tool } = setup()
    tool.onButtonPress(ev, { x: 50, y: 50 })
    tool.onMotion(ev, { x: 70, y: 50 })
    tool.onButtonRelease(ev, { x: 70, y: 50 })
    tool.onDeactivate?.()
    expect(raster.transform).toMatchObject({ x: 20 })
    expect(h.history.canUndo()).toBe(true)
  })

  it('ignores groups', () => {
    const content = new DefaultContentStore()
    const a = rasterKind.create({ transform: { x: 0, y: 0, w: 50, h: 50, rotation: 0 } })
    const group = groupKind.create({ children: [a] })
    const doc: Document = { version: 2, width: 200, height: 200, root: root([group as unknown as RasterData]), channels: [] }
    const h = harness(doc, content, () => ({}) as PaintCore)
    h.ctx.setActiveNode(group.id)
    const tool = makeTransformToolDef().create(h.ctx)
    tool.onActivate?.()
    tool.onButtonPress(ev, { x: 25, y: 25 })
    tool.onMotion(ev, { x: 45, y: 25 })
    tool.onButtonRelease(ev, { x: 45, y: 25 })
    expect(a.transform).toMatchObject({ x: 0, y: 0 })
    expect(h.history.canUndo()).toBe(false)
  })
})
