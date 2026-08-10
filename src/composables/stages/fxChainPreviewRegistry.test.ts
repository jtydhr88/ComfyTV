import { describe, it, expect, beforeEach, vi } from 'vitest'

const fakes = vi.hoisted(() => {
  class FakeRenderer {
    calls: unknown[][] = []
    lost = false
    err: string | null = null
    renderToCanvas(...args: unknown[]) {
      this.calls.push(args)
      return true
    }
    isLost() {
      return this.lost
    }
    get error() {
      return this.err
    }
    dispose = vi.fn()
  }
  const lutInstances: InstanceType<typeof FakeRenderer>[] = []
  class FakeLutRenderer extends FakeRenderer {
    constructor() {
      super()
      lutInstances.push(this)
    }
  }
  return { FakeRenderer, FakeLutRenderer, lutInstances }
})

const lutMath = vi.hoisted(() => ({
  isPreviewableLutFile: (f: string) => f.endsWith('.cube'),
  parseLutText: vi.fn((_f: string, _t: string): any =>
    ({ size: 2, data: new Float32Array(0), scale: [1, 1, 1] })),
}))

vi.mock('@/widgets/glsl/videoColorRenderer', () => ({ VideoColorRenderer: fakes.FakeRenderer }))
vi.mock('@/widgets/glsl/videoCurvesRenderer', () => ({ VideoCurvesRenderer: fakes.FakeRenderer }))
vi.mock('@/widgets/glsl/videoBlurRenderer', () => ({ VideoBlurRenderer: fakes.FakeRenderer }))
vi.mock('@/widgets/glsl/videoStylizeRenderer', () => ({ VideoStylizeRenderer: fakes.FakeRenderer }))
vi.mock('@/widgets/glsl/videoLutRenderer', () => ({ VideoLutRenderer: fakes.FakeLutRenderer }))
vi.mock('@/widgets/glsl/videoHueCorrectRenderer', () => ({ VideoHueCorrectRenderer: fakes.FakeRenderer }))
vi.mock('@/widgets/glsl/keyingRenderers', () => ({
  VideoColorSuppressRenderer: fakes.FakeRenderer,
  VideoDespillRenderer: fakes.FakeRenderer,
  VideoKeyerRenderer: fakes.FakeRenderer,
  VideoPikRenderer: fakes.FakeRenderer,
}))
vi.mock('@/widgets/glsl/videoTransformRenderer', () => ({ VideoTransformRenderer: fakes.FakeRenderer }))
vi.mock('@/widgets/glsl/videoSelectiveColorRenderer', () => ({ VideoSelectiveColorRenderer: fakes.FakeRenderer }))
vi.mock('@/composables/stages/particlesPreviewRenderer', () => ({ ParticlesPreviewRenderer: fakes.FakeRenderer }))
vi.mock('@/widgets/glsl/videoChromaShiftRenderer', () => ({ VideoChromaShiftRenderer: fakes.FakeRenderer }))
vi.mock('@/widgets/glsl/videoPseudocolorRenderer', () => ({ VideoPseudocolorRenderer: fakes.FakeRenderer }))
vi.mock('@/widgets/glsl/videoDistortRenderers', () => ({
  VideoKaleidoRenderer: fakes.FakeRenderer,
  VideoWaveWarpRenderer: fakes.FakeRenderer,
}))
vi.mock('@/composables/stages/videoLutMath', () => lutMath)

import {
  CHAIN_PREVIEW_STAGES,
  ChainLutRenderer,
  ChainBlitRenderer,
} from './fxChainPreviewRegistry'
import { SELECTIVE_ZONE_IDS } from '@/composables/stages/videoSelectiveColorMath'
import type { FxPreviewSource } from '@/widgets/glsl/fxPreviewSource'

function nodeWith(widgets: Record<string, unknown>) {
  return {
    widgets: Object.entries(widgets).map(([name, value]) => ({ name, value })),
  }
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  fakes.lutInstances.length = 0
  lutMath.parseLutText.mockClear()
  vi.unstubAllGlobals()
})

