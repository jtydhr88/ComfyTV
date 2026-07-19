import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, reactive, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import {
  useVideoTransitionPreview,
  type VideoTransitionRendererLike,
} from './useVideoTransitionPreview'

interface FakeVideo {
  el: HTMLVideoElement
  seeks: number[]
  setDuration: (d: number) => void
  setReady: (r: number) => void
  fireSeeked: () => void
  fireMeta: () => void
}

function makeVideo(duration = 2, ready = 2): FakeVideo {
  const el = document.createElement('video')
  let ct = 0
  let dur = duration
  let rs = ready
  const seeks: number[] = []
  Object.defineProperty(el, 'readyState', { configurable: true, get: () => rs })
  Object.defineProperty(el, 'duration', { configurable: true, get: () => dur })
  Object.defineProperty(el, 'currentTime', {
    configurable: true,
    get: () => ct,
    set: (t: number) => {
      ct = t
      seeks.push(t)
    },
  })
  return {
    el,
    seeks,
    setDuration: (d) => { dur = d },
    setReady: (r) => { rs = r },
    fireSeeked: () => el.dispatchEvent(new Event('seeked')),
    fireMeta: () => el.dispatchEvent(new Event('loadedmetadata')),
  }
}

function makeRenderer(ok = true) {
  const renderer: VideoTransitionRendererLike = {
    renderToCanvas: vi.fn(() => ok),
    dispose: vi.fn(),
  }
  return renderer
}

function captureRaf() {
  let cb: FrameRequestCallback | null = null
  const raf = vi.spyOn(window, 'requestAnimationFrame')
    .mockImplementation((fn: FrameRequestCallback) => {
      cb = fn
      return 11
    })
  const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  return { raf, caf, tick: () => { const fn = cb; cb = null; fn?.(0) } }
}

