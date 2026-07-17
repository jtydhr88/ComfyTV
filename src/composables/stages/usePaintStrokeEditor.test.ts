import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import {
  makeStroke,
  normalizePressure,
  parseStrokes,
  serializeStrokes,
  shouldAppendPoint,
  usePaintStrokeEditor,
  type Stroke,
  type StrokeBrush,
} from './usePaintStrokeEditor'

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
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    globalAlpha: 1,
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

function ptr(clientX: number, clientY: number, pressure = 0): PointerEvent {
  return {
    clientX,
    clientY,
    pressure,
    pointerId: 1,
    stopPropagation: vi.fn(),
    target: { setPointerCapture: vi.fn() },
  } as unknown as PointerEvent
}

const brush = (over: Partial<StrokeBrush> = {}): StrokeBrush => ({
  mode: 'clone', radius: 20, hardness: 0.5, dx: 5, dy: -5, sigma: 8, color: '#FF4444',
  ...over,
})

describe('stroke codec helpers', () => {
  it('parseStrokes parses arrays and rejects everything else', () => {
    expect(parseStrokes('[{"mode":"blur","points":[],"radius":1,"hardness":0}]'))
      .toEqual([{ mode: 'blur', points: [], radius: 1, hardness: 0 }])
    expect(parseStrokes('')).toEqual([])
    expect(parseStrokes('nope')).toEqual([])
    expect(parseStrokes('{"mode":"blur"}')).toEqual([])
  })

  it('serializeStrokes emits empty string for an empty list', () => {
    expect(serializeStrokes([])).toBe('')
    const st: Stroke = { mode: 'color', points: [], radius: 1, hardness: 0 }
    expect(JSON.parse(serializeStrokes([st]))).toEqual([st])
  })
})

describe('normalizePressure', () => {
  it('rounds real pressure to 2 decimals and defaults 0 to 1', () => {
    expect(normalizePressure(0.456)).toBe(0.46)
    expect(normalizePressure(1)).toBe(1)
    expect(normalizePressure(0)).toBe(1)
  })
})

describe('shouldAppendPoint', () => {
  it('requires at least 3 video px of travel', () => {
    expect(shouldAppendPoint({ x: 0, y: 0, p: 1 }, { x: 2, y: 2, p: 1 })).toBe(false)
    expect(shouldAppendPoint({ x: 0, y: 0, p: 1 }, { x: 3, y: 0, p: 1 })).toBe(true)
  })
})

describe('makeStroke', () => {
  const pt = { x: 1, y: 2, p: 1 }

  it('attaches clone offsets only in clone mode', () => {
    expect(makeStroke(pt, brush())).toEqual({
      mode: 'clone', points: [pt], radius: 20, hardness: 0.5, dx: 5, dy: -5,
    })
  })

  it('attaches sigma only in blur mode', () => {
    const st = makeStroke(pt, brush({ mode: 'blur' }))
    expect(st.sigma).toBe(8)
    expect(st.dx).toBeUndefined()
    expect(st.color).toBeUndefined()
  })

  it('attaches color only in color mode', () => {
    const st = makeStroke(pt, brush({ mode: 'color', color: '#00FF00' }))
    expect(st.color).toBe('#00FF00')
    expect(st.sigma).toBeUndefined()
  })
})

