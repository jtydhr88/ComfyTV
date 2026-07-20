import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, reactive, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import {
  useFxVideoPreview,
  type FxRendererLike,
} from './useFxVideoPreview'
import { getPreviewSource } from './previewBus'

interface FakeParams {
  amount: number
  mode: string
}

function makeVideo(ready = 2, paused = true): HTMLVideoElement {
  const v = document.createElement('video')
  Object.defineProperty(v, 'readyState', { value: ready, configurable: true })
  Object.defineProperty(v, 'paused', { value: paused, configurable: true })
  return v
}

function makeRenderer(ok = true) {
  const renderer: FxRendererLike<FakeParams> = {
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
      return 7
    })
  const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  return { raf, caf, tick: () => { const fn = cb; cb = null; fn?.(0) } }
}

describe('useFxVideoPreview', () => {
  let wrappers: VueWrapper[] = []
  afterEach(() => {
    wrappers.forEach((w) => w.unmount())
    wrappers = []
    vi.restoreAllMocks()
  })

  function setup(opts: {
    video?: HTMLVideoElement | null
    renderer?: FxRendererLike<FakeParams>
    nodeId?: string
  } = {}) {
    const videoEl = ref<HTMLVideoElement | null>(
      'video' in opts ? opts.video ?? null : makeVideo(),
    )
    const canvasEl = ref<HTMLCanvasElement | null>(document.createElement('canvas'))
    const params = reactive<FakeParams>({ amount: 0, mode: 'a' })
    const renderer = opts.renderer ?? makeRenderer()
    const createRenderer = vi.fn(() => renderer)
    let api!: ReturnType<typeof useFxVideoPreview<FakeParams>>
    const wrapper = mount(defineComponent({
      setup() {
        api = useFxVideoPreview<FakeParams>({
          videoEl,
          canvasEl,
          nodeId: opts.nodeId,
          params: () => ({ amount: params.amount, mode: params.mode }),
          createRenderer,
        })
        return () => null
      },
    }))
    wrappers.push(wrapper)
    return { api, wrapper, videoEl, canvasEl, params, renderer, createRenderer }
  }

  it('renders once on attach when the video is ready and paused', () => {
    const { renderer, videoEl, canvasEl } = setup()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(1)
    expect(renderer.renderToCanvas).toHaveBeenCalledWith(
      videoEl.value, { amount: 0, mode: 'a' }, canvasEl.value,
    )
  })

  it('does not render without a video or before readyState 2', () => {
    const a = setup({ video: null })
    expect(a.renderer.renderToCanvas).not.toHaveBeenCalled()
    const b = setup({ video: makeVideo(0) })
    expect(b.renderer.renderToCanvas).not.toHaveBeenCalled()
  })

  it('re-renders on param edits with the fresh values', async () => {
    const { renderer, params, wrapper } = setup()
    params.amount = 0.7
    await wrapper.vm.$nextTick()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(2)
    params.mode = 'b'
    await wrapper.vm.$nextTick()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(3)
    expect(renderer.renderToCanvas).toHaveBeenLastCalledWith(
      expect.anything(), { amount: 0.7, mode: 'b' }, expect.anything(),
    )
  })

  it('registers on the preview bus and unregisters on unmount', () => {
    const { canvasEl, wrapper } = setup({ nodeId: 'fx-7' })
    expect(getPreviewSource('fx-7')?.()).toBe(canvasEl.value)
    wrapper.unmount()
    expect(getPreviewSource('fx-7')).toBeNull()
  })

  it('starts a raf loop on play and stops it on pause with a final frame', () => {
    const { raf, caf, tick } = captureRaf()
    const { renderer, videoEl } = setup()
    videoEl.value!.dispatchEvent(new Event('play'))
    expect(raf).toHaveBeenCalledTimes(1)
    tick()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(2)
    expect(raf).toHaveBeenCalledTimes(2)
    caf.mockClear()
    videoEl.value!.dispatchEvent(new Event('pause'))
    expect(caf).toHaveBeenCalled()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(3)
  })

  it('renders single frames on seeked and loadeddata', () => {
    const { renderer, videoEl } = setup()
    videoEl.value!.dispatchEvent(new Event('seeked'))
    videoEl.value!.dispatchEvent(new Event('loadeddata'))
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(3)
  })

  it('flips supported off and stops when the renderer fails', () => {
    const { raf } = captureRaf()
    const { api, renderer, videoEl } = setup({ renderer: makeRenderer(false) })
    expect(api.supported.value).toBe(false)
    videoEl.value!.dispatchEvent(new Event('seeked'))
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(1)
    api.startLoop()
    expect(raf).not.toHaveBeenCalled()
  })

  it('swaps listeners when the video element changes', async () => {
    const { renderer, videoEl, wrapper } = setup()
    const old = videoEl.value!
    const fresh = makeVideo()
    videoEl.value = fresh
    await wrapper.vm.$nextTick()
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(2)
    old.dispatchEvent(new Event('seeked'))
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(2)
    fresh.dispatchEvent(new Event('seeked'))
    expect(renderer.renderToCanvas).toHaveBeenCalledTimes(3)
  })

  it('creates the renderer lazily and only once', () => {
    const { createRenderer, videoEl } = setup()
    videoEl.value!.dispatchEvent(new Event('seeked'))
    videoEl.value!.dispatchEvent(new Event('seeked'))
    expect(createRenderer).toHaveBeenCalledTimes(1)
  })

  it('disposes the renderer and cancels the loop on unmount', () => {
    const { caf } = captureRaf()
    const { api, renderer, wrapper } = setup()
    api.startLoop()
    caf.mockClear()
    wrapper.unmount()
    expect(caf).toHaveBeenCalled()
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
  })
})
