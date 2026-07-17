import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import {
  PATTERN_PREVIEW_W,
  addEasedStops,
  drawPattern,
  ease,
  hexToRgb,
  mixColors,
  mulberry32,
  usePatternPreview,
  type PatternParams,
} from './usePatternPreview'

function makeCtx() {
  const gradient = { addColorStop: vi.fn() }
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    fillStyle: '' as unknown,
    filter: 'none',
    globalAlpha: 1,
  }
  return { ctx, gradient }
}

function makeCanvas(ctx: unknown) {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
  } as unknown as HTMLCanvasElement
}

function baseParams(over: Partial<PatternParams> = {}): PatternParams {
  return {
    kind: 'ramp',
    width: 1280,
    height: 720,
    color0: '#000000',
    color1: '#ffffff',
    p0x: 0,
    p0y: 0,
    p1x: 1,
    p1y: 1,
    interp: 'linear',
    softness: 0,
    noiseScale: 64,
    noiseOctaves: 4,
    seed: 7,
    ...over,
  }
}

describe('ease', () => {
  it('is identity for linear and unknown interps', () => {
    expect(ease(0.3, 'linear')).toBe(0.3)
    expect(ease(0.3, 'whatever')).toBe(0.3)
  })

  it('applies smoothstep, ease-in and ease-out shapes', () => {
    expect(ease(0.5, 'smooth')).toBeCloseTo(0.5)
    expect(ease(0.25, 'smooth')).toBeCloseTo(0.25 * 0.25 * (3 - 0.5))
    expect(ease(0.5, 'ease_in')).toBeCloseTo(0.25)
    expect(ease(0.5, 'ease_out')).toBeCloseTo(0.75)
  })
})

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('produces values in [0, 1) and differs across seeds', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
})

describe('hexToRgb / mixColors', () => {
  it('parses hex colors', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0])
    expect(hexToRgb('000000')).toEqual([0, 0, 0])
  })

  it('interpolates channels and rounds', () => {
    expect(mixColors([0, 0, 0], [255, 255, 255], 0.5)).toBe('rgb(128,128,128)')
    expect(mixColors([10, 20, 30], [10, 20, 30], 0.7)).toBe('rgb(10,20,30)')
  })
})

describe('addEasedStops', () => {
  it('adds 17 stops shaped by the interpolation', () => {
    const grad = { addColorStop: vi.fn() }
    addEasedStops(grad as unknown as CanvasGradient, '#000000', '#ffffff', 'ease_in')
    expect(grad.addColorStop).toHaveBeenCalledTimes(17)
    expect(grad.addColorStop).toHaveBeenNthCalledWith(1, 0, 'rgb(0,0,0)')
    expect(grad.addColorStop).toHaveBeenLastCalledWith(1, 'rgb(255,255,255)')
    const mid = grad.addColorStop.mock.calls[8]
    expect(mid[0]).toBe(0.5)
    expect(mid[1]).toBe('rgb(64,64,64)')
  })
})

