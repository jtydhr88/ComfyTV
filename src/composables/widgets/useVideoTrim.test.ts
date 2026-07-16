import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import {
  formatTime,
  MIN_TRIM_GAP,
  useVideoTrim,
  type TrimRange,
} from './useVideoTrim'

function makeVideo(duration = 10): HTMLVideoElement {
  const v = document.createElement('video')
  Object.defineProperty(v, 'duration', { value: duration, configurable: true })
  let ct = 0
  Object.defineProperty(v, 'currentTime', {
    get: () => ct,
    set: (x: number) => { ct = x },
    configurable: true,
  })
  v.pause = vi.fn()
  v.play = vi.fn(() => Promise.resolve())
  return v
}

function makeTrack(width = 100): HTMLDivElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({
    left: 0, top: 0, width, height: 12,
    right: width, bottom: 12, x: 0, y: 0,
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
  vi.useRealTimers()
})

function setup(initial: TrimRange = { start: 0, end: 0 }, url: string | null = null) {
  const videoEl = ref<HTMLVideoElement | null>(null)
  const trackEl = ref<HTMLElement | null>(null)
  const sourceVideoUrl = ref<string | null>(url)
  const modelValue = ref<TrimRange>({ ...initial })
  let api!: ReturnType<typeof useVideoTrim>
  const wrapper = mount(defineComponent({
    setup() {
      api = useVideoTrim({ videoEl, trackEl, sourceVideoUrl, modelValue })
      return () => null
    },
  }))
  wrappers.push(wrapper)
  return { api, videoEl, trackEl, sourceVideoUrl, modelValue }
}

async function setupWithVideo(initial: TrimRange = { start: 0, end: 0 }, duration = 10) {
  const ctx = setup(initial, '/view?filename=v.mp4')
  const video = makeVideo(duration)
  const track = makeTrack(100)
  ctx.videoEl.value = video
  ctx.trackEl.value = track
  await nextTick()
  video.dispatchEvent(new Event('loadedmetadata'))
  return { ...ctx, video, track }
}

describe('formatTime', () => {
  it('formats minutes/seconds/tenths', () => {
    expect(formatTime(0)).toBe('0:00.0')
    expect(formatTime(65.34)).toBe('1:05.3')
    expect(formatTime(600)).toBe('10:00.0')
  })
  it('clamps garbage to zero', () => {
    expect(formatTime(-3)).toBe('0:00.0')
    expect(formatTime(NaN)).toBe('0:00.0')
  })
})

describe('useVideoTrim selection', () => {
  it('maps raw end<=0 to full duration once metadata arrives', async () => {
    const { api } = await setupWithVideo({ start: 0, end: 0 })
    expect(api.duration.value).toBe(10)
    expect(api.selStart.value).toBe(0)
    expect(api.selEnd.value).toBe(10)
    expect(api.selDuration.value).toBe(10)
    expect(api.isLoading.value).toBe(false)
  })

  it('clamps a stale end beyond the new duration', async () => {
    const { api, modelValue } = await setupWithVideo({ start: 2, end: 15 })
    expect(modelValue.value.end).toBe(10)
    expect(api.selEnd.value).toBe(10)
  })

  it('clamps a stale start beyond the new duration', async () => {
    const { modelValue } = await setupWithVideo({ start: 12, end: 0 })
    expect(modelValue.value.start).toBeLessThanOrEqual(10 - MIN_TRIM_GAP)
  })

  it('setStart/setEnd write rounded, gap-respecting values', async () => {
    const { api, modelValue } = await setupWithVideo()
    api.setStart(3.333333)
    expect(modelValue.value.start).toBe(3.33)
    api.setEnd(7.777777)
    expect(modelValue.value.end).toBe(7.78)
    api.setStart(9.99)
    expect(modelValue.value.start).toBeLessThanOrEqual(modelValue.value.end - MIN_TRIM_GAP)
  })

  it('setEnd enforces the minimum gap above start', async () => {
    const { api, modelValue } = await setupWithVideo({ start: 5, end: 10 })
    api.setEnd(1)
    expect(modelValue.value.end).toBeGreaterThanOrEqual(modelValue.value.start + MIN_TRIM_GAP)
  })
})

