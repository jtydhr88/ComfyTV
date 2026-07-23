<template>
  <FxCardShell :node="node">
    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <textarea
        v-model="expression"
        rows="2"
        spellcheck="false"
        class="ctv:w-full ctv:resize-y ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-1.5 ctv:py-1 ctv:font-mono ctv:text-2xs ctv:text-base-foreground ctv:outline-none ctv:focus:border-primary-background"
        placeholder="noise(t*2)*20"
        @keydown.stop
      />
      <div class="ctv:relative ctv:h-16 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-black/40">
        <canvas ref="canvasRef" class="ctv:absolute ctv:inset-0 ctv:w-full ctv:h-full" />
        <span
          v-if="evalError"
          class="ctv:absolute ctv:inset-0 ctv:flex ctv:items-center ctv:justify-center ctv:px-2 ctv:text-center ctv:text-2xs ctv:text-error-background"
        >{{ evalError }}</span>
      </div>

      <FxChips v-model="field" :options="FIELD_OPTS" />
      <FxSlider v-model="rate" label="Keys / s" :min="1" :max="60" :step="1" :decimals="0" :reset-to="10" />
      <FxSlider v-if="!hasVideo" v-model="duration" label="Duration" :min="0.5" :max="120" :step="0.5" :reset-to="5" />
      <FxSlider v-model="seed" label="Seed" :min="0" :max="9999" :step="1" :decimals="0" :reset-to="0" />

      <div class="ctv:text-2xs ctv:text-muted-foreground ctv:leading-snug">
        {{ $t('fx.expressionHint') }}
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
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
  </FxCardShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxCardShell from '@/components/stages/FxCardShell.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'
import { expressionEval } from '@/api'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const FIELD_OPTS = ['v', 'scale', 'opacity', 'x', 'y', 'rotation']
  .map(v => ({ value: v, label: v }))

const hasVideo = computed(() => !!pickSourceImageUrl(props.state.inputs, 'video'))
const expression = useStrWidget(props.node, 'expression', 'sin(t*2)*10')
const field = useStrWidget(props.node, 'field', 'v')
const rate = useNumWidget(props.node, 'rate', 10)
const duration = useNumWidget(props.node, 'duration', 5)
const seed = useNumWidget(props.node, 'seed', 0)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const evalError = ref('')
let evalTimer: ReturnType<typeof setTimeout> | null = null
let evalToken = 0

function drawSamples(samples: [number, number][]) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const w = Math.max(40, Math.round(rect.width * devicePixelRatio))
  const h = Math.max(24, Math.round(rect.height * devicePixelRatio))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  if (!samples.length) return
  let lo = Infinity
  let hi = -Infinity
  for (const [, v] of samples) {
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return
  if (hi - lo < 1e-9) {
    lo -= 1
    hi += 1
  }
  const t0 = samples[0][0]
  const t1 = samples[samples.length - 1][0] || 1
  const pad = h * 0.1
  if (lo < 0 && hi > 0) {
    const zy = h - pad - ((0 - lo) / (hi - lo)) * (h - 2 * pad)
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, zy)
    ctx.lineTo(w, zy)
    ctx.stroke()
  }
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = Math.max(1, devicePixelRatio)
  ctx.beginPath()
  samples.forEach(([t, v], i) => {
    const x = ((t - t0) / Math.max(1e-9, t1 - t0)) * w
    const y = h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = `${10 * devicePixelRatio}px monospace`
  ctx.fillText(hi.toFixed(2), 3 * devicePixelRatio, 10 * devicePixelRatio)
  ctx.fillText(lo.toFixed(2), 3 * devicePixelRatio, h - 3 * devicePixelRatio)
}

function scheduleEval() {
  if (evalTimer) clearTimeout(evalTimer)
  evalTimer = setTimeout(runEval, 350)
}

async function runEval() {
  const expr = expression.value.trim()
  if (!expr) {
    evalError.value = ''
    drawSamples([])
    return
  }
  const token = ++evalToken
  try {
    const res = await expressionEval({
      expression: expr,
      duration: Math.min(120, duration.value),
      rate: Math.min(60, Math.max(1, rate.value)),
      seed: seed.value,
    })
    if (token !== evalToken) return
    evalError.value = ''
    drawSamples(res.samples as [number, number][])
  } catch (e) {
    if (token !== evalToken) return
    evalError.value = e instanceof Error ? e.message : String(e)
    drawSamples([])
  }
}

watch([expression, duration, rate, seed], scheduleEval)
onMounted(runEval)
</script>
