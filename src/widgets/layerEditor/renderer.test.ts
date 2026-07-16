import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ContentStore } from './ContentStore'
import { exportComposited, exportLayerAlone, renderMain, renderOverlay, type RenderDeps } from './renderer'
import type { Layer, LayerEditorState, LayerTransform, RasterLayer, TextLayer } from './types'

interface Op {
  op: string
  args: unknown[]
  fillStyle: unknown
  strokeStyle: unknown
  globalAlpha: number
  globalCompositeOperation: string
  lineWidth: number
}

type MockCtx = CanvasRenderingContext2D & {
  ops: Op[]
  createPattern: ReturnType<typeof vi.fn>
}

const CTX_METHODS = [
  'clearRect', 'fillRect', 'strokeRect', 'drawImage', 'translate', 'rotate', 'scale',
  'setLineDash', 'beginPath', 'moveTo', 'lineTo', 'arc', 'fill', 'stroke',
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
  }
  const record = (op: string, args: unknown[]) => {
    ops.push({
      op,
      args,
      fillStyle: ctx.fillStyle,
      strokeStyle: ctx.strokeStyle,
      globalAlpha: ctx.globalAlpha as number,
      globalCompositeOperation: ctx.globalCompositeOperation as string,
      lineWidth: ctx.lineWidth as number,
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

let uidCounter = 0
function uid(): string {
  return `u${++uidCounter}`
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
    text: 'hi',
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
  return { version: 1, width: 300, height: 200, layers }
}

function makeDeps(overrides?: Map<string, HTMLCanvasElement>): RenderDeps & { content: ContentStore } {
  return {
    content: new ContentStore(),
    getTextBitmap: vi.fn(() => null),
    overrides,
  }
}

function newMainCtx(): MockCtx {
  return ctxOf(makeCanvas(300, 200))
}

describe('renderMain', () => {
  it('fills a checker pattern by default and reuses the cached pattern', () => {
    const ctx = newMainCtx()
    const st = state()
    const deps = makeDeps()
    renderMain(ctx, st, deps)
    renderMain(ctx, st, deps)
    // module-level pattern cache: only the very first render creates a pattern
    expect(ctx.createPattern.mock.calls.length).toBeLessThanOrEqual(1)
    const fills = opsOf(ctx, 'fillRect')
    expect(fills).toHaveLength(2)
    expect(fills[0].args).toEqual([0, 0, 300, 200])
    expect((fills[0].fillStyle as { __pattern?: boolean }).__pattern).toBe(true)
    expect(opsOf(ctx, 'clearRect')[0].args).toEqual([0, 0, 300, 200])
  })

  it('fills white when checker is off and background is white', () => {
    const ctx = newMainCtx()
    renderMain(ctx, state(), makeDeps(), { checker: false, background: 'white' })
    const fills = opsOf(ctx, 'fillRect')
    expect(fills).toHaveLength(1)
    expect(fills[0].fillStyle).toBe('#ffffff')
  })

  it('leaves the background transparent when checker is off with no background', () => {
    const ctx = newMainCtx()
    renderMain(ctx, state(), makeDeps(), { checker: false })
    expect(opsOf(ctx, 'fillRect')).toHaveLength(0)
    expect(opsOf(ctx, 'clearRect')).toHaveLength(1)
  })

  it('skips hidden layers', () => {
    const ctx = newMainCtx()
    const deps = makeDeps()
    const id = uid()
    const layer = raster(id, t(0, 0, 100, 100), { visible: false, contentId: `c-${id}` })
    deps.content.register(makeCanvas(50, 50), { id: `c-${id}` })
    renderMain(ctx, state(layer), deps, { checker: false })
    expect(opsOf(ctx, 'drawImage')).toHaveLength(0)
    expect(opsOf(ctx, 'fillRect')).toHaveLength(0)
  })

  it('draws a translucent gray placeholder when content is missing', () => {
    const ctx = newMainCtx()
    const layer = raster(uid(), t(10, 20, 100, 50, 0.3))
    renderMain(ctx, state(layer), makeDeps(), { checker: false })
    const fill = opsOf(ctx, 'fillRect')[0]
    expect(fill.args).toEqual([-50, -25, 100, 50])
    expect(fill.fillStyle).toBe('#808080')
    expect(fill.globalAlpha).toBe(0.25)
    expect(opsOf(ctx, 'translate')[0].args).toEqual([60, 45])
    expect(opsOf(ctx, 'rotate')[0].args).toEqual([0.3])
    expect(opsOf(ctx, 'drawImage')).toHaveLength(0)
  })

  it('draws a raster layer with transform, opacity and blend mode', () => {
    const ctx = newMainCtx()
    const deps = makeDeps()
    const cid = `c-${uid()}`
    const base = makeCanvas(200, 150)
    deps.content.register(base, { id: cid })
    const layer = raster('a', t(10, 20, 100, 50, 0.3), {
      contentId: cid,
      opacity: 0.7,
      blendMode: 'multiply',
    })
    renderMain(ctx, state(layer), deps, { checker: false })
    const draw = opsOf(ctx, 'drawImage')[0]
    expect(draw.args).toEqual([base, -50, -25, 100, 50])
    expect(draw.globalAlpha).toBe(0.7)
    expect(draw.globalCompositeOperation).toBe('multiply')
    expect(opsOf(ctx, 'translate')[0].args).toEqual([60, 45])
    expect(opsOf(ctx, 'rotate')[0].args).toEqual([0.3])
  })

  it('draws text layers via getTextBitmap and a placeholder when it returns null', () => {
    const ctx = newMainCtx()
    const bitmap = makeCanvas(80, 30)
    const deps = makeDeps()
    deps.getTextBitmap = vi.fn(() => bitmap)
    const layer = textLayer('t1', t(0, 0, 80, 30))
    renderMain(ctx, state(layer), deps, { checker: false })
    expect(deps.getTextBitmap).toHaveBeenCalledWith(layer)
    expect(opsOf(ctx, 'drawImage')[0].args[0]).toBe(bitmap)

    const ctx2 = newMainCtx()
    const deps2 = makeDeps()
    renderMain(ctx2, state(layer), deps2, { checker: false })
    expect(opsOf(ctx2, 'drawImage')).toHaveLength(0)
    expect(opsOf(ctx2, 'fillRect')[0].fillStyle).toBe('#808080')
  })

  it('prefers a content override over stored content', () => {
    const cid = `c-${uid()}`
    const deps = makeDeps(new Map())
    deps.content.register(makeCanvas(10, 10), { id: cid })
    const override = makeCanvas(20, 20)
    const layer = raster('a', t(0, 0, 100, 100), { contentId: cid })
    deps.overrides!.set('content:a', override)
    const ctx = newMainCtx()
    renderMain(ctx, state(layer), deps, { checker: false })
    expect(opsOf(ctx, 'drawImage')[0].args[0]).toBe(override)
  })

  it('applies an enabled mask via an offscreen destination-in composite', () => {
    const cid = `c-${uid()}`
    const mid = `m-${uid()}`
    const deps = makeDeps()
    const base = makeCanvas(200, 150)
    const mask = makeCanvas(64, 64)
    deps.content.register(base, { id: cid })
    deps.content.register(mask, { id: mid })
    const layer = raster('a', t(0, 0, 100, 75), {
      contentId: cid,
      mask: { contentId: mid, enabled: true },
    })
    const ctx = newMainCtx()
    renderMain(ctx, state(layer), deps, { checker: false })

    const masked = opsOf(ctx, 'drawImage')[0].args[0] as HTMLCanvasElement
    expect(masked).not.toBe(base)
    expect(masked.width).toBe(200)
    expect(masked.height).toBe(150)
    const mctx = ctxOf(masked)
    const draws = opsOf(mctx, 'drawImage')
    expect(draws[0].args).toEqual([base, 0, 0])
    expect(draws[1].args).toEqual([mask, 0, 0, 200, 150])
    expect(draws[1].globalCompositeOperation).toBe('destination-in')
  })

  it('ignores a disabled mask and a mask whose content is missing', () => {
    const cid = `c-${uid()}`
    const deps = makeDeps()
    const base = makeCanvas(50, 50)
    deps.content.register(base, { id: cid })

    const disabled = raster('a', t(0, 0, 50, 50), {
      contentId: cid,
      mask: { contentId: 'whatever', enabled: false },
    })
    const ctx = newMainCtx()
    renderMain(ctx, state(disabled), deps, { checker: false })
    expect(opsOf(ctx, 'drawImage')[0].args[0]).toBe(base)

    const missing = raster('b', t(0, 0, 50, 50), {
      contentId: cid,
      mask: { contentId: 'not-registered', enabled: true },
    })
    const ctx2 = newMainCtx()
    renderMain(ctx2, state(missing), deps, { checker: false })
    expect(opsOf(ctx2, 'drawImage')[0].args[0]).toBe(base)
  })

  it('reuses the masked bitmap from the cache on repeated renders', () => {
    const cid = `c-${uid()}`
    const mid = `m-${uid()}`
    const deps = makeDeps()
    deps.content.register(makeCanvas(40, 40), { id: cid })
    deps.content.register(makeCanvas(40, 40), { id: mid })
    const layer = raster('a', t(0, 0, 40, 40), {
      contentId: cid,
      mask: { contentId: mid, enabled: true },
    })
    const ctx = newMainCtx()
    const st = state(layer)
    renderMain(ctx, st, deps, { checker: false })
    renderMain(ctx, st, deps, { checker: false })
    const draws = opsOf(ctx, 'drawImage')
    expect(draws).toHaveLength(2)
    expect(draws[0].args[0]).toBe(draws[1].args[0])
    // masked canvas was composed only once
    const mctx = ctxOf(draws[0].args[0] as HTMLCanvasElement)
    expect(opsOf(mctx, 'drawImage')).toHaveLength(2)
  })

  it('does not cache when a mask override is active', () => {
    const cid = `c-${uid()}`
    const mid = `m-${uid()}`
    const deps = makeDeps(new Map())
    deps.content.register(makeCanvas(40, 40), { id: cid })
    deps.content.register(makeCanvas(40, 40), { id: mid })
    const maskOverride = makeCanvas(40, 40)
    deps.overrides!.set('mask:a', maskOverride)
    const layer = raster('a', t(0, 0, 40, 40), {
      contentId: cid,
      mask: { contentId: mid, enabled: true },
    })
    const ctx = newMainCtx()
    const st = state(layer)
    renderMain(ctx, st, deps, { checker: false })
    renderMain(ctx, st, deps, { checker: false })
    const draws = opsOf(ctx, 'drawImage')
    expect(draws[0].args[0]).not.toBe(draws[1].args[0])
    // the override was used as the mask source
    const mctx = ctxOf(draws[0].args[0] as HTMLCanvasElement)
    expect(opsOf(mctx, 'drawImage')[1].args[0]).toBe(maskOverride)
  })

  it('evicts the oldest masked bitmap when the cache overflows', () => {
    const deps = makeDeps()
    const layers: Layer[] = []
    for (let i = 0; i < 17; i++) {
      const cid = `c-${uid()}`
      const mid = `m-${uid()}`
      deps.content.register(makeCanvas(8, 8), { id: cid })
      deps.content.register(makeCanvas(8, 8), { id: mid })
      layers.push(raster(`l${i}`, t(0, 0, 8, 8), {
        contentId: cid,
        mask: { contentId: mid, enabled: true },
      }))
    }
    const ctx = newMainCtx()
    renderMain(ctx, state(...layers), deps, { checker: false })
    const firstMasked = opsOf(ctx, 'drawImage')[0].args[0]

    // layer 0's cache entry was evicted by the 17th insert
    const ctx2 = newMainCtx()
    renderMain(ctx2, state(layers[0]), deps, { checker: false })
    const rebuilt = opsOf(ctx2, 'drawImage')[0].args[0]
    expect(rebuilt).not.toBe(firstMasked)

    // and it is now cached again
    const ctx3 = newMainCtx()
    renderMain(ctx3, state(layers[0]), deps, { checker: false })
    expect(opsOf(ctx3, 'drawImage')[0].args[0]).toBe(rebuilt)
  })
})

describe('renderOverlay', () => {
  it('draws dashed outlines for selected non-active layers and stops without an active layer', () => {
    const ctx = newMainCtx()
    const a = raster('a', t(0, 0, 100, 50, 0.2))
    const b = raster('b', t(10, 10, 20, 20))
    renderOverlay(ctx, state(a, b), { activeId: 'missing', selectedIds: new Set(['a']) }, 2)
    const rects = opsOf(ctx, 'strokeRect')
    expect(rects).toHaveLength(1)
    expect(rects[0].args).toEqual([-50, -25, 100, 50])
    expect(rects[0].lineWidth).toBeCloseTo(0.75)
    expect(rects[0].globalAlpha).toBe(0.5)
    expect(opsOf(ctx, 'setLineDash')[0].args).toEqual([[2, 2]])
    expect(opsOf(ctx, 'fillRect')).toHaveLength(0)
    expect(opsOf(ctx, 'arc')).toHaveLength(0)
  })

  it('draws the active box, eight square handles, a rotate knob and its stem', () => {
    const ctx = newMainCtx()
    const a = raster('a', t(0, 0, 100, 100))
    renderOverlay(ctx, state(a), { activeId: 'a', selectedIds: new Set(['a']) }, 1)
    // active layer is skipped by the "other selected" pass: box + 8 handle outlines
    expect(opsOf(ctx, 'strokeRect')).toHaveLength(9)
    expect(opsOf(ctx, 'fillRect')).toHaveLength(8)
    expect(opsOf(ctx, 'arc')).toHaveLength(1)
    // stem from top-center to the rotate handle
    expect(opsOf(ctx, 'moveTo')[0].args).toEqual([50, 0])
    expect(opsOf(ctx, 'lineTo')[0].args).toEqual([50, -24])
    expect(opsOf(ctx, 'clearRect')[0].args).toEqual([0, 0, 300, 200])
  })

  it('ignores layers that are not selected', () => {
    const ctx = newMainCtx()
    const a = raster('a', t(0, 0, 100, 100))
    renderOverlay(ctx, state(a), { activeId: null, selectedIds: new Set() }, 1)
    expect(opsOf(ctx, 'strokeRect')).toHaveLength(0)
  })
})

describe('exports', () => {
  it('exportComposited defaults to a white background sized to the artboard', () => {
    const deps = makeDeps()
    const cid = `c-${uid()}`
    const base = makeCanvas(30, 30)
    deps.content.register(base, { id: cid })
    const st = state(raster('a', t(0, 0, 30, 30), { contentId: cid }))
    const out = exportComposited(st, deps)
    expect(out.width).toBe(300)
    expect(out.height).toBe(200)
    const octx = ctxOf(out)
    expect(opsOf(octx, 'fillRect')[0].fillStyle).toBe('#ffffff')
    expect(opsOf(octx, 'drawImage')[0].args[0]).toBe(base)
  })

  it('exportComposited supports a transparent background', () => {
    const out = exportComposited(state(), makeDeps(), 'transparent')
    expect(opsOf(ctxOf(out), 'fillRect')).toHaveLength(0)
  })

  it('exportLayerAlone forces source-over regardless of the layer blend mode', () => {
    const deps = makeDeps()
    const cid = `c-${uid()}`
    const base = makeCanvas(30, 30)
    deps.content.register(base, { id: cid })
    const layer = raster('a', t(5, 5, 30, 30), { contentId: cid, blendMode: 'multiply', opacity: 0.5 })
    const out = exportLayerAlone(state(layer), layer, deps)
    expect(out.width).toBe(300)
    const draw = opsOf(ctxOf(out), 'drawImage')[0]
    expect(draw.globalCompositeOperation).toBe('source-over')
    expect(draw.globalAlpha).toBe(0.5)
  })
})
