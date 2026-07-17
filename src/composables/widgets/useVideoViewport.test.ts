import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import {
  clientToMedia,
  computeFit,
  mediaToBox,
  useVideoViewport,
} from './useVideoViewport'

describe('computeFit', () => {
  it('fits landscape media into a wider box with horizontal centering', () => {
    expect(computeFit(200, 100, 100, 100)).toEqual({ scale: 1, offX: 50, offY: 0 })
  })

  it('fits media larger than box by downscaling', () => {
    const f = computeFit(100, 100, 200, 100)
    expect(f.scale).toBe(0.5)
    expect(f.offX).toBe(0)
    expect(f.offY).toBe(25)
  })

  it('returns identity when any dimension is zero', () => {
    expect(computeFit(0, 100, 100, 100)).toEqual({ scale: 1, offX: 0, offY: 0 })
    expect(computeFit(100, 100, 0, 0)).toEqual({ scale: 1, offX: 0, offY: 0 })
  })
})

describe('clientToMedia / mediaToBox', () => {
  const fit = { scale: 0.5, offX: 10, offY: 20 }

  it('round-trips a point inside the media', () => {
    const rect = { left: 0, top: 0 }
    const [bx, by] = mediaToBox(40, 60, fit)
    const [mx, my] = clientToMedia(bx, by, rect, fit, 100, 100)
    expect(mx).toBeCloseTo(40)
    expect(my).toBeCloseTo(60)
  })

  it('respects the element offset rect', () => {
    const rect = { left: 100, top: 50 }
    const [mx, my] = clientToMedia(100 + 10 + 25, 50 + 20 + 25, rect, fit, 100, 100)
    expect(mx).toBeCloseTo(50)
    expect(my).toBeCloseTo(50)
  })

  it('clamps to [0, media size]', () => {
    const rect = { left: 0, top: 0 }
    expect(clientToMedia(-1000, -1000, rect, fit, 100, 100)).toEqual([0, 0])
    expect(clientToMedia(10000, 10000, rect, fit, 100, 100)).toEqual([100, 100])
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

function makeCanvas(w = 320, h = 180): HTMLCanvasElement {
  const c = document.createElement('canvas')
  Object.defineProperty(c, 'clientWidth', { value: w, configurable: true })
  Object.defineProperty(c, 'clientHeight', { value: h, configurable: true })
  c.getBoundingClientRect = () => ({
    left: 0, top: 0, width: w, height: h,
    right: w, bottom: h, x: 0, y: 0,
    toJSON: () => ({}),
  }) as DOMRect
  return c
}

describe('useVideoViewport', () => {
  function setup() {
    const videoEl = ref<HTMLVideoElement | null>(makeVideo())
    const overlayEl = ref<HTMLCanvasElement | null>(makeCanvas())
    const vp = useVideoViewport({ videoEl, overlayEl })
    return { videoEl, overlayEl, vp }
  }

  it('reads dimensions and duration on loadedmetadata', () => {
    const { vp } = setup()
    vp.onLoadedMetadata()
    expect(vp.vw.value).toBe(640)
    expect(vp.vh.value).toBe(360)
    expect(vp.duration.value).toBe(12)
  })

  it('treats non-finite duration as 0', () => {
    const videoEl = ref<HTMLVideoElement | null>(makeVideo(640, 360, Infinity))
    const overlayEl = ref<HTMLCanvasElement | null>(makeCanvas())
    const vp = useVideoViewport({ videoEl, overlayEl })
    vp.onLoadedMetadata()
    expect(vp.duration.value).toBe(0)
  })

  it('tracks currentTime on timeupdate', () => {
    const { vp } = setup()
    vp.onTimeUpdate()
    expect(vp.currentTime.value).toBe(3)
  })

  it('is inert when elements are missing', () => {
    const videoEl = ref<HTMLVideoElement | null>(null)
    const overlayEl = ref<HTMLCanvasElement | null>(null)
    const vp = useVideoViewport({ videoEl, overlayEl })
    vp.onLoadedMetadata()
    vp.onTimeUpdate()
    vp.togglePlay()
    expect(vp.vw.value).toBe(0)
    expect(vp.currentTime.value).toBe(0)
    expect(vp.fit()).toEqual({ scale: 1, offX: 0, offY: 0 })
    expect(vp.toVideo({ clientX: 10, clientY: 10 } as PointerEvent)).toEqual([0, 0])
    expect(vp.syncCanvasSize()).toBeNull()
  })

  it('maps pointer events into video coordinates', () => {
    const { vp } = setup()
    vp.onLoadedMetadata()
    const pt = vp.toVideo({ clientX: 160, clientY: 90 } as PointerEvent)
    expect(pt[0]).toBeCloseTo(320)
    expect(pt[1]).toBeCloseTo(180)
  })

  it('syncCanvasSize resizes backing store to client size and clears', () => {
    const { vp, overlayEl } = setup()
    const clearRect = vi.fn()
    const ctx = { clearRect } as unknown as CanvasRenderingContext2D
    overlayEl.value!.getContext = vi.fn(() => ctx) as never
    const got = vp.syncCanvasSize()
    expect(got).toBe(ctx)
    expect(overlayEl.value!.width).toBe(320)
    expect(overlayEl.value!.height).toBe(180)
    expect(clearRect).toHaveBeenCalledWith(0, 0, 320, 180)
  })

  it('togglePlay plays when paused and pauses when playing', () => {
    const { vp, videoEl } = setup()
    const v = videoEl.value!
    let paused = true
    Object.defineProperty(v, 'paused', { get: () => paused, configurable: true })
    v.play = vi.fn(() => { paused = false; return Promise.resolve() })
    v.pause = vi.fn(() => { paused = true })
    vp.togglePlay()
    expect(v.play).toHaveBeenCalled()
    vp.togglePlay()
    expect(v.pause).toHaveBeenCalled()
  })
})
