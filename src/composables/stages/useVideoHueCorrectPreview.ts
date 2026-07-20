import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { registerPreviewSource } from '@/composables/stages/previewBus'
import type { VideoHueCorrectParams } from '@/composables/stages/videoHueCorrectMath'
import { VideoHueCorrectRenderer } from '@/widgets/glsl/videoHueCorrectRenderer'

export interface VideoHueCorrectRendererLike {
  renderToCanvas(
    video: HTMLVideoElement,
    params: Partial<VideoHueCorrectParams>,
    target: HTMLCanvasElement,
  ): boolean
  dispose(): void
}

export interface UseVideoHueCorrectPreviewOptions {
  videoEl: Ref<HTMLVideoElement | null>
  canvasEl: Ref<HTMLCanvasElement | null>
  nodeId?: string
  params: () => Partial<VideoHueCorrectParams>
  createRenderer?: () => VideoHueCorrectRendererLike
}

export function useVideoHueCorrectPreview(
  opts: UseVideoHueCorrectPreviewOptions,
) {
  const supported = ref(true)
  const unregister = opts.nodeId != null
    ? registerPreviewSource(opts.nodeId, () => opts.canvasEl.value)
    : null
  let renderer: VideoHueCorrectRendererLike | null = null
  let rafId = 0
  let attached: HTMLVideoElement | null = null

  function renderOnce(): void {
    if (!supported.value) return
    const v = opts.videoEl.value
    const c = opts.canvasEl.value
    if (!v || !c || v.readyState < 2) return
    renderer ??= (opts.createRenderer ?? (() => new VideoHueCorrectRenderer()))()
    if (!renderer.renderToCanvas(v, opts.params(), c)) {
      supported.value = false
      stopLoop()
    }
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

  watch(() => opts.params(), () => renderOnce())

  onBeforeUnmount(() => {
    unregister?.()
    detach()
    stopLoop()
    renderer?.dispose()
    renderer = null
  })

  return { supported, renderOnce, startLoop, stopLoop }
}
