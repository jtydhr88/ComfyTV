import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { registerPreviewSource } from '@/composables/stages/previewBus'
import {
  isPreviewableLutFile,
  parseLutText,
  type ParsedLut,
} from '@/composables/stages/videoLutMath'
import type { VideoLutRenderParams } from '@/widgets/glsl/videoLutRenderer'
import { VideoLutRenderer } from '@/widgets/glsl/videoLutRenderer'

export interface VideoLutPreviewParams {
  lutFile: string
  lutUrl: string
  interp: string
}

export interface VideoLutRendererLike {
  renderToCanvas(
    video: HTMLVideoElement,
    params: VideoLutRenderParams,
    target: HTMLCanvasElement,
  ): boolean
  dispose(): void
}

export interface UseVideoLutPreviewOptions {
  videoEl: Ref<HTMLVideoElement | null>
  canvasEl: Ref<HTMLCanvasElement | null>
  nodeId?: string
  params: () => VideoLutPreviewParams
  createRenderer?: () => VideoLutRendererLike
  fetchText?: (url: string) => Promise<string>
}

async function defaultFetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`LUT fetch failed: ${res.status}`)
  return res.text()
}

export function useVideoLutPreview(opts: UseVideoLutPreviewOptions) {
  const supported = ref(true)
  const lutReady = ref(false)
  const lutUnsupported = ref(false)
  const unregister = opts.nodeId != null
    ? registerPreviewSource(opts.nodeId, () => opts.canvasEl.value)
    : null
  const lutCache = new Map<string, ParsedLut | null>()
  let currentLut: ParsedLut | null = null
  let loadToken = 0
  let renderer: VideoLutRendererLike | null = null
  let rafId = 0
  let attached: HTMLVideoElement | null = null

  function renderOnce(): void {
    if (!supported.value) return
    const v = opts.videoEl.value
    const c = opts.canvasEl.value
    if (!v || !c || v.readyState < 2) return
    renderer ??= (opts.createRenderer ?? (() => new VideoLutRenderer()))()
    const p = opts.params()
    if (!renderer.renderToCanvas(v, { lut: currentLut, interp: p.interp }, c)) {
      supported.value = false
      stopLoop()
    }
  }

  function applyLoaded(lut: ParsedLut | null, file: string): void {
    currentLut = lut
    lutReady.value = lut != null
    lutUnsupported.value = lut == null && !!file
    renderOnce()
  }

  async function loadLut(): Promise<void> {
    const { lutFile, lutUrl } = opts.params()
    const token = ++loadToken
    if (!lutUrl || !lutFile) {
      applyLoaded(null, '')
      return
    }
    if (!isPreviewableLutFile(lutFile)) {
      applyLoaded(null, lutFile)
      return
    }
    if (lutCache.has(lutUrl)) {
      applyLoaded(lutCache.get(lutUrl) ?? null, lutFile)
      return
    }
    let lut: ParsedLut | null = null
    let fetched = false
    try {
      const text = await (opts.fetchText ?? defaultFetchText)(lutUrl)
      fetched = true
      lut = parseLutText(lutFile, text)
    } catch {
    }
    if (token !== loadToken) return
    if (fetched) lutCache.set(lutUrl, lut)
    currentLut = lut
    lutReady.value = lut != null
    lutUnsupported.value = fetched && lut == null
    renderOnce()
  }

  function loop(): void {
    renderOnce()
    if (supported.value) rafId = requestAnimationFrame(loop)
  }

  function startLoop(): void {
    stopLoop()
    if (!supported.value) return
    rafId = requestAnimationFrame(loop)
  }

  function stopLoop(): void {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  const onPlay = (): void => startLoop()
  const onStop = (): void => {
    stopLoop()
    renderOnce()
  }
  const onFrame = (): void => renderOnce()

  function detach(): void {
    if (!attached) return
    attached.removeEventListener('play', onPlay)
    attached.removeEventListener('pause', onStop)
    attached.removeEventListener('ended', onStop)
    attached.removeEventListener('seeked', onFrame)
    attached.removeEventListener('loadeddata', onFrame)
    attached = null
  }

  watch(opts.videoEl, (v) => {
    detach()
    stopLoop()
    if (!v) return
    attached = v
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onStop)
    v.addEventListener('ended', onStop)
    v.addEventListener('seeked', onFrame)
    v.addEventListener('loadeddata', onFrame)
    if (v.paused) renderOnce()
    else startLoop()
  }, { immediate: true })

  watch(
    () => {
      const p = opts.params()
      return [p.lutFile, p.lutUrl] as const
    },
    () => { void loadLut() },
    { immediate: true },
  )

  watch(() => opts.params().interp, () => renderOnce())

  onBeforeUnmount(() => {
    unregister?.()
    detach()
    stopLoop()
    renderer?.dispose()
    renderer = null
  })

  return { supported, lutReady, lutUnsupported, renderOnce, startLoop, stopLoop }
}
