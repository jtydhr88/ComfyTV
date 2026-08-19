import { computed, ref, watch, type Ref } from 'vue'

import {
  CLIP_GAP_PX,
  clipWidthPxOf,
  type DirectorClip,
  type DirectorClipStatus,
} from './useDirectorTimeline'

export interface TimelineSegment {
  id: string
  trackIndex: number
  startS: number
  durationS: number
  startPx: number
  widthPx: number
  url: string
}

export interface RulerTick {
  px: number
  label: string
  major: boolean
}

export function buildSegments(
  clips: DirectorClip[],
  statuses: Map<string, DirectorClipStatus>,
): TimelineSegment[] {
  const out: TimelineSegment[] = []
  let px = 0
  let t = 0
  clips.forEach((c, i) => {
    const w = clipWidthPxOf(c)
    if (c.enabled) {
      out.push({
        id: c.id,
        trackIndex: i,
        startS: t,
        durationS: c.duration_s,
        startPx: px,
        widthPx: w,
        url: statuses.get(c.id)?.url ?? '',
      })
      t += c.duration_s
    }
    px += w + CLIP_GAP_PX
  })
  return out
}

export function totalDurationS(segments: TimelineSegment[]): number {
  const last = segments[segments.length - 1]
  return last ? last.startS + last.durationS : 0
}

export function timeToPx(segments: TimelineSegment[], t: number): number {
  if (!segments.length) return 0
  for (const s of segments) {
    if (t < s.startS) return s.startPx
    if (t < s.startS + s.durationS) {
      return s.startPx + ((t - s.startS) / s.durationS) * s.widthPx
    }
  }
  const last = segments[segments.length - 1]
  return last.startPx + last.widthPx
}

export function pxToTime(segments: TimelineSegment[], x: number): number {
  if (!segments.length) return 0
  for (const s of segments) {
    if (x < s.startPx) return s.startS
    if (x < s.startPx + s.widthPx) {
      return s.startS + ((x - s.startPx) / s.widthPx) * s.durationS
    }
  }
  return totalDurationS(segments)
}

export function rulerTicks(segments: TimelineSegment[]): RulerTick[] {
  const out: RulerTick[] = []
  for (const s of segments) {
    out.push({ px: s.startPx, label: `${Math.round(s.startS)}s`, major: true })
    const step = Math.max(1, Math.ceil(s.durationS / 30))
    const pps = s.widthPx / s.durationS
    for (let k = step; k < s.durationS; k += step) {
      out.push({ px: s.startPx + k * pps, label: '', major: false })
    }
  }
  const last = segments[segments.length - 1]
  if (last) {
    out.push({
      px: last.startPx + last.widthPx,
      label: `${Math.round(totalDurationS(segments))}s`,
      major: true,
    })
  }
  return out
}

