import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, reactive, ref } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { getPreviewSource } from './previewBus'
import {
  useVideoLutPreview,
  type VideoLutRendererLike,
} from './useVideoLutPreview'

const CUBE_TEXT = [
  'LUT_3D_SIZE 2',
  '0.0 0.0 0.0', '1.0 0.0 0.0', '0.0 1.0 0.0', '1.0 1.0 0.0',
  '0.0 0.0 1.0', '1.0 0.0 1.0', '0.0 1.0 1.0', '1.0 1.0 1.0',
].join('\n')

function makeVideo(ready = 2, paused = true): HTMLVideoElement {
  const v = document.createElement('video')
  Object.defineProperty(v, 'readyState', { value: ready, configurable: true })
  Object.defineProperty(v, 'paused', { value: paused, configurable: true })
  return v
}

function makeRenderer(ok = true) {
  const renderer: VideoLutRendererLike = {
    renderToCanvas: vi.fn(() => ok),
    dispose: vi.fn(),
  }
  return renderer
}

function lastLut(renderer: VideoLutRendererLike) {
  const calls = (renderer.renderToCanvas as ReturnType<typeof vi.fn>).mock.calls
  return calls[calls.length - 1]?.[1]
}

describe('useVideoLutPreview', () => {
  let wrappers: VueWrapper[] = []
  afterEach(() => {
    wrappers.forEach((w) => w.unmount())
    wrappers = []
    vi.restoreAllMocks()
  })

  function setup(opts: {
    video?: HTMLVideoElement | null
    renderer?: VideoLutRendererLike
    nodeId?: string
    lutFile?: string
    lutUrl?: string
    fetchText?: (url: string) => Promise<string>
  } = {}) {
    const videoEl = ref<HTMLVideoElement | null>(
      'video' in opts ? opts.video ?? null : makeVideo(),
    )
    const canvasEl = ref<HTMLCanvasElement | null>(document.createElement('canvas'))
    const params = reactive({
      lutFile: opts.lutFile ?? 'grade.cube',
      lutUrl: opts.lutUrl ?? '/view?filename=grade.cube',
      interp: 'tetrahedral',
    })
    const renderer = opts.renderer ?? makeRenderer()
    const createRenderer = vi.fn(() => renderer)
    const fetchText = vi.fn(opts.fetchText ?? (() => Promise.resolve(CUBE_TEXT)))
    let api!: ReturnType<typeof useVideoLutPreview>
    const wrapper = mount(defineComponent({
      setup() {
        api = useVideoLutPreview({
          videoEl,
          canvasEl,
          nodeId: opts.nodeId,
          params: () => ({
            lutFile: params.lutFile,
            lutUrl: params.lutUrl,
            interp: params.interp,
          }),
          createRenderer,
          fetchText,
        })
        return () => null
      },
    }))
    wrappers.push(wrapper)
    return { api, wrapper, videoEl, canvasEl, params, renderer, createRenderer, fetchText }
  }

  it('fetches, parses, and passes the LUT to the renderer', async () => {
    const { api, renderer, fetchText } = setup()
    await flushPromises()
    expect(fetchText).toHaveBeenCalledWith('/view?filename=grade.cube')
    expect(api.lutReady.value).toBe(true)
    expect(api.lutUnsupported.value).toBe(false)
    const arg = lastLut(renderer)
    expect(arg.interp).toBe('tetrahedral')
    expect(arg.lut).not.toBeNull()
    expect(arg.lut.size).toBe(2)
  })

  it('registers the overlay canvas on the preview bus under nodeId', async () => {
    const { canvasEl, wrapper } = setup({ nodeId: 'lut-42' })
    await flushPromises()
    expect(getPreviewSource('lut-42')!()).toBe(canvasEl.value)
    wrapper.unmount()
    expect(getPreviewSource('lut-42')).toBeNull()
  })

  it('caches the parsed LUT by url and refetches on url change', async () => {
    const { params, fetchText, wrapper } = setup()
    await flushPromises()
    expect(fetchText).toHaveBeenCalledTimes(1)
    params.interp = 'nearest'
    await wrapper.vm.$nextTick()
    await flushPromises()
    expect(fetchText).toHaveBeenCalledTimes(1)
    params.lutUrl = '/view?filename=other.cube'
    params.lutFile = 'other.cube'
    await flushPromises()
    expect(fetchText).toHaveBeenCalledTimes(2)
    expect(fetchText).toHaveBeenLastCalledWith('/view?filename=other.cube')
  })

  it('re-renders with the new interp on interp change', async () => {
    const { renderer, params, wrapper } = setup()
    await flushPromises()
    const before = (renderer.renderToCanvas as ReturnType<typeof vi.fn>).mock.calls.length
    params.interp = 'trilinear'
    await wrapper.vm.$nextTick()
    expect((renderer.renderToCanvas as ReturnType<typeof vi.fn>).mock.calls.length)
      .toBeGreaterThan(before)
    expect(lastLut(renderer).interp).toBe('trilinear')
  })

  it('flags non-previewable formats without fetching and keeps supported true', async () => {
    const { api, renderer, fetchText } = setup({
      lutFile: 'grade.csp',
      lutUrl: '/view?filename=grade.csp',
    })
    await flushPromises()
    expect(fetchText).not.toHaveBeenCalled()
    expect(api.supported.value).toBe(true)
    expect(api.lutReady.value).toBe(false)
    expect(api.lutUnsupported.value).toBe(true)
    expect(lastLut(renderer).lut).toBeNull()
  })

  it('flags parse failures as unsupported and renders passthrough', async () => {
    const { api, renderer } = setup({
      fetchText: () => Promise.resolve('not a cube file'),
    })
    await flushPromises()
    expect(api.supported.value).toBe(true)
    expect(api.lutReady.value).toBe(false)
    expect(api.lutUnsupported.value).toBe(true)
    expect(lastLut(renderer).lut).toBeNull()
  })

  it('treats fetch failures as not-ready without the format hint', async () => {
    const { api } = setup({ fetchText: () => Promise.reject(new Error('offline')) })
    await flushPromises()
    expect(api.lutReady.value).toBe(false)
    expect(api.lutUnsupported.value).toBe(false)
  })

  it('clears the LUT when no file is selected', async () => {
    const { api, fetchText } = setup({ lutFile: '', lutUrl: '' })
    await flushPromises()
    expect(fetchText).not.toHaveBeenCalled()
    expect(api.lutReady.value).toBe(false)
    expect(api.lutUnsupported.value).toBe(false)
  })

  it('ignores stale fetches after a url change', async () => {
    let resolveFirst!: (text: string) => void
    const first = new Promise<string>((res) => { resolveFirst = res })
    let call = 0
    const { api, params } = setup({
      fetchText: () => (++call === 1 ? first : Promise.resolve(CUBE_TEXT)),
    })
    params.lutUrl = '/view?filename=second.cube'
    params.lutFile = 'second.cube'
    await flushPromises()
    expect(api.lutReady.value).toBe(true)
    resolveFirst('not a cube file')
    await flushPromises()
    expect(api.lutReady.value).toBe(true)
    expect(api.lutUnsupported.value).toBe(false)
  })

  it('flips supported off and stops when the renderer fails', async () => {
    const { api, renderer } = setup({ renderer: makeRenderer(false) })
    await flushPromises()
    expect(api.supported.value).toBe(false)
    const calls = (renderer.renderToCanvas as ReturnType<typeof vi.fn>).mock.calls.length
    api.renderOnce()
    expect((renderer.renderToCanvas as ReturnType<typeof vi.fn>).mock.calls.length)
      .toBe(calls)
  })

  it('renders single frames on seeked and pause, loops on play', async () => {
    let rafCb: FrameRequestCallback | null = null
    vi.spyOn(window, 'requestAnimationFrame')
      .mockImplementation((fn: FrameRequestCallback) => { rafCb = fn; return 7 })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    const { renderer, videoEl } = setup()
    await flushPromises()
    const count = () =>
      (renderer.renderToCanvas as ReturnType<typeof vi.fn>).mock.calls.length
    const before = count()
    videoEl.value!.dispatchEvent(new Event('seeked'))
    expect(count()).toBe(before + 1)
    videoEl.value!.dispatchEvent(new Event('play'))
    const cb = rafCb as FrameRequestCallback | null
    cb?.(0)
    expect(count()).toBe(before + 2)
    videoEl.value!.dispatchEvent(new Event('pause'))
    expect(count()).toBe(before + 3)
  })

  it('disposes the renderer and detaches listeners on unmount', async () => {
    const { renderer, videoEl, wrapper } = setup()
    await flushPromises()
    const count = () =>
      (renderer.renderToCanvas as ReturnType<typeof vi.fn>).mock.calls.length
    wrapper.unmount()
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    const after = count()
    videoEl.value!.dispatchEvent(new Event('seeked'))
    expect(count()).toBe(after)
  })
})
