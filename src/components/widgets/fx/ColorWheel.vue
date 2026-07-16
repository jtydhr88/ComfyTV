<template>
  <div class="ctv:flex ctv:flex-col ctv:items-center ctv:gap-0.5 ctv:select-none">
    <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ label }}</span>
    <canvas
      ref="cv"
      :width="size" :height="size"
      class="ctv:rounded-full ctv:cursor-crosshair ctv:touch-none"
      :style="{ width: `${size}px`, height: `${size}px` }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @dblclick="resetWheel"
    />
    <span class="ctv:text-2xs ctv:font-mono ctv:text-muted-foreground">
      {{ fmt(modelValue.r) }} {{ fmt(modelValue.g) }} {{ fmt(modelValue.b) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: { r: number; g: number; b: number }
  label: string
  size?: number
}>(), { size: 78 })

const emit = defineEmits<{ 'update:modelValue': [v: { r: number; g: number; b: number }] }>()

const cv = ref<HTMLCanvasElement | null>(null)
const dragging = ref(false)

const AX = [
  { x: Math.cos(Math.PI / 2), y: -Math.sin(Math.PI / 2) },
  { x: Math.cos((210 * Math.PI) / 180), y: -Math.sin((210 * Math.PI) / 180) },
  { x: Math.cos((330 * Math.PI) / 180), y: -Math.sin((330 * Math.PI) / 180) },
]

function offsetsToPuck(v: { r: number; g: number; b: number }) {
  const x = (2 / 3) * (v.r * AX[0].x + v.g * AX[1].x + v.b * AX[2].x)
  const y = (2 / 3) * (v.r * AX[0].y + v.g * AX[1].y + v.b * AX[2].y)
  return { x, y }
}

function puckToOffsets(x: number, y: number) {
  const len = Math.hypot(x, y)
  if (len > 1) { x /= len; y /= len }
  return {
    r: clamp1(x * AX[0].x + y * AX[0].y),
    g: clamp1(x * AX[1].x + y * AX[1].y),
    b: clamp1(x * AX[2].x + y * AX[2].y),
  }
}

function clamp1(v: number) { return Math.min(1, Math.max(-1, Math.round(v * 1000) / 1000)) }
function fmt(v: number) { return (v >= 0 ? '+' : '') + v.toFixed(2) }

function draw() {
  const c = cv.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  const s = props.size
  const r = s / 2
  ctx.clearRect(0, 0, s, s)

  const conic = (ctx as any).createConicGradient
    ? (ctx as any).createConicGradient(-Math.PI / 2, r, r)
    : null
  if (conic) {
    for (let i = 0; i <= 12; i++) {
      conic.addColorStop(i / 12, `hsl(${-i * 30}, 80%, 55%)`)
    }
    ctx.fillStyle = conic
  } else {
    ctx.fillStyle = '#666'
  }
  ctx.beginPath()
  ctx.arc(r, r, r - 1, 0, Math.PI * 2)
  ctx.fill()
  const fade = ctx.createRadialGradient(r, r, 0, r, r, r - 1)
  fade.addColorStop(0, 'rgba(30,30,30,1)')
  fade.addColorStop(1, 'rgba(30,30,30,0)')
  ctx.fillStyle = fade
  ctx.beginPath()
  ctx.arc(r, r, r - 1, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(r, 3); ctx.lineTo(r, s - 3)
  ctx.moveTo(3, r); ctx.lineTo(s - 3, r)
  ctx.stroke()

  const p = offsetsToPuck(props.modelValue)
  const px = r + p.x * (r - 6)
  const py = r + p.y * (r - 6)
  ctx.beginPath()
  ctx.arc(px, py, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.strokeStyle = '#000'
  ctx.stroke()
}

function apply(e: PointerEvent) {
  const c = cv.value
  if (!c) return
  const rect = c.getBoundingClientRect()
  const r = props.size / 2
  const x = ((e.clientX - rect.left) - r) / (r - 6)
  const y = ((e.clientY - rect.top) - r) / (r - 6)
  emit('update:modelValue', puckToOffsets(x, y))
}

function onDown(e: PointerEvent) {
  dragging.value = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  apply(e)
  e.stopPropagation()
}
function onMove(e: PointerEvent) {
  if (dragging.value) { apply(e); e.stopPropagation() }
}
function onUp(e: PointerEvent) {
  dragging.value = false
  e.stopPropagation()
}
function resetWheel() {
  emit('update:modelValue', { r: 0, g: 0, b: 0 })
}

watch(() => props.modelValue, draw, { deep: true })
onMounted(draw)
</script>
