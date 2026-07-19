import { registerPreviewSource } from '@/composables/stages/previewBus'
import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import {
  clampProgress,
  effectiveTransitionWindow,
  previewTimeline,
  timelineToSeeks,
  type PreviewTimeline,
  type TransitionWindow,
} from '@/composables/stages/videoTransitionMath'
import { VideoTransitionRenderer } from '@/widgets/glsl/videoTransitionRenderer'

export interface VideoTransitionRendererLike {
  renderToCanvas(
    videoA: HTMLVideoElement,
    videoB: HTMLVideoElement,
    transition: string,
    progress: number,
    target: HTMLCanvasElement,
  ): boolean
  dispose(): void
}

export interface VideoTransitionPreviewParams {
  transition: string
  duration: number
  offset: number
}

export interface UseVideoTransitionPreviewOptions {
  videoAEl: Ref<HTMLVideoElement | null>
  videoBEl: Ref<HTMLVideoElement | null>
  canvasEl: Ref<HTMLCanvasElement | null>
  nodeId?: string
  params: () => VideoTransitionPreviewParams
  createRenderer?: () => VideoTransitionRendererLike
  now?: () => number
}

const SEEK_EPS = 0.002
const SCRUB_THROTTLE_MS = 30

export function useVideoTransitionPreview(opts: UseVideoTransitionPreviewOptions) {
  const now = opts.now ?? (() => performance.now())

  const supported = ref(true)
  const unregisterPreview = opts.nodeId != null
    ? registerPreviewSource(opts.nodeId, () => opts.canvasEl.value)
    : null
  const time = ref(0)
  const playing = ref(false)
  const durA = ref(0)
  const durB = ref(0)

  const window = computed<TransitionWindow>(() => {
    const p = opts.params()
    return effectiveTransitionWindow(durA.value, durB.value, p.duration, p.offset)
  })
  const timeline = computed<PreviewTimeline>(() =>
    previewTimeline(window.value.offset, window.value.duration, durA.value, durB.value),
  )
  const progress = computed(() =>
    timelineToSeeks(time.value, window.value, timeline.value).p,
  )
  const ready = computed(() => durA.value > 0 && durB.value > 0)

  let renderer: VideoTransitionRendererLike | null = null
  let attachedA: HTMLVideoElement | null = null
  let attachedB: HTMLVideoElement | null = null
  let pendA = false
  let pendB = false
  let queued: number | null = null
  let lastIssueAt = -Infinity
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let rafId = 0
  let playT0 = 0

  function renderOnce(): void {
    if (!supported.value) return
    const a = opts.videoAEl.value
    const b = opts.videoBEl.value
    const c = opts.canvasEl.value
    if (!a || !b || !c || a.readyState < 2 || b.readyState < 2) return
    renderer ??= (opts.createRenderer ?? (() => new VideoTransitionRenderer()))()
    const ok = renderer.renderToCanvas(
      a, b, opts.params().transition, progress.value, c,
    )
    if (!ok) {
      supported.value = false
      pause()
    }
  }

  function issueSeek(t: number): void {
    if (!supported.value || !ready.value) return
    const a = opts.videoAEl.value
    const b = opts.videoBEl.value
    if (!a || !b) return
    const s = timelineToSeeks(t, window.value, timeline.value)
    lastIssueAt = now()
    const needA = Math.abs(a.currentTime - s.aTime) > SEEK_EPS
    const needB = Math.abs(b.currentTime - s.bTime) > SEEK_EPS
    pendA = s.aActive && needA
    pendB = s.bActive && needB
    if (needA) a.currentTime = s.aTime
    if (needB) b.currentTime = s.bTime
    if (!pendA && !pendB) renderOnce()
  }

  function maybeSettle(): void {
    if (pendA || pendB) return
    renderOnce()
    if (queued != null) {
      const q = queued
      queued = null
      issueSeek(q)
    }
  }

  const onSeekedA = (): void => {
    pendA = false
    maybeSettle()
  }
  const onSeekedB = (): void => {
    pendB = false
    maybeSettle()
  }

  function scheduleFlush(delay: number): void {
    if (flushTimer != null) return
    flushTimer = setTimeout(() => {
      flushTimer = null
      if (queued != null && !pendA && !pendB) {
        const q = queued
        queued = null
        issueSeek(q)
      }
    }, delay)
  }

  function scrub(fraction: number): void {
    const t = clampProgress(fraction) * timeline.value.total
    time.value = t
    if (pendA || pendB) {
      queued = t
      return
    }
    const elapsed = now() - lastIssueAt
    if (elapsed < SCRUB_THROTTLE_MS) {
      queued = t
      scheduleFlush(SCRUB_THROTTLE_MS - elapsed)
      return
    }
    issueSeek(t)
  }

  function tick(): void {
    if (!playing.value) return
    const total = Math.max(0.1, timeline.value.total)
    const elapsed = (now() - playT0) / 1000
    const t = elapsed % total
    time.value = t
    if (!pendA && !pendB) issueSeek(t)
    rafId = requestAnimationFrame(tick)
  }

  function play(): void {
    if (playing.value || !ready.value || !supported.value) return
    playing.value = true
    const total = timeline.value.total
    const start = time.value >= total ? 0 : time.value
    playT0 = now() - start * 1000
    rafId = requestAnimationFrame(tick)
  }

  function pause(): void {
    playing.value = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  function togglePlay(): void {
    if (playing.value) pause()
    else play()
  }

  function readDuration(v: HTMLVideoElement, side: Ref<number>): void {
    const d = v.duration
    side.value = Number.isFinite(d) && d > 0 ? d : 0
  }

  const onMetaA = (): void => {
    if (attachedA) readDuration(attachedA, durA)
    if (ready.value) issueSeek(time.value)
  }
  const onMetaB = (): void => {
    if (attachedB) readDuration(attachedB, durB)
    if (ready.value) issueSeek(time.value)
  }

  function detach(): void {
    if (attachedA) {
      attachedA.removeEventListener('loadedmetadata', onMetaA)
      attachedA.removeEventListener('seeked', onSeekedA)
      attachedA = null
    }
    if (attachedB) {
      attachedB.removeEventListener('loadedmetadata', onMetaB)
      attachedB.removeEventListener('seeked', onSeekedB)
      attachedB = null
    }
    pendA = false
    pendB = false
    queued = null
  }

  watch([opts.videoAEl, opts.videoBEl], ([a, b]) => {
    detach()
    pause()
    durA.value = 0
    durB.value = 0
    if (a) {
      attachedA = a
      a.addEventListener('loadedmetadata', onMetaA)
      a.addEventListener('seeked', onSeekedA)
      if (a.readyState >= 1) readDuration(a, durA)
    }
    if (b) {
      attachedB = b
      b.addEventListener('loadedmetadata', onMetaB)
      b.addEventListener('seeked', onSeekedB)
      if (b.readyState >= 1) readDuration(b, durB)
    }
    if (ready.value) {
      time.value = Math.min(time.value, timeline.value.total)
      issueSeek(time.value)
    }
  }, { immediate: true })

  watch(() => opts.params(), () => {
    if (!ready.value) return
    time.value = Math.min(time.value, timeline.value.total)
    if (pendA || pendB) {
      queued = time.value
      return
    }
    issueSeek(time.value)
  })

  onBeforeUnmount(() => {
    unregisterPreview?.()
    detach()
    pause()
    if (flushTimer != null) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    renderer?.dispose()
    renderer = null
  })

  return {
    supported,
    ready,
    progress,
    time,
    playing,
    window,
    timeline,
    durA,
    durB,
    scrub,
    play,
    pause,
    togglePlay,
    renderOnce,
  }
}
