import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParticleSnapshot } from '@/composables/stages/particleSim'
import type { FxPreviewSource } from '@/widgets/glsl/fxPreviewSource'

const h = vi.hoisted(() => ({
  snap: [] as unknown[],
  instances: [] as { args: unknown[]; advanceTo: (t: number) => void }[],
}))

vi.mock('@/composables/stages/particleSim', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./particleSim')>()
  class FakeSim {
    args: unknown[]
    advanceTo = vi.fn()
    constructor(...args: unknown[]) {
      this.args = args
      h.instances.push(this as never)
    }
    snapshot() {
      return h.snap
    }
  }
  return { ...actual, ParticleSimTs: FakeSim }
})

import { ParticlesPreviewRenderer } from './particlesPreviewRenderer'

interface DrawCall {
  img: unknown
  x: number
  y: number
  alpha: number
  op: string
}

interface CtxEntry {
  ctx: Record<string, unknown>
  draws: DrawCall[]
}

function makeCtx(): CtxEntry {
  const draws: DrawCall[] = []
  const ctx: Record<string, unknown> = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    clearRect: vi.fn(),
    putImageData: vi.fn(),
    createImageData: (w: number, hh: number) => ({
      data: new Uint8ClampedArray(w * hh * 4),
      width: w,
      height: hh,
    }),
  }
  ctx.drawImage = vi.fn((img: unknown, x: number, y: number) => {
    draws.push({
      img,
      x,
      y,
      alpha: ctx.globalAlpha as number,
      op: ctx.globalCompositeOperation as string,
    })
  })
  return { ctx, draws }
}

const ctxMap = new WeakMap<HTMLCanvasElement, CtxEntry>()
let origGetContext: typeof HTMLCanvasElement.prototype.getContext

function pt(over: Partial<ParticleSnapshot> = {}): ParticleSnapshot {
  return {
    x: 50,
    y: 40,
    vx: 12,
    vy: -6,
    frac: 0,
    hx: [48, 46, 44, 42, 40],
    hy: [41, 42, 43, 44, 45],
    size: 5,
    opacity: 0.8,
    color: [1, 0.5, 0.25],
    kind: 0,
    ...over,
  }
}

function makeSrc(w = 64, hh = 48): FxPreviewSource {
  return { width: w, height: hh } as unknown as FxPreviewSource
}

function setup() {
  const target = document.createElement('canvas')
  const r = new ParticlesPreviewRenderer()
  return { r, target, entry: () => ctxMap.get(target)! }
}

beforeEach(() => {
  h.snap = []
  h.instances = []
  origGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    let e = ctxMap.get(this)
    if (!e) {
      e = makeCtx()
      ctxMap.set(this, e)
    }
    return e.ctx as unknown as CanvasRenderingContext2D
  } as unknown as typeof HTMLCanvasElement.prototype.getContext
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = origGetContext
  vi.restoreAllMocks()
})

describe('renderToCanvas basics', () => {
  it('resizes the target, clears and draws the source frame', () => {
    const { r, target, entry } = setup()
    const src = makeSrc()
    h.snap = [pt()]
    const ok = r.renderToCanvas(src, {}, target, 0)
    expect(ok).toBe(true)
    expect(target.width).toBe(64)
    expect(target.height).toBe(48)
    const { ctx, draws } = entry()
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 64, 48)
    expect(draws[0].img).toBe(src)
    expect(draws[0].x).toBe(0)
    expect(draws[0].y).toBe(0)
    expect(draws[0].op).toBe('source-over')
  })

  it('returns false when no 2d context is available', () => {
    const { r } = setup()
    const bad = document.createElement('canvas')
    bad.getContext = vi.fn(() => null) as never
    expect(r.renderToCanvas(makeSrc(), {}, bad, 0)).toBe(false)
  })

  it('skips simulation entirely when rate is zero', () => {
    const { r, target, entry } = setup()
    h.snap = [pt()]
    expect(r.renderToCanvas(makeSrc(), { rate: 0 }, target, 0)).toBe(true)
    expect(h.instances.length).toBe(0)
    expect(entry().draws.length).toBe(1)
  })
})

