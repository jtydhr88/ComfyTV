<template>
  <canvas
    ref="cv"
    class="ctv:block ctv:size-full ctv:min-h-0 ctv:min-w-0 ctv:overflow-hidden"
    :style="{ cursor: orientation === 'h' ? 'ns-resize' : 'ew-resize' }"
    @pointerdown.prevent="onDown"
    @pointermove="emit('rulermove', $event)"
    @pointerup="emit('rulerup', $event)"
    @pointercancel="emit('rulercancel', $event)"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { computeRulerTicks, markerRect } from './rulerTicks'

const props = defineProps<{
  orientation: 'h' | 'v'
  lower: number
  upper: number
  position: number | null
  maxSize: number
}>()

const emit = defineEmits<{
  (e: 'rulerdown', ev: PointerEvent): void
  (e: 'rulermove', ev: PointerEvent): void
  (e: 'rulerup', ev: PointerEvent): void
  (e: 'rulercancel', ev: PointerEvent): void
}>()

function onDown(ev: PointerEvent) {
  if (ev.button !== 0) return
  try { cv.value?.setPointerCapture(ev.pointerId) } catch {}
  emit('rulerdown', ev)
}

const cv = ref<HTMLCanvasElement | null>(null)
let ro: ResizeObserver | null = null
let raf = 0

function schedule() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    draw()
  })
}

function draw() {
  const canvas = cv.value
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1
  const cw = canvas.clientWidth
  const ch = canvas.clientHeight
  if (cw <= 0 || ch <= 0) return
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr)
    canvas.height = Math.round(ch * dpr)
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cw, ch)
  ctx.fillStyle = '#202020'
  ctx.fillRect(0, 0, cw, ch)

  const horizontal = props.orientation === 'h'
  const lengthPx = horizontal ? cw : ch
  const breadthPx = horizontal ? ch : cw
  const { ticks, labels } = computeRulerTicks({
    lower: props.lower, upper: props.upper,
    lengthPx, breadthPx, maxSize: props.maxSize, digitWidth: 6,
  })

  ctx.strokeStyle = '#8a8a8a'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const t of ticks) {
    if (horizontal) {
      ctx.moveTo(t.pos + 0.5, ch)
      ctx.lineTo(t.pos + 0.5, ch - t.len)
    } else {
      ctx.moveTo(cw, t.pos + 0.5)
      ctx.lineTo(cw - t.len, t.pos + 0.5)
    }
  }
  ctx.stroke()

  ctx.fillStyle = '#b5b5b5'
  ctx.font = '9px monospace'
  if (horizontal) {
    ctx.textBaseline = 'top'
    for (const l of labels) ctx.fillText(l.text, l.pos + 2, 1)
  } else {
    ctx.textBaseline = 'top'
    for (const l of labels) {
      let y = l.pos + 2
      for (const chr of l.text) {
        ctx.fillText(chr, 2, y)
        y += 9
      }
    }
  }

  if (props.position != null) {
    const m = markerRect(props.position, props.lower, props.upper, lengthPx, breadthPx)
    if (m) {
      ctx.fillStyle = '#46b4e6'
      ctx.beginPath()
      if (horizontal) {
        const x = m.pos
        ctx.moveTo(x - m.width / 2, ch - m.height)
        ctx.lineTo(x + m.width / 2, ch - m.height)
        ctx.lineTo(x, ch)
      } else {
        const y = m.pos
        ctx.moveTo(cw - m.height, y - m.width / 2)
        ctx.lineTo(cw - m.height, y + m.width / 2)
        ctx.lineTo(cw, y)
      }
      ctx.closePath()
      ctx.fill()
    }
  }
}

watch(() => [props.lower, props.upper, props.position, props.maxSize, props.orientation], schedule)

onMounted(() => {
  ro = new ResizeObserver(schedule)
  if (cv.value) ro.observe(cv.value)
  schedule()
})

onBeforeUnmount(() => {
  ro?.disconnect()
  if (raf) cancelAnimationFrame(raf)
})
</script>
