import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { useVideoPlayback } from './useVideoPlayback'

function makeVideo(duration = 10): HTMLVideoElement {
  const v = document.createElement('video')
  Object.defineProperty(v, 'duration', { value: duration, configurable: true })
  let ct = 0
  Object.defineProperty(v, 'currentTime', {
    get: () => ct,
    set: (x: number) => { ct = x },
    configurable: true,
  })
  let paused = true
  Object.defineProperty(v, 'paused', { get: () => paused, configurable: true })
  v.play = vi.fn(() => { paused = false; return Promise.resolve() })
  v.pause = vi.fn(() => { paused = true })
  return v
}

function makeSeekBar(width = 100): HTMLDivElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({
    left: 0, top: 0, width, height: 8,
    right: width, bottom: 8, x: 0, y: 0,
    toJSON: () => ({}),
  }) as DOMRect
  return el
}

function pointerEvt(clientX: number): PointerEvent {
  return {
    clientX,
    pointerId: 1,
    currentTarget: { setPointerCapture: vi.fn() },
  } as unknown as PointerEvent
}

let wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers = []
})

function setup(opts: { duration?: number; initialMuted?: boolean; url?: string | null } = {}) {
  const videoEl = ref<HTMLVideoElement | null>(makeVideo(opts.duration ?? 10))
  const seekEl = ref<HTMLElement | null>(makeSeekBar())
  const sourceVideoUrl = ref<string | null>(opts.url ?? '/view?filename=v.mp4')
  let api!: ReturnType<typeof useVideoPlayback>
  const wrapper = mount(defineComponent({
    setup() {
      api = useVideoPlayback({
        videoEl, seekEl, sourceVideoUrl,
        initialMuted: opts.initialMuted,
      })
      return () => null
    },
  }))
  wrappers.push(wrapper)
  return { api, videoEl, seekEl, sourceVideoUrl, wrapper }
}

describe('useVideoPlayback state', () => {
  it('starts muted by default and honors initialMuted', () => {
    expect(setup().api.muted.value).toBe(true)
    expect(setup({ initialMuted: false }).api.muted.value).toBe(false)
  })

  it('onLoadedMetadata reads duration and clears loadError', () => {
    const { api } = setup({ duration: 8 })
    api.onError()
    expect(api.loadError.value).toBe(true)
    api.onLoadedMetadata()
    expect(api.duration.value).toBe(8)
    expect(api.loadError.value).toBe(false)
  })

  it('onTimeUpdate mirrors currentTime and playing from the element', () => {
    const { api, videoEl } = setup()
    videoEl.value!.currentTime = 4.5
    api.onTimeUpdate()
    expect(api.currentTime.value).toBe(4.5)
    expect(api.playing.value).toBe(false)
    void videoEl.value!.play()
    api.onTimeUpdate()
    expect(api.playing.value).toBe(true)
  })

  it('onPlay/onPause/onError set the corresponding flags', () => {
    const { api } = setup()
    api.onPlay()
    expect(api.playing.value).toBe(true)
    api.onPause()
    expect(api.playing.value).toBe(false)
    api.onError()
    expect(api.loadError.value).toBe(true)
  })

  it('resets state when the source url changes', async () => {
    const { api, sourceVideoUrl } = setup()
    api.onLoadedMetadata()
    api.onPlay()
    api.onError()
    api.onTimeUpdate()
    sourceVideoUrl.value = '/view?filename=other.mp4'
    await nextTick()
    expect(api.duration.value).toBe(0)
    expect(api.currentTime.value).toBe(0)
    expect(api.playing.value).toBe(false)
    expect(api.loadError.value).toBe(false)
  })

  it('computes progressPct clamped to 100', () => {
    const { api, videoEl } = setup({ duration: 10 })
    expect(api.progressPct.value).toBe(0)
    api.onLoadedMetadata()
    videoEl.value!.currentTime = 2.5
    api.onTimeUpdate()
    expect(api.progressPct.value).toBe(25)
    videoEl.value!.currentTime = 99
    api.onTimeUpdate()
    expect(api.progressPct.value).toBe(100)
  })
})

describe('useVideoPlayback togglePlay', () => {
  it('is a no-op before metadata', () => {
    const { api, videoEl } = setup()
    api.togglePlay()
    expect(videoEl.value!.play).not.toHaveBeenCalled()
  })

  it('plays when paused and marks playing after the promise resolves', async () => {
    const { api, videoEl } = setup()
    api.onLoadedMetadata()
    api.togglePlay()
    expect(videoEl.value!.play).toHaveBeenCalled()
    await Promise.resolve()
    expect(api.playing.value).toBe(true)
  })

  it('pauses when playing', async () => {
    const { api, videoEl } = setup()
    api.onLoadedMetadata()
    api.togglePlay()
    await Promise.resolve()
    api.togglePlay()
    expect(videoEl.value!.pause).toHaveBeenCalled()
    expect(api.playing.value).toBe(false)
  })

  it('swallows play() rejections', async () => {
    const { api, videoEl } = setup()
    api.onLoadedMetadata()
    videoEl.value!.play = vi.fn(() => Promise.reject(new Error('nope')))
    api.togglePlay()
    await Promise.resolve()
    await Promise.resolve()
    expect(api.playing.value).toBe(false)
  })
})

describe('useVideoPlayback seeking', () => {
  it('onSeekStart pauses, captures the pointer and seeks to the fraction', () => {
    const { api, videoEl } = setup({ duration: 10 })
    api.onLoadedMetadata()
    const e = pointerEvt(25)
    api.onSeekStart(e)
    expect(videoEl.value!.pause).toHaveBeenCalled()
    expect(api.playing.value).toBe(false)
    expect(api.seeking.value).toBe(true)
    expect((e.currentTarget as HTMLElement).setPointerCapture).toHaveBeenCalledWith(1)
    expect(videoEl.value!.currentTime).toBe(2.5)
    expect(api.currentTime.value).toBe(2.5)
  })

  it('onSeekStart is inert before metadata', () => {
    const { api, videoEl } = setup()
    api.onSeekStart(pointerEvt(25))
    expect(api.seeking.value).toBe(false)
    expect(videoEl.value!.pause).not.toHaveBeenCalled()
  })

  it('clamps seeks outside the bar to [0, duration]', () => {
    const { api, videoEl } = setup({ duration: 10 })
    api.onLoadedMetadata()
    api.onSeekStart(pointerEvt(-50))
    expect(videoEl.value!.currentTime).toBe(0)
    api.onSeekMove(pointerEvt(500))
    expect(videoEl.value!.currentTime).toBe(10)
  })

  it('onSeekMove only tracks while seeking, onSeekEnd stops it', () => {
    const { api, videoEl } = setup({ duration: 10 })
    api.onLoadedMetadata()
    api.onSeekMove(pointerEvt(50))
    expect(videoEl.value!.currentTime).toBe(0.001)
    api.onSeekStart(pointerEvt(10))
    api.onSeekMove(pointerEvt(50))
    expect(videoEl.value!.currentTime).toBe(5)
    api.onSeekEnd()
    expect(api.seeking.value).toBe(false)
    api.onSeekMove(pointerEvt(90))
    expect(videoEl.value!.currentTime).toBe(5)
  })
})

describe('useVideoPlayback teardown', () => {
  it('pauses the video on unmount', () => {
    const { videoEl, wrapper } = setup()
    wrapper.unmount()
    wrappers = []
    expect(videoEl.value!.pause).toHaveBeenCalled()
  })
})