export function useDirectorPlayback(opts: {
  clips: Ref<DirectorClip[]>
  statuses: () => Map<string, DirectorClipStatus>
  filmUrl: () => string
  video: () => HTMLVideoElement | null
}) {
  const active = ref(false)
  const playing = ref(false)
  const wantPlay = ref(false)
  const playheadS = ref(0)
  const segIdx = ref(-1)
  const pendingFrac = ref<number | null>(null)

  const segments = computed(() => buildSegments(opts.clips.value, opts.statuses()))
  const totalS = computed(() => totalDurationS(segments.value))
  const ticks = computed(() => rulerTicks(segments.value))
  const playable = computed(() => segments.value.filter(s => s.url))
  const film = computed(() => (opts.filmUrl() ?? '').trim())
  const mode = computed<'film' | 'clips'>(() => (film.value ? 'film' : 'clips'))
  const canPlay = computed(() => !!film.value || playable.value.length > 0)
  const playheadPx = computed(() => timeToPx(segments.value, playheadS.value))
  const currentSrc = computed(() =>
    mode.value === 'film' ? film.value : playable.value[segIdx.value]?.url ?? '',
  )

  watch(playable, (list) => {
    if (segIdx.value >= list.length) segIdx.value = list.length - 1
  })

  function video(): HTMLVideoElement | null {
    return opts.video()
  }

  function open() {
    if (!canPlay.value) return
    active.value = true
    if (mode.value === 'clips' && segIdx.value < 0) segIdx.value = 0
  }

  function close() {
    wantPlay.value = false
    video()?.pause?.()
    active.value = false
    playing.value = false
    playheadS.value = 0
    segIdx.value = -1
    pendingFrac.value = null
  }

  function seekVideoFrac(frac: number) {
    const el = video()
    if (!el) {
      pendingFrac.value = frac
      return
    }
    const d = el.duration
    if (Number.isFinite(d) && d > 0) el.currentTime = frac * d
    else pendingFrac.value = frac
  }

  function seekTo(t: number) {
    const total = totalS.value
    if (total <= 0 || !canPlay.value) return
    t = Math.max(0, Math.min(total, t))
    if (!active.value) open()
    if (mode.value === 'film') {
      playheadS.value = t
      seekVideoFrac(t / total)
      return
    }
    let target = -1
    for (let i = 0; i < playable.value.length; i++) {
      const s = playable.value[i]
      if (t < s.startS + s.durationS) {
        target = i
        break
      }
    }
    if (target < 0) target = playable.value.length - 1
    if (target < 0) return
    const s = playable.value[target]
    const frac = Math.max(0, Math.min(1, (t - s.startS) / s.durationS))
    playheadS.value = Math.max(s.startS, Math.min(t, s.startS + s.durationS))
    if (segIdx.value !== target) {
      segIdx.value = target
      pendingFrac.value = frac
    } else {
      seekVideoFrac(frac)
    }
  }

  function play() {
    if (!canPlay.value) return
    if (!active.value) open()
    if (totalS.value > 0 && playheadS.value >= totalS.value - 0.05) seekTo(0)
    wantPlay.value = true
    void video()?.play?.()
  }

  function pause() {
    wantPlay.value = false
    video()?.pause?.()
  }

  function togglePlay() {
    if (playing.value) pause()
    else play()
  }

  function onLoadedMetadata() {
    const frac = pendingFrac.value
    if (frac != null) {
      pendingFrac.value = null
      seekVideoFrac(frac)
    }
    if (wantPlay.value) void video()?.play?.()
  }

  function onTimeUpdate() {
    const el = video()
    if (!el) return
    const d = el.duration
    if (mode.value === 'film') {
      if (Number.isFinite(d) && d > 0) {
        playheadS.value = (el.currentTime / d) * totalS.value
      }
      return
    }
    const s = playable.value[segIdx.value]
    if (!s) return
    const cd = Number.isFinite(d) && d > 0 ? d : s.durationS
    playheadS.value = s.startS + Math.min(1, el.currentTime / cd) * s.durationS
  }

  function onEnded() {
    if (mode.value === 'clips' && segIdx.value + 1 < playable.value.length) {
      segIdx.value += 1
      playheadS.value = playable.value[segIdx.value].startS
      pendingFrac.value = 0
      return
    }
    wantPlay.value = false
    playheadS.value = totalS.value
  }

  function onPlay() {
    playing.value = true
  }

  function onPause() {
    playing.value = false
  }

  function onRulerPointerDown(e: PointerEvent) {
    if (!canPlay.value) return
    const host = e.currentTarget as HTMLElement | null
    if (!host) return
    const toTime = (ev: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      const scale = host.offsetWidth > 0 && rect.width > 0
        ? rect.width / host.offsetWidth
        : 1
      return pxToTime(segments.value, (ev.clientX - rect.left) / scale)
    }
    seekTo(toTime(e))
    host.setPointerCapture?.(e.pointerId)
    const move = (ev: PointerEvent) => seekTo(toTime(ev))
    const finish = () => {
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerup', finish)
      host.removeEventListener('pointercancel', finish)
      try {
        host.releasePointerCapture?.(e.pointerId)
      } catch {}
    }
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerup', finish)
    host.addEventListener('pointercancel', finish)
  }

  return {
    active,
    playing,
    playheadS,
    playheadPx,
    segments,
    ticks,
    totalS,
    canPlay,
    mode,
    currentSrc,
    open,
    close,
    play,
    pause,
    togglePlay,
    seekTo,
    onRulerPointerDown,
    onLoadedMetadata,
    onTimeUpdate,
    onEnded,
    onPlay,
    onPause,
  }
}