describe('usePaintStrokeEditor', () => {
  function setup(strokesRaw = '') {
    const node = makeNode({ strokes: strokesRaw, t_start: 0, t_end: -1 })
    const ctx = stubCtx()
    const videoEl = ref<HTMLVideoElement | null>(makeVideo())
    const overlayEl = ref<HTMLCanvasElement | null>(makeCanvas(ctx))
    const ed = usePaintStrokeEditor({ node, videoEl, overlayEl })
    ed.onMeta()
    return { node, ctx, videoEl, overlayEl, ed }
  }

  it('commits a stroke with rounded coords and pressure on pointer up', () => {
    const { ed, node } = setup()
    ed.onDown(ptr(10, 10, 0.5))
    expect(ed.drawing.value).toBe(true)
    ed.onMovePtr(ptr(14, 10))
    ed.onUp(ptr(14, 10))
    expect(ed.drawing.value).toBe(false)
    const parsed = JSON.parse(String(widgetValue(node, 'strokes')))
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({ mode: 'clone', radius: 20, hardness: 0.5, dx: 0, dy: 0 })
    expect(parsed[0].points).toEqual([
      { x: 20, y: 20, p: 0.5 },
      { x: 28, y: 20, p: 1 },
    ])
  })

  it('skips move samples closer than the minimum distance', () => {
    const { ed } = setup()
    ed.onDown(ptr(10, 10))
    ed.onMovePtr(ptr(11, 10))
    ed.onUp(ptr(11, 10))
    expect(ed.strokes.value[0].points).toHaveLength(1)
  })

  it('ignores moves and ups when no stroke is active', () => {
    const { ed, node } = setup()
    ed.onMovePtr(ptr(50, 50))
    ed.onUp(ptr(50, 50))
    expect(widgetValue(node, 'strokes')).toBe('')
    expect(ed.strokes.value).toEqual([])
  })

  it('snapshots the active brush per mode', () => {
    const { ed } = setup()
    ed.mode.value = 'blur'
    ed.sigma.value = 12
    ed.onDown(ptr(10, 10))
    ed.onUp(ptr(10, 10))
    ed.mode.value = 'color'
    ed.color.value = '#00FF00'
    ed.onDown(ptr(100, 50))
    ed.onUp(ptr(100, 50))
    const [blur, color] = ed.strokes.value
    expect(blur).toMatchObject({ mode: 'blur', sigma: 12 })
    expect(blur.dx).toBeUndefined()
    expect(color).toMatchObject({ mode: 'color', color: '#00FF00' })
    expect(color.sigma).toBeUndefined()
  })

  it('undoStroke drops the last stroke and clearStrokes empties the widget', () => {
    const { ed, node } = setup()
    ed.onDown(ptr(10, 10))
    ed.onUp(ptr(10, 10))
    ed.onDown(ptr(100, 50))
    ed.onUp(ptr(100, 50))
    expect(ed.strokes.value).toHaveLength(2)
    ed.undoStroke()
    expect(ed.strokes.value).toHaveLength(1)
    ed.clearStrokes()
    expect(ed.strokes.value).toEqual([])
    expect(widgetValue(node, 'strokes')).toBe('')
  })

  it('restores strokes from the widget', () => {
    const raw = JSON.stringify([
      { mode: 'color', color: '#123456', points: [{ x: 1, y: 2, p: 1 }], radius: 5, hardness: 0.5 },
    ])
    const { ed } = setup(raw)
    expect(ed.strokes.value).toHaveLength(1)
    expect(ed.strokes.value[0].color).toBe('#123456')
  })

  it('draw dots single-point strokes and strokes polylines', () => {
    const { ed, ctx } = setup()
    ed.onDown(ptr(10, 10))
    ed.onUp(ptr(10, 10))
    ctx.arc.mockClear()
    ctx.fill.mockClear()
    ctx.stroke.mockClear()
    ed.draw()
    expect(ctx.arc).toHaveBeenCalledTimes(1)
    expect(ctx.fill).toHaveBeenCalledTimes(1)
    expect(ctx.stroke).not.toHaveBeenCalled()
    ed.onDown(ptr(50, 50))
    ed.onMovePtr(ptr(100, 100))
    ed.onUp(ptr(100, 100))
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('draw shows the in-progress stroke before pointer up', () => {
    const { ed, ctx } = setup()
    ed.onDown(ptr(10, 10))
    expect(ed.strokes.value).toEqual([])
    expect(ctx.arc).toHaveBeenCalled()
  })

  it('draw uses the picked color for color strokes', () => {
    const raw = JSON.stringify([
      { mode: 'color', color: '#ABCDEF', points: [{ x: 1, y: 2, p: 1 }, { x: 50, y: 60, p: 1 }], radius: 5, hardness: 0.5 },
    ])
    const { ed, ctx } = setup(raw)
    ed.draw()
    expect(ctx.strokeStyle).toBe('#ABCDEF')
  })
})
