import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Point } from '@/widgets/painter/types'

import { ContentStore } from './ContentStore'
import { createPaintTool, createSelectTool, createTextTool, type BrushParams, type ToolContext } from './tools'
import type { Layer, LayerEditorState, LayerTransform, RasterLayer, TextLayer } from './types'

interface Op {
  op: string
  args: unknown[]
  fillStyle: unknown
  globalAlpha: number
  globalCompositeOperation: string
}

type MockCtx = CanvasRenderingContext2D & { ops: Op[] }

const CTX_METHODS = [
  'clearRect', 'fillRect', 'strokeRect', 'drawImage', 'translate', 'rotate', 'scale',
  'beginPath', 'moveTo', 'lineTo', 'arc', 'fill', 'stroke', 'setLineDash',
] as const

function createMockCtx(canvas: HTMLCanvasElement): MockCtx {
  const ops: Op[] = []
  const stack: Array<Record<string, unknown>> = []
  const ctx: Record<string, unknown> = {
    canvas,
    ops,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
  }
  const record = (op: string, args: unknown[]) => {
    ops.push({
      op,
      args,
      fillStyle: ctx.fillStyle,
      globalAlpha: ctx.globalAlpha as number,
      globalCompositeOperation: ctx.globalCompositeOperation as string,
    })
  }
  for (const m of CTX_METHODS) ctx[m] = vi.fn((...args: unknown[]) => record(m, args))
  ctx.save = vi.fn(() => {
    stack.push({
      fillStyle: ctx.fillStyle,
      strokeStyle: ctx.strokeStyle,
      globalAlpha: ctx.globalAlpha,
      globalCompositeOperation: ctx.globalCompositeOperation,
      lineWidth: ctx.lineWidth,
      lineCap: ctx.lineCap,
      lineJoin: ctx.lineJoin,
    })
    record('save', [])
  })
  ctx.restore = vi.fn(() => {
    Object.assign(ctx, stack.pop() ?? {})
    record('restore', [])
  })
  ctx.createPattern = vi.fn(() => ({ __pattern: true }))
  ctx.createRadialGradient = vi.fn(() => ({ addColorStop: vi.fn() }))
  return ctx as unknown as MockCtx
}

const ctxByCanvas = new WeakMap<HTMLCanvasElement, MockCtx>()

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    let c = ctxByCanvas.get(this)
    if (!c) {
      c = createMockCtx(this)
      ctxByCanvas.set(this, c)
    }
    return c as unknown as CanvasRenderingContext2D
  })
})

function ctxOf(canvas: HTMLCanvasElement): MockCtx {
  return canvas.getContext('2d') as unknown as MockCtx
}