describe('CHAIN_PREVIEW_STAGES', () => {
  it('every stage def creates a renderer and derives params from a bare node', () => {
    for (const [cls, def] of Object.entries(CHAIN_PREVIEW_STAGES)) {
      const renderer = def.create()
      expect(typeof renderer.renderToCanvas, cls).toBe('function')
      const params = def.paramsOf({})
      expect(params, cls).toBeTypeOf('object')
      renderer.dispose()
    }
  })

  it('derives params from nodes without widgets', () => {
    for (const def of Object.values(CHAIN_PREVIEW_STAGES)) {
      expect(def.paramsOf(undefined)).toBeTypeOf('object')
    }
  })

  it('VideoColorStage uses defaults and reads widget overrides', () => {
    const def = CHAIN_PREVIEW_STAGES['ComfyTV.VideoColorStage']
    expect(def.paramsOf({})).toMatchObject({
      exposure: 0,
      temperature: 6500,
      whitepoint: 1,
      shadows: [0, 0, 0],
      midtones: [0, 0, 0],
      highlights: [0, 0, 0],
      preserveLightness: true,
    })
    const p = def.paramsOf(nodeWith({
      exposure: '2',
      temperature: 4000,
      preserve_lightness: 0,
      shadows_r: 0.25,
    }))
    expect(p.exposure).toBe(2)
    expect(p.temperature).toBe(4000)
    expect(p.preserveLightness).toBe(false)
    expect(p.shadows).toEqual([0.25, 0, 0])
  })

  it('num falls back to default for non-finite widget values', () => {
    const def = CHAIN_PREVIEW_STAGES['ComfyTV.VideoBlurSharpenStage']
    const p = def.paramsOf(nodeWith({ amount: 'abc', size: 9 }))
    expect(p.amount).toBe(2)
    expect(p.size).toBe(9)
  })

  it('str falls back to default for non-string widget values', () => {
    const def = CHAIN_PREVIEW_STAGES['ComfyTV.VideoStylizeStage']
    const p = def.paramsOf(nodeWith({ effect: 42, strength: 0.9 }))
    expect(p.effect).toBe('vignette')
    expect(p.strength).toBe(0.9)
  })

  it('VideoCurvesStage reads curve point strings', () => {
    const def = CHAIN_PREVIEW_STAGES['ComfyTV.VideoCurvesStage']
    const p = def.paramsOf(nodeWith({ preset: 'film', master_pts: '0,0;1,1' }))
    expect(p).toMatchObject({ preset: 'film', master: '0,0;1,1', red: '' })
  })

  it('VideoLUTStage builds an encoded view url', () => {
    const def = CHAIN_PREVIEW_STAGES['ComfyTV.VideoLUTStage']
    const p = def.paramsOf(nodeWith({ lut_file: 'My Lut.cube' }))
    expect(p.lutFile).toBe('My Lut.cube')
    expect(p.lutUrl).toBe('/comfytv/luts/My%20Lut.cube')
    expect(p.interp).toBe('tetrahedral')
  })

  it('VideoLUTStage yields an empty url without a file', () => {
    const def = CHAIN_PREVIEW_STAGES['ComfyTV.VideoLUTStage']
    const p = def.paramsOf({})
    expect(p.lutFile).toBe('')
    expect(p.lutUrl).toBe('')
  })

  it('SelectiveColorStage exposes a value per zone', () => {
    const def = CHAIN_PREVIEW_STAGES['ComfyTV.SelectiveColorStage']
    const p = def.paramsOf(nodeWith({ [`sc_${SELECTIVE_ZONE_IDS[0]}`]: 0.5 })) as {
      scMethod: string
      zones: Record<string, number>
    }
    expect(p.scMethod).toBe('absolute')
    expect(Object.keys(p.zones)).toEqual([...SELECTIVE_ZONE_IDS])
    expect(p.zones[SELECTIVE_ZONE_IDS[0]]).toBe(0.5)
  })

  it('KeyerStage maps its widget names', () => {
    const def = CHAIN_PREVIEW_STAGES['ComfyTV.KeyerStage']
    const p = def.paramsOf(nodeWith({ mode: 'chroma', key_color: '#00ff00' }))
    expect(p).toMatchObject({
      mode: 'chroma',
      keyColor: '#00ff00',
      softnessLower: -0.5,
      despillAngle: 120,
      output: 'matte',
    })
  })

  it('ParticlesStage exposes the full emitter parameter set', () => {
    const def = CHAIN_PREVIEW_STAGES['ComfyTV.ParticlesStage']
    const p = def.paramsOf(nodeWith({ rate: 10, sprite: 'spark' }))
    expect(p).toMatchObject({
      emitter: 'point',
      rate: 10,
      sprite: 'spark',
      blend: 'additive',
      seed: 7,
    })
  })

  it('PIKStage maps bias and clip widgets', () => {
    const def = CHAIN_PREVIEW_STAGES['ComfyTV.PIKStage']
    const p = def.paramsOf(nodeWith({ use_alpha_bias: false, clip_white: 0.8 }))
    expect(p.useAlphaBias).toBe(false)
    expect(p.screenSubtraction).toBe(true)
    expect(p.clipWhite).toBe(0.8)
    expect(p.pickColor).toBe('#00FF00')
  })
})