describe('useVideoTrim playback', () => {
  it('seek clamps into [0, duration]', async () => {
    const { api, video } = await setupWithVideo()
    api.seek(-5)
    expect(video.currentTime).toBe(0)
    api.seek(25)
    expect(video.currentTime).toBe(10)
    api.seek(4)
    expect(api.currentTime.value).toBe(4)
  })

  it('playSelection rewinds to the selection start and toggles pause', async () => {
    const { api, video } = await setupWithVideo({ start: 2, end: 6 })
    video.currentTime = 9
    api.playSelection()
    expect(video.currentTime).toBe(2)
    expect(video.play).toHaveBeenCalledTimes(1)
    expect(api.previewing.value).toBe(true)
    api.playSelection()
    expect(video.pause).toHaveBeenCalled()
    video.dispatchEvent(new Event('pause'))
    expect(api.previewing.value).toBe(false)
  })

  it('playSelection is a no-op without a loaded video', () => {
    const { api } = setup()
    api.playSelection()
    expect(api.previewing.value).toBe(false)
  })

  it('flags loadError on video error events', async () => {
    const { api, video } = await setupWithVideo()
    video.dispatchEvent(new Event('error'))
    expect(api.loadError.value).toBe(true)
  })
})

describe('useVideoTrim drag interactions', () => {
  it('start-handle drag writes start and seeks for feedback', async () => {
    const { api, video, modelValue } = await setupWithVideo()
    api.onDragStart(pointerEvt(50), 'start')
    expect(api.dragging.value).toBe('start')
    expect(modelValue.value.start).toBe(5)
    expect(video.currentTime).toBe(5)
    api.onDragMove(pointerEvt(70))
    expect(modelValue.value.start).toBe(7)
    api.onDragEnd()
    expect(api.dragging.value).toBeNull()
    api.onDragMove(pointerEvt(20))
    expect(modelValue.value.start).toBe(7)
  })

  it('end-handle drag writes end above start + gap', async () => {
    const { api, modelValue } = await setupWithVideo({ start: 3, end: 0 })
    api.onDragStart(pointerEvt(40), 'end')
    expect(modelValue.value.end).toBe(4)
    api.onDragMove(pointerEvt(10))
    expect(modelValue.value.end).toBeGreaterThanOrEqual(3 + MIN_TRIM_GAP)
  })

  it('scrub drag moves the playhead without touching the selection', async () => {
    const { api, video, modelValue } = await setupWithVideo({ start: 2, end: 8 })
    api.onDragStart(pointerEvt(30), 'scrub')
    expect(video.currentTime).toBe(3)
    expect(modelValue.value).toEqual({ start: 2, end: 8 })
  })

  it('ignores drags before metadata', () => {
    const { api } = setup()
    api.onDragStart(pointerEvt(50), 'start')
    expect(api.dragging.value).toBeNull()
  })
})

describe('useVideoTrim playhead loop', () => {
  function captureRaf() {
    let cb: FrameRequestCallback | null = null
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn: FrameRequestCallback) => {
      cb = fn
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    return { raf, tick: () => { const fn = cb; cb = null; fn?.(0) } }
  }

  afterEach(() => vi.restoreAllMocks())

  it('timeupdate events refresh currentTime when the raf loop is idle', async () => {
    const { api, video } = await setupWithVideo()
    video.currentTime = 3.5
    video.dispatchEvent(new Event('timeupdate'))
    expect(api.currentTime.value).toBe(3.5)
  })

  it('play starts the raf loop and keeps scheduling while playing', async () => {
    const { raf, tick } = captureRaf()
    const { api, video } = await setupWithVideo()
    Object.defineProperty(video, 'paused', { value: false, configurable: true })
    video.dispatchEvent(new Event('play'))
    expect(raf).toHaveBeenCalledTimes(1)
    video.currentTime = 2
    tick()
    expect(api.currentTime.value).toBe(2)
    expect(raf).toHaveBeenCalledTimes(2)
  })

  it('raf loop stops rescheduling once the video is paused', async () => {
    const { raf, tick } = captureRaf()
    const { video } = await setupWithVideo()
    Object.defineProperty(video, 'paused', { value: false, configurable: true })
    video.dispatchEvent(new Event('play'))
    Object.defineProperty(video, 'paused', { value: true, configurable: true })
    tick()
    expect(raf).toHaveBeenCalledTimes(1)
  })

  it('preview auto-pauses when the playhead reaches the selection end', async () => {
    const { tick } = captureRaf()
    const { api, video } = await setupWithVideo({ start: 2, end: 6 })
    Object.defineProperty(video, 'paused', { value: false, configurable: true })
    api.playSelection()
    expect(api.previewing.value).toBe(true)
    video.dispatchEvent(new Event('play'))
    video.currentTime = 5.99
    tick()
    expect(video.pause).toHaveBeenCalled()
    expect(api.previewing.value).toBe(false)
  })

  it('raf tick bails out when the video element vanishes', async () => {
    const { raf, tick } = captureRaf()
    const ctx = await setupWithVideo()
    Object.defineProperty(ctx.video, 'paused', { value: false, configurable: true })
    ctx.video.dispatchEvent(new Event('play'))
    ctx.videoEl.value = null
    expect(() => tick()).not.toThrow()
    expect(raf).toHaveBeenCalledTimes(1)
  })
})

