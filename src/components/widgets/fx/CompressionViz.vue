<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1">
    <canvas
      ref="curveCanvas"
      class="ctv:w-full ctv:rounded ctv:border ctv:border-border-subtle"
      :width="W" :height="H"
    />
    <canvas
      v-if="hasHistory"
      ref="historyCanvas"
      class="ctv:w-full ctv:rounded ctv:border ctv:border-border-subtle"
      :width="W" :height="H"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAudioEnvelope } from '@/composables/widgets/fx/useAudioEnvelope'
import { compressorTransferDb, resampleEnvelope, transferCurvePoints } from '@/utils/audioViz'

const props = defineProps<{
  thresholdDb: number
  ratio: number
  kneeFactor: number
  makeupDb: number
  inputUrl?: string | null
  outputUrl?: string | null
}>()

const W = 260
const H = 130
const MIN_DB = -60

const curveCanvas = ref<HTMLCanvasElement | null>(null)
const historyCanvas = ref<HTMLCanvasElement | null>(null)

const { hasHistory, reload } = useAudioEnvelope({
  inputUrl: computed(() => props.inputUrl),
  outputUrl: computed(() => props.outputUrl),
})

function xPix(db: number) { return ((db - MIN_DB) / -MIN_DB) * (W - 1) }
function yPix(db: number) { return (1 - (db - MIN_DB) / -MIN_DB) * (H - 1) }

function drawCurve() {
  const ctx = curveCanvas.value?.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = 'rgb(43,43,75)'
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, H - 1)
  ctx.lineTo(W - 1, 0)
  ctx.stroke()

  const p = {
    thresholdDb: props.thresholdDb,
    ratio: props.ratio,
    kneeFactor: props.kneeFactor,
    makeupDb: props.makeupDb,
  }
  const pts = transferCurvePoints(p, W, MIN_DB, 0)

  ctx.fillStyle = 'rgba(255,0,0,0.25)'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  for (const pt of pts) ctx.lineTo(xPix(pt.x), yPix(Math.min(0, pt.y)))
  ctx.lineTo(W - 1, 0)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (const [i, pt] of pts.entries()) {
    const x = xPix(pt.x)
    const y = yPix(Math.min(0, Math.max(MIN_DB, pt.y)))
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  const tx = xPix(props.thresholdDb)
  const ty = yPix(Math.min(0, compressorTransferDb(props.thresholdDb, p)))
  ctx.fillStyle = 'rgba(190,120,255,0.9)'
  ctx.beginPath()
  ctx.arc(tx, ty, 3, 0, Math.PI * 2)
  ctx.fill()
}

async function drawHistory() {
  const envs = await reload()
  if (!envs) return
  await new Promise(resolve => setTimeout(resolve))
  const ctx = historyCanvas.value?.getContext('2d')
  if (!ctx) return

  const inR = resampleEnvelope(envs.input, W)
  const outR = resampleEnvelope(envs.output, W)
  ctx.fillStyle = 'rgb(43,43,75)'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(86,86,149,0.8)'
  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x < W; x++) ctx.lineTo(x, yPix(inR[x]))
  ctx.lineTo(W - 1, H)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(182,182,244,0.9)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let x = 0; x < W; x++) {
    const y = yPix(outR[x])
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  ctx.strokeStyle = 'rgba(252,220,151,0.95)'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let x = 0; x < W; x++) {
    const red = Math.max(-30, Math.min(0, outR[x] - inR[x]))
    const y = (-red / 30) * (H - 1)
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

onMounted(() => {
  drawCurve()
  void drawHistory()
})
watch(() => [props.thresholdDb, props.ratio, props.kneeFactor, props.makeupDb],
  drawCurve)
watch(() => [props.inputUrl, props.outputUrl], () => { void drawHistory() })
</script>
