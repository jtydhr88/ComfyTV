import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import {
  CHROMA_PREVIEW_H,
  CHROMA_PREVIEW_W,
  applyChromaKey,
  frameFit,
  hexToRgb,
  rgbToHex,
  rgbToUv,
  useChromaKeyPicker,
} from './useChromaKeyPicker'

describe('color helpers', () => {
  it('hexToRgb parses channel pairs and tolerates garbage', () => {
    expect(hexToRgb('#00FF00')).toEqual([0, 255, 0])
    expect(hexToRgb('0080ff')).toEqual([0, 128, 255])
    expect(hexToRgb('#zzzzzz')).toEqual([0, 0, 0])
  })

  it('rgbToUv maps neutral gray to the UV origin', () => {
    const [u, v] = rgbToUv(128, 128, 128)
    expect(u).toBeCloseTo(128, 3)
    expect(v).toBeCloseTo(128, 3)
  })

  it('rgbToHex emits padded uppercase hex', () => {
    expect(rgbToHex(0, 255, 0)).toBe('#00FF00')
    expect(rgbToHex(12, 200, 34)).toBe('#0CC822')
  })
})

describe('applyChromaKey', () => {
  function pixels(...rgba: number[]): Uint8ClampedArray {
    return new Uint8ClampedArray(rgba)
  }

  it('zeroes alpha for pixels matching the key color', () => {
    const d = pixels(0, 255, 0, 255)
    applyChromaKey(d, '#00FF00', 0.1, 0)
    expect(d[3]).toBe(0)
  })

  it('keeps alpha for colors far from the key', () => {
    const d = pixels(255, 0, 0, 255)
    applyChromaKey(d, '#00FF00', 0.1, 0.05)
    expect(d[3]).toBe(255)
  })

  it('ramps alpha inside the blend band', () => {
    const d = pixels(255, 255, 255, 255)
    const [ku, kv] = rgbToUv(0, 255, 0)
    const [u, v] = rgbToUv(255, 255, 255)
    const dist = Math.hypot(u - ku, v - kv)
    const similarity = 0.3
    const blend = 0.2
    const sim = similarity * 255 * Math.SQRT2
    const bl = blend * 255 * Math.SQRT2
    expect(dist).toBeGreaterThan(sim)
    expect(dist).toBeLessThan(sim + bl)
    applyChromaKey(d, '#00FF00', similarity, blend)
    expect(d[3]).toBe(Math.round(((dist - sim) / bl) * 255))
  })

  it('never raises an existing alpha value', () => {
    const d = pixels(255, 0, 0, 40)
    applyChromaKey(d, '#00FF00', 0.1, 0)
    expect(d[3]).toBe(40)
  })

  it('processes every pixel independently', () => {
    const d = pixels(
      0, 255, 0, 255,
      255, 0, 0, 255,
    )
    applyChromaKey(d, '#00FF00', 0.2, 0)
    expect(d[3]).toBe(0)
    expect(d[7]).toBe(255)
  })
})

function makeVideo(ready = 2, w = 1920, h = 1080): HTMLVideoElement {
  const v = document.createElement('video')
  Object.defineProperty(v, 'readyState', { value: ready, configurable: true })
  Object.defineProperty(v, 'videoWidth', { value: w, configurable: true })
  Object.defineProperty(v, 'videoHeight', { value: h, configurable: true })
  let paused = true
  Object.defineProperty(v, 'paused', { get: () => paused, configurable: true })
  v.play = vi.fn(() => { paused = false; return Promise.resolve() })
  v.pause = vi.fn(() => { paused = true })
  return v
}

describe('frameFit', () => {
  it('fills the preview box for a 16:9 video', () => {
    expect(frameFit(makeVideo(2, 1920, 1080))).toEqual({ dx: 0, dy: 0, dw: 320, dh: 180 })
  })

  it('pillarboxes portrait video', () => {
    const f = frameFit(makeVideo(2, 1080, 1920))
    expect(f.dh).toBe(CHROMA_PREVIEW_H)
    expect(f.dw).toBeCloseTo(101.25)
    expect(f.dx).toBeCloseTo((CHROMA_PREVIEW_W - 101.25) / 2)
    expect(f.dy).toBe(0)
  })

  it('falls back to 16:9 when dimensions are unavailable', () => {
    expect(frameFit(makeVideo(2, 0, 0))).toEqual({ dx: 0, dy: 0, dw: 320, dh: 180 })
  })
})

interface FakeCtx {
  clearRect: ReturnType<typeof vi.fn>
  drawImage: ReturnType<typeof vi.fn>
  getImageData: ReturnType<typeof vi.fn>
  putImageData: ReturnType<typeof vi.fn>
}

function makeCtx(pixel: number[] = [0, 255, 0, 255]): FakeCtx {
  return {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(pixel) })),
    putImageData: vi.fn(),
  }
}