function installFilmstripDom(opts: {
  duration?: number
  videoWidth?: number
  videoHeight?: number
} = {}) {
  const origCreate = document.createElement.bind(document)
  const created: HTMLVideoElement[] = []
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (String(tag).toLowerCase() === 'video') {
      const v = origCreate('video') as HTMLVideoElement
      Object.defineProperty(v, 'duration', { value: opts.duration ?? 2, configurable: true })
      Object.defineProperty(v, 'videoWidth', { value: opts.videoWidth ?? 64, configurable: true })
      Object.defineProperty(v, 'videoHeight', { value: opts.videoHeight ?? 36, configurable: true })
      let ct = 0
      Object.defineProperty(v, 'currentTime', {
        get: () => ct,
        set: (x: number) => {
          ct = x
          queueMicrotask(() => v.dispatchEvent(new Event('seeked')))
        },
        configurable: true,
      })
      v.load = vi.fn()
      queueMicrotask(() => v.dispatchEvent(new Event('loadeddata')))
      created.push(v)
      return v
    }
    if (String(tag).toLowerCase() === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toDataURL: () => 'data:image/jpeg;base64,frame',
      } as unknown as HTMLCanvasElement
    }
    return origCreate(tag)
  }) as any)
  return { created }
}

describe('useVideoTrim filmstrip', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders THUMB_COUNT thumbnails from evenly spaced seeks', async () => {
    const { created } = installFilmstripDom()
    const { api } = setup({ start: 0, end: 0 }, '/view?filename=v.mp4')
    await vi.waitFor(() => expect(api.thumbnails.value).toHaveLength(8))
    expect(api.thumbnails.value.every(t => t.startsWith('data:image/jpeg'))).toBe(true)
    // offscreen element is released afterwards
    expect(created[0]!.load).toHaveBeenCalled()
    expect(created[0]!.getAttribute('src')).toBeNull()
  })

  it('gives up without drawing when the video reports no dimensions', async () => {
    const { created } = installFilmstripDom({ videoWidth: 0 })
    const { api } = setup({ start: 0, end: 0 }, '/view?filename=v.mp4')
    await vi.waitFor(() => expect(created[0]!.load).toHaveBeenCalled())
    expect(api.thumbnails.value).toEqual([])
  })

  it('abandons a stale filmstrip build when the source url changes', async () => {
    const { created } = installFilmstripDom()
    const { api, sourceVideoUrl } = setup({ start: 0, end: 0 }, '/view?filename=v.mp4')
    sourceVideoUrl.value = null // bumps filmstripSeq before loadeddata fires
    await nextTick()
    await vi.waitFor(() => expect(created[0]!.load).toHaveBeenCalled())
    expect(api.thumbnails.value).toEqual([])
  })

  it('fails gracefully when the offscreen video never loads, clears on url loss', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.useFakeTimers()
    const { api, sourceVideoUrl } = setup({ start: 0, end: 0 }, '/view?filename=v.mp4')
    expect(api.thumbnails.value).toEqual([])
    await vi.advanceTimersByTimeAsync(4200)
    expect(api.thumbnails.value).toEqual([])
    expect(warn).toHaveBeenCalled()
    sourceVideoUrl.value = null
    await nextTick()
    expect(api.thumbnails.value).toEqual([])
    warn.mockRestore()
  })
})
