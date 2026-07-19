import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const fxClipPreview = vi.fn()
vi.mock('@/api', () => ({
  fxClipPreview: (...a: any[]) => fxClipPreview(...a),
}))

import { useFxClipPreview } from './useFxClipPreview'

const RESULT = { url: '/view?filename=p.mp4', t0: 0.9, t1: 2.1 }

function setup(over: Partial<Parameters<typeof useFxClipPreview>[0]> = {}) {
  const params = ref<Record<string, unknown>>({ method: 'atadenoise', strength: 0.3 })
  const video = ref<string | null>('/view?filename=in.mp4')
  const preview = useFxClipPreview({
    nodeId: 'ComfyTV.VideoDenoiseStage',
    getParams: () => params.value,
    getVideo: () => video.value,
    getPlayhead: () => 1.5,
    ...over,
  })
  return { params, video, preview }
}

beforeEach(() => {
  vi.clearAllMocks()
  fxClipPreview.mockResolvedValue(RESULT)
})

describe('useFxClipPreview', () => {
  it('requests with node id, params, video and playhead', async () => {
    const { preview } = setup()
    await preview.request()
    expect(fxClipPreview).toHaveBeenCalledWith(
      'ComfyTV.VideoDenoiseStage',
      { method: 'atadenoise', strength: 0.3 },
      '/view?filename=in.mp4',
      1.5,
      undefined,
    )
    expect(preview.state.url).toBe(RESULT.url)
    expect(preview.state.t0).toBe(0.9)
    expect(preview.state.t1).toBe(2.1)
    expect(preview.state.loading).toBe(false)
    expect(preview.state.stale).toBe(false)
    expect(preview.state.error).toBeNull()
  })

  it('forwards a custom window', async () => {
    const { preview } = setup({ window: 2.5 })
    await preview.request()
    expect(fxClipPreview).toHaveBeenCalledWith(
      expect.any(String), expect.any(Object), expect.any(String), 1.5, 2.5)
  })

  it('does nothing without a video', async () => {
    const { preview, video } = setup()
    video.value = null
    await preview.request()
    expect(fxClipPreview).not.toHaveBeenCalled()
    expect(preview.state.url).toBeNull()
  })

  it('captures errors into state.error', async () => {
    fxClipPreview.mockRejectedValueOnce(new Error('boom'))
    const { preview } = setup()
    await preview.request()
    expect(preview.state.error).toBe('boom')
    expect(preview.state.loading).toBe(false)
    expect(preview.state.url).toBeNull()
  })

  it('marks stale when params change after a result and clears on re-request', async () => {
    const { preview, params } = setup()
    await preview.request()
    expect(preview.state.stale).toBe(false)

    params.value = { method: 'atadenoise', strength: 0.9 }
    await nextTick()
    expect(preview.state.stale).toBe(true)

    await preview.request()
    expect(preview.state.stale).toBe(false)
  })

  it('does not mark stale before the first result', async () => {
    const { preview, params } = setup()
    params.value = { method: 'nlmeans', strength: 0.5 }
    await nextTick()
    expect(preview.state.stale).toBe(false)
  })

  it('ignores overlapping requests while loading', async () => {
    let release!: (v: typeof RESULT) => void
    fxClipPreview.mockImplementationOnce(
      () => new Promise((resolve) => { release = resolve }))
    const { preview } = setup()
    const first = preview.request()
    expect(preview.state.loading).toBe(true)
    await preview.request()
    expect(fxClipPreview).toHaveBeenCalledTimes(1)
    release(RESULT)
    await first
    expect(preview.state.url).toBe(RESULT.url)
  })
})
