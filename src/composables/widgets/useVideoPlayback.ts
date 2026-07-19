import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'

export interface UseVideoPlaybackOptions {
  videoEl: Ref<HTMLVideoElement | null>
  seekEl: Ref<HTMLElement | null>
  sourceVideoUrl: Ref<string | null>
  initialMuted?: boolean
}

export function useVideoPlayback(opts: UseVideoPlaybackOptions) {
  const { videoEl, seekEl, sourceVideoUrl } = opts

  const muted = ref(opts.initialMuted ?? true)
  const playing = ref(false)
  const duration = ref(0)
  const currentTime = ref(0)
  const loadError = ref(false)
  const seeking = ref(false)

  const progressPct = computed(() =>
    duration.value > 0 ? Math.min(100, (currentTime.value / duration.value) * 100) : 0)

  function onLoadedMetadata() {
    const v = videoEl.value
    duration.value = v?.duration || 0
    loadError.value = false
    if (v && v.paused && v.currentTime === 0) {
      try {
        v.currentTime = 0.001
      } catch {
        void 0
      }
    }
  }

  function onTimeUpdate() {
    const v = videoEl.value
    if (v) {
      currentTime.value = v.currentTime
      playing.value = !v.paused
    }
  }

  function onPlay() { playing.value = true }
  function onPause() { playing.value = false }
  function onError() { loadError.value = true }

  watch(sourceVideoUrl, () => {
    duration.value = 0
    currentTime.value = 0
    playing.value = false
    loadError.value = false
  })

  function togglePlay() {
    const v = videoEl.value
    if (!v || duration.value <= 0) return
    if (v.paused) {
      void v.play().then(() => { playing.value = true }).catch(() => {})
    } else {
      v.pause()
      playing.value = false
    }
  }

  function seekFromClientX(clientX: number) {
    const el = seekEl.value
    const v = videoEl.value
    if (!el || !v || duration.value <= 0) return
    const rect = el.getBoundingClientRect()
    const frac = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
    v.currentTime = Math.min(Math.max(0, frac), 1) * duration.value
    currentTime.value = v.currentTime
  }

  function onSeekStart(e: PointerEvent) {
    if (duration.value <= 0) return
    videoEl.value?.pause()
    playing.value = false
    seeking.value = true
    ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
    seekFromClientX(e.clientX)
  }
  function onSeekMove(e: PointerEvent) {
    if (seeking.value) seekFromClientX(e.clientX)
  }
  function onSeekEnd() {
    seeking.value = false
  }

  onBeforeUnmount(() => {
    videoEl.value?.pause()
  })

  return {
    muted, playing, duration, currentTime, loadError, seeking, progressPct,
    onLoadedMetadata, onTimeUpdate, onPlay, onPause, onError,
    togglePlay, seekFromClientX, onSeekStart, onSeekMove, onSeekEnd,
  }
}
