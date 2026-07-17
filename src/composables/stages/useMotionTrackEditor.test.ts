import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { FitMetrics } from '@/composables/widgets/useVideoViewport'
import {
  hitTrackPointIndex,
  parseTrackPoints,
  solveHintFor,
  useMotionTrackEditor,
} from './useMotionTrackEditor'

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
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
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

function click(offsetX: number, offsetY: number): MouseEvent {
  return { offsetX, offsetY } as MouseEvent
}

describe('parseTrackPoints', () => {
  it('parses valid point arrays', () => {
    expect(parseTrackPoints('[{"x":1,"y":2},{"x":3,"y":4}]'))
      .toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }])
  })

  it('drops entries with non-finite coordinates', () => {
    expect(parseTrackPoints('[{"x":1,"y":2},{"x":"a","y":4},{"y":6}]'))
      .toEqual([{ x: 1, y: 2 }])
  })

  it('returns [] for empty, invalid JSON, or non-arrays', () => {
    expect(parseTrackPoints('')).toEqual([])
    expect(parseTrackPoints('nope')).toEqual([])
    expect(parseTrackPoints('{"x":1}')).toEqual([])
  })
})

describe('hitTrackPointIndex', () => {
  const fit: FitMetrics = { scale: 0.5, offX: 0, offY: 0 }
  const pts = [{ x: 100, y: 60 }, { x: 400, y: 200 }]

  it('hits within 12 display px', () => {
    expect(hitTrackPointIndex(pts, 55, 30, fit)).toBe(0)
    expect(hitTrackPointIndex(pts, 200, 100, fit)).toBe(1)
  })

  it('misses outside the radius', () => {
    expect(hitTrackPointIndex(pts, 70, 30, fit)).toBe(-1)
    expect(hitTrackPointIndex([], 0, 0, fit)).toBe(-1)
  })
})

describe('solveHintFor', () => {
  it('describes point requirements per solve mode', () => {
    expect(solveHintFor('perspective')).toBe('Needs 4+ points · feeds Corner Pin')
    expect(solveHintFor('similarity')).toBe('Needs 2+ points · feeds Transform/Composite')
    expect(solveHintFor('none')).toBe('')
    expect(solveHintFor('translation')).toBe('')
  })
})

describe('useMotionTrackEditor', () => {
  function setup(widgets: Record<string, unknown> = {}) {
    const node = makeNode({
      points: '', solve: 'none', point_x: 0, point_y: 0,
      pattern: 16, search: 32, ...widgets,
    })
    const ctx = stubCtx()
    const videoEl = ref<HTMLVideoElement | null>(makeVideo())
    const overlayEl = ref<HTMLCanvasElement | null>(makeCanvas(ctx))
    const ed = useMotionTrackEditor({ node, videoEl, overlayEl })
    return { node, ctx, videoEl, overlayEl, ed }
  }

  it('adding a point writes rounded coords plus point_x/point_y', () => {
    const { ed, node } = setup()
    ed.onMeta()
    ed.onVideoClick(click(51, 30))
    expect(ed.points.value).toEqual([{ x: 102, y: 60 }])
    expect(JSON.parse(String(widgetValue(node, 'points')))).toEqual([{ x: 102, y: 60 }])
    expect(widgetValue(node, 'point_x')).toBe(102)
    expect(widgetValue(node, 'point_y')).toBe(60)
  })

  it('clamps clicks in the letterbox to the frame', () => {
    const { ed } = setup()
    ed.onMeta()
    ed.onVideoClick(click(-40, 500))
    expect(ed.points.value).toEqual([{ x: 0, y: 360 }])
  })

  it('ignores clicks on an existing point', () => {
    const { ed } = setup()
    ed.onMeta()
    ed.onVideoClick(click(51, 30))
    ed.onVideoClick(click(53, 32))
    expect(ed.points.value).toHaveLength(1)
  })

  it('ignores clicks before metadata', () => {
    const { ed } = setup()
    ed.onVideoClick(click(51, 30))
    ed.onVideoDblClick(click(51, 30))
    expect(ed.points.value).toEqual([])
  })

  it('double click removes the point under the cursor', () => {
    const { ed, node } = setup({ points: '[{"x":102,"y":60},{"x":400,"y":200}]' })
    ed.onMeta()
    ed.onVideoDblClick(click(300, 170))
    expect(ed.points.value).toHaveLength(2)
    ed.onVideoDblClick(click(51, 30))
    expect(ed.points.value).toEqual([{ x: 400, y: 200 }])
    expect(widgetValue(node, 'point_x')).toBe(400)
  })

  it('clearPoints empties the widget and resets the primary point', () => {
    const { ed, node } = setup({ points: '[{"x":10,"y":20}]', point_x: 10, point_y: 20 })
    ed.onMeta()
    ed.clearPoints()
    expect(widgetValue(node, 'points')).toBe('')
    expect(widgetValue(node, 'point_x')).toBe(0)
    expect(widgetValue(node, 'point_y')).toBe(0)
  })

  it('solveHint tracks the solve widget', () => {
    const { ed } = setup({ solve: 'perspective' })
    expect(ed.solveHint.value).toBe('Needs 4+ points · feeds Corner Pin')
    ed.solve.value = 'similarity'
    expect(ed.solveHint.value).toBe('Needs 2+ points · feeds Transform/Composite')
    ed.solve.value = 'none'
    expect(ed.solveHint.value).toBe('')
  })

  it('redraw paints crosshair, pattern box, and dashed search box for point 1', () => {
    const { ed, ctx } = setup({ points: '[{"x":102,"y":60},{"x":400,"y":200}]' })
    ed.onMeta()
    ctx.strokeRect.mockClear()
    ctx.setLineDash.mockClear()
    ed.redraw()
    expect(ctx.strokeRect).toHaveBeenCalledTimes(3)
    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 3])
    expect(ctx.fillText).toHaveBeenCalledWith('1', expect.any(Number), expect.any(Number))
    expect(ctx.strokeRect.mock.calls[0]).toEqual([43, 22, 16, 16])
  })

  it('redraw clears but draws nothing before metadata', () => {
    const { ed, ctx } = setup({ points: '[{"x":102,"y":60}]' })
    ed.redraw()
    expect(ctx.clearRect).toHaveBeenCalled()
    expect(ctx.strokeRect).not.toHaveBeenCalled()
  })
})
