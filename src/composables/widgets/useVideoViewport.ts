import { ref, type Ref } from 'vue'

export type Pt = [number, number]

export interface FitMetrics {
  scale: number
  offX: number
  offY: number
}

export function computeFit(
  boxW: number,
  boxH: number,
  mediaW: number,
  mediaH: number,
): FitMetrics {
  if (!boxW || !boxH || !mediaW || !mediaH) return { scale: 1, offX: 0, offY: 0 }
  const scale = Math.min(boxW / mediaW, boxH / mediaH)
  return {
    scale,
    offX: (boxW - mediaW * scale) / 2,
    offY: (boxH - mediaH * scale) / 2,
  }
}

export function clientToMedia(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  fit: FitMetrics,
  mediaW: number,
  mediaH: number,
): Pt {
  return [
    Math.min(mediaW, Math.max(0, (clientX - rect.left - fit.offX) / fit.scale)),
    Math.min(mediaH, Math.max(0, (clientY - rect.top - fit.offY) / fit.scale)),
  ]
}

export function mediaToBox(x: number, y: number, fit: FitMetrics): Pt {
  return [x * fit.scale + fit.offX, y * fit.scale + fit.offY]
}

export function useVideoViewport(opts: {
  videoEl: Ref<HTMLVideoElement | null>
  overlayEl: Ref<HTMLCanvasElement | null>
}) {
  const { videoEl, overlayEl } = opts

  const vw = ref(0)
  const vh = ref(0)
  const duration = ref(0)
  const currentTime = ref(0)

  function onLoadedMetadata(): void {
    const v = videoEl.value
    if (!v) return
    vw.value = v.videoWidth
    vh.value = v.videoHeight
    duration.value = Number.isFinite(v.duration) ? v.duration : 0
  }

  function onTimeUpdate(): void {
    currentTime.value = videoEl.value?.currentTime ?? 0
  }

  function fit(): FitMetrics {
    const box = overlayEl.value
    if (!box) return { scale: 1, offX: 0, offY: 0 }
    return computeFit(box.clientWidth, box.clientHeight, vw.value, vh.value)
  }

  function toVideo(e: PointerEvent): Pt {
    const box = overlayEl.value
    if (!box) return [0, 0]
    return clientToMedia(
      e.clientX,
      e.clientY,
      box.getBoundingClientRect(),
      fit(),
      vw.value,
      vh.value,
    )
  }

  function syncCanvasSize(): CanvasRenderingContext2D | null {
    const c = overlayEl.value
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return null
    if (c.width !== c.clientWidth || c.height !== c.clientHeight) {
      c.width = c.clientWidth
      c.height = c.clientHeight
    }
    ctx.clearRect(0, 0, c.width, c.height)
    return ctx
  }

  function togglePlay(): void {
    const v = videoEl.value
    if (!v) return
    if (v.paused) void v.play()
    else v.pause()
  }

  return {
    vw,
    vh,
    duration,
    currentTime,
    onLoadedMetadata,
    onTimeUpdate,
    fit,
    toVideo,
    syncCanvasSize,
    togglePlay,
  }
}
