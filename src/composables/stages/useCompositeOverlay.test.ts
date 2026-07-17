import { describe, it, expect, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import {
  dragToPos,
  useCompositeOverlay,
  wheelScale,
  type OverlayDragStart,
} from './useCompositeOverlay'

describe('dragToPos', () => {
  const start: OverlayDragStart = { px: 100, py: 100, x0: 10, y0: 20 }

  it('converts pointer deltas into video-space offsets with inverted Y', () => {
    expect(dragToPos(start, 120, 80, 0.5)).toEqual([50, 60])
  })

  it('rounds to integer positions', () => {
    expect(dragToPos(start, 101, 99, 3)).toEqual([10, 20])
    expect(dragToPos(start, 102, 98, 3)).toEqual([11, 21])
  })
})

describe('wheelScale', () => {
  it('zooms out on positive deltaY and in on negative', () => {
    expect(wheelScale(1, 100)).toBe(0.95)
    expect(wheelScale(1, -100)).toBe(1.05)
  })

  it('rounds to two decimals', () => {
    expect(wheelScale(0.95, -100)).toBe(1)
  })

  it('clamps into [0.05, 4]', () => {
    expect(wheelScale(0.05, 100)).toBe(0.05)
    expect(wheelScale(4, -100)).toBe(4)
  })
})

function makeVideo(w = 640, h = 360, duration = 12): HTMLVideoElement {
  const v = document.createElement('video')
  Object.defineProperty(v, 'videoWidth', { value: w, configurable: true })
  Object.defineProperty(v, 'videoHeight', { value: h, configurable: true })
  Object.defineProperty(v, 'duration', { value: duration, configurable: true })
  let ct = 3
  Object.defineProperty(v, 'currentTime', {
    get: () => ct,
    set: (x: number) => { ct = x },
    configurable: true,
  })
  return v
}

function makeCtx() {
  return {
    clearRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    restore: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    fillStyle: '',
  }
}

function makeCanvas(ctx: ReturnType<typeof makeCtx>, w = 320, h = 180): HTMLCanvasElement {
  const c = document.createElement('canvas')
  Object.defineProperty(c, 'clientWidth', { value: w, configurable: true })
  Object.defineProperty(c, 'clientHeight', { value: h, configurable: true })
  c.getContext = vi.fn(() => ctx) as never
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

describe('useCompositeOverlay', () => {
  function setup() {
    const ctx = makeCtx()
    const videoEl = ref<HTMLVideoElement | null>(makeVideo())
    const overlayEl = ref<HTMLCanvasElement | null>(makeCanvas(ctx))
    const posX = ref(0)
    const posY = ref(0)
    const scale = ref(1)
    const rotation = ref(0)
    const ov = useCompositeOverlay({ videoEl, overlayEl, posX, posY, scale, rotation })
    return { ctx, videoEl, overlayEl, posX, posY, scale, rotation, ov }
  }

  it('onMeta reads metadata and draws the transformed bounds', async () => {
    const { ov, ctx } = setup()
    ov.onMeta()
    await nextTick()
    expect(ov.vw.value).toBe(640)
    expect(ov.vh.value).toBe(360)
    expect(ov.duration.value).toBe(12)
    expect(ctx.translate).toHaveBeenCalledWith(160, 90)
    expect(ctx.strokeRect).toHaveBeenCalledWith(-160, -90, 320, 180)
    expect(ctx.rotate).toHaveBeenCalledWith(-0)
  })

  it('draw respects pos/scale/rotation refs', async () => {
    const { ov, ctx, posX, posY, scale, rotation } = setup()
    ov.onMeta()
    posX.value = 100
    posY.value = 50
    scale.value = 0.5
    rotation.value = 90
    await nextTick()
    ctx.translate.mockClear()
    ctx.strokeRect.mockClear()
    ov.draw()
    expect(ctx.translate).toHaveBeenCalledWith((320 + 100) * 0.5, (180 - 50) * 0.5)
    expect(ctx.strokeRect).toHaveBeenCalledWith(-80, -45, 160, 90)
    expect(ctx.rotate).toHaveBeenCalledWith((-90 * Math.PI) / 180)
  })

  it('draw clears but skips the rect before metadata arrives', () => {
    const { ov, ctx } = setup()
    ov.draw()
    expect(ctx.clearRect).toHaveBeenCalled()
    expect(ctx.strokeRect).not.toHaveBeenCalled()
  })

  it('draw is inert without an overlay canvas', () => {
    const { ov, overlayEl } = setup()
    overlayEl.value = null
    expect(() => ov.draw()).not.toThrow()
  })

  it('redraws when a transform ref changes', async () => {
    const { ov, ctx, posX } = setup()
    ov.onMeta()
    await nextTick()
    ctx.translate.mockClear()
    posX.value = 25
    await nextTick()
    await nextTick()
    expect(ctx.translate).toHaveBeenCalledWith((320 + 25) * 0.5, 90)
  })

  it('drag maps pointer deltas through the fit scale into pos widgets', async () => {
    const { ov, posX, posY } = setup()
    ov.onMeta()
    await nextTick()
    const down = ptr(100, 100)
    ov.onDown(down)
    expect(ov.dragging.value).toBe(true)
    expect((down.target as HTMLElement).setPointerCapture).toHaveBeenCalledWith(1)
    ov.onMovePtr(ptr(120, 80))
    expect(posX.value).toBe(40)
    expect(posY.value).toBe(40)
    ov.onUp(ptr(120, 80))
    expect(ov.dragging.value).toBe(false)
    ov.onMovePtr(ptr(200, 200))
    expect(posX.value).toBe(40)
  })

  it('ignores pointer moves when no drag is active', () => {
    const { ov, posX } = setup()
    const e = ptr(50, 50)
    ov.onMovePtr(e)
    expect(posX.value).toBe(0)
    expect(e.stopPropagation).not.toHaveBeenCalled()
  })

  it('drag resumes from the widget values captured at pointerdown', async () => {
    const { ov, posX, posY } = setup()
    ov.onMeta()
    await nextTick()
    posX.value = 10
    posY.value = 20
    ov.onDown(ptr(0, 0))
    ov.onMovePtr(ptr(5, -5))
    expect(posX.value).toBe(20)
    expect(posY.value).toBe(30)
  })

  it('wheel zoom writes a clamped scale', () => {
    const { ov, scale } = setup()
    ov.onWheel({ deltaY: 100 } as WheelEvent)
    expect(scale.value).toBe(0.95)
    scale.value = 4
    ov.onWheel({ deltaY: -100 } as WheelEvent)
    expect(scale.value).toBe(4)
  })

  it('onTime tracks the playhead', () => {
    const { ov } = setup()
    ov.onTime()
    expect(ov.currentTime.value).toBe(3)
  })
})
