import { nextTick, ref, watch, type Ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { mediaToBox, useVideoViewport } from '@/composables/widgets/useVideoViewport'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'

export interface RotoPt {
  x: number
  y: number
}

export interface RotoShapePoint extends RotoPt {
  lx: number
  ly: number
  rx: number
  ry: number
}

export const ROTO_HIT_PX = 12

export function parseShapeVerts(raw: string): RotoPt[] {
  try {
    const keys = JSON.parse(raw || '[]')
    const pts = keys?.[0]?.points
    if (Array.isArray(pts)) {
      return pts.map((p: { x?: unknown; y?: unknown }) => ({
        x: Number(p?.x),
        y: Number(p?.y),
      }))
    }
  } catch {  }
  return []
}

export function buildShapePoints(verts: RotoPt[], smooth: boolean): RotoShapePoint[] {
  const n = verts.length
  return verts.map((p, i) => {
    if (!smooth) {
      return { x: p.x, y: p.y, lx: p.x, ly: p.y, rx: p.x, ry: p.y }
    }
    const prev = verts[(i - 1 + n) % n]
    const next = verts[(i + 1) % n]
    const tx = (next.x - prev.x) / 6
    const ty = (next.y - prev.y) / 6
    return {
      x: p.x, y: p.y,
      lx: p.x - tx, ly: p.y - ty,
      rx: p.x + tx, ry: p.y + ty,
    }
  })
}

export function serializeShape(verts: RotoPt[], smooth: boolean): string {
  if (verts.length < 3) return ''
  return JSON.stringify([{ t: 0, points: buildShapePoints(verts, smooth) }])
}

export function hitVertexIndex(verts: RotoPt[], p: RotoPt, scale: number): number {
  const r = ROTO_HIT_PX / scale
  return verts.findIndex((v) => Math.hypot(v.x - p.x, v.y - p.y) < r)
}

export function useRotoMaskEditor(opts: {
  node: LGraphNode
  videoEl: Ref<HTMLVideoElement | null>
  overlayEl: Ref<HTMLCanvasElement | null>
}) {
  const { node, videoEl, overlayEl } = opts

  const shapeRaw = useStrWidget(node, 'shape_keys', '')
  const smooth = ref(true)
  const viewport = useVideoViewport({ videoEl, overlayEl })
  const dragIdx = ref(-1)
  const verts = ref<RotoPt[]>(parseShapeVerts(shapeRaw.value))

  function saveToWidget(): void {
    shapeRaw.value = serializeShape(verts.value, smooth.value)
  }

  function toVert(e: MouseEvent): RotoPt {
    const [x, y] = viewport.toVideo(e as PointerEvent)
    return { x, y }
  }

  function draw(): void {
    const ctx = viewport.syncCanvasSize()
    if (!ctx) return
    const pts = verts.value
    if (!pts.length) return
    const f = viewport.fit()
    const disp = pts.map((p) => {
      const [x, y] = mediaToBox(p.x, p.y, f)
      return { x, y }
    })

    if (disp.length >= 3) {
      ctx.beginPath()
      disp.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.closePath()
      ctx.fillStyle = 'rgba(79,195,247,0.18)'
      ctx.fill()
      ctx.strokeStyle = '#4fc3f7'
      ctx.lineWidth = 1.5
      ctx.stroke()
    } else if (disp.length === 2) {
      ctx.beginPath()
      ctx.moveTo(disp[0].x, disp[0].y)
      ctx.lineTo(disp[1].x, disp[1].y)
      ctx.strokeStyle = '#4fc3f7'
      ctx.stroke()
    }
    disp.forEach((p, i) => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = i === dragIdx.value ? '#ffb74d' : '#4fc3f7'
      ctx.fill()
      ctx.strokeStyle = '#000'
      ctx.stroke()
    })
  }

  function hit(e: MouseEvent): number {
    return hitVertexIndex(verts.value, toVert(e), viewport.fit().scale)
  }

  function onMeta(): void {
    viewport.onLoadedMetadata()
    void nextTick(draw)
  }

  function onDown(e: PointerEvent): void {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const idx = hit(e)
    if (idx >= 0) {
      dragIdx.value = idx
    } else {
      verts.value = [...verts.value, toVert(e)]
      dragIdx.value = verts.value.length - 1
      saveToWidget()
    }
    draw()
  }

  function onMovePtr(e: PointerEvent): void {
    if (dragIdx.value < 0) return
    e.stopPropagation()
    const next = verts.value.slice()
    next[dragIdx.value] = toVert(e)
    verts.value = next
  }

  function onUp(e: PointerEvent): void {
    if (dragIdx.value >= 0) saveToWidget()
    dragIdx.value = -1
    e.stopPropagation()
    draw()
  }

  function onDbl(e: MouseEvent): void {
    const idx = hit(e)
    if (idx >= 0) {
      const next = verts.value.slice()
      next.splice(idx, 1)
      verts.value = next
      saveToWidget()
      draw()
    }
  }

  function clearShape(): void {
    verts.value = []
    shapeRaw.value = ''
    draw()
  }

  watch([verts, smooth], () => { saveToWidget(); void nextTick(draw) }, { deep: true })

  return {
    verts,
    dragIdx,
    smooth,
    draw,
    onMeta,
    onDown,
    onMovePtr,
    onUp,
    onDbl,
    clearShape,
  }
}
