import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { EQ_H, EQ_W, freqToX, gainToY, type EqBand } from './eqMath'
import { useEqGraph } from './useEqGraph'

function stubCtx() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    font: '',
  } as unknown as CanvasRenderingContext2D
}

function makeCanvas(ctx: CanvasRenderingContext2D): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.getContext = vi.fn(() => ctx) as never
  c.getBoundingClientRect = () => ({
    left: 0, top: 0, width: EQ_W, height: EQ_H,
    right: EQ_W, bottom: EQ_H, x: 0, y: 0,
    toJSON: () => ({}),
  }) as DOMRect
  return c
}

function pointerEvt(clientX: number, clientY: number, extra: Record<string, unknown> = {}): PointerEvent {
  return {
    clientX,
    clientY,
    pointerId: 1,
    stopPropagation: vi.fn(),
    target: { setPointerCapture: vi.fn() },
    ...extra,
  } as unknown as PointerEvent
}

let wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers = []
})

function setup(initial: EqBand[] = [{ type: 'peak', f: 1000, g: 0, q: 1 }]) {
  const ctx = stubCtx()
  const canvasEl = ref<HTMLCanvasElement | null>(makeCanvas(ctx))
  const modelValue = ref<EqBand[]>(initial)
  const onChange = vi.fn((v: EqBand[]) => { modelValue.value = v })
  let api!: ReturnType<typeof useEqGraph>
  const wrapper = mount(defineComponent({
    setup() {
      api = useEqGraph({ canvasEl, modelValue, onChange })
      return () => null
    },
  }))
  wrappers.push(wrapper)
  return { api, ctx, modelValue, onChange }
}

describe('useEqGraph drawing', () => {
  it('draws grid, response curve and one dot per band on mount', () => {
    const { ctx } = setup([
      { type: 'peak', f: 1000, g: 3, q: 1 },
      { type: 'highpass', f: 100, g: 0, q: 1 },
    ])
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, EQ_W, EQ_H)
    expect(ctx.arc).toHaveBeenCalledTimes(2)
    expect(ctx.fillText).toHaveBeenCalledTimes(3)
  })
})

describe('useEqGraph dragging', () => {
  it('grabs a band dot on pointer down', () => {
    const { api } = setup()
    api.onDown(pointerEvt(freqToX(1000), gainToY(0)))
    expect(api.dragIdx.value).toBe(0)
  })

  it('misses when pointer is far from any dot', () => {
    const { api } = setup()
    api.onDown(pointerEvt(freqToX(1000) + 40, gainToY(0)))
    expect(api.dragIdx.value).toBe(-1)
  })

  it('drags a peak band to a new frequency and gain', () => {
    const { api, onChange } = setup()
    api.onDown(pointerEvt(freqToX(1000), gainToY(0)))
    api.onMove(pointerEvt(freqToX(2000), gainToY(6)))
    const bands = onChange.mock.calls.at(-1)![0]
    expect(bands[0].f).toBe(2000)
    expect(bands[0].g).toBeCloseTo(6)
  })

  it('clamps drags to the frequency and gain ranges', () => {
    const { api, onChange } = setup()
    api.onDown(pointerEvt(freqToX(1000), gainToY(0)))
    api.onMove(pointerEvt(-500, 10000))
    const bands = onChange.mock.calls.at(-1)![0]
    expect(bands[0].f).toBe(20)
    expect(bands[0].g).toBe(-24)
  })

  it('never changes gain for highpass/lowpass bands', () => {
    const { api, onChange } = setup([{ type: 'highpass', f: 1000, g: 0, q: 1 }])
    api.onDown(pointerEvt(freqToX(1000), EQ_H / 2))
    expect(api.dragIdx.value).toBe(0)
    api.onMove(pointerEvt(freqToX(500), gainToY(12)))
    const bands = onChange.mock.calls.at(-1)![0]
    expect(bands[0].f).toBe(500)
    expect(bands[0].g).toBe(0)
  })

  it('releases the drag on pointer up', () => {
    const { api, onChange } = setup()
    api.onDown(pointerEvt(freqToX(1000), gainToY(0)))
    api.onUp(pointerEvt(0, 0))
    expect(api.dragIdx.value).toBe(-1)
    api.onMove(pointerEvt(freqToX(2000), gainToY(6)))
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('useEqGraph wheel and double-click', () => {
  it('wheel over a dot scales q down and up within [0.1, 20]', () => {
    const { api, onChange, modelValue } = setup()
    const at = () => pointerEvt(freqToX(modelValue.value[0].f), gainToY(modelValue.value[0].g))
    api.onWheel({ ...at(), deltaY: 100 } as unknown as WheelEvent)
    expect(onChange.mock.calls.at(-1)![0][0].q).toBe(0.85)
    api.onWheel({ ...at(), deltaY: -100 } as unknown as WheelEvent)
    expect(onChange.mock.calls.at(-1)![0][0].q).toBeCloseTo(1)
    modelValue.value = [{ type: 'peak', f: 1000, g: 0, q: 0.1 }]
    api.onWheel({ ...at(), deltaY: 100 } as unknown as WheelEvent)
    expect(onChange.mock.calls.at(-1)![0][0].q).toBe(0.1)
  })

  it('wheel away from any dot does nothing', () => {
    const { api, onChange } = setup()
    api.onWheel({ ...pointerEvt(5, 5), deltaY: 100 } as unknown as WheelEvent)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('double-click on empty space adds a peak band at that spot', () => {
    const { api, onChange } = setup()
    api.onDbl(pointerEvt(freqToX(200), gainToY(-6)) as unknown as MouseEvent)
    const bands = onChange.mock.calls.at(-1)![0]
    expect(bands).toHaveLength(2)
    expect(bands[1]).toEqual({ type: 'peak', f: 200, g: -6, q: 1.0 })
  })

  it('double-click on a dot removes the band', () => {
    const { api, onChange } = setup()
    api.onDbl(pointerEvt(freqToX(1000), gainToY(0)) as unknown as MouseEvent)
    expect(onChange.mock.calls.at(-1)![0]).toEqual([])
  })
})
