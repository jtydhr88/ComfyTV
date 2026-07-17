import { onMounted, ref, watch, type Ref } from 'vue'
import {
  CURVES_H,
  CURVES_PAD,
  CURVES_W,
  evalSpline,
  fromPx,
  normalizeCurvePoints,
  splineM,
  toPx,
  type CurvePoints,
} from '@/composables/widgets/fx/curvesMath'

export interface UseCurvesCanvasOptions {
  canvasEl: Ref<HTMLCanvasElement | null>
  modelValue: Ref<[number, number][]>
  color: Ref<string>
  onChange: (v: [number, number][]) => void
}

export function useCurvesCanvas(opts: UseCurvesCanvasOptions) {
  const { canvasEl, modelValue, color, onChange } = opts

  const dragIdx = ref(-1)

  function pts(): CurvePoints {
    return normalizeCurvePoints(modelValue.value)
  }

  function draw() {
    const ctx = canvasEl.value?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, CURVES_W, CURVES_H)

    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      const [gx] = toPx(i / 4, 0)
      const [, gy] = toPx(0, i / 4)
      ctx.beginPath(); ctx.moveTo(gx, CURVES_PAD); ctx.lineTo(gx, CURVES_H - CURVES_PAD); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(CURVES_PAD, gy); ctx.lineTo(CURVES_W - CURVES_PAD, gy); ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(...toPx(0, 0))
    ctx.lineTo(...toPx(1, 1))
    ctx.stroke()
    ctx.setLineDash([])

    const p = pts()
    const m = splineM(p)
    ctx.strokeStyle = color.value
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i <= 120; i++) {
      const x = i / 120
      const [px, py] = toPx(x, evalSpline(p, m, x))
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()

    for (const [x, y] of p) {
      const [px, py] = toPx(x, y)
      ctx.beginPath()
      ctx.arc(px, py, 4, 0, Math.PI * 2)
      ctx.fillStyle = color.value
      ctx.fill()
      ctx.strokeStyle = '#000'
      ctx.stroke()
    }
  }

  function hitIndex(e: PointerEvent): number {
    const rect = canvasEl.value!.getBoundingClientRect()
    const sx = CURVES_W / rect.width
    const sy = CURVES_H / rect.height
    const px = (e.clientX - rect.left) * sx
    const py = (e.clientY - rect.top) * sy
    const p = pts()
    for (let i = 0; i < p.length; i++) {
      const [cx, cyy] = toPx(p[i][0], p[i][1])
      if (Math.hypot(cx - px, cyy - py) < 8) return i
    }
    return -1
  }

  function eventPoint(e: PointerEvent): [number, number] {
    const rect = canvasEl.value!.getBoundingClientRect()
    return fromPx((e.clientX - rect.left) * (CURVES_W / rect.width),
                  (e.clientY - rect.top) * (CURVES_H / rect.height))
  }

  function onDown(e: PointerEvent) {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const idx = hitIndex(e)
    if (idx >= 0) {
      dragIdx.value = idx
      return
    }
    const p = pts()
    const np = eventPoint(e)
    p.push(np)
    p.sort((a, b) => a[0] - b[0])
    dragIdx.value = p.findIndex((q) => q === np)
    onChange(p)
  }

  function onMove(e: PointerEvent) {
    if (dragIdx.value < 0) return
    e.stopPropagation()
    const p = pts()
    const np = eventPoint(e)
    const i = dragIdx.value
    if (i === 0) np[0] = p[0][0]
    else if (i === p.length - 1) np[0] = p[p.length - 1][0]
    else np[0] = Math.min(p[i + 1][0] - 0.01, Math.max(p[i - 1][0] + 0.01, np[0]))
    p[i] = np
    onChange(p)
  }

  function onUp(e: PointerEvent) {
    dragIdx.value = -1
    e.stopPropagation()
  }

  function onRightClick(e: MouseEvent) {
    const idx = hitIndex(e as unknown as PointerEvent)
    const p = pts()
    if (idx > 0 && idx < p.length - 1) {
      p.splice(idx, 1)
      onChange(p)
    }
  }

  watch(modelValue, draw, { deep: true })
  onMounted(draw)

  return { dragIdx, draw, onDown, onMove, onUp, onRightClick }
}
