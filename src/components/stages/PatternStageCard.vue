<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <canvas
      ref="previewEl"
      class="ctv:w-full ctv:h-40 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background"
    />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="kind" :options="KINDS" />

      <FxSlider v-model="width" label="Width" :min="16" :max="4096" :step="16" :decimals="0" :reset-to="1280" />
      <FxSlider v-model="height" label="Height" :min="16" :max="4096" :step="16" :decimals="0" :reset-to="720" />
      <FxSlider v-model="fps" label="FPS" :min="1" :max="120" :step="1" :decimals="0" :reset-to="24" />
      <FxSlider v-model="duration" :label="$t('fx.duration')" :min="0.5" :max="120" :step="0.5" :reset-to="5" unit="s" />

      <div class="ctv:flex ctv:items-center ctv:gap-3 ctv:text-2xs ctv:text-muted-foreground">
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:cursor-pointer">
          <input type="color" v-model="color0" class="ctv:w-8 ctv:h-5 ctv:p-0 ctv:border-0 ctv:cursor-pointer ctv:bg-transparent" />
          Color A
        </label>
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:cursor-pointer">
          <input type="color" v-model="color1" class="ctv:w-8 ctv:h-5 ctv:p-0 ctv:border-0 ctv:cursor-pointer ctv:bg-transparent" />
          Color B
        </label>
      </div>

      <FxSlider v-model="p0x" label="P0 X" :min="0" :max="1" :step="0.01" :reset-to="0" />
      <FxSlider v-model="p0y" label="P0 Y" :min="0" :max="1" :step="0.01" :reset-to="0" />
      <FxSlider v-model="p1x" label="P1 X" :min="0" :max="1" :step="0.01" :reset-to="1" />
      <FxSlider v-model="p1y" label="P1 Y" :min="0" :max="1" :step="0.01" :reset-to="1" />

      <FxChips v-if="kind === 'ramp' || kind === 'radial'" v-model="interp" :options="INTERPS" />
      <FxSlider v-if="kind === 'rectangle'" v-model="softness" label="Softness" :min="0" :max="1" :step="0.01" :reset-to="0" />

      <template v-if="kind === 'noise'">
        <FxSlider v-model="noiseScale" label="Noise scale" :min="4" :max="512" :step="1" :decimals="0" :reset-to="64" />
        <FxSlider v-model="noiseOctaves" label="Octaves" :min="1" :max="8" :step="1" :decimals="0" :reset-to="4" />
        <FxSlider v-model="noiseSpeed" label="Speed" :min="0" :max="10" :step="0.1" :reset-to="1" />
        <FxSlider v-model="seed" label="Seed" :min="0" :max="99999" :step="1" :decimals="0" :reset-to="7" />
      </template>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.adjustThenRun') }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const KINDS = [
  { value: 'ramp', label: 'Ramp' },
  { value: 'radial', label: 'Radial' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'noise', label: 'Noise' },
]

const INTERPS = [
  { value: 'linear', label: 'Linear' },
  { value: 'smooth', label: 'Smooth' },
  { value: 'ease_in', label: 'Ease in' },
  { value: 'ease_out', label: 'Ease out' },
]

const kind = useStrWidget(props.node, 'kind', 'ramp')
const width = useNumWidget(props.node, 'width', 1280)
const height = useNumWidget(props.node, 'height', 720)
const fps = useNumWidget(props.node, 'fps', 24)
const duration = useNumWidget(props.node, 'duration', 5)
const color0 = useStrWidget(props.node, 'color0', '#000000')
const color1 = useStrWidget(props.node, 'color1', '#ffffff')
const p0x = useNumWidget(props.node, 'p0_x', 0)
const p0y = useNumWidget(props.node, 'p0_y', 0)
const p1x = useNumWidget(props.node, 'p1_x', 1)
const p1y = useNumWidget(props.node, 'p1_y', 1)
const interp = useStrWidget(props.node, 'interp', 'linear')
const softness = useNumWidget(props.node, 'softness', 0)
const noiseScale = useNumWidget(props.node, 'noise_scale', 64)
const noiseOctaves = useNumWidget(props.node, 'noise_octaves', 4)
const noiseSpeed = useNumWidget(props.node, 'noise_speed', 1)
const seed = useNumWidget(props.node, 'seed', 7)

const previewEl = ref<HTMLCanvasElement>()

function ease(t: number): number {
  if (interp.value === 'smooth') return t * t * (3 - 2 * t)
  if (interp.value === 'ease_in') return t * t
  if (interp.value === 'ease_out') return 1 - (1 - t) * (1 - t)
  return t
}

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mixColors(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return `rgb(${r},${g},${bl})`
}

function addEasedStops(grad: CanvasGradient) {
  const c0 = hexToRgb(color0.value)
  const c1 = hexToRgb(color1.value)
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    grad.addColorStop(t, mixColors(c0, c1, ease(t)))
  }
}

function draw() {
  const canvas = previewEl.value
  if (!canvas) return
  const w = 320
  const h = Math.max(16, Math.round((w * height.value) / Math.max(16, width.value)))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)

  const x0 = p0x.value * w
  const y0 = p0y.value * h
  const x1 = p1x.value * w
  const y1 = p1y.value * h

  if (kind.value === 'ramp') {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1)
    addEasedStops(grad)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  } else if (kind.value === 'radial') {
    const r = Math.max(1, Math.hypot(x1 - x0, y1 - y0))
    const grad = ctx.createRadialGradient(x0, y0, 0, x0, y0, r)
    addEasedStops(grad)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  } else if (kind.value === 'rectangle') {
    ctx.fillStyle = color1.value
    ctx.fillRect(0, 0, w, h)
    ctx.save()
    ctx.filter = softness.value > 0 ? `blur(${softness.value * 12}px)` : 'none'
    ctx.fillStyle = color0.value
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
    ctx.restore()
  } else {
    const c0 = hexToRgb(color0.value)
    const c1 = hexToRgb(color1.value)
    const octaves = Math.max(1, Math.round(noiseOctaves.value))
    ctx.fillStyle = color0.value
    ctx.fillRect(0, 0, w, h)
    for (let o = 0; o < octaves; o++) {
      const rng = mulberry32(Math.round(seed.value) + o * 1013)
      const cell = Math.max(1, Math.round((w / Math.max(4, noiseScale.value)) * 8) >> o)
      ctx.globalAlpha = 1 / (o + 1)
      for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
          ctx.fillStyle = mixColors(c0, c1, rng())
          ctx.fillRect(x, y, cell, cell)
        }
      }
    }
    ctx.globalAlpha = 1
  }
}

watch(
  [kind, width, height, color0, color1, p0x, p0y, p1x, p1y, interp, softness, noiseScale, noiseOctaves, noiseSpeed, seed],
  draw,
)
onMounted(draw)
</script>