function opsOf(ctx: MockCtx, name: string): Op[] {
  return ctx.ops.filter((o) => o.op === name)
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function t(x: number, y: number, w: number, h: number, rotation = 0): LayerTransform {
  return { x, y, w, h, rotation }
}

function raster(id: string, transform: LayerTransform, extra: Partial<RasterLayer> = {}): RasterLayer {
  return {
    id,
    type: 'raster',
    name: id,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    transform,
    contentId: `c-${id}`,
    naturalWidth: transform.w,
    naturalHeight: transform.h,
    ...extra,
  }
}

function textLayer(id: string, transform: LayerTransform, extra: Partial<TextLayer> = {}): TextLayer {
  return {
    id,
    type: 'text',
    name: id,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    transform,
    text: 'hello',
    fontRef: { kind: 'builtin', id: 'inter' },
    fontSize: 64,
    color: '#ffffff',
    letterSpacing: 0,
    lineHeight: 1.2,
    align: 'left',
    ...extra,
  }
}

function state(...layers: Layer[]): LayerEditorState {
  return { version: 1, width: 400, height: 300, layers }
}

interface CtxOptions {
  activeId?: string | null
  zoom?: number
  brush?: BrushParams
  brushTool?: 'brush' | 'eraser'
  paintTarget?: 'content' | 'mask'
}

function makeToolContext(initial: LayerEditorState, opts: CtxOptions = {}) {
  const content = new ContentStore()
  let stateRef = initial
  let activeId = opts.activeId ?? null
  const commit = vi.fn((next: LayerEditorState) => {
    stateRef = next
  })
  const setActiveLayer = vi.fn((id: string | null) => {
    activeId = id
  })
  const setOverride = vi.fn()
  const requestRender = vi.fn()
  const openTextEditor = vi.fn()
  const toolCtx: ToolContext = {
    getState: () => stateRef,
    getActiveId: () => activeId,
    setActiveLayer,
    content,
    zoom: () => opts.zoom ?? 1,
    commit,
    requestRender,
    brush: () => opts.brush ?? { size: 10, opacity: 0.8, hardness: 1, color: '#ff0000' },
    brushTool: () => opts.brushTool ?? 'brush',
    paintTarget: () => opts.paintTarget ?? 'content',
    setOverride,
    openTextEditor,
  }
  return {
    toolCtx,
    content,
    commit,
    setActiveLayer,
    setOverride,
    requestRender,
    openTextEditor,
    setState: (s: LayerEditorState) => {
      stateRef = s
    },
    getActiveId: () => activeId,
  }
}

const pe = (shiftKey = false) => ({ shiftKey }) as PointerEvent

function lastCommit(commit: ReturnType<typeof vi.fn>): [LayerEditorState, string | undefined] {
  const call = commit.mock.calls[commit.mock.calls.length - 1]
  return [call[0] as LayerEditorState, call[1] as string | undefined]
}

describe('createSelectTool', () => {
  it('deselects and returns false on empty space', () => {
    const h = makeToolContext(state(raster('a', t(0, 0, 100, 100))))
    const tool = createSelectTool(h.toolCtx)
    expect(tool.onPointerDown(pe(), { x: 350, y: 250 })).toBe(false)
    expect(h.setActiveLayer).toHaveBeenCalledWith(null)
  })

  it('starts a move on a layer body and commits translated transforms', () => {
    const h = makeToolContext(state(raster('a', t(0, 0, 100, 100))))
    const tool = createSelectTool(h.toolCtx)
    expect(tool.onPointerDown(pe(), { x: 40, y: 40 })).toBe(true)
    expect(h.setActiveLayer).toHaveBeenCalledWith('a')

    tool.onPointerMove(pe(), { x: 60, y: 55 })
    let [next, key] = lastCommit(h.commit)
    expect(key).toBe('move:a')
    expect(next.layers[0].transform).toMatchObject({ x: 20, y: 15, w: 100, h: 100 })

    // deltas are always relative to the drag start
    tool.onPointerMove(pe(), { x: 45, y: 40 })
    ;[next] = lastCommit(h.commit)
    expect(next.layers[0].transform).toMatchObject({ x: 5, y: 0 })

    tool.onPointerUp(pe(), { x: 45, y: 40 })
    const commits = h.commit.mock.calls.length
    tool.onPointerMove(pe(), { x: 99, y: 99 })
    expect(h.commit.mock.calls.length).toBe(commits)
  })

  it('moves the active layer when clicking its body away from any handle', () => {
    const h = makeToolContext(state(raster('a', t(0, 0, 100, 100))), { activeId: 'a' })
    const tool = createSelectTool(h.toolCtx)
    expect(tool.onPointerDown(pe(), { x: 50, y: 50 })).toBe(true)
    tool.onPointerMove(pe(), { x: 55, y: 60 })
    const [next, key] = lastCommit(h.commit)
    expect(key).toBe('move:a')
    expect(next.layers[0].transform).toMatchObject({ x: 5, y: 10 })
  })

  it('resizes via the active layer handles', () => {
    const h = makeToolContext(state(raster('a', t(0, 0, 100, 100))), { activeId: 'a' })
    const tool = createSelectTool(h.toolCtx)
    expect(tool.onPointerDown(pe(), { x: 100, y: 100 })).toBe(true)
    tool.onPointerMove(pe(), { x: 140, y: 120 })
    const [next, key] = lastCommit(h.commit)
    expect(key).toBe('resize:a')
    expect(next.layers[0].transform).toMatchObject({ x: 0, y: 0, w: 140, h: 120 })
  })

  it('locks the aspect ratio while shift is held', () => {
    const h = makeToolContext(state(raster('a', t(0, 0, 100, 100))), { activeId: 'a' })
    const tool = createSelectTool(h.toolCtx)
    tool.onPointerDown(pe(), { x: 100, y: 100 })
    tool.onPointerMove(pe(true), { x: 140, y: 120 })
    const [next] = lastCommit(h.commit)
    expect(next.layers[0].transform.w).toBeCloseTo(140)
    expect(next.layers[0].transform.h).toBeCloseTo(140)
  })

  it('rotates via the rotate handle', () => {
    const h = makeToolContext(state(raster('a', t(0, 0, 100, 100))), { activeId: 'a' })
    const tool = createSelectTool(h.toolCtx)
    expect(tool.onPointerDown(pe(), { x: 50, y: -24 })).toBe(true)
    tool.onPointerMove(pe(), { x: 124, y: 50 })
    const [next, key] = lastCommit(h.commit)
    expect(key).toBe('rotate:a')
    expect(next.layers[0].transform.rotation).toBeCloseTo(Math.PI / 2)
  })

  it('ignores handles of a locked active layer', () => {
    const h = makeToolContext(state(raster('a', t(0, 0, 100, 100), { locked: true })), { activeId: 'a' })
    const tool = createSelectTool(h.toolCtx)
    expect(tool.onPointerDown(pe(), { x: 100, y: 100 })).toBe(false)
    expect(h.setActiveLayer).toHaveBeenCalledWith(null)
  })

  it('does not commit when the dragged layer disappears from the state', () => {
    const h = makeToolContext(state(raster('a', t(0, 0, 100, 100))))
    const tool = createSelectTool(h.toolCtx)
    tool.onPointerDown(pe(), { x: 40, y: 40 })
    h.setState(state())
    tool.onPointerMove(pe(), { x: 60, y: 60 })
    expect(h.commit).not.toHaveBeenCalled()
  })

  it('reports cursors for handles, layer bodies and empty space', () => {
    const h = makeToolContext(state(raster('a', t(0, 0, 100, 100))), { activeId: 'a' })
    const tool = createSelectTool(h.toolCtx)
    expect(tool.cursorFor({ x: 100, y: 50 })).toBe('ew-resize')
    expect(tool.cursorFor({ x: 50, y: -24 })).toBe('grab')
    expect(tool.cursorFor({ x: 50, y: 50 })).toBe('move')
    expect(tool.cursorFor({ x: 300, y: 300 })).toBe('default')
  })

  it('reports default cursor over a locked layer', () => {
    const h = makeToolContext(state(raster('a', t(0, 0, 100, 100), { locked: true })), { activeId: 'a' })
    const tool = createSelectTool(h.toolCtx)
    expect(tool.cursorFor({ x: 50, y: 50 })).toBe('default')
  })
})

describe('createPaintTool', () => {
  function paintSetup(opts: CtxOptions & { layer?: Partial<RasterLayer>; baseSize?: number } = {}) {
    const base = makeCanvas(opts.baseSize ?? 200, opts.baseSize ?? 200)
    const layer = raster('a', t(0, 0, 100, 100), { contentId: 'c1', url: 'http://old', ...opts.layer })
    const h = makeToolContext(state(layer), { activeId: 'a', ...opts })
    h.content.register(base, { id: 'c1' })
    return { ...h, base, layer, tool: createPaintTool(h.toolCtx) }
  }

  it('refuses to start without an active layer', () => {
    const h = makeToolContext(state(raster('a', t(0, 0, 100, 100))))
    const tool = createPaintTool(h.toolCtx)
    expect(tool.onPointerDown(pe(), { x: 10, y: 10 })).toBe(false)
    expect(h.setOverride).not.toHaveBeenCalled()
  })

  it('refuses locked layers, text layers and missing content', () => {
    const locked = paintSetup({ layer: { locked: true } })
    expect(locked.tool.onPointerDown(pe(), { x: 10, y: 10 })).toBe(false)

    const textState = makeToolContext(state(textLayer('a', t(0, 0, 100, 100))), { activeId: 'a' })
    expect(createPaintTool(textState.toolCtx).onPointerDown(pe(), { x: 10, y: 10 })).toBe(false)

    const missing = makeToolContext(state(raster('a', t(0, 0, 100, 100), { contentId: 'nope' })), { activeId: 'a' })
    expect(createPaintTool(missing.toolCtx).onPointerDown(pe(), { x: 10, y: 10 })).toBe(false)
  })

  it('refuses mask painting without a mask or without mask content', () => {
    const noMask = paintSetup({ paintTarget: 'mask' })
    expect(noMask.tool.onPointerDown(pe(), { x: 10, y: 10 })).toBe(false)

    const orphan = paintSetup({
      paintTarget: 'mask',
      layer: { mask: { contentId: 'm-missing', enabled: true } },
    })
    expect(orphan.tool.onPointerDown(pe(), { x: 10, y: 10 })).toBe(false)
  })

  it('paints a brush stroke into a preview override and commits new content on release', () => {
    const h = paintSetup({ brush: { size: 10, opacity: 0.8, hardness: 0.5, color: '#ff0000' } })
    expect(h.tool.onPointerDown(pe(), { x: 10, y: 10 })).toBe(true)

    const [key, preview] = h.setOverride.mock.calls[0] as [string, HTMLCanvasElement]
    expect(key).toBe('content:a')
    expect(preview.width).toBe(200)
    expect(preview.height).toBe(200)
    expect(h.requestRender).toHaveBeenCalled()

    // preview composite: base first, then the stroke with brush opacity
    const pctx = ctxOf(preview)
    const draws = opsOf(pctx, 'drawImage')
    expect(draws[0].args[0]).toBe(h.base)
    expect(draws[1].globalAlpha).toBeCloseTo(0.8)
    expect(draws[1].globalCompositeOperation).toBe('source-over')

    // stroke canvas: dab at artboard (10,10) -> local px (20,20), pixelScale 2
    const strokeCanvas = draws[1].args[0] as HTMLCanvasElement
    const sctx = ctxOf(strokeCanvas)
    const arc0 = opsOf(sctx, 'arc')[0]
    expect(arc0.args.slice(0, 2)).toEqual([20, 20])
    // soft brush -> gradient dabs
    expect(sctx.createRadialGradient).toHaveBeenCalled()

    h.tool.onPointerMove(pe(), { x: 12, y: 10 })
    expect(opsOf(sctx, 'arc').length).toBeGreaterThan(1)

    h.tool.onPointerUp(pe(), { x: 12, y: 10 })
    const [next] = lastCommit(h.commit)
    const committed = next.layers[0] as RasterLayer
    expect(committed.contentId).not.toBe('c1')
    expect(committed.url).toBeUndefined()
    expect(h.content.get(committed.contentId)?.canvas).toBe(preview)
    expect(h.setOverride).toHaveBeenLastCalledWith('content:a', null)
  })

  it('erases content with destination-out, full alpha and forced hardness', () => {
    const h = paintSetup({
      brushTool: 'eraser',
      brush: { size: 10, opacity: 0.8, hardness: 0.5, color: '#ff0000' },
    })
    expect(h.tool.onPointerDown(pe(), { x: 10, y: 10 })).toBe(true)
    const preview = h.setOverride.mock.calls[0][1] as HTMLCanvasElement
    const pctx = ctxOf(preview)
    const strokeDraw = opsOf(pctx, 'drawImage')[1]
    expect(strokeDraw.globalCompositeOperation).toBe('destination-out')
    expect(strokeDraw.globalAlpha).toBe(1)

    // hardness forced to 1 -> segment strokes use plain lines, no gradients
    const sctx = ctxOf(strokeDraw.args[0] as HTMLCanvasElement)
    h.tool.onPointerMove(pe(), { x: 20, y: 10 })
    expect(opsOf(sctx, 'moveTo').length).toBeGreaterThan(0)
    expect(sctx.createRadialGradient).not.toHaveBeenCalled()
    h.tool.onPointerUp(pe(), { x: 20, y: 10 })
  })

  it('paints masks in white with inverted composite ops and rebinds mask content', () => {
    const h = paintSetup({
      paintTarget: 'mask',
      layer: { mask: { contentId: 'm1', enabled: true, url: 'http://mask' } },
    })
    h.content.register(makeCanvas(100, 100), { id: 'm1' })

    expect(h.tool.onPointerDown(pe(), { x: 10, y: 10 })).toBe(true)
    const [key, preview] = h.setOverride.mock.calls[0] as [string, HTMLCanvasElement]
    expect(key).toBe('mask:a')
    const pctx = ctxOf(preview)
    const strokeDraw = opsOf(pctx, 'drawImage')[1]
    // brush on mask hides pixels
    expect(strokeDraw.globalCompositeOperation).toBe('destination-out')

    const sctx = ctxOf(strokeDraw.args[0] as HTMLCanvasElement)
    expect(opsOf(sctx, 'fill')[0].fillStyle).toBe('rgb(255, 255, 255)')

    h.tool.onPointerUp(pe(), { x: 10, y: 10 })
    const [next] = lastCommit(h.commit)
    const mask = next.layers[0].mask!
    expect(mask.contentId).not.toBe('m1')
    expect(mask.url).toBeUndefined()
    expect(h.content.get(mask.contentId)?.canvas).toBe(preview)
  })

  it('restores mask pixels with source-over when erasing on a mask', () => {
    const h = paintSetup({
      paintTarget: 'mask',
      brushTool: 'eraser',
      layer: { mask: { contentId: 'm1', enabled: true } },
    })
    h.content.register(makeCanvas(100, 100), { id: 'm1' })
    expect(h.tool.onPointerDown(pe(), { x: 10, y: 10 })).toBe(true)
    const preview = h.setOverride.mock.calls[0][1] as HTMLCanvasElement
    expect(opsOf(ctxOf(preview), 'drawImage')[1].globalCompositeOperation).toBe('source-over')
    h.tool.onPointerUp(pe(), { x: 10, y: 10 })
  })

  it('emits smoothed points once the stroke is long enough', () => {
    const h = paintSetup()
    h.tool.onPointerDown(pe(), { x: 10, y: 10 })
    const preview = h.setOverride.mock.calls[0][1] as HTMLCanvasElement
    const strokeCanvas = opsOf(ctxOf(preview), 'drawImage')[1].args[0] as HTMLCanvasElement
    const sctx = ctxOf(strokeCanvas)
    // enough travel for the StrokeProcessor to emit resampled points itself
    for (const x of [15, 25, 40, 60, 80]) h.tool.onPointerMove(pe(), { x, y: 10 })
    const arcs = opsOf(sctx, 'arc')
    expect(arcs.length).toBeGreaterThan(3)
    h.tool.onPointerUp(pe(), { x: 80, y: 10 })
    const [next] = lastCommit(h.commit)
    expect((next.layers[0] as RasterLayer).contentId).not.toBe('c1')
  })

  it('keeps the layer untouched when its type changed mid-stroke', () => {
    const h = paintSetup()
    h.tool.onPointerDown(pe(), { x: 10, y: 10 })
    // same id, but no longer a raster layer when the stroke ends
    h.setState(state(textLayer('a', t(0, 0, 100, 100))))
    h.tool.onPointerUp(pe(), { x: 10, y: 10 })
    expect(h.commit).toHaveBeenCalled()
    const [next] = lastCommit(h.commit)
    expect(next.layers[0].type).toBe('text')
    expect((next.layers[0] as TextLayer).text).toBe('hello')
    expect(h.setOverride).toHaveBeenLastCalledWith('content:a', null)
  })

  it('ignores move/up without a session', () => {
    const h = paintSetup()
    h.tool.onPointerMove(pe(), { x: 10, y: 10 })
    h.tool.onPointerUp(pe(), { x: 10, y: 10 })
    expect(h.commit).not.toHaveBeenCalled()
    expect(h.requestRender).not.toHaveBeenCalled()
  })

  it('skips the commit but clears the override when the layer vanished mid-stroke', () => {
    const h = paintSetup()
    h.tool.onPointerDown(pe(), { x: 10, y: 10 })
    h.setState(state())
    h.tool.onPointerUp(pe(), { x: 10, y: 10 })
    expect(h.commit).not.toHaveBeenCalled()
    expect(h.setOverride).toHaveBeenLastCalledWith('content:a', null)
  })

  it('hides the cursor while painting', () => {
    const h = paintSetup()
    expect(h.tool.cursorFor({ x: 0, y: 0 })).toBe('none')
  })
})

describe('createTextTool', () => {
  it('opens the editor for an existing text layer without committing', () => {
    const h = makeToolContext(state(textLayer('t1', t(0, 0, 100, 50))))
    const tool = createTextTool(h.toolCtx)
    expect(tool.onPointerDown(pe(), { x: 50, y: 25 })).toBe(true)
    expect(h.setActiveLayer).toHaveBeenCalledWith('t1')
    expect(h.openTextEditor).toHaveBeenCalledWith('t1')
    expect(h.commit).not.toHaveBeenCalled()
  })

  it('creates a new text layer on empty space', () => {
    const h = makeToolContext(state())
    const tool = createTextTool(h.toolCtx)
    expect(tool.onPointerDown(pe(), { x: 120, y: 80 })).toBe(true)
    const [next] = lastCommit(h.commit)
    expect(next.layers).toHaveLength(1)
    const created = next.layers[0] as TextLayer
    expect(created.type).toBe('text')
    expect(created.transform).toMatchObject({ x: 120, y: 80 })
    expect(h.setActiveLayer).toHaveBeenCalledWith(created.id)
    expect(h.openTextEditor).toHaveBeenCalledWith(created.id)
  })

  it('creates a new text layer when clicking a raster layer', () => {
    const h = makeToolContext(state(raster('a', t(0, 0, 100, 100))))
    const tool = createTextTool(h.toolCtx)
    expect(tool.onPointerDown(pe(), { x: 50, y: 50 })).toBe(true)
    const [next] = lastCommit(h.commit)
    expect(next.layers).toHaveLength(2)
    expect(next.layers[1].type).toBe('text')
  })

  it('has inert move/up handlers and a text cursor', () => {
    const h = makeToolContext(state())
    const tool = createTextTool(h.toolCtx)
    const pt: Point = { x: 0, y: 0 }
    tool.onPointerMove(pe(), pt)
    tool.onPointerUp(pe(), pt)
    expect(tool.cursorFor(pt)).toBe('text')
  })
})
