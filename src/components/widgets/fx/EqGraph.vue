<template>
  <canvas
    ref="cv"
    :width="W" :height="H"
    class="ctv:w-full ctv:rounded ctv:cursor-crosshair ctv:touch-none ctv:border ctv:border-border-subtle ctv:bg-black/60"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @wheel.prevent="onWheel"
    @dblclick="onDbl"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

export interface EqBand {
  type: 'peak' | 'highpass' | 'lowpass' | 'lowshelf' | 'highshelf'
  f: number
  g: number
  q: number
}

const props = defineProps<{ modelValue: EqBand[] }>()
const emit = defineEmits<{ 'update:modelValue': [v: EqBand[]] }>()

const W = 260
const H = 140
const FS = 44100
const FMIN = 20
const FMAX = 20000
const GMAX = 24

const cv = ref<HTMLCanvasElement | null>(null)
const dragIdx = ref(-1)

const BAND_COLORS = ['#ffb74d', '#4fc3f7', '#aed581', '#f06292', '#ba68c8', '#fff176']

function fx(f: number) { return (Math.log10(f / FMIN) / Math.log10(FMAX / FMIN)) * W }
function xf(x: number) { return FMIN * Math.pow(FMAX / FMIN, x / W) }
function gy(g: number) { return H / 2 - (g / GMAX) * (H / 2 - 8) }
function yg(y: number) { return ((H / 2 - y) / (H / 2 - 8)) * GMAX }

function peakDb(band: EqBand, f: number): number {
  const A = Math.pow(10, band.g / 40)
  const w0 = (2 * Math.PI * band.f) / FS
  const alpha = Math.sin(w0) / (2 * Math.max(0.1, band.q))
  const b0 = 1 + alpha * A
  const b1 = -2 * Math.cos(w0)
  const b2 = 1 - alpha * A
  const a0 = 1 + alpha / A
  const a1 = b1
  const a2 = 1 - alpha / A
  const w = (2 * Math.PI * f) / FS
  const cw = Math.cos(w), c2w = Math.cos(2 * w)
  const num = (b0 * b0 + b1 * b1 + b2 * b2) + 2 * (b0 * b1 + b1 * b2) * cw + 2 * b0 * b2 * c2w
  const den = (a0 * a0 + a1 * a1 + a2 * a2) + 2 * (a0 * a1 + a1 * a2) * cw + 2 * a0 * a2 * c2w
  return 10 * Math.log10(Math.max(1e-12, num / den))
}

function bandDb(band: EqBand, f: number): number {
  switch (band.type) {
    case 'peak': return peakDb(band, f)
    case 'highpass': return f >= band.f ? 0 : Math.max(-40, -12 * Math.log2(band.f / f))
    case 'lowpass': return f <= band.f ? 0 : Math.max(-40, -12 * Math.log2(f / band.f))
    case 'lowshelf': {
      const t = 1 / (1 + Math.pow(f / band.f, 2))
      return band.g * t
    }
    case 'highshelf': {
      const t = 1 / (1 + Math.pow(band.f / f, 2))
      return band.g * t
    }
  }
  return 0
}

function draw() {
  const ctx = cv.value?.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.font = '8px monospace'
  for (const f of [100, 1000, 10000]) {
    const x = fx(f)
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x + 2, H - 3)
  }
  for (const g of [-12, 0, 12]) {
    const y = gy(g)
    ctx.strokeStyle = g === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  const bands = props.modelValue ?? []
  ctx.strokeStyle = '#7ec8ff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let px = 0; px <= W; px += 2) {
    const f = xf(px)
    let db = 0
    for (const b of bands) db += bandDb(b, f)
    db = Math.min(GMAX, Math.max(-GMAX, db))
    const y = gy(db)
    if (px === 0) ctx.moveTo(px, y)
    else ctx.lineTo(px, y)
  }
  ctx.stroke()

  bands.forEach((b, i) => {
    const x = fx(b.f)
    const y = b.type === 'highpass' || b.type === 'lowpass' ? H / 2 : gy(b.g)
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.fillStyle = BAND_COLORS[i % BAND_COLORS.length]
    ctx.fill()
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    ctx.stroke()
  })
}

function localXY(e: MouseEvent): [number, number] {
  const rect = cv.value!.getBoundingClientRect()
  return [(e.clientX - rect.left) * (W / rect.width),
          (e.clientY - rect.top) * (H / rect.height)]
}

function hitIndex(e: MouseEvent): number {
  const [px, py] = localXY(e)
  const bands = props.modelValue ?? []
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]
    const x = fx(b.f)
    const y = b.type === 'highpass' || b.type === 'lowpass' ? H / 2 : gy(b.g)
    if (Math.hypot(x - px, y - py) < 9) return i
  }
  return -1
}

function onDown(e: PointerEvent) {
  e.stopPropagation()
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  dragIdx.value = hitIndex(e)
}

function onMove(e: PointerEvent) {
  if (dragIdx.value < 0) return
  e.stopPropagation()
  const [px, py] = localXY(e)
  const bands = (props.modelValue ?? []).slice()
  const b = { ...bands[dragIdx.value] }
  b.f = Math.round(Math.min(FMAX, Math.max(FMIN, xf(px))))
  if (b.type === 'peak' || b.type === 'lowshelf' || b.type === 'highshelf') {
    b.g = Math.round(Math.min(GMAX, Math.max(-GMAX, yg(py))) * 10) / 10
  }
  bands[dragIdx.value] = b
  emit('update:modelValue', bands)
}

function onUp(e: PointerEvent) {
  dragIdx.value = -1
  e.stopPropagation()
}

function onWheel(e: WheelEvent) {
  const idx = hitIndex(e)
  if (idx < 0) return
  const bands = (props.modelValue ?? []).slice()
  const b = { ...bands[idx] }
  b.q = Math.round(Math.min(20, Math.max(0.1, b.q * (e.deltaY > 0 ? 0.85 : 1.18))) * 100) / 100
  bands[idx] = b
  emit('update:modelValue', bands)
}

function onDbl(e: MouseEvent) {
  const idx = hitIndex(e)
  const bands = (props.modelValue ?? []).slice()
  if (idx >= 0) {
    bands.splice(idx, 1)
  } else {
    const [px, py] = localXY(e)
    bands.push({
      type: 'peak',
      f: Math.round(xf(px)),
      g: Math.round(Math.min(GMAX, Math.max(-GMAX, yg(py))) * 10) / 10,
      q: 1.0,
    })
  }
  emit('update:modelValue', bands)
}

watch(() => props.modelValue, draw, { deep: true })
onMounted(draw)
</script>