describe('useVideoTransitionPreview', () => {
  let wrappers: VueWrapper[] = []
  afterEach(() => {
    wrappers.forEach((w) => w.unmount())
    wrappers = []
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function setup(opts: {
    a?: FakeVideo | null
    b?: FakeVideo | null
    renderer?: VideoTransitionRendererLike
  } = {}) {
    const a = 'a' in opts ? opts.a ?? null : makeVideo(2)
    const b = 'b' in opts ? opts.b ?? null : makeVideo(1.5)
    const videoAEl = ref<HTMLVideoElement | null>(a?.el ?? null)
    const videoBEl = ref<HTMLVideoElement | null>(b?.el ?? null)
    const canvasEl = ref<HTMLCanvasElement | null>(document.createElement('canvas'))
    const params = reactive({ transition: 'fade', duration: 1, offset: 0 })
    const renderer = opts.renderer ?? makeRenderer()
    const createRenderer = vi.fn(() => renderer)
    const clock = { t: 1000 }
    let api!: ReturnType<typeof useVideoTransitionPreview>
    const wrapper = mount(defineComponent({
      setup() {
        api = useVideoTransitionPreview({
          videoAEl,
          videoBEl,
          canvasEl,
          params: () => ({ ...params }),
          createRenderer,
          now: () => clock.t,
        })
        return () => null
      },
    }))
    wrappers.push(wrapper)
    return { api, wrapper, videoAEl, videoBEl, canvasEl, params, renderer, createRenderer, clock, a, b }
  }

  it('computes the effective window and preview timeline from metadata', () => {
    const { api } = setup()
    expect(api.ready.value).toBe(true)
    expect(api.window.value).toEqual({ duration: 1, offset: 1 })
    expect(api.timeline.value).toEqual({ lead: 1, tail: 0.5, total: 2.5 })
  })

  it('renders the timeline start immediately when both videos sit at t=0', () => {
    const { api, a, b, renderer, canvasEl, videoAEl, videoBEl } = setup()
    expect(a!.seeks).toEqual([])
    expect(b!.seeks).toEqual([])
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(1)
    expect(renderer.renderToCanvas).toHaveBeenCalledWith(
      videoAEl.value, videoBEl.value, 'fade', 0, canvasEl.value,
    )
    expect(api.time.value).toBe(0)
    expect(api.progress.value).toBe(0)
    expect(api.supported.value).toBe(true)
  })

  it('waits for metadata before seeking', () => {
    const a = makeVideo(0, 0)
    const b = makeVideo(0, 0)
    const { api } = setup({ a, b })
    expect(api.ready.value).toBe(false)
    expect(a.seeks).toEqual([])
    a.setDuration(5)
    a.setReady(2)
    a.fireMeta()
    expect(a.seeks).toEqual([])
    b.setDuration(1.5)
    b.setReady(2)
    b.fireMeta()
    expect(api.ready.value).toBe(true)
    expect(api.window.value).toEqual({ duration: 1, offset: 4 })
    expect(a.seeks).toEqual([3])
    expect(b.seeks).toEqual([])
  })

  it('seeks only A in the lead segment', () => {
    const { api, a, b, renderer, clock } = setup()
    clock.t += 100
    api.scrub(0.2)
    expect(api.time.value).toBe(0.5)
    expect(a!.seeks).toEqual([0.5])
    expect(b!.seeks).toEqual([])
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(1)
    a!.fireSeeked()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(2)
    expect(renderer.renderToCanvas).toHaveBeenLastCalledWith(
      expect.anything(), expect.anything(), 'fade', 0, expect.anything(),
    )
  })

  it('rolls B and parks A without stalling in the tail segment', () => {
    const { api, a, b, renderer, clock } = setup()
    clock.t += 100
    api.scrub(0.9)
    expect(api.time.value).toBe(2.25)
    expect(api.progress.value).toBe(1)
    expect(a!.seeks).toEqual([2])
    expect(b!.seeks).toEqual([1.25])
    b!.fireSeeked()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(2)
    expect(renderer.renderToCanvas).toHaveBeenLastCalledWith(
      expect.anything(), expect.anything(), 'fade', 1, expect.anything(),
    )
  })

  it('coalesces scrubs while a seek is pending and re-seeks once settled', () => {
    const { api, a, b, renderer, clock } = setup()
    clock.t += 100
    api.scrub(0.6)
    expect(a!.seeks).toEqual([1.5])
    expect(b!.seeks).toEqual([0.5])
    api.scrub(0.8)
    expect(a!.seeks).toEqual([1.5])
    a!.fireSeeked()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(1)
    b!.fireSeeked()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(2)
    expect(a!.seeks).toEqual([1.5, 2])
    expect(b!.seeks).toEqual([0.5, 1])
    expect(api.time.value).toBe(2)
    b!.fireSeeked()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(3)
  })

  it('throttles rapid scrubs after settling with a trailing flush', () => {
    vi.useFakeTimers()
    const { api, a, b, clock } = setup()
    clock.t += 100
    api.scrub(0.2)
    expect(a!.seeks).toEqual([0.5])
    a!.fireSeeked()
    clock.t += 5
    api.scrub(0.4)
    expect(a!.seeks).toEqual([0.5])
    clock.t += 30
    vi.advanceTimersByTime(30)
    expect(a!.seeks).toEqual([0.5, 1])
    expect(b!.seeks).toEqual([])
  })

  it('clamps scrub fractions into the timeline', () => {
    const { api } = setup()
    api.scrub(7)
    expect(api.time.value).toBe(2.5)
    api.scrub(-2)
    expect(api.time.value).toBe(0)
  })

  it('animates over the full timeline and loops', () => {
    const { tick } = captureRaf()
    const { api, a, clock } = setup()
    api.play()
    expect(api.playing.value).toBe(true)
    clock.t += 500
    tick()
    expect(api.time.value).toBeCloseTo(0.5, 5)
    expect(api.progress.value).toBe(0)
    expect(a!.seeks).toContain(0.5)
    a!.fireSeeked()
    clock.t += 1000
    tick()
    expect(api.time.value).toBeCloseTo(1.5, 5)
    expect(api.progress.value).toBeCloseTo(0.5, 5)
    a!.fireSeeked()
    clock.t += 1250
    tick()
    expect(api.time.value).toBeCloseTo(0.25, 5)
    api.pause()
    expect(api.playing.value).toBe(false)
  })

  it('skips seeks while one is still pending during playback', () => {
    const { tick } = captureRaf()
    const { api, a, clock } = setup()
    api.play()
    clock.t += 300
    tick()
    const count = a!.seeks.length
    clock.t += 100
    tick()
    expect(a!.seeks.length).toBe(count)
  })

  it('re-seeks with the new mapping when params change', async () => {
    const { api, a, b, params, wrapper, renderer, clock } = setup()
    clock.t += 100
    api.scrub(0.6)
    a!.fireSeeked()
    b!.fireSeeked()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(2)
    params.duration = 0.5
    await wrapper.vm.$nextTick()
    expect(api.window.value).toEqual({ duration: 0.5, offset: 1.5 })
    expect(api.timeline.value).toEqual({ lead: 1, tail: 1, total: 2.5 })
    expect(a!.seeks).toEqual([1.5, 2])
    expect(b!.seeks).toEqual([0.5])
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(3)
    expect(renderer.renderToCanvas).toHaveBeenLastCalledWith(
      expect.anything(), expect.anything(), 'fade', 1, expect.anything(),
    )
  })

  it('clamps the playhead when the timeline shrinks', async () => {
    const { api, a, b, params, wrapper, clock } = setup()
    clock.t += 100
    api.scrub(1)
    a!.fireSeeked()
    b!.fireSeeked()
    expect(api.time.value).toBe(2.5)
    params.offset = 0.5
    await wrapper.vm.$nextTick()
    expect(api.window.value).toEqual({ duration: 1, offset: 0.5 })
    expect(api.timeline.value).toEqual({ lead: 0.5, tail: 0.5, total: 2 })
    expect(api.time.value).toBe(2)
    expect(a!.seeks).toEqual([2, 1.5])
  })

  it('flips supported off and stops playback when the renderer fails', () => {
    const { api } = setup({ renderer: makeRenderer(false) })
    expect(api.supported.value).toBe(false)
    api.play()
    expect(api.playing.value).toBe(false)
  })

  it('creates the renderer lazily and only once', () => {
    const { api, createRenderer } = setup()
    api.renderOnce()
    api.renderOnce()
    expect(createRenderer).toHaveBeenCalledTimes(1)
  })

  it('swaps listeners and resets state when video elements change', async () => {
    const { api, videoAEl, videoBEl, renderer, wrapper } = setup()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(1)
    const oldA = videoAEl.value!
    const freshA = makeVideo(3)
    const freshB = makeVideo(3)
    videoAEl.value = freshA.el
    videoBEl.value = freshB.el
    await wrapper.vm.$nextTick()
    expect(api.window.value).toEqual({ duration: 1, offset: 2 })
    expect(api.timeline.value).toEqual({ lead: 1, tail: 1, total: 3 })
    oldA.dispatchEvent(new Event('seeked'))
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(1)
    expect(freshA.seeks).toEqual([1])
    freshA.fireSeeked()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(2)
  })

  it('disposes the renderer on unmount', () => {
    const { renderer, wrapper } = setup()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
  })

  it('togglePlay starts and stops the loop', () => {
    captureRaf()
    const { api } = setup()
    api.togglePlay()
    expect(api.playing.value).toBe(true)
    api.togglePlay()
    expect(api.playing.value).toBe(false)
  })
})
