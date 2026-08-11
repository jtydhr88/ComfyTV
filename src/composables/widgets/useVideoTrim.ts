import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { useMediaTrim, waitEvent, type TrimRange } from './useMediaTrim'

export { formatTime, MIN_TRIM_GAP, type TrimRange } from './useMediaTrim'

export const THUMB_COUNT = 8
const THUMB_WIDTH = 96

export function useVideoTrim(opts: {
  videoEl: Ref<HTMLVideoElement | null>
  trackEl: Ref<HTMLElement | null>
  sourceVideoUrl: Ref<string | null>
  modelValue: Ref<TrimRange>
}) {
  const core = useMediaTrim({
    mediaEl: opts.videoEl,
    trackEl: opts.trackEl,
    sourceUrl: opts.sourceVideoUrl,
    modelValue: opts.modelValue,
  })

  const thumbnails = ref<string[]>([])
  let filmstripSeq = 0

  async function buildFilmstrip(url: string) {
    const mySeq = ++filmstripSeq
    thumbnails.value = []
    const v = document.createElement('video')
    v.muted = true
    v.preload = 'auto'
    v.src = url
    try {
      await waitEvent(v, 'loadeddata')
      if (mySeq !== filmstripSeq) return
      const d = v.duration
      if (!Number.isFinite(d) || d <= 0 || !v.videoWidth) return
      const w = THUMB_WIDTH
      const h = Math.max(1, Math.round((w * v.videoHeight) / v.videoWidth))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const out: string[] = []
      for (let i = 0; i < THUMB_COUNT; i++) {
        v.currentTime = ((i + 0.5) / THUMB_COUNT) * d
        await waitEvent(v, 'seeked')
        if (mySeq !== filmstripSeq) return
        ctx.drawImage(v, 0, 0, w, h)
        out.push(canvas.toDataURL('image/jpeg', 0.6))
        thumbnails.value = [...out]
      }
    } catch (err) {
      console.warn('[ComfyTV/videoTrim] filmstrip generation failed', err)
    } finally {
      v.removeAttribute('src')
      v.load()
    }
  }

  watch(opts.sourceVideoUrl, (url) => {
    if (url) void buildFilmstrip(url)
    else { filmstripSeq++; thumbnails.value = [] }
  }, { immediate: true })

  onBeforeUnmount(() => {
    filmstripSeq++
  })

  return {
    ...core,
    thumbnails,
  }
}
