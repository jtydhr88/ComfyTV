import { nextTick, ref, watch, type Ref } from 'vue'
import { useVideoViewport } from '@/composables/widgets/useVideoViewport'

export interface OverlayDragStart {
  px: number
  py: number
  x0: number
  y0: number
}

export function dragToPos(
  start: OverlayDragStart,
  clientX: number,
  clientY: number,
  scale: number,
): [number, number] {
  return [
    Math.round(start.x0 + (clientX - start.px) / scale),
    Math.round(start.y0 - (clientY - start.py) / scale),
  ]
}

export function wheelScale(current: number, deltaY: number): number {
  return Math.min(
    4,
    Math.max(
      0.05,
      Math.round(current * (deltaY > 0 ? 0.95 : 1.05) * 100) / 100,
    ),
  )
}

export function useCompositeOverlay(opts: {
  videoEl: Ref<HTMLVideoElement | null>
  overlayEl: Ref<HTMLCanvasElement | null>
  posX: Ref<number>
  posY: Ref<number>
  scale: Ref<number>
  rotation: Ref<number>
}) {
  const { videoEl, overlayEl, posX, posY, scale, rotation } = opts
  const vp = useVideoViewport({ videoEl, overlayEl })
  const { vw, vh, duration, currentTime } = vp

  const dragging = ref(false)
  let dragStart: OverlayDragStart | null = null

  function draw(): void {
    const ctx = vp.syncCanvasSize()
    if (!ctx || !vw.value) return
    const { scale: s, offX, offY } = vp.fit()
    const cx = (vw.value / 2 + posX.value) * s + offX
    const cy = (vh.value / 2 - posY.value) * s + offY
    const hw = (vw.value * scale.value * s) / 2
    const hh = (vh.value * scale.value * s) / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((-rotation.value * Math.PI) / 180)
    ctx.strokeStyle = '#ffb74d'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 4])
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2)
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(0, 0, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffb74d'
    ctx.fill()
    ctx.restore()
  }

  function onMeta(): void {
    vp.onLoadedMetadata()
    void nextTick(draw)
  }

  function onTime(): void {
    vp.onTimeUpdate()
  }

  function onDown(e: PointerEvent): void {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.value = true
    dragStart = { px: e.clientX, py: e.clientY, x0: posX.value, y0: posY.value }
  }

  function onMovePtr(e: PointerEvent): void {
    if (!dragging.value || !dragStart) return
    e.stopPropagation()
    const { scale: s } = vp.fit()
    const [x, y] = dragToPos(dragStart, e.clientX, e.clientY, s)
    posX.value = x
    posY.value = y
  }

  function onUp(e: PointerEvent): void {
    dragging.value = false
    dragStart = null
    e.stopPropagation()
  }

  function onWheel(e: WheelEvent): void {
    scale.value = wheelScale(scale.value, e.deltaY)
  }

  watch([posX, posY, scale, rotation, vw], () => nextTick(draw))

  return {
    vw,
    vh,
    duration,
    currentTime,
    dragging,
    draw,
    onMeta,
    onTime,
    onDown,
    onMovePtr,
    onUp,
    onWheel,
  }
}
