import { computed, ref, watch, type Ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import {
  clientToMedia,
  mediaToBox,
  useVideoViewport,
  type FitMetrics,
} from '@/composables/widgets/useVideoViewport'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

export interface TrackPoint {
  x: number
  y: number
}

export const TRACK_HIT_PX = 12

export function parseTrackPoints(raw: string): TrackPoint[] {
  try {
    const p = JSON.parse(raw || '[]')
    if (Array.isArray(p)) {
      return p
        .map((q) => ({ x: Number(q?.x), y: Number(q?.y) }))
        .filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y))
    }
  } catch {}
  return []
}

export function hitTrackPointIndex(
  points: TrackPoint[],
  offsetX: number,
  offsetY: number,
  fit: FitMetrics,
): number {
  for (let i = 0; i < points.length; i++) {
    const [dx, dy] = mediaToBox(points[i].x, points[i].y, fit)
    if (Math.hypot(dx - offsetX, dy - offsetY) <= TRACK_HIT_PX) return i
  }
  return -1
}

export function solveHintFor(solve: string): string {
  if (solve === 'perspective') return 'Needs 4+ points · feeds Corner Pin'
  if (solve === 'similarity') return 'Needs 2+ points · feeds Transform/Composite'
  return ''
}

export function useMotionTrackEditor(opts: {
  node: LGraphNode
  videoEl: Ref<HTMLVideoElement | null>
  overlayEl: Ref<HTMLCanvasElement | null>
}) {
  const { node, videoEl, overlayEl } = opts

  const pointsRaw = useStrWidget(node, 'points', '')
  const solve = useStrWidget(node, 'solve', 'none')
  const pointX = useNumWidget(node, 'point_x', 0)
  const pointY = useNumWidget(node, 'point_y', 0)
  const pattern = useNumWidget(node, 'pattern', 16)
  const search = useNumWidget(node, 'search', 32)
  const viewport = useVideoViewport({ videoEl, overlayEl })
  const { vw, vh } = viewport

  const points = computed<TrackPoint[]>({
    get: () => parseTrackPoints(pointsRaw.value),
    set: (pts: TrackPoint[]) => {
      pointsRaw.value = pts.length ? JSON.stringify(pts) : ''
      pointX.value = pts.length ? pts[0].x : 0
      pointY.value = pts.length ? pts[0].y : 0
    },
  })

  const solveHint = computed(() => solveHintFor(solve.value))

  function onMeta(): void {
    viewport.onLoadedMetadata()
    redraw()
  }

  function onVideoClick(e: MouseEvent): void {
    if (!vw.value || !vh.value) return
    const f = viewport.fit()
    if (hitTrackPointIndex(points.value, e.offsetX, e.offsetY, f) >= 0) return
    const [mx, my] = clientToMedia(
      e.offsetX, e.offsetY, { left: 0, top: 0 }, f, vw.value, vh.value,
    )
    points.value = [...points.value, { x: Math.round(mx), y: Math.round(my) }]
  }

  function onVideoDblClick(e: MouseEvent): void {
    if (!vw.value || !vh.value) return
    const idx = hitTrackPointIndex(points.value, e.offsetX, e.offsetY, viewport.fit())
    if (idx < 0) return
    const next = points.value.slice()
    next.splice(idx, 1)
    points.value = next
  }

  function clearPoints(): void {
    points.value = []
  }

  function redraw(): void {
    const ctx = viewport.syncCanvasSize()
    if (!ctx || !vw.value || !vh.value) return
    const f = viewport.fit()

    points.value.forEach((p, i) => {
      const [dx, dy] = mediaToBox(p.x, p.y, f)

      ctx.strokeStyle = '#4ade80'
      ctx.lineWidth = 1
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(dx - 8, dy)
      ctx.lineTo(dx + 8, dy)
      ctx.moveTo(dx, dy - 8)
      ctx.lineTo(dx, dy + 8)
      ctx.stroke()

      const pHalf = pattern.value * f.scale
      ctx.strokeRect(dx - pHalf, dy - pHalf, pHalf * 2, pHalf * 2)

      ctx.fillStyle = '#4ade80'
      ctx.font = '10px monospace'
      ctx.fillText(String(i + 1), dx + 5, dy - 5)

      if (i === 0) {
        const sHalf = search.value * f.scale
        ctx.strokeStyle = '#facc15'
        ctx.setLineDash([4, 3])
        ctx.strokeRect(dx - sHalf, dy - sHalf, sHalf * 2, sHalf * 2)
        ctx.setLineDash([])
      }
    })
  }

  watch([pointsRaw, pattern, search], redraw)

  return {
    duration: viewport.duration,
    points,
    solve,
    solveHint,
    pattern,
    search,
    redraw,
    onMeta,
    onVideoClick,
    onVideoDblClick,
    clearPoints,
  }
}
