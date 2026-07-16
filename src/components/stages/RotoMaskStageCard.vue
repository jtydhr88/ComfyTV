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
          @dblclick="onDbl"
        />
      </template>
    </div>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('fx.rotoHint') }}</div>
      <FxSlider v-model="feather" :label="$t('fx.feather')" :min="0" :max="200" :step="1" :decimals="0" :reset-to="0" />
      <div class="ctv:flex ctv:items-center ctv:gap-1.5">
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="invert" class="ctv:accent-primary-background" />
          {{ $t('fx.invert') }}
        </label>
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="smooth" class="ctv:accent-primary-background" />
          Bezier
        </label>
        <button
          type="button"
          class="ctv:ml-auto ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-destructive-background
                 ctv:hover:border-destructive-background"
          @click="clearShape"
        ><i class="pi pi-trash" /> {{ $t('fx.clearKeys') }}</button>
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
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useBoolWidget, useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const shapeRaw = useStrWidget(props.node, 'shape_keys', '')
const feather = useNumWidget(props.node, 'feather', 0)
const invert = useBoolWidget(props.node, 'invert', false)
const smooth = ref(true)

const videoEl = ref<HTMLVideoElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)
const vw = ref(0)
const vh = ref(0)
const dragIdx = ref(-1)

type Pt = { x: number; y: number }

const verts = ref<Pt[]>([])

function loadFromWidget() {
  try {
    const keys = JSON.parse(shapeRaw.value || '[]')
    const pts = keys?.[0]?.points
    if (Array.isArray(pts)) {
      verts.value = pts.map((p: any) => ({ x: Number(p.x), y: Number(p.y) }))
      return
    }
  } catch {  }
  verts.value = []
}
loadFromWidget()

function saveToWidget() {
  if (verts.value.length < 3) {
    shapeRaw.value = ''
    return
  }
  const n = verts.value.length
  const points = verts.value.map((p, i) => {
    if (!smooth.value) {
      return { x: p.x, y: p.y, lx: p.x, ly: p.y, rx: p.x, ry: p.y }
    }
    const prev = verts.value[(i - 1 + n) % n]
    const next = verts.value[(i + 1) % n]
    const tx = (next.x - prev.x) / 6
    const ty = (next.y - prev.y) / 6
    return {
      x: p.x, y: p.y,
      lx: p.x - tx, ly: p.y - ty,
      rx: p.x + tx, ry: p.y + ty,
    }
  })
  shapeRaw.value = JSON.stringify([{ t: 0, points }])
}

function fit() {
  const box = overlayEl.value
  if (!box || !vw.value) return { scale: 1, offX: 0, offY: 0 }
  const scale = Math.min(box.clientWidth / vw.value, box.clientHeight / vh.value)
  return {
    scale,
    offX: (box.clientWidth - vw.value * scale) / 2,
    offY: (box.clientHeight - vh.value * scale) / 2,
  }
}

function toVideo(e: MouseEvent): Pt {
  const rect = overlayEl.value!.getBoundingClientRect()
  const { scale, offX, offY } = fit()
  return {
    x: Math.min(vw.value, Math.max(0, (e.clientX - rect.left - offX) / scale)),
    y: Math.min(vh.value, Math.max(0, (e.clientY - rect.top - offY) / scale)),
  }
}

function draw() {
  const c = overlayEl.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  if (c.width !== c.clientWidth) { c.width = c.clientWidth; c.height = c.clientHeight }
  ctx.clearRect(0, 0, c.width, c.height)
  const pts = verts.value
  if (!pts.length) return
  const { scale, offX, offY } = fit()
  const disp = pts.map((p) => ({ x: p.x * scale + offX, y: p.y * scale + offY }))

  if (disp.length >= 3) {
    ctx.beginPath()
    disp.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.fillStyle = 'rgba(79,195,247,0.18)'
    ctx.fill()
    ctx.strokeStyle = '#4fc3f7'
    ctx.lineWidth = 1.5
    ctx.stroke()
  } else if (disp.length === 2) {
    ctx.beginPath()
    ctx.moveTo(disp[0].x, disp[0].y)
    ctx.lineTo(disp[1].x, disp[1].y)
    ctx.strokeStyle = '#4fc3f7'
    ctx.stroke()
  }
  disp.forEach((p, i) => {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = i === dragIdx.value ? '#ffb74d' : '#4fc3f7'
    ctx.fill()
    ctx.strokeStyle = '#000'
    ctx.stroke()
  })
}

function hit(e: MouseEvent): number {
  const p = toVideo(e)
  const { scale } = fit()
  const r = 12 / scale
  return verts.value.findIndex((v) => Math.hypot(v.x - p.x, v.y - p.y) < r)
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
  const idx = hit(e)
  if (idx >= 0) {
    dragIdx.value = idx
  } else {
    verts.value = [...verts.value, toVideo(e)]
    dragIdx.value = verts.value.length - 1
    saveToWidget()
  }
  draw()
}

function onMovePtr(e: PointerEvent) {
  if (dragIdx.value < 0) return
  e.stopPropagation()
  const next = verts.value.slice()
  next[dragIdx.value] = toVideo(e)
  verts.value = next
}

function onUp(e: PointerEvent) {
  if (dragIdx.value >= 0) saveToWidget()
  dragIdx.value = -1
  e.stopPropagation()
  draw()
}

function onDbl(e: MouseEvent) {
  const idx = hit(e)
  if (idx >= 0) {
    const next = verts.value.slice()
    next.splice(idx, 1)
    verts.value = next
    saveToWidget()
    draw()
  }
}

function clearShape() {
  verts.value = []
  shapeRaw.value = ''
  draw()
}

watch([verts, smooth], () => { saveToWidget(); nextTick(draw) }, { deep: true })
</script>
