<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div
      class="ctv:relative ctv:w-full ctv:h-[220px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <div v-if="!sourceVideoUrl"
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <i class="pi pi-video ctv:text-[32px] ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('videoTrim.noInputVideo') }}</div>
      </div>
      <template v-else>
        <video
          ref="videoEl" :src="sourceVideoUrl" muted playsinline preload="metadata"
          class="ctv:block ctv:size-full ctv:object-contain"
          @loadedmetadata="onMeta"
        />
        <canvas
          ref="overlayEl"
          class="ctv:absolute ctv:inset-0 ctv:size-full ctv:touch-none ctv:cursor-crosshair"
          @pointerdown="onDown"
          @pointermove="onMovePtr"
          @pointerup="onUp"
          @pointercancel="onUp"
        />
      </template>
    </div>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <FxChips v-model="mode" :options="MODES" />
      <FxSlider v-model="radius" label="Radius" :min="2" :max="150" :step="1" :decimals="0" :reset-to="20" />
      <FxSlider v-model="hardness" label="Hardness" :min="0" :max="0.99" :step="0.01" :reset-to="0.5" />
      <FxSlider v-if="mode === 'blur'" v-model="sigma" label="Blur σ" :min="0.5" :max="50" :step="0.5" :reset-to="8" />
      <div v-if="mode === 'clone'" class="ctv:flex ctv:gap-1">
        <FxSlider v-model="dx" label="Src ΔX" :min="-300" :max="300" :step="1" :decimals="0" :reset-to="0" class="ctv:flex-1" />
        <FxSlider v-model="dy" label="Src ΔY" :min="-300" :max="300" :step="1" :decimals="0" :reset-to="0" class="ctv:flex-1" />
      </div>
      <div v-if="mode === 'color'" class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.colorLbl') }}</span>
        <input type="color" v-model="color"
               class="ctv:w-8 ctv:h-6 ctv:p-0 ctv:border ctv:border-border-subtle ctv:rounded ctv:cursor-pointer ctv:bg-transparent" />
      </div>

      <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground">
        <span>{{ strokes.length }} strokes</span>
        <button
          type="button"
          class="ctv:ml-auto ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
                 ctv:hover:border-primary-background ctv:disabled:opacity-40"
          :disabled="!strokes.length"
          @click="undoStroke"
        ><i class="pi pi-undo" /></button>
        <button
          type="button"
          class="ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-destructive-background
                 ctv:hover:border-destructive-background ctv:disabled:opacity-40"
          :disabled="!strokes.length"
          @click="clearStrokes"
        ><i class="pi pi-trash" /></button>
      </div>

      <div class="ctv:flex ctv:gap-1">
        <FxSlider v-model="tStart" :label="$t('fx.tStart')" :min="0" :max="3600" :step="0.05" class="ctv:flex-1" />
        <FxSlider v-model="tEnd" :label="$t('fx.tEnd')" :min="-1" :max="3600" :step="0.05" class="ctv:flex-1" />
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
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
import { computed, nextTick, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const MODES = [
  { value: 'clone', label: 'Clone' },
  { value: 'blur', label: 'Blur' },
  { value: 'color', label: 'Color' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const strokesRaw = useStrWidget(props.node, 'strokes', '')
const tStart = useNumWidget(props.node, 't_start', 0)
const tEnd = useNumWidget(props.node, 't_end', -1)

const mode = ref('clone')
const radius = ref(20)
const hardness = ref(0.5)
const sigma = ref(8)
const dx = ref(0)
const dy = ref(0)
const color = ref('#FF4444')

interface Stroke {
  mode: string
  points: { x: number; y: number; p: number }[]
  radius: number
  hardness: number
  dx?: number
  dy?: number
  sigma?: number
  color?: string
}

const strokes = computed<Stroke[]>({
  get: () => {
    try {
      const p = JSON.parse(strokesRaw.value || '[]')
      return Array.isArray(p) ? p : []
    } catch { return [] }
  },
  set: (v: Stroke[]) => {
    strokesRaw.value = v.length ? JSON.stringify(v) : ''
  },
})

const videoEl = ref<HTMLVideoElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)
const vw = ref(0)
const vh = ref(0)
const drawing = ref(false)
let current: Stroke | null = null

function fit() {
  const box = overlayEl.value
  if (!box || !vw.value) return { s: 1, offX: 0, offY: 0 }
  const s = Math.min(box.clientWidth / vw.value, box.clientHeight / vh.value)
  return { s, offX: (box.clientWidth - vw.value * s) / 2, offY: (box.clientHeight - vh.value * s) / 2 }
}

function toVideo(e: PointerEvent) {
  const rect = overlayEl.value!.getBoundingClientRect()
  const { s, offX, offY } = fit()
  return {
    x: Math.round(Math.min(vw.value, Math.max(0, (e.clientX - rect.left - offX) / s))),
    y: Math.round(Math.min(vh.value, Math.max(0, (e.clientY - rect.top - offY) / s))),
    p: e.pressure > 0 ? Math.round(e.pressure * 100) / 100 : 1.0,
  }
}

const STROKE_COLORS: Record<string, string> = {
  clone: 'rgba(79,195,247,0.55)', blur: 'rgba(174,213,129,0.55)',
}

function draw() {
  const c = overlayEl.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  if (c.width !== c.clientWidth) { c.width = c.clientWidth; c.height = c.clientHeight }
  ctx.clearRect(0, 0, c.width, c.height)
  const { s, offX, offY } = fit()
  const all = current ? [...strokes.value, current] : strokes.value
  for (const st of all) {
    ctx.strokeStyle = st.mode === 'color'
      ? (st.color ?? '#FF4444')
      : (STROKE_COLORS[st.mode] ?? 'rgba(255,255,255,0.5)')
    ctx.lineWidth = Math.max(2, st.radius * 2 * s)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = 0.55
    ctx.beginPath()
    st.points.forEach((p, i) => {
      const x = p.x * s + offX
      const y = p.y * s + offY
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    if (st.points.length === 1) {
      const p = st.points[0]
      ctx.arc(p.x * s + offX, p.y * s + offY, Math.max(1, st.radius * s), 0, Math.PI * 2)
      ctx.fillStyle = ctx.strokeStyle
      ctx.fill()
    } else {
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

function onMeta() {
  const v = videoEl.value
  if (!v) return
  vw.value = v.videoWidth
  vh.value = v.videoHeight
  nextTick(draw)
}

function onDown(e: PointerEvent) {
  e.stopPropagation()
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  drawing.value = true
  current = {
    mode: mode.value,
    points: [toVideo(e)],
    radius: radius.value,
    hardness: hardness.value,
  }
  if (mode.value === 'clone') { current.dx = dx.value; current.dy = dy.value }
  if (mode.value === 'blur') current.sigma = sigma.value
  if (mode.value === 'color') current.color = color.value
  draw()
}

function onMovePtr(e: PointerEvent) {
  if (!drawing.value || !current) return
  e.stopPropagation()
  const pt = toVideo(e)
  const last = current.points[current.points.length - 1]
  if (Math.hypot(pt.x - last.x, pt.y - last.y) >= 3) {
    current.points.push(pt)
    draw()
  }
}

function onUp(e: PointerEvent) {
  e.stopPropagation()
  if (drawing.value && current) {
    strokes.value = [...strokes.value, current]
  }
  drawing.value = false
  current = null
  draw()
}

function undoStroke() {
  strokes.value = strokes.value.slice(0, -1)
  nextTick(draw)
}
function clearStrokes() {
  strokes.value = []
  nextTick(draw)
}

watch([strokes, vw], () => nextTick(draw), { deep: true })
</script>
