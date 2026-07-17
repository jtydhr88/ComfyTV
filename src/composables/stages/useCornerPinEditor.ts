import { computed, nextTick, ref, watch, type Ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import {
  mediaToBox,
  useVideoViewport,
  type Pt,
} from '@/composables/widgets/useVideoViewport'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'

export const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL']
export const CORNER_HIT_PX = 24

export function defaultCorners(vw: number, vh: number): Pt[] {
  return [[0, 0], [vw, 0], [vw, vh], [0, vh]]
}

export function parseCorners(raw: string, vw: number, vh: number): Pt[] {
  try {
    const p = JSON.parse(raw || 'null')
    if (Array.isArray(p) && p.length === 4) return p as Pt[]
  } catch {  }
  if (!vw) return []
  return defaultCorners(vw, vh)
}

export function serializeCorners(pts: Pt[]): string {
  return JSON.stringify(pts.map(([x, y]) =>
    [Math.round(x * 10) / 10, Math.round(y * 10) / 10]))
}

export function nearestCornerIndex(pts: Pt[], [px, py]: Pt, scale: number): number {
  let best = -1
  let bestD = CORNER_HIT_PX / scale
  pts.forEach(([x, y], i) => {
    const d = Math.hypot(x - px, y - py)
    if (d < bestD) { bestD = d; best = i }
  })
  return best
}

export function useCornerPinEditor(opts: {
  node: LGraphNode
  videoEl: Ref<HTMLVideoElement | null>
  overlayEl: Ref<HTMLCanvasElement | null>
}) {
  const { node, videoEl, overlayEl } = opts

  const cornersRaw = useStrWidget(node, 'corners', '')
  const viewport = useVideoViewport({ videoEl, overlayEl })
  const { vw, vh } = viewport
  const dragIdx = ref(-1)

  const corners = computed<Pt[]>({
    get: () => parseCorners(cornersRaw.value, vw.value, vh.value),
    set: (v: Pt[]) => {
      cornersRaw.value = serializeCorners(v)
    },
  })

  function draw(): void {
    const ctx = viewport.syncCanvasSize()
    if (!ctx) return
    const pts = corners.value
    if (pts.length !== 4) return
    const f = viewport.fit()
    const disp = pts.map(([x, y]) => mediaToBox(x, y, f))
    ctx.strokeStyle = '#4fc3f7'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    disp.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    ctx.closePath()
    ctx.stroke()
    disp.forEach(([x, y], i) => {
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fillStyle = i === dragIdx.value ? '#ffb74d' : '#4fc3f7'
      ctx.fill()
      ctx.strokeStyle = '#000'
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = '9px monospace'
      ctx.fillText(CORNER_LABELS[i], x + 8, y - 6)
    })
  }

  function onMeta(): void {
    viewport.onLoadedMetadata()
    if (!cornersRaw.value) corners.value = defaultCorners(vw.value, vh.value)
    void nextTick(draw)
  }

  function onDown(e: PointerEvent): void {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragIdx.value = nearestCornerIndex(
      corners.value,
      viewport.toVideo(e),
      viewport.fit().scale,
    )
    draw()
  }

  function onMovePtr(e: PointerEvent): void {
    if (dragIdx.value < 0) return
    e.stopPropagation()
    const pts = corners.value.slice()
    pts[dragIdx.value] = viewport.toVideo(e)
    corners.value = pts
  }

  function onUp(e: PointerEvent): void {
    dragIdx.value = -1
    e.stopPropagation()
    draw()
  }

  function resetCorners(): void {
    if (vw.value) corners.value = defaultCorners(vw.value, vh.value)
  }

  watch([corners, vw], () => nextTick(draw), { deep: true })

  return {
    corners,
    dragIdx,
    draw,
    onMeta,
    onDown,
    onMovePtr,
    onUp,
    resetCorners,
    togglePlay: viewport.togglePlay,
  }
}
