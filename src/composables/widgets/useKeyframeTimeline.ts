import { ref, type Ref } from 'vue'

export interface TimelineKey {
  t: number
}

export function timeAtPixel(
  clientX: number,
  rect: { left: number; width: number },
  duration: number,
): number {
  if (duration <= 0) return 0
  const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  return Math.round(f * duration * 100) / 100
}

export function findNearIndex(
  keys: TimelineKey[],
  t: number,
  duration: number,
): number {
  return keys.findIndex(
    (k) => duration > 0 && Math.abs(k.t - t) / duration < 0.02,
  )
}

export function keyLeftPercent(t: number, duration: number): number {
  return duration > 0 ? (t / duration) * 100 : 0
}

export function formatT(t: number): string {
  return `${(t ?? 0).toFixed(2)}s`
}

export function useKeyframeTimeline(opts: {
  track: Ref<HTMLElement | null>
  getKeys: () => TimelineKey[]
  getDuration: () => number
  onAdd: (t: number) => void
  onMoveKey: (i: number, t: number) => void
  onSelect: (i: number) => void
}) {
  const { track, getKeys, getDuration, onAdd, onMoveKey, onSelect } = opts

  const dragIdx = ref(-1)

  function timeAt(e: PointerEvent): number {
    const el = track.value
    if (!el) return 0
    return timeAtPixel(e.clientX, el.getBoundingClientRect(), getDuration())
  }

  function onTrackDown(e: PointerEvent): void {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const t = timeAt(e)
    const near = findNearIndex(getKeys(), t, getDuration())
    if (near >= 0) {
      onSelect(near)
      dragIdx.value = near
    } else {
      onAdd(t)
    }
  }

  function onKeyDown(i: number, e: PointerEvent): void {
    track.value?.setPointerCapture(e.pointerId)
    onSelect(i)
    dragIdx.value = i
  }

  function onMove(e: PointerEvent): void {
    if (dragIdx.value < 0) return
    e.stopPropagation()
    onMoveKey(dragIdx.value, timeAt(e))
  }

  function onUp(e: PointerEvent): void {
    dragIdx.value = -1
    e.stopPropagation()
  }

  return { dragIdx, timeAt, onTrackDown, onKeyDown, onMove, onUp }
}
