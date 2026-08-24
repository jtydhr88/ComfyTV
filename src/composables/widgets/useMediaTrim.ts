import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { DEFAULT_VIDEO_FPS } from '@/utils/videoMetadataUtil'

export interface TrimRange {
  start: number
  end: number
}

export const MIN_TRIM_GAP = 0.05

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

export function waitEvent(el: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error(`timeout waiting for ${event}`))
    }, SEEK_TIMEOUT_MS)
    const onOk = () => { cleanup(); resolve() }
    const onErr = () => { cleanup(); reject(new Error('media error')) }
    function cleanup() {
      window.clearTimeout(timer)
      el.removeEventListener(event, onOk)
      el.removeEventListener('error', onErr)
    }
    el.addEventListener(event, onOk, { once: true })
    el.addEventListener('error', onErr, { once: true })
  })
}

export function useMediaTrim(opts: {
  mediaEl: Ref<HTMLMediaElement | null>
  trackEl: Ref<HTMLElement | null>
  sourceUrl: Ref<string | null>
  modelValue: Ref<TrimRange>
}) {
  const { mediaEl, trackEl, sourceUrl, modelValue } = opts

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
    const v = mediaEl.value
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
    const v = mediaEl.value
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
    const v = mediaEl.value
    if (v && rafId == null) currentTime.value = v.currentTime
  }
  function onPlay() {
    stopRaf()
    rafId = requestAnimationFrame(tickPlayhead)
  }
  function onPause() {
    previewing.value = false
    stopRaf()
    const v = mediaEl.value
    if (v) currentTime.value = v.currentTime
  }
  function onError() {
    isLoading.value = false
    loadError.value = true
  }

  function bindMedia(v: HTMLMediaElement | null, old?: HTMLMediaElement | null) {
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
  watch(mediaEl, (v, old) => bindMedia(v, old), { immediate: true })

  watch(sourceUrl, () => {
    duration.value = 0
    currentTime.value = 0
    previewing.value = false
    loadError.value = false
    isLoading.value = !!sourceUrl.value
  }, { immediate: true })

  function seek(t: number) {
    const v = mediaEl.value
    if (!v || !Number.isFinite(t)) return
    const d = duration.value
    v.currentTime = d > 0 ? Math.min(Math.max(0, t), d) : Math.max(0, t)
    currentTime.value = v.currentTime
  }

  function playSelection() {
    const v = mediaEl.value
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
  const keyTarget = ref<Exclude<DragKind, null>>('scrub')
  const stepSize = ref(1 / DEFAULT_VIDEO_FPS)

  function timeFromClientX(clientX: number): number {
    const el = trackEl.value
    const d = duration.value
    if (!el || d <= 0) return 0
    const rect = el.getBoundingClientRect()
    const frac = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
    return Math.min(Math.max(0, frac), 1) * d
  }

  function applyAt(t: number, kind: Exclude<DragKind, null>) {
    if (kind === 'start') {
      setStart(Math.min(t, selEnd.value - MIN_TRIM_GAP))
      seek(selStart.value)
    } else if (kind === 'end') {
      setEnd(Math.max(t, selStart.value + MIN_TRIM_GAP))
      seek(selEnd.value)
    } else {
      seek(t)
    }
  }

  function applyDrag(clientX: number) {
    if (!dragging.value) return
    applyAt(timeFromClientX(clientX), dragging.value)
  }

  function onDragStart(e: PointerEvent, kind: Exclude<DragKind, null>) {
    if (duration.value <= 0) return
    mediaEl.value?.pause()
    dragging.value = kind
    keyTarget.value = kind
    ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
    trackEl.value?.focus?.({ preventScroll: true })
    applyDrag(e.clientX)
  }
  function onDragMove(e: PointerEvent) {
    if (!dragging.value) return
    applyDrag(e.clientX)
  }
  function onDragEnd() {
    dragging.value = null
  }

  function nudge(dir: -1 | 1) {
    if (duration.value <= 0) return
    mediaEl.value?.pause()
    const step = stepSize.value
    const kind = keyTarget.value
    const base = kind === 'start' ? selStart.value
      : kind === 'end' ? selEnd.value
      : currentTime.value
    applyAt((Math.round(base / step) + dir) * step, kind)
  }

  function onTrackKeydown(e: KeyboardEvent) {
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1
      : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1
      : 0
    const jump = e.key === 'Home' ? selStart.value
      : e.key === 'End' ? selEnd.value
      : null
    if (dir === 0 && jump === null) return
    e.preventDefault()
    e.stopPropagation()
    if (dir !== 0) {
      nudge(dir)
    } else if (jump !== null && duration.value > 0) {
      mediaEl.value?.pause()
      seek(jump)
    }
  }

  onBeforeUnmount(() => {
    stopRaf()
    bindMedia(null, mediaEl.value)
  })

  return {
    duration, currentTime, isLoading, loadError, previewing,
    selStart, selEnd, selDuration,
    setStart, setEnd, seek, playSelection,
    dragging, onDragStart, onDragMove, onDragEnd,
    keyTarget, stepSize, nudge, onTrackKeydown,
  }
}