describe('drawPattern', () => {
  it('sizes the canvas from the aspect ratio at 320 wide', () => {
    const { ctx } = makeCtx()
    const canvas = makeCanvas(ctx)
    drawPattern(canvas, baseParams())
    expect(canvas.width).toBe(PATTERN_PREVIEW_W)
    expect(canvas.height).toBe(180)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 320, 180)
  })

  it('clamps the preview height to at least 16', () => {
    const { ctx } = makeCtx()
    const canvas = makeCanvas(ctx)
    drawPattern(canvas, baseParams({ width: 4096, height: 16 }))
    expect(canvas.height).toBe(16)
  })

  it('bails out when no 2d context is available', () => {
    const canvas = makeCanvas(null)
    expect(() => drawPattern(canvas, baseParams())).not.toThrow()
  })

  it('draws a linear ramp between the scaled control points', () => {
    const { ctx, gradient } = makeCtx()
    const canvas = makeCanvas(ctx)
    drawPattern(canvas, baseParams({ kind: 'ramp', p0x: 0.25, p0y: 0.5, p1x: 1, p1y: 1 }))
    expect(ctx.createLinearGradient).toHaveBeenCalledWith(80, 90, 320, 180)
    expect(gradient.addColorStop).toHaveBeenCalledTimes(17)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 320, 180)
  })

  it('draws a radial gradient with the point distance as radius', () => {
    const { ctx } = makeCtx()
    const canvas = makeCanvas(ctx)
    drawPattern(canvas, baseParams({ kind: 'radial', p0x: 0, p0y: 0, p1x: 1, p1y: 0 }))
    expect(ctx.createRadialGradient).toHaveBeenCalledWith(0, 0, 0, 0, 0, 320)
  })

  it('enforces a minimum radial radius of 1', () => {
    const { ctx } = makeCtx()
    const canvas = makeCanvas(ctx)
    drawPattern(canvas, baseParams({ kind: 'radial', p0x: 0.5, p0y: 0.5, p1x: 0.5, p1y: 0.5 }))
    expect(ctx.createRadialGradient).toHaveBeenCalledWith(160, 90, 0, 160, 90, 1)
  })

  it('draws a soft rectangle with a blur filter inside save/restore', () => {
    const { ctx } = makeCtx()
    const canvas = makeCanvas(ctx)
    drawPattern(canvas, baseParams({
      kind: 'rectangle', softness: 0.5,
      p0x: 0.75, p0y: 0.75, p1x: 0.25, p1y: 0.25,
    }))
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.filter).toBe('blur(6px)')
    expect(ctx.fillRect).toHaveBeenCalledWith(80, 45, 160, 90)
    expect(ctx.restore).toHaveBeenCalled()
  })

  it('keeps the filter off for a hard rectangle', () => {
    const { ctx } = makeCtx()
    const canvas = makeCanvas(ctx)
    drawPattern(canvas, baseParams({ kind: 'rectangle', softness: 0 }))
    expect(ctx.filter).toBe('none')
  })

  it('fills noise cells per octave and restores globalAlpha', () => {
    const { ctx } = makeCtx()
    const canvas = makeCanvas(ctx)
    drawPattern(canvas, baseParams({ kind: 'noise', noiseOctaves: 2, noiseScale: 64 }))
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(2)
    expect(ctx.globalAlpha).toBe(1)
  })

  it('routes unknown kinds through the noise fallback', () => {
    const { ctx } = makeCtx()
    const canvas = makeCanvas(ctx)
    drawPattern(canvas, baseParams({ kind: 'checkerboard' }))
    expect(ctx.fillRect).toHaveBeenCalled()
    expect(ctx.createLinearGradient).not.toHaveBeenCalled()
  })
})

describe('usePatternPreview', () => {
  let wrappers: VueWrapper[] = []
  afterEach(() => {
    wrappers.forEach((w) => w.unmount())
    wrappers = []
  })

  function setupComposable() {
    const { ctx } = makeCtx()
    const canvasEl = ref<HTMLCanvasElement | undefined>(makeCanvas(ctx))
    const params = {
      kind: ref('ramp'),
      width: ref(1280),
      height: ref(720),
      color0: ref('#000000'),
      color1: ref('#ffffff'),
      p0x: ref(0),
      p0y: ref(0),
      p1x: ref(1),
      p1y: ref(1),
      interp: ref('linear'),
      softness: ref(0),
      noiseScale: ref(64),
      noiseOctaves: ref(4),
      noiseSpeed: ref(1),
      seed: ref(7),
    }
    let api!: ReturnType<typeof usePatternPreview>
    const wrapper = mount(defineComponent({
      setup() {
        api = usePatternPreview({ canvasEl, params })
        return () => null
      },
    }))
    wrappers.push(wrapper)
    return { api, ctx, canvasEl, params }
  }

  it('draws once on mount', () => {
    const { ctx } = setupComposable()
    expect(ctx.clearRect).toHaveBeenCalledTimes(1)
  })

  it('redraws when any watched param changes', async () => {
    const { ctx, params } = setupComposable()
    params.color1.value = '#ff0000'
    await nextTick()
    expect(ctx.clearRect).toHaveBeenCalledTimes(2)
    params.noiseSpeed.value = 3
    await nextTick()
    expect(ctx.clearRect).toHaveBeenCalledTimes(3)
  })

  it('is inert without a canvas element', async () => {
    const { api, canvasEl, ctx } = setupComposable()
    canvasEl.value = undefined
    ctx.clearRect.mockClear()
    expect(() => api.draw()).not.toThrow()
    expect(ctx.clearRect).not.toHaveBeenCalled()
  })
})
