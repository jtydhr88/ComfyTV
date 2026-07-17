import { describe, it, expect, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import {
  buildShapePoints,
  hitVertexIndex,
  parseShapeVerts,
  serializeShape,
  useRotoMaskEditor,
  type RotoPt,
} from './useRotoMaskEditor'

function makeNode(widgets: Record<string, unknown>): LGraphNode {
  return {
    widgets: Object.entries(widgets).map(([name, value]) => ({ name, value })),
  } as unknown as LGraphNode
}

function widgetValue(node: LGraphNode, name: string): unknown {
  return node.widgets?.find((w) => w.name === name)?.value
}

function stubCtx() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
  }
}

function makeVideo(w = 640, h = 360): HTMLVideoElement {
  const v = document.createElement('video')
  Object.defineProperty(v, 'videoWidth', { value: w, configurable: true })
  Object.defineProperty(v, 'videoHeight', { value: h, configurable: true })
  Object.defineProperty(v, 'duration', { value: 10, configurable: true })
  return v
}

function makeCanvas(ctx: ReturnType<typeof stubCtx>, w = 320, h = 180): HTMLCanvasElement {
  const c = document.createElement('canvas')
  Object.defineProperty(c, 'clientWidth', { value: w, configurable: true })
  Object.defineProperty(c, 'clientHeight', { value: h, configurable: true })
  c.getContext = vi.fn(() => ctx) as never
  c.getBoundingClientRect = () => ({
    left: 0, top: 0, width: w, height: h,
    right: w, bottom: h, x: 0, y: 0,
    toJSON: () => ({}),
  }) as DOMRect
  return c
}

function ptr(clientX: number, clientY: number): PointerEvent {
  return {
    clientX,
    clientY,
    pointerId: 1,
    stopPropagation: vi.fn(),
    target: { setPointerCapture: vi.fn() },
  } as unknown as PointerEvent
}

describe('parseShapeVerts', () => {
  it('reads the first key of a shape_keys payload', () => {
    const raw = JSON.stringify([{ t: 0, points: [{ x: 1, y: 2, lx: 0, ly: 0, rx: 0, ry: 0 }] }])
    expect(parseShapeVerts(raw)).toEqual([{ x: 1, y: 2 }])
  })

  it('returns [] for empty, invalid, or wrong-shape payloads', () => {
    expect(parseShapeVerts('')).toEqual([])
    expect(parseShapeVerts('not json')).toEqual([])
    expect(parseShapeVerts('[{"t":0}]')).toEqual([])
    expect(parseShapeVerts('{"points":[]}')).toEqual([])
  })
})

describe('buildShapePoints / serializeShape', () => {
  const tri: RotoPt[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 6 }]

  it('linear mode collapses handles onto the vertex', () => {
    const pts = buildShapePoints(tri, false)
    expect(pts[0]).toEqual({ x: 0, y: 0, lx: 0, ly: 0, rx: 0, ry: 0 })
    expect(pts[1]).toEqual({ x: 6, y: 0, lx: 6, ly: 0, rx: 6, ry: 0 })
  })

  it('smooth mode derives tangents from wrapped neighbours', () => {
    const pts = buildShapePoints(tri, true)
    expect(pts[0]).toEqual({ x: 0, y: 0, lx: -1, ly: 1, rx: 1, ry: -1 })
  })

  it('serializeShape emits a single t=0 key and round-trips vertices', () => {
    const raw = serializeShape(tri, true)
    const parsed = JSON.parse(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].t).toBe(0)
    expect(parseShapeVerts(raw)).toEqual(tri)
  })

  it('serializeShape returns empty string below 3 vertices', () => {
    expect(serializeShape([], true)).toBe('')
    expect(serializeShape(tri.slice(0, 2), true)).toBe('')
  })
})

describe('hitVertexIndex', () => {
  const verts: RotoPt[] = [{ x: 10, y: 10 }, { x: 100, y: 100 }]

  it('hits within 12/scale video px', () => {
    expect(hitVertexIndex(verts, { x: 20, y: 10 }, 0.5)).toBe(0)
    expect(hitVertexIndex(verts, { x: 105, y: 100 }, 1)).toBe(1)
  })

  it('misses outside the radius', () => {
    expect(hitVertexIndex(verts, { x: 50, y: 50 }, 0.5)).toBe(-1)
    expect(hitVertexIndex(verts, { x: 23, y: 10 }, 1)).toBe(-1)
  })
})

