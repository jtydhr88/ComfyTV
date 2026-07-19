import { reactive, watch } from 'vue'

import { fxClipPreview } from '@/api'

export interface FxClipPreviewState {
  loading: boolean
  url: string | null
  error: string | null
  stale: boolean
  t0: number
  t1: number
}

export interface FxClipPreviewOptions {
  nodeId: string
  getParams: () => Record<string, unknown>
  getVideo: () => string | null
  getPlayhead: () => number
  window?: number
}

export function useFxClipPreview(options: FxClipPreviewOptions) {
  const state = reactive<FxClipPreviewState>({
    loading: false,
    url: null,
    error: null,
    stale: false,
    t0: 0,
    t1: 0,
  })
  let resultParams: string | null = null

  watch(() => JSON.stringify(options.getParams()), (serialized) => {
    if (resultParams !== null) state.stale = serialized !== resultParams
  })

  async function request(): Promise<void> {
    const video = options.getVideo()
    if (!video || state.loading) return
    const params = options.getParams()
    const serialized = JSON.stringify(params)
    state.loading = true
    state.error = null
    try {
      const res = await fxClipPreview(
        options.nodeId, params, video, options.getPlayhead(), options.window)
      state.url = res.url
      state.t0 = res.t0
      state.t1 = res.t1
      resultParams = serialized
      state.stale = JSON.stringify(options.getParams()) !== serialized
    } catch (e) {
      state.error = e instanceof Error ? e.message : String(e)
    } finally {
      state.loading = false
    }
  }

  return { state, request }
}