describe('ChainLutRenderer', () => {
  it('renders with a null lut when no url is given', () => {
    const r = new ChainLutRenderer()
    const target = {} as HTMLCanvasElement
    const ok = r.renderToCanvas({} as FxPreviewSource, {}, target)
    expect(ok).toBe(true)
    const inner = fakes.lutInstances[0]
    expect(inner.calls[0][1]).toMatchObject({ lut: null, interp: 'tetrahedral' })
  })

  it('skips fetching for non-previewable lut files', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const r = new ChainLutRenderer()
    r.renderToCanvas({} as FxPreviewSource,
      { lutFile: 'a.xyz', lutUrl: '/u/a.xyz' }, {} as HTMLCanvasElement)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches once, caches the parsed lut and passes it on later renders', async () => {
    const fetchMock = vi.fn(async () =>
      ({ ok: true, text: async () => 'LUTDATA' }))
    vi.stubGlobal('fetch', fetchMock)
    const r = new ChainLutRenderer()
    const params = { lutFile: 'grade.cube', lutUrl: '/luts/one.cube' }
    r.renderToCanvas({} as FxPreviewSource, params, {} as HTMLCanvasElement)
    r.renderToCanvas({} as FxPreviewSource, params, {} as HTMLCanvasElement)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const inner = fakes.lutInstances[0]
    expect((inner.calls[0][1] as { lut: unknown }).lut).toBeNull()
    await flush()
    expect(lutMath.parseLutText).toHaveBeenCalledWith('grade.cube', 'LUTDATA')
    r.renderToCanvas({} as FxPreviewSource, params, {} as HTMLCanvasElement)
    expect((inner.calls[2][1] as { lut: unknown }).lut)
      .toMatchObject({ size: 2 })
  })

  it('caches null on fetch failure and does not refetch', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    const r = new ChainLutRenderer()
    const params = { lutFile: 'bad.cube', lutUrl: '/luts/two.cube' }
    r.renderToCanvas({} as FxPreviewSource, params, {} as HTMLCanvasElement)
    await flush()
    r.renderToCanvas({} as FxPreviewSource, params, {} as HTMLCanvasElement)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const inner = fakes.lutInstances[0]
    expect((inner.calls[1][1] as { lut: unknown }).lut).toBeNull()
  })

  it('delegates isLost, error and dispose to the inner renderer', () => {
    const r = new ChainLutRenderer()
    const inner = fakes.lutInstances[0]
    expect(r.isLost()).toBe(false)
    inner.lost = true
    expect(r.isLost()).toBe(true)
    expect(r.error).toBeNull()
    inner.err = 'boom'
    expect(r.error).toBe('boom')
    r.dispose()
    expect(inner.dispose).toHaveBeenCalled()
  })
})

describe('ChainBlitRenderer', () => {
  function fakeTarget(ctx: unknown) {
    return {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
    }
  }

  it('resizes the target to the source size and draws', () => {
    const ctx = { clearRect: vi.fn(), drawImage: vi.fn() }
    const target = fakeTarget(ctx)
    const src = { width: 640, height: 360 }
    const r = new ChainBlitRenderer()
    const ok = r.renderToCanvas(
      src as unknown as FxPreviewSource, {},
      target as unknown as HTMLCanvasElement)
    expect(ok).toBe(true)
    expect(target.width).toBe(640)
    expect(target.height).toBe(360)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 360)
    expect(ctx.drawImage).toHaveBeenCalledWith(src, 0, 0, 640, 360)
  })

  it('uses video dimensions when the source is a video element', () => {
    const ctx = { clearRect: vi.fn(), drawImage: vi.fn() }
    const target = fakeTarget(ctx)
    const src = { videoWidth: 100, videoHeight: 50 }
    const r = new ChainBlitRenderer()
    r.renderToCanvas(
      src as unknown as FxPreviewSource, {},
      target as unknown as HTMLCanvasElement)
    expect(target.width).toBe(100)
    expect(target.height).toBe(50)
  })

  it('returns false when a 2d context is unavailable', () => {
    const target = fakeTarget(null)
    const r = new ChainBlitRenderer()
    const ok = r.renderToCanvas(
      { width: 4, height: 4 } as unknown as FxPreviewSource, {},
      target as unknown as HTMLCanvasElement)
    expect(ok).toBe(false)
  })

  it('dispose is a no-op', () => {
    expect(() => new ChainBlitRenderer().dispose()).not.toThrow()
  })
})