describe('sprite stamping', () => {
  it('stamps a particle at its rounded center with the nearest pyramid size', () => {
    const { r, target, entry } = setup()
    h.snap = [pt()]
    r.renderToCanvas(makeSrc(), {}, target, 0)
    const { draws } = entry()
    expect(draws.length).toBe(2)
    expect(draws[1].x).toBe(50 - 4.5)
    expect(draws[1].y).toBe(40 - 4.5)
    expect(draws[1].alpha).toBeCloseTo(0.8)
    expect(draws[1].op).toBe('lighter')
  })

  it('uses source-over compositing for the over blend mode', () => {
    const { r, target, entry } = setup()
    h.snap = [pt()]
    r.renderToCanvas(makeSrc(), { blend: 'over' }, target, 0)
    expect(entry().draws[1].op).toBe('source-over')
  })

  it('skips particles smaller than one pixel', () => {
    const { r, target, entry } = setup()
    h.snap = [pt({ size: 0.4 })]
    r.renderToCanvas(makeSrc(), {}, target, 0)
    expect(entry().draws.length).toBe(1)
  })

  it('skips stamps with near-zero opacity and clamps alpha to one', () => {
    const { r, target, entry } = setup()
    h.snap = [pt({ opacity: 0.003 }), pt({ opacity: 3 })]
    r.renderToCanvas(makeSrc(), {}, target, 0)
    const { draws } = entry()
    expect(draws.length).toBe(2)
    expect(draws[1].alpha).toBe(1)
  })

  it('tints the sprite pixels with the quantized particle color', () => {
    const { r, target, entry } = setup()
    h.snap = [pt()]
    r.renderToCanvas(makeSrc(), {}, target, 0)
    const spriteCanvas = entry().draws[1].img as HTMLCanvasElement
    const spriteEntry = ctxMap.get(spriteCanvas)!
    expect(spriteEntry.ctx.putImageData).toHaveBeenCalledTimes(1)
    const img = (spriteEntry.ctx.putImageData as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as { data: Uint8ClampedArray; width: number }
    const size = img.width
    const center = (Math.floor(size / 2) * size + Math.floor(size / 2)) * 4
    expect(img.data[center]).toBe(255)
    expect(img.data[center + 1]).toBe(136)
    expect(img.data[center + 2]).toBe(68)
    expect(img.data[center + 3]).toBeGreaterThan(0)
    expect(img.data[3]).toBe(0)
  })

  it('renders spark and star sprite kinds', () => {
    for (const sprite of ['spark', 'star']) {
      const { r, target, entry } = setup()
      h.snap = [pt()]
      r.renderToCanvas(makeSrc(), { sprite }, target, 0)
      expect(entry().draws.length).toBe(2)
    }
  })
})

describe('stretched and trail renderers', () => {
  it('stamps four samples along the velocity for the stretched renderer', () => {
    const { r, target, entry } = setup()
    h.snap = [pt()]
    r.renderToCanvas(makeSrc(), { renderer: 'stretched', stretch: 1 }, target, 0)
    const { draws } = entry()
    expect(draws.length).toBe(5)
    expect(draws[1].x).toBe(50 - 4.5)
    expect(draws[1].y).toBe(40 - 4.5)
    for (const d of draws.slice(1)) expect(d.alpha).toBeCloseTo(0.32)
    expect(draws[4].x).toBeLessThan(draws[1].x)
    expect(draws[4].y).toBeGreaterThan(draws[1].y)
  })

  it('clamps the stretch factor without throwing', () => {
    const { r, target, entry } = setup()
    h.snap = [pt()]
    r.renderToCanvas(makeSrc(), { renderer: 'stretched', stretch: 99 }, target, 0)
    expect(entry().draws.length).toBe(5)
  })

  it('stamps the head plus a fading history for the trail renderer', () => {
    const { r, target, entry } = setup()
    h.snap = [pt()]
    r.renderToCanvas(makeSrc(), { renderer: 'trail', trail_len: 3 }, target, 0)
    const { draws } = entry()
    expect(draws.length).toBe(5)
    expect(draws[1].alpha).toBeCloseTo(0.8)
    expect(draws[2].x).toBe(48 - 4.5)
    expect(draws[2].y).toBe(41 - 4.5)
    expect(draws[2].alpha).toBeCloseTo(0.8 * 0.75 * 0.45)
    expect(draws[3].alpha).toBeGreaterThan(draws[4].alpha)
  })

  it('clamps trail length between two and the history capacity', () => {
    const { r, target, entry } = setup()
    h.snap = [pt()]
    r.renderToCanvas(makeSrc(), { renderer: 'trail', trail_len: 0 }, target, 0)
    expect(entry().draws.length).toBe(4)
    r.renderToCanvas(makeSrc(), { renderer: 'trail', trail_len: 99 }, target, 0.1)
    expect(entry().draws.length).toBe(4 + 7)
  })
})

describe('simulation lifecycle', () => {
  it('reuses the sim for the same params moving forward in time', () => {
    const { r, target } = setup()
    const src = makeSrc()
    r.renderToCanvas(src, { rate: 100 }, target, 0)
    r.renderToCanvas(src, { rate: 100 }, target, 0.5)
    expect(h.instances.length).toBe(1)
    expect(h.instances[0].args).toEqual([{ rate: 100 }, 64, 48, 24])
    expect(h.instances[0].advanceTo).toHaveBeenLastCalledWith(0.5)
  })

  it('rebuilds the sim when params change or time rewinds', () => {
    const { r, target } = setup()
    const src = makeSrc()
    r.renderToCanvas(src, { rate: 100 }, target, 0.5)
    r.renderToCanvas(src, { rate: 200 }, target, 0.6)
    expect(h.instances.length).toBe(2)
    r.renderToCanvas(src, { rate: 200 }, target, 0.1)
    expect(h.instances.length).toBe(3)
    r.renderToCanvas(src, { rate: 200 }, target, 0.09)
    expect(h.instances.length).toBe(3)
  })

  it('caches tinted sprites across renders and color quantization buckets', () => {
    const { r, target } = setup()
    const src = makeSrc()
    h.snap = [pt()]
    const ce = vi.spyOn(document, 'createElement')
    r.renderToCanvas(src, {}, target, 0)
    r.renderToCanvas(src, {}, target, 0.1)
    h.snap = [pt({ color: [1, 0.501, 0.25] })]
    r.renderToCanvas(src, {}, target, 0.2)
    expect(ce.mock.calls.filter((c) => c[0] === 'canvas').length).toBe(1)
    h.snap = [pt({ color: [0, 1, 0] })]
    r.renderToCanvas(src, {}, target, 0.3)
    expect(ce.mock.calls.filter((c) => c[0] === 'canvas').length).toBe(2)
  })

  it('dispose drops the sim and sprite caches', () => {
    const { r, target } = setup()
    const src = makeSrc()
    h.snap = [pt()]
    const ce = vi.spyOn(document, 'createElement')
    r.renderToCanvas(src, {}, target, 0)
    expect(h.instances.length).toBe(1)
    r.dispose()
    r.renderToCanvas(src, {}, target, 0.1)
    expect(h.instances.length).toBe(2)
    expect(ce.mock.calls.filter((c) => c[0] === 'canvas').length).toBe(2)
  })

  it('never reports a lost context', () => {
    expect(new ParticlesPreviewRenderer().isLost()).toBe(false)
  })
})
