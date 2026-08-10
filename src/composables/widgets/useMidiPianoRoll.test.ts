import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref, type Ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

const midiEvents = vi.fn()
vi.mock('@/api', () => ({
  midiEvents: (...a: unknown[]) => midiEvents(...a),
}))

import { useMidiPianoRoll } from './useMidiPianoRoll'

function stubCtx() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textBaseline: '',
  }
}

function makeCanvas(ctx: unknown, w = 400, hh = 200): HTMLCanvasElement {
  const box = document.createElement('div')
  Object.defineProperty(box, 'clientWidth', { value: w })
  Object.defineProperty(box, 'clientHeight', { value: hh })
  const el = document.createElement('canvas')
  el.getContext = vi.fn(() => ctx) as never
  box.appendChild(el)
  return el
}

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

const READY = {
  status: 'ready',
  events: [{ t: 0, dur: 1, midi: 60, vel: 100, ch: 0 }],
  programs: { '0': 0 },
  duration: 4,
}

describe('useMidiPianoRoll', () => {
  let wrappers: VueWrapper[] = []
  let rafCb: FrameRequestCallback | null = null
  let rafId = 0
  let rafSpy: ReturnType<typeof vi.fn>
  let cancelSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    midiEvents.mockReset()
    rafCb = null
    rafId = 0
    rafSpy = vi.fn((cb: FrameRequestCallback) => {
      rafCb = cb
      return ++rafId
    })
    cancelSpy = vi.fn()
    vi.stubGlobal('requestAnimationFrame', rafSpy)
    vi.stubGlobal('cancelAnimationFrame', cancelSpy)
  })

  afterEach(() => {
    wrappers.forEach((w) => w.unmount())
    wrappers = []
    vi.unstubAllGlobals()
  })

  function setup(o: {
    url?: string | null
    enabled?: boolean
    canvas?: HTMLCanvasElement | null
    time?: () => number
  } = {}) {
    const url = ref<string | null>(o.url === undefined ? '/view?filename=a.mid' : o.url)
    const enabled = ref(o.enabled ?? true)
    const canvas: Ref<HTMLCanvasElement | null> = ref(o.canvas ?? null)
    let api!: ReturnType<typeof useMidiPianoRoll>
    const wrapper = mount(defineComponent({
      setup() {
        api = useMidiPianoRoll({
          url,
          enabled,
          canvas,
          currentTime: o.time ?? (() => 0),
        })
        return () => null
      },
    }))
    wrappers.push(wrapper)
    return { api, url, enabled, canvas, wrapper }
  }

  it('does nothing without a url', async () => {
    const { api } = setup({ url: null })
    await flush()
    expect(midiEvents).not.toHaveBeenCalled()
    expect(api.ready.value).toBe(false)
  })

  it('does nothing while disabled', async () => {
    const { api } = setup({ enabled: false })
    await flush()
    expect(midiEvents).not.toHaveBeenCalled()
    expect(api.ready.value).toBe(false)
  })

  it('loads notes, becomes ready and starts the draw loop', async () => {
    midiEvents.mockResolvedValue(READY)
    const ctx = stubCtx()
    const el = makeCanvas(ctx)
    const { api } = setup({ canvas: el })
    await flush()
    expect(midiEvents).toHaveBeenCalledWith('/view?filename=a.mid')
    expect(api.ready.value).toBe(true)
    expect(rafSpy).toHaveBeenCalled()
    expect(el.width).toBe(400)
    expect(el.height).toBe(200)
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 400, 200)
  })

  it('scales the backing store by devicePixelRatio', async () => {
    vi.stubGlobal('devicePixelRatio', 2)
    midiEvents.mockResolvedValue(READY)
    const ctx = stubCtx()
    const el = makeCanvas(ctx)
    setup({ canvas: el })
    await flush()
    expect(el.width).toBe(800)
    expect(el.height).toBe(400)
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
  })

  it('keeps looping when the frame callback fires', async () => {
    midiEvents.mockResolvedValue(READY)
    setup({ canvas: makeCanvas(stubCtx()) })
    await flush()
    const calls = rafSpy.mock.calls.length
    rafCb!(0)
    expect(rafSpy.mock.calls.length).toBe(calls + 1)
  })

  it('stays not ready when the response has no events', async () => {
    midiEvents.mockResolvedValue({ status: 'ready' })
    const { api } = setup({ canvas: makeCanvas(stubCtx()) })
    await flush()
    expect(api.ready.value).toBe(false)
    expect(rafSpy).not.toHaveBeenCalled()
  })

  it('stays not ready for an original status', async () => {
    midiEvents.mockResolvedValue({ status: 'original', events: [] })
    const { api } = setup({ canvas: makeCanvas(stubCtx()) })
    await flush()
    expect(api.ready.value).toBe(false)
  })

  it('swallows fetch errors', async () => {
    midiEvents.mockRejectedValue(new Error('boom'))
    const { api } = setup({ canvas: makeCanvas(stubCtx()) })
    await flush()
    expect(api.ready.value).toBe(false)
  })

  it('ignores a stale response after the url changed', async () => {
    let resolve1!: (v: unknown) => void
    midiEvents.mockImplementationOnce(() => new Promise((r) => { resolve1 = r }))
    midiEvents.mockResolvedValue(READY)
    const { api, url } = setup({ canvas: makeCanvas(stubCtx()) })
    url.value = '/view?filename=b.mid'
    await flush()
    expect(api.ready.value).toBe(true)
    resolve1({ status: 'ready', events: [] })
    await flush()
    expect(api.ready.value).toBe(true)
    expect(midiEvents).toHaveBeenCalledTimes(2)
  })

  it('stops the loop and resets when the url is cleared', async () => {
    midiEvents.mockResolvedValue(READY)
    const { api, url } = setup({ canvas: makeCanvas(stubCtx()) })
    await flush()
    expect(api.ready.value).toBe(true)
    url.value = null
    await flush()
    expect(api.ready.value).toBe(false)
    expect(cancelSpy).toHaveBeenCalled()
  })

  it('cancels the loop on unmount', async () => {
    midiEvents.mockResolvedValue(READY)
    const { wrapper } = setup({ canvas: makeCanvas(stubCtx()) })
    await flush()
    wrapper.unmount()
    wrappers = wrappers.filter((w) => w !== wrapper)
    expect(cancelSpy).toHaveBeenCalled()
  })

  it('render is a no-op before readiness or without a canvas', async () => {
    const ctx = stubCtx()
    const el = makeCanvas(ctx)
    const { api, canvas } = setup({ url: null, canvas: el })
    api.render()
    expect(ctx.setTransform).not.toHaveBeenCalled()
    canvas.value = null
    expect(() => api.render()).not.toThrow()
    await flush()
  })

  it('falls back to the canvas own size without a parent box', async () => {
    midiEvents.mockResolvedValue(READY)
    const ctx = stubCtx()
    const el = document.createElement('canvas')
    el.getContext = vi.fn(() => ctx) as never
    setup({ canvas: el })
    await flush()
    expect(el.width).toBe(1)
    expect(el.height).toBe(1)
    expect(ctx.setTransform).toHaveBeenCalled()
  })

  it('bails out when the canvas has no 2d context', async () => {
    midiEvents.mockResolvedValue(READY)
    const el = document.createElement('canvas')
    el.getContext = vi.fn(() => null) as never
    const { api } = setup({ canvas: el })
    await flush()
    expect(api.ready.value).toBe(true)
    expect(() => api.render()).not.toThrow()
  })
})
