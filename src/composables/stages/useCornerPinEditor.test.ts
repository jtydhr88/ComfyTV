import { describe, it, expect, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import {
  CORNER_LABELS,
  defaultCorners,
  nearestCornerIndex,
  parseCorners,
  serializeCorners,
  useCornerPinEditor,
} from './useCornerPinEditor'

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
    fillText: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    font: '',
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

describe('corner codec helpers', () => {
  it('defaultCorners spans the full frame clockwise from TL', () => {
    expect(defaultCorners(100, 50)).toEqual([[0, 0], [100, 0], [100, 50], [0, 50]])
  })

  it('parseCorners returns a stored 4-point array', () => {
    expect(parseCorners('[[1,2],[3,4],[5,6],[7,8]]', 640, 360))
      .toEqual([[1, 2], [3, 4], [5, 6], [7, 8]])
  })

  it('parseCorners falls back to defaults for bad or wrong-shape JSON', () => {
    expect(parseCorners('', 100, 50)).toEqual(defaultCorners(100, 50))
    expect(parseCorners('not json', 100, 50)).toEqual(defaultCorners(100, 50))
    expect(parseCorners('[[1,2],[3,4]]', 100, 50)).toEqual(defaultCorners(100, 50))
    expect(parseCorners('{"a":1}', 100, 50)).toEqual(defaultCorners(100, 50))
  })

  it('parseCorners returns [] before video dimensions are known', () => {
    expect(parseCorners('', 0, 0)).toEqual([])
    expect(parseCorners('bad', 0, 360)).toEqual([])
  })

  it('serializeCorners rounds to a tenth of a pixel', () => {
    expect(serializeCorners([[1.26, 2.34], [3, 4], [5, 6], [7.05, 8.99]]))
      .toBe('[[1.3,2.3],[3,4],[5,6],[7.1,9]]')
  })
})

describe('nearestCornerIndex', () => {
  const pts = defaultCorners(640, 360)

  it('finds the corner within 24/scale video px', () => {
    expect(nearestCornerIndex(pts, [10, 10], 0.5)).toBe(0)
    expect(nearestCornerIndex(pts, [630, 355], 0.5)).toBe(2)
  })

  it('returns -1 when nothing is close enough', () => {
    expect(nearestCornerIndex(pts, [320, 180], 0.5)).toBe(-1)
    expect(nearestCornerIndex(pts, [30, 30], 1)).toBe(-1)
  })

  it('picks the nearest of several candidates', () => {
    const tight: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]
    expect(nearestCornerIndex(tight, [8, 1], 0.5)).toBe(1)
  })
})

describe('useCornerPinEditor', () => {
  function setup(corners = '') {
    const node = makeNode({ corners })
    const ctx = stubCtx()
    const videoEl = ref<HTMLVideoElement | null>(makeVideo())
    const overlayEl = ref<HTMLCanvasElement | null>(makeCanvas(ctx))
    const ed = useCornerPinEditor({ node, videoEl, overlayEl })
    return { node, ctx, videoEl, overlayEl, ed }
  }

  it('seeds the widget with full-frame corners on first metadata', () => {
    const { ed, node } = setup()
    ed.onMeta()
    expect(JSON.parse(String(widgetValue(node, 'corners'))))
      .toEqual([[0, 0], [640, 0], [640, 360], [0, 360]])
  })

  it('keeps existing widget corners on metadata', () => {
    const raw = '[[1,1],[2,2],[3,3],[4,4]]'
    const { ed, node } = setup(raw)
    ed.onMeta()
    expect(widgetValue(node, 'corners')).toBe(raw)
    expect(ed.corners.value).toEqual([[1, 1], [2, 2], [3, 3], [4, 4]])
  })

  it('picks up external widget callback updates', () => {
    const { ed, node } = setup()
    ed.onMeta()
    const w = node.widgets!.find((x) => x.name === 'corners')!
    w.value = '[[9,9],[10,9],[10,10],[9,10]]'
    w.callback?.(w.value)
    expect(ed.corners.value).toEqual([[9, 9], [10, 9], [10, 10], [9, 10]])
  })

  it('onDown grabs the nearest corner within threshold', () => {
    const { ed } = setup()
    ed.onMeta()
    ed.onDown(ptr(2, 2))
    expect(ed.dragIdx.value).toBe(0)
    ed.onUp(ptr(2, 2))
    ed.onDown(ptr(160, 90))
    expect(ed.dragIdx.value).toBe(-1)
  })

  it('dragging a corner writes clamped video coordinates to the widget', () => {
    const { ed, node } = setup()
    ed.onMeta()
    ed.onDown(ptr(2, 2))
    ed.onMovePtr(ptr(50, 41))
    expect(JSON.parse(String(widgetValue(node, 'corners')))[0]).toEqual([100, 82])
    ed.onMovePtr(ptr(-500, -500))
    expect(JSON.parse(String(widgetValue(node, 'corners')))[0]).toEqual([0, 0])
    ed.onUp(ptr(-500, -500))
    expect(ed.dragIdx.value).toBe(-1)
  })

  it('ignores moves when no corner is grabbed', () => {
    const { ed, node } = setup()
    ed.onMeta()
    const before = widgetValue(node, 'corners')
    ed.onMovePtr(ptr(50, 41))
    expect(widgetValue(node, 'corners')).toBe(before)
  })

  it('resetCorners restores the full frame, and is inert before metadata', () => {
    const { ed, node } = setup()
    ed.resetCorners()
    expect(widgetValue(node, 'corners')).toBe('')
    ed.onMeta()
    ed.onDown(ptr(2, 2))
    ed.onMovePtr(ptr(50, 41))
    ed.onUp(ptr(50, 41))
    ed.resetCorners()
    expect(JSON.parse(String(widgetValue(node, 'corners'))))
      .toEqual([[0, 0], [640, 0], [640, 360], [0, 360]])
  })

  it('draw paints the quad and labeled handles', async () => {
    const { ed, ctx } = setup()
    ed.onMeta()
    await nextTick()
    ctx.arc.mockClear()
    ctx.fillText.mockClear()
    ed.draw()
    expect(ctx.clearRect).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
    expect(ctx.arc).toHaveBeenCalledTimes(4)
    const labels = ctx.fillText.mock.calls.map((c) => c[0])
    expect(labels).toEqual(expect.arrayContaining(CORNER_LABELS))
  })

  it('draw is a no-op without a canvas or corners', () => {
    const { ed, overlayEl, ctx } = setup()
    expect(() => ed.draw()).not.toThrow()
    expect(ctx.stroke).not.toHaveBeenCalled()
    overlayEl.value = null
    expect(() => ed.draw()).not.toThrow()
  })
})
