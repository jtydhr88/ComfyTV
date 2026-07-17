import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { toPx } from './curvesMath'
import { useCurvesCanvas } from './useCurvesCanvas'

function stubCtx() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
  } as unknown as CanvasRenderingContext2D
}

function makeCanvas(ctx: CanvasRenderingContext2D, w = 240, h = 160): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.getContext = vi.fn(() => ctx) as never
  c.getBoundingClientRect = () => ({
    left: 0, top: 0, width: w, height: h,
    right: w, bottom: h, x: 0, y: 0,
    toJSON: () => ({}),
  }) as DOMRect
  return c
}

function pointerEvt(clientX: number, clientY: number): PointerEvent {
  return {
    clientX,
    clientY,
    pointerId: 1,
    stopPropagation: vi.fn(),
    target: { setPointerCapture: vi.fn() },
  } as unknown as PointerEvent
}

let wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers = []
})

function setup(initial: [number, number][] = [[0, 0], [0.5, 0.5], [1, 1]]) {
  const ctx = stubCtx()
  const canvasEl = ref<HTMLCanvasElement | null>(makeCanvas(ctx))
  const modelValue = ref<[number, number][]>(initial)
  const color = ref('#e0e0e0')
  const onChange = vi.fn((v: [number, number][]) => { modelValue.value = v })
  let api!: ReturnType<typeof useCurvesCanvas>
  const wrapper = mount(defineComponent({
    setup() {
      api = useCurvesCanvas({ canvasEl, modelValue, color, onChange })
      return () => null
    },
  }))
  wrappers.push(wrapper)
  return { api, ctx, modelValue, onChange }
}

describe('useCurvesCanvas drawing', () => {
  it('draws on mount: clears, plots the spline and one dot per point', () => {
    const { ctx } = setup()
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 240, 160)
    expect(ctx.arc).toHaveBeenCalledTimes(3)
  })

  it('is inert without a 2d context', () => {
    const canvasEl = ref<HTMLCanvasElement | null>(null)
    const modelValue = ref<[number, number][]>([[0, 0], [1, 1]])
    let api!: ReturnType<typeof useCurvesCanvas>
    wrappers.push(mount(defineComponent({
      setup() {
        api = useCurvesCanvas({
          canvasEl, modelValue, color: ref('#fff'), onChange: vi.fn(),
        })
        return () => null
      },
    })))
    expect(() => api.draw()).not.toThrow()
  })
})

describe('useCurvesCanvas pointer interaction', () => {
  it('picks up an existing point without emitting', () => {
    const { api, onChange } = setup()
    const [px, py] = toPx(0.5, 0.5)
    api.onDown(pointerEvt(px, py))
    expect(api.dragIdx.value).toBe(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('adds a new sorted point on empty space and starts dragging it', () => {
    const { api, onChange } = setup()
    const [px, py] = toPx(0.25, 0.75)
    api.onDown(pointerEvt(px, py))
    expect(onChange).toHaveBeenCalledTimes(1)
    const emitted = onChange.mock.calls[0][0]
    expect(emitted).toHaveLength(4)
    expect(emitted[1][0]).toBeCloseTo(0.25)
    expect(emitted[1][1]).toBeCloseTo(0.75)
    expect(api.dragIdx.value).toBe(1)
  })

  it('pins endpoint x while dragging the first point', () => {
    const { api, onChange } = setup()
    const [sx, sy] = toPx(0, 0)
    api.onDown(pointerEvt(sx, sy))
    expect(api.dragIdx.value).toBe(0)
    const [mx, my] = toPx(0.4, 0.3)
    api.onMove(pointerEvt(mx, my))
    const moved = onChange.mock.calls.at(-1)![0]
    expect(moved[0][0]).toBe(0)
    expect(moved[0][1]).toBeCloseTo(0.3)
  })

  it('clamps an interior point between its neighbors', () => {
    const { api, onChange } = setup()
    const [px, py] = toPx(0.5, 0.5)
    api.onDown(pointerEvt(px, py))
    const [mx, my] = toPx(1, 0.5)
    api.onMove(pointerEvt(mx, my))
    const moved = onChange.mock.calls.at(-1)![0]
    expect(moved[1][0]).toBeCloseTo(0.99)
  })

  it('stops dragging on pointer up', () => {
    const { api, onChange } = setup()
    const [px, py] = toPx(0.5, 0.5)
    api.onDown(pointerEvt(px, py))
    api.onUp(pointerEvt(px, py))
    expect(api.dragIdx.value).toBe(-1)
    api.onMove(pointerEvt(px + 30, py))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('right-click removes interior points but never endpoints', () => {
    const { api, onChange } = setup()
    const [ex, ey] = toPx(0, 0)
    api.onRightClick(pointerEvt(ex, ey) as unknown as MouseEvent)
    expect(onChange).not.toHaveBeenCalled()
    const [px, py] = toPx(0.5, 0.5)
    api.onRightClick(pointerEvt(px, py) as unknown as MouseEvent)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]).toEqual([[0, 0], [1, 1]])
  })
})