function makeCanvas(ctx: FakeCtx | null, cssW = 320, cssH = 180): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    getBoundingClientRect: () => ({
      left: 0, top: 0, width: cssW, height: cssH,
      right: cssW, bottom: cssH, x: 0, y: 0,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLCanvasElement
}

describe('useChromaKeyPicker', () => {
  let wrappers: VueWrapper[] = []
  afterEach(() => {
    wrappers.forEach((w) => w.unmount())
    wrappers = []
    vi.restoreAllMocks()
  })

  function setup(opts: {
    video?: HTMLVideoElement | null
    ctx?: FakeCtx | null
  } = {}) {
    const videoEl = ref<HTMLVideoElement | null>('video' in opts ? opts.video ?? null : makeVideo())
    const ctx = 'ctx' in opts ? opts.ctx ?? null : makeCtx()
    const canvasEl = ref<HTMLCanvasElement | null>(makeCanvas(ctx))
    const keyColor = ref('#00FF00')
    const similarity = ref(0.1)
    const blend = ref(0.05)
    let api!: ReturnType<typeof useChromaKeyPicker>
    const wrapper = mount(defineComponent({
      setup() {
        api = useChromaKeyPicker({ videoEl, canvasEl, keyColor, similarity, blend })
        return () => null
      },
    }))
    wrappers.push(wrapper)
    return { api, wrapper, videoEl, canvasEl, keyColor, ctx }
  }

  function captureRaf() {
    let cb: FrameRequestCallback | null = null
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn: FrameRequestCallback) => {
      cb = fn
      return 1
    })
    const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    return { raf, caf, tick: () => { const fn = cb; cb = null; fn?.(0) } }
  }

  it('togglePlay plays a paused video and reports playing', () => {
    const { api, videoEl } = setup()
    api.togglePlay()
    expect(videoEl.value!.play).toHaveBeenCalled()
    expect(api.playing.value).toBe(true)
    api.togglePlay()
    expect(videoEl.value!.pause).toHaveBeenCalled()
    expect(api.playing.value).toBe(false)
  })

  it('togglePlay is a no-op without a video', () => {
    const { api } = setup({ video: null })
    expect(() => api.togglePlay()).not.toThrow()
    expect(api.playing.value).toBe(false)
  })

  it('clicking without pick mode toggles playback', () => {
    const { api, videoEl } = setup()
    api.onCanvasClick(new MouseEvent('click'))
    expect(videoEl.value!.play).toHaveBeenCalled()
  })

  it('clicking in pick mode samples the frame color under the cursor', () => {
    const { api, keyColor, videoEl } = setup()
    const tctx = makeCtx([12, 200, 34, 255])
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (String(tag).toLowerCase() === 'canvas') {
        return { width: 0, height: 0, getContext: () => tctx } as unknown as HTMLCanvasElement
      }
      return origCreate(tag)
    }) as typeof document.createElement)

    api.picking.value = true
    api.onCanvasClick({ clientX: 160, clientY: 90 } as MouseEvent)

    expect(tctx.drawImage).toHaveBeenCalledWith(videoEl.value, 0, 0, 320, 180)
    expect(tctx.getImageData).toHaveBeenCalledWith(160, 90, 1, 1)
    expect(keyColor.value).toBe('#0CC822')
    expect(api.picking.value).toBe(false)
    expect(videoEl.value!.play).not.toHaveBeenCalled()
  })

  it('scales pick coordinates from CSS pixels to the preview buffer', () => {
    const { api, canvasEl } = setup()
    const tctx = makeCtx()
    canvasEl.value = makeCanvas(makeCtx(), 640, 360)
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (String(tag).toLowerCase() === 'canvas') {
        return { width: 0, height: 0, getContext: () => tctx } as unknown as HTMLCanvasElement
      }
      return origCreate(tag)
    }) as typeof document.createElement)

    api.picking.value = true
    api.onCanvasClick({ clientX: 320, clientY: 180 } as MouseEvent)
    expect(tctx.getImageData).toHaveBeenCalledWith(160, 90, 1, 1)
  })

  it('ignores pick clicks while the video is not ready', () => {
    const { api } = setup({ video: makeVideo(0) })
    api.picking.value = true
    api.onCanvasClick({ clientX: 10, clientY: 10 } as MouseEvent)
    expect(api.picking.value).toBe(true)
  })

  it('startLoop reschedules until the video is ready', () => {
    const { raf, caf, tick } = captureRaf()
    const { api, ctx } = setup({ video: makeVideo(0) })
    api.startLoop()
    expect(caf).toHaveBeenCalled()
    expect(raf).toHaveBeenCalledTimes(1)
    tick()
    expect(raf).toHaveBeenCalledTimes(2)
    expect(ctx!.drawImage).not.toHaveBeenCalled()
  })

  it('renders a keyed frame and keeps the loop running when ready', () => {
    const { raf, tick } = captureRaf()
    const { api, canvasEl, ctx } = setup()
    api.startLoop()
    tick()
    expect(canvasEl.value!.width).toBe(CHROMA_PREVIEW_W)
    expect(canvasEl.value!.height).toBe(CHROMA_PREVIEW_H)
    expect(ctx!.clearRect).toHaveBeenCalledWith(0, 0, CHROMA_PREVIEW_W, CHROMA_PREVIEW_H)
    expect(ctx!.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 320, 180)
    const putArg = ctx!.putImageData.mock.calls[0][0] as { data: Uint8ClampedArray }
    expect(putArg.data[3]).toBe(0)
    expect(raf).toHaveBeenCalledTimes(2)
  })

  it('cancels the loop on unmount', () => {
    const { caf } = captureRaf()
    const { api, wrapper } = setup()
    api.startLoop()
    caf.mockClear()
    wrapper.unmount()
    expect(caf).toHaveBeenCalledTimes(1)
  })
})
