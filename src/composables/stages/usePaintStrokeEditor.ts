import { computed, nextTick, ref, watch, type Ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { mediaToBox, useVideoViewport } from '@/composables/widgets/useVideoViewport'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'

export interface StrokePoint {
  x: number
  y: number
  p: number
}

export interface Stroke {
  mode: string
  points: StrokePoint[]
  radius: number
  hardness: number
  dx?: number
  dy?: number
  sigma?: number
  color?: string
}

export interface StrokeBrush {
  mode: string
  radius: number
  hardness: number
  dx: number
  dy: number
  sigma: number
  color: string
}

export const STROKE_COLORS: Record<string, string> = {
  clone: 'rgba(79,195,247,0.55)', blur: 'rgba(174,213,129,0.55)',
}

export const MIN_POINT_DIST = 3

export function parseStrokes(raw: string): Stroke[] {
  try {
    const p = JSON.parse(raw || '[]')
    return Array.isArray(p) ? p : []
  } catch { return [] }
}

export function serializeStrokes(v: Stroke[]): string {
  return v.length ? JSON.stringify(v) : ''
}

export function normalizePressure(pressure: number): number {
  return pressure > 0 ? Math.round(pressure * 100) / 100 : 1.0
}

export function shouldAppendPoint(last: StrokePoint, pt: StrokePoint): boolean {
  return Math.hypot(pt.x - last.x, pt.y - last.y) >= MIN_POINT_DIST
}

export function makeStroke(pt: StrokePoint, brush: StrokeBrush): Stroke {
  const st: Stroke = {
    mode: brush.mode,
    points: [pt],
    radius: brush.radius,
    hardness: brush.hardness,
  }
  if (brush.mode === 'clone') { st.dx = brush.dx; st.dy = brush.dy }
  if (brush.mode === 'blur') st.sigma = brush.sigma
  if (brush.mode === 'color') st.color = brush.color
  return st
}

export function usePaintStrokeEditor(opts: {
  node: LGraphNode
  videoEl: Ref<HTMLVideoElement | null>
  overlayEl: Ref<HTMLCanvasElement | null>
}) {
  const { node, videoEl, overlayEl } = opts

  const strokesRaw = useStrWidget(node, 'strokes', '')
  const viewport = useVideoViewport({ videoEl, overlayEl })
  const duration = viewport.duration
  const { vw } = viewport

  const mode = ref('clone')
  const radius = ref(20)
  const hardness = ref(0.5)
  const sigma = ref(8)
  const dx = ref(0)
  const dy = ref(0)
  const color = ref('#FF4444')

  const strokes = computed<Stroke[]>({
    get: () => parseStrokes(strokesRaw.value),
    set: (v: Stroke[]) => {
      strokesRaw.value = serializeStrokes(v)
    },
  })

  const drawing = ref(false)
  let current: Stroke | null = null

  function toStrokePt(e: PointerEvent): StrokePoint {
    const [x, y] = viewport.toVideo(e)
    return {
      x: Math.round(x),
      y: Math.round(y),
      p: normalizePressure(e.pressure),
    }
  }

  function draw(): void {
    const ctx = viewport.syncCanvasSize()
    if (!ctx) return
    const f = viewport.fit()
    const all = current ? [...strokes.value, current] : strokes.value
    for (const st of all) {
      ctx.strokeStyle = st.mode === 'color'
        ? (st.color ?? '#FF4444')
        : (STROKE_COLORS[st.mode] ?? 'rgba(255,255,255,0.5)')
      ctx.lineWidth = Math.max(2, st.radius * 2 * f.scale)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      st.points.forEach((p, i) => {
        const [x, y] = mediaToBox(p.x, p.y, f)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      if (st.points.length === 1) {
        const p = st.points[0]
        const [x, y] = mediaToBox(p.x, p.y, f)
        ctx.arc(x, y, Math.max(1, st.radius * f.scale), 0, Math.PI * 2)
        ctx.fillStyle = ctx.strokeStyle
        ctx.fill()
      } else {
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
  }

  function onMeta(): void {
    viewport.onLoadedMetadata()
    void nextTick(draw)
  }

  function onDown(e: PointerEvent): void {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drawing.value = true
    current = makeStroke(toStrokePt(e), {
      mode: mode.value,
      radius: radius.value,
      hardness: hardness.value,
      dx: dx.value,
      dy: dy.value,
      sigma: sigma.value,
      color: color.value,
    })
    draw()
  }

  function onMovePtr(e: PointerEvent): void {
    if (!drawing.value || !current) return
    e.stopPropagation()
    const pt = toStrokePt(e)
    const last = current.points[current.points.length - 1]
    if (shouldAppendPoint(last, pt)) {
      current.points.push(pt)
      draw()
    }
  }

  function onUp(e: PointerEvent): void {
    e.stopPropagation()
    if (drawing.value && current) {
      strokes.value = [...strokes.value, current]
    }
    drawing.value = false
    current = null
    draw()
  }

  function undoStroke(): void {
    strokes.value = strokes.value.slice(0, -1)
    void nextTick(draw)
  }

  function clearStrokes(): void {
    strokes.value = []
    void nextTick(draw)
  }

  watch([strokes, vw], () => nextTick(draw), { deep: true })

  return {
    duration,
    strokes,
    drawing,
    mode,
    radius,
    hardness,
    sigma,
    dx,
    dy,
    color,
    draw,
    onMeta,
    onDown,
    onMovePtr,
    onUp,
    undoStroke,
    clearStrokes,
  }
}
