<template>
  <canvas
    ref="cv"
    :width="W" :height="H"
    class="ctv:w-full ctv:rounded ctv:cursor-crosshair ctv:touch-none ctv:border ctv:border-border-subtle ctv:bg-black/60"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @contextmenu.prevent="onRightClick"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: [number, number][]
  color?: string
}>(), { color: '#e0e0e0' })

const emit = defineEmits<{ 'update:modelValue': [v: [number, number][]] }>()

const W = 240
const H = 160
const PAD = 6
const cv = ref<HTMLCanvasElement | null>(null)
const dragIdx = ref(-1)

function pts(): [number, number][] {
  const p = (props.modelValue ?? []).slice() as [number, number][]
  if (p.length < 2) return [[0, 0], [1, 1]]
  return p.slice().sort((a, b) => a[0] - b[0])
}

function splineM(p: [number, number][]): number[] {
  const n = p.length
  const m = new Array(n).fill(0)
  if (n < 3) return m
  const a = new Array(n).fill(0)
  const b = new Array(n).fill(0)
  const c = new Array(n).fill(0)
  const d = new Array(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    const h0 = p[i][0] - p[i - 1][0]
    const h1 = p[i + 1][0] - p[i][0]
    a[i] = h0
    b[i] = 2 * (h0 + h1)
    c[i] = h1
    d[i] = 6 * ((p[i + 1][1] - p[i][1]) / (h1 || 1e-6) - (p[i][1] - p[i - 1][1]) / (h0 || 1e-6))
  }
  for (let i = 2; i < n - 1; i++) {
    const w = a[i] / (b[i - 1] || 1e-6)
    b[i] -= w * c[i - 1]
    d[i] -= w * d[i - 1]
  }
  for (let i = n - 2; i >= 1; i--) {
    m[i] = (d[i] - c[i] * m[i + 1]) / (b[i] || 1e-6)
  }
  return m
}

function evalSpline(p: [number, number][], m: number[], x: number): number {
  if (x <= p[0][0]) return p[0][1]
  if (x >= p[p.length - 1][0]) return p[p.length - 1][1]
  let i = 0
  while (i < p.length - 2 && x > p[i + 1][0]) i++
  const h = p[i + 1][0] - p[i][0] || 1e-6
  const t0 = (p[i + 1][0] - x) / h
  const t1 = (x - p[i][0]) / h
  const y = t0 * p[i][1] + t1 * p[i + 1][1]
    + ((t0 * t0 * t0 - t0) * m[i] + (t1 * t1 * t1 - t1) * m[i + 1]) * (h * h) / 6
  return Math.min(1, Math.max(0, y))
}

function toPx(x: number, y: number) {
  return [PAD + x * (W - 2 * PAD), H - PAD - y * (H - 2 * PAD)]
}
function fromPx(px: number, py: number): [number, number] {
  return [
    Math.min(1, Math.max(0, (px - PAD) / (W - 2 * PAD))),
    Math.min(1, Math.max(0, (H - PAD - py) / (H - 2 * PAD))),
  ]
}

function draw() {
  const ctx = cv.value?.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  for (let i = 1; i < 4; i++) {
    const [gx] = toPx(i / 4, 0)
    const [, gy] = toPx(0, i / 4)
    ctx.beginPath(); ctx.moveTo(gx, PAD); ctx.lineTo(gx, H - PAD); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(PAD, gy); ctx.lineTo(W - PAD, gy); ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(...(toPx(0, 0) as [number, number]))
  ctx.lineTo(...(toPx(1, 1) as [number, number]))
  ctx.stroke()
  ctx.setLineDash([])

  const p = pts()
  const m = splineM(p)
  ctx.strokeStyle = props.color
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
    ctx.fillStyle = props.color
    ctx.fill()
    ctx.strokeStyle = '#000'
    ctx.stroke()
  }
}

function hitIndex(e: PointerEvent): number {
  const rect = cv.value!.getBoundingClientRect()
  const sx = W / rect.width
  const sy = H / rect.height
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
  const rect = cv.value!.getBoundingClientRect()
  return fromPx((e.clientX - rect.left) * (W / rect.width),
                (e.clientY - rect.top) * (H / rect.height))
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
  emit('update:modelValue', p)
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
  emit('update:modelValue', p)
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
    emit('update:modelValue', p)
  }
}

watch(() => props.modelValue, draw, { deep: true })
onMounted(draw)
</script>
