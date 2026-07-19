import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { RgbOffsets } from './colorWheelMath'
import { useColorWheel } from './useColorWheel'

function stubCtx(withConic = true) {
  const gradient = { addColorStop: vi.fn() }
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    strokeStyle: '',
    fillStyle: '' as unknown,
    lineWidth: 0,
  } as Record<string, unknown>
  if (withConic) ctx.createConicGradient = vi.fn(() => gradient)
  return { ctx: ctx as unknown as CanvasRenderingContext2D, gradient }
}

function makeCanvas(ctx: CanvasRenderingContext2D, size = 78): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.getContext = vi.fn(() => ctx) as never
  c.getBoundingClientRect = () => ({
    left: 0, top: 0, width: size, height: size,
    right: size, bottom: size, x: 0, y: 0,
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

function setup(initial: RgbOffsets = { r: 0, g: 0, b: 0 }, withConic = true) {
  const { ctx, gradient } = stubCtx(withConic)
  const canvasEl = ref<HTMLCanvasElement | null>(makeCanvas(ctx))
  const modelValue = ref<RgbOffsets>(initial)
  const onChange = vi.fn((v: RgbOffsets) => { modelValue.value = v })
  let api!: ReturnType<typeof useColorWheel>
  const wrapper = mount(defineComponent({
    setup() {
      api = useColorWheel({ canvasEl, modelValue, size: ref(78), onChange })
      return () => null
    },
  }))
  wrappers.push(wrapper)
  return { api, ctx, gradient, modelValue, onChange }
}

describe('useColorWheel drawing', () => {
  it('draws the wheel, fade and puck on mount', () => {
    const { ctx, gradient } = setup()
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 78, 78)
    expect(ctx.createRadialGradient).toHaveBeenCalled()
    expect(gradient.addColorStop).toHaveBeenCalled()
    expect(ctx.arc).toHaveBeenCalledTimes(3)
  })

  it('falls back to a flat fill when createConicGradient is unavailable', () => {
    const { ctx } = setup({ r: 0, g: 0, b: 0 }, false)
    expect(ctx.clearRect).toHaveBeenCalled()
    expect(ctx.arc).toHaveBeenCalledTimes(3)
  })
})

describe('useColorWheel interaction', () => {
  it('pointer down at the center emits neutral offsets', () => {
    const { api, onChange } = setup()
    const e = pointerEvt(39, 39)
    api.onDown(e)
    expect(api.dragging.value).toBe(true)
    expect((e.target as HTMLElement).setPointerCapture).toHaveBeenCalledWith(1)
    expect(e.stopPropagation).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith({ r: 0, g: 0, b: 0 })
  })

  it('pointer down at the top emits a red-shifted offset', () => {
    const { api, onChange } = setup()
    api.onDown(pointerEvt(39, 39 - 33))
    expect(onChange).toHaveBeenCalledWith({ r: 1, g: -0.5, b: -0.5 })
  })

  it('only tracks moves while dragging', () => {
    const { api, onChange } = setup()
    api.onMove(pointerEvt(39, 6))
    expect(onChange).not.toHaveBeenCalled()
    api.onDown(pointerEvt(39, 39))
    api.onMove(pointerEvt(39, 6))
    expect(onChange).toHaveBeenCalledTimes(2)
    api.onUp(pointerEvt(39, 6))
    expect(api.dragging.value).toBe(false)
    api.onMove(pointerEvt(20, 20))
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})

describe('useColorWheel under canvas zoom', () => {
  it('maps pointer positions through a scaled bounding rect', () => {
    const { ctx } = stubCtx()
    const c = makeCanvas(ctx, 156)
    const canvasEl = ref<HTMLCanvasElement | null>(c)
    const modelValue = ref<RgbOffsets>({ r: 0, g: 0, b: 0 })
    const onChange = vi.fn()
    let api!: ReturnType<typeof useColorWheel>
    const wrapper = mount(defineComponent({
      setup() {
        api = useColorWheel({ canvasEl, modelValue, size: ref(78), onChange })
        return () => null
      },
    }))
    wrappers.push(wrapper)
    api.onDown(pointerEvt(78, 78))
    const v = onChange.mock.calls[0][0] as RgbOffsets
    expect(v.r).toBeCloseTo(0)
    expect(v.g).toBeCloseTo(0)
    expect(v.b).toBeCloseTo(0)
  })
})