describe('useRotoMaskEditor', () => {
  function setup(shapeKeys = '') {
    const node = makeNode({ shape_keys: shapeKeys, feather: 0, invert: false })
    const ctx = stubCtx()
    const videoEl = ref<HTMLVideoElement | null>(makeVideo())
    const overlayEl = ref<HTMLCanvasElement | null>(makeCanvas(ctx))
    const ed = useRotoMaskEditor({ node, videoEl, overlayEl })
    ed.onMeta()
    return { node, ctx, videoEl, overlayEl, ed }
  }

  it('restores vertices from the widget on setup', () => {
    const raw = serializeShape([{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }], true)
    const { ed } = setup(raw)
    expect(ed.verts.value).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }])
  })

  it('appends vertices on empty-area pointerdown, saving once closed', () => {
    const { ed, node } = setup()
    ed.onDown(ptr(10, 10))
    ed.onUp(ptr(10, 10))
    expect(ed.verts.value).toEqual([{ x: 20, y: 20 }])
    expect(widgetValue(node, 'shape_keys')).toBe('')
    ed.onDown(ptr(100, 10))
    ed.onUp(ptr(100, 10))
    ed.onDown(ptr(10, 80))
    ed.onUp(ptr(10, 80))
    const parsed = JSON.parse(String(widgetValue(node, 'shape_keys')))
    expect(parsed[0].points).toHaveLength(3)
    expect(parsed[0].points[0]).toMatchObject({ x: 20, y: 20 })
  })

  it('drags an existing vertex instead of adding a new one', () => {
    const { ed, node } = setup(serializeShape(
      [{ x: 20, y: 20 }, { x: 200, y: 20 }, { x: 20, y: 160 }], true))
    ed.onDown(ptr(10, 10))
    expect(ed.dragIdx.value).toBe(0)
    expect(ed.verts.value).toHaveLength(3)
    ed.onMovePtr(ptr(30, 30))
    expect(ed.verts.value[0]).toEqual({ x: 60, y: 60 })
    ed.onUp(ptr(30, 30))
    expect(ed.dragIdx.value).toBe(-1)
    const parsed = JSON.parse(String(widgetValue(node, 'shape_keys')))
    expect(parsed[0].points[0]).toMatchObject({ x: 60, y: 60 })
  })

  it('ignores moves when not dragging', () => {
    const { ed } = setup()
    ed.onMovePtr(ptr(30, 30))
    expect(ed.verts.value).toEqual([])
  })

  it('double click removes the vertex under the cursor', () => {
    const { ed, node } = setup(serializeShape(
      [{ x: 20, y: 20 }, { x: 200, y: 20 }, { x: 20, y: 160 }], true))
    ed.onDbl({ clientX: 160, clientY: 90 } as MouseEvent)
    expect(ed.verts.value).toHaveLength(3)
    ed.onDbl({ clientX: 10, clientY: 10 } as MouseEvent)
    expect(ed.verts.value).toHaveLength(2)
    expect(widgetValue(node, 'shape_keys')).toBe('')
  })

  it('clearShape empties vertices and the widget', () => {
    const { ed, node } = setup(serializeShape(
      [{ x: 20, y: 20 }, { x: 200, y: 20 }, { x: 20, y: 160 }], true))
    ed.clearShape()
    expect(ed.verts.value).toEqual([])
    expect(widgetValue(node, 'shape_keys')).toBe('')
  })

  it('toggling smooth reserializes with collapsed handles', async () => {
    const { ed, node } = setup(serializeShape(
      [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 60 }], true))
    ed.smooth.value = false
    await nextTick()
    const parsed = JSON.parse(String(widgetValue(node, 'shape_keys')))
    expect(parsed[0].points[0]).toEqual({ x: 0, y: 0, lx: 0, ly: 0, rx: 0, ry: 0 })
  })

  it('draw fills the polygon with 3+ vertices and marks handles', () => {
    const { ed, ctx } = setup(serializeShape(
      [{ x: 20, y: 20 }, { x: 200, y: 20 }, { x: 20, y: 160 }], true))
    ed.draw()
    expect(ctx.clearRect).toHaveBeenCalled()
    expect(ctx.fill).toHaveBeenCalled()
    expect(ctx.arc).toHaveBeenCalledTimes(3)
  })

  it('draw renders a segment for exactly 2 vertices and nothing for 0', () => {
    const { ed, ctx } = setup()
    ed.draw()
    expect(ctx.arc).not.toHaveBeenCalled()
    ed.onDown(ptr(10, 10))
    ed.onUp(ptr(10, 10))
    ed.onDown(ptr(100, 10))
    ed.onUp(ptr(100, 10))
    ctx.arc.mockClear()
    ctx.fill.mockClear()
    ed.draw()
    expect(ctx.arc).toHaveBeenCalledTimes(2)
    expect(ctx.stroke).toHaveBeenCalled()
  })
})
