import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'

export interface TrimRange {
  start: number
  end: number
}

export const MIN_TRIM_GAP = 0.05

export const THUMB_COUNT = 8
const THUMB_WIDTH = 96
const SEEK_TIMEOUT_MS = 4000

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  const whole = Math.floor(s)
  const tenth = Math.floor((s - whole) * 10)
  return `${m}:${String(whole).padStart(2, '0')}.${tenth}`
}

function roundS(v: number): number {
  return Math.round(v * 100) / 100
}

function waitEvent(el: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error(`timeout waiting for ${event}`))
    }, SEEK_TIMEOUT_MS)
    const onOk = () => { cleanup(); resolve() }
    const onErr = () => { cleanup(); reject(new Error('video error')) }
    function cleanup() {
      window.clearTimeout(timer)
      el.removeEventListener(event, onOk)
      el.removeEventListener('error', onErr)
    }
    el.addEventListener(event, onOk, { once: true })
    el.addEventListener('error', onErr, { once: true })
  })
}

export function useVideoTrim(opts: {
  videoEl: Ref<HTMLVideoElement | null>
  trackEl: Ref<HTMLElement | null>
  sourceVideoUrl: Ref<string | null>
  modelValue: Ref<TrimRange>
}) {
  const { videoEl, trackEl, sourceVideoUrl, modelValue } = opts

  const duration = ref(0)
  const currentTime = ref(0)
  const isLoading = ref(false)
  const loadError = ref(false)
  const previewing = ref(false)


  const selStart = computed(() => {
    const d = duration.value
    return d > 0 ? Math.min(Math.max(0, modelValue.value.start), d) : Math.max(0, modelValue.value.start)
  })

  const selEnd = computed(() => {
    const d = duration.value
    const raw = modelValue.value.end
    if (raw <= 0) return d
    return d > 0 ? Math.min(raw, d) : raw
  })

  const selDuration = computed(() => Math.max(0, selEnd.value - selStart.value))

  function writeRange(start: number, end: number) {
    const d = duration.value
    start = roundS(Math.min(Math.max(0, start), Math.max(0, (d || start) - MIN_TRIM_GAP)))
    end = roundS(Math.max(start + MIN_TRIM_GAP, d > 0 ? Math.min(end, d) : end))
    if (start !== modelValue.value.start || end !== modelValue.value.end) {
      modelValue.value = { start, end }
    }
  }

  function setStart(v: number) { writeRange(v, selEnd.value) }
  function setEnd(v: number)   { writeRange(selStart.value, v) }

  let rafId: number | null = null
  function stopRaf() {
    if (rafId != null) { cancelAnimationFrame(rafId) ; rafId = null }
  }
  function tickPlayhead() {
    const v = videoEl.value
    if (!v) { stopRaf(); return }
    currentTime.value = v.currentTime
    if (previewing.value && v.currentTime >= selEnd.value - 0.02) {
      v.pause()
      previewing.value = false
    }
    if (!v.paused) rafId = requestAnimationFrame(tickPlayhead)
    else rafId = null
  }

  function onLoadedMetadata() {
    const v = videoEl.value
    if (!v) return
    duration.value = v.duration || 0
    isLoading.value = false
    loadError.value = false
    const raw = modelValue.value
    if (raw.end > 0 && duration.value > 0 && raw.end > duration.value + 0.01) {
      writeRange(raw.start, duration.value)
    } else if (raw.start > 0 && duration.value > 0 && raw.start >= duration.value) {
      writeRange(0, raw.end)
    }
  }
  function onTimeUpdate() {
    const v = videoEl.value
    if (v && rafId == null) currentTime.value = v.currentTime
  }
  function onPlay() {
    stopRaf()
    rafId = requestAnimationFrame(tickPlayhead)
  }
  function onPause() {
    previewing.value = false
    stopRaf()
    const v = videoEl.value
    if (v) currentTime.value = v.currentTime
  }
  function onError() {
    isLoading.value = false
    loadError.value = true
  }

  function bindVideo(v: HTMLVideoElement | null, old?: HTMLVideoElement | null) {
    if (old) {
      old.removeEventListener('loadedmetadata', onLoadedMetadata)
      old.removeEventListener('timeupdate', onTimeUpdate)
      old.removeEventListener('play', onPlay)
      old.removeEventListener('pause', onPause)
      old.removeEventListener('error', onError)
    }
    if (v) {
      v.addEventListener('loadedmetadata', onLoadedMetadata)
      v.addEventListener('timeupdate', onTimeUpdate)
      v.addEventListener('play', onPlay)
      v.addEventListener('pause', onPause)
      v.addEventListener('error', onError)
      if (v.readyState >= 1) onLoadedMetadata()
    }
  }
  watch(videoEl, (v, old) => bindVideo(v, old), { immediate: true })

  watch(sourceVideoUrl, (url) => {
    duration.value = 0
    currentTime.value = 0
    previewing.value = false
    loadError.value = false
    isLoading.value = !!url
  }, { immediate: true })

  function seek(t: number) {
    const v = videoEl.value
    if (!v || !Number.isFinite(t)) return
    const d = duration.value
    v.currentTime = d > 0 ? Math.min(Math.max(0, t), d) : Math.max(0, t)
    currentTime.value = v.currentTime
  }

  function playSelection() {
    const v = videoEl.value
    if (!v || duration.value <= 0) return
    if (previewing.value) {
      v.pause()
      return
    }
    if (v.currentTime < selStart.value - 0.02 || v.currentTime >= selEnd.value - 0.05) {
      v.currentTime = selStart.value
    }
    previewing.value = true
    void v.play().catch(() => { previewing.value = false })
  }


  type DragKind = 'start' | 'end' | 'scrub' | null
  const dragging = ref<DragKind>(null)

  function timeFromClientX(clientX: number): number {
    const el = trackEl.value
    const d = duration.value
    if (!el || d <= 0) return 0
    const rect = el.getBoundingClientRect()
    const frac = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
    return Math.min(Math.max(0, frac), 1) * d
  }

  function applyDrag(clientX: number) {
    const t = timeFromClientX(clientX)
    if (dragging.value === 'start') {
      setStart(Math.min(t, selEnd.value - MIN_TRIM_GAP))
      seek(selStart.value)
    } else if (dragging.value === 'end') {
      setEnd(Math.max(t, selStart.value + MIN_TRIM_GAP))
      seek(selEnd.value)
    } else if (dragging.value === 'scrub') {
      seek(t)
    }
  }

  function onDragStart(e: PointerEvent, kind: Exclude<DragKind, null>) {
    if (duration.value <= 0) return
    videoEl.value?.pause()
    dragging.value = kind
    ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
    applyDrag(e.clientX)
  }
  function onDragMove(e: PointerEvent) {
    if (!dragging.value) return
    applyDrag(e.clientX)
  }
  function onDragEnd() {
    dragging.value = null
  }

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

  watch(sourceVideoUrl, (url) => {
    if (url) void buildFilmstrip(url)
    else { filmstripSeq++; thumbnails.value = [] }
  }, { immediate: true })

  onBeforeUnmount(() => {
    filmstripSeq++
    stopRaf()
    bindVideo(null, videoEl.value)
  })

  return {
    duration, currentTime, isLoading, loadError, previewing,
    selStart, selEnd, selDuration,
    setStart, setEnd, seek, playSelection,
    dragging, onDragStart, onDragMove, onDragEnd,
    thumbnails,
  }
}
