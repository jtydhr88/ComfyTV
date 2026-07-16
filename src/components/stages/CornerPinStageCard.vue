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
          @click="togglePlay"
        />
        <canvas
          ref="overlayEl"
          class="ctv:absolute ctv:inset-0 ctv:size-full ctv:touch-none"
          :class="dragIdx >= 0 ? 'ctv:cursor-grabbing' : 'ctv:cursor-crosshair'"
          @pointerdown="onDown"
          @pointermove="onMovePtr"
          @pointerup="onUp"
          @pointercancel="onUp"
        />
      </template>
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:flex-1 ctv:text-2xs ctv:text-muted-foreground">{{ $t('fx.cornerHint') }}</span>
      <button
        type="button"
        class="ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
               ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
               ctv:hover:border-primary-background"
        @click="resetCorners"
      >{{ $t('fx.clearKeys') }}</button>
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
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const cornersRaw = useStrWidget(props.node, 'corners', '')

const videoEl = ref<HTMLVideoElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)
const vw = ref(0)
const vh = ref(0)
const dragIdx = ref(-1)

type Pt = [number, number]

const corners = computed<Pt[]>({
  get: (): Pt[] => {
    try {
      const p = JSON.parse(cornersRaw.value || 'null')
      if (Array.isArray(p) && p.length === 4) return p as Pt[]
    } catch {  }
    if (!vw.value) return []
    return [[0, 0], [vw.value, 0], [vw.value, vh.value], [0, vh.value]] as Pt[]
  },
  set: (v: Pt[]) => {
    cornersRaw.value = JSON.stringify(v.map(([x, y]) =>
      [Math.round(x * 10) / 10, Math.round(y * 10) / 10]))
  },
})

function fit() {
  const box = overlayEl.value
  if (!box || !vw.value) return { scale: 1, offX: 0, offY: 0 }
  const bw = box.clientWidth
  const bh = box.clientHeight
  const scale = Math.min(bw / vw.value, bh / vh.value)
  return { scale, offX: (bw - vw.value * scale) / 2, offY: (bh - vh.value * scale) / 2 }
}

function toVideo(e: PointerEvent): Pt {
  const rect = overlayEl.value!.getBoundingClientRect()
  const { scale, offX, offY } = fit()
  return [
    Math.min(vw.value, Math.max(0, (e.clientX - rect.left - offX) / scale)),
    Math.min(vh.value, Math.max(0, (e.clientY - rect.top - offY) / scale)),
  ]
}

function draw() {
  const c = overlayEl.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  if (c.width !== c.clientWidth) { c.width = c.clientWidth; c.height = c.clientHeight }
  ctx.clearRect(0, 0, c.width, c.height)
  const pts = corners.value
  if (pts.length !== 4) return
  const { scale, offX, offY } = fit()
  const disp = pts.map(([x, y]) => [x * scale + offX, y * scale + offY])
  ctx.strokeStyle = '#4fc3f7'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  disp.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.closePath()
  ctx.stroke()
  const labels = ['TL', 'TR', 'BR', 'BL']
  disp.forEach(([x, y], i) => {
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.fillStyle = i === dragIdx.value ? '#ffb74d' : '#4fc3f7'
    ctx.fill()
    ctx.strokeStyle = '#000'
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = '9px monospace'
    ctx.fillText(labels[i], x + 8, y - 6)
  })
}

function onMeta() {
  const v = videoEl.value
  if (!v) return
  vw.value = v.videoWidth
  vh.value = v.videoHeight
  if (!cornersRaw.value) corners.value = [[0, 0], [vw.value, 0], [vw.value, vh.value], [0, vh.value]]
  nextTick(draw)
}

function onDown(e: PointerEvent) {
  e.stopPropagation()
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  const [px, py] = toVideo(e)
  const { scale } = fit()
  let best = -1
  let bestD = 24 / scale
  corners.value.forEach(([x, y], i) => {
    const d = Math.hypot(x - px, y - py)
    if (d < bestD) { bestD = d; best = i }
  })
  dragIdx.value = best
  draw()
}

function onMovePtr(e: PointerEvent) {
  if (dragIdx.value < 0) return
  e.stopPropagation()
  const pts = corners.value.slice() as Pt[]
  pts[dragIdx.value] = toVideo(e)
  corners.value = pts
}

function onUp(e: PointerEvent) {
  dragIdx.value = -1
  e.stopPropagation()
  draw()
}

function resetCorners() {
  if (vw.value) corners.value = [[0, 0], [vw.value, 0], [vw.value, vh.value], [0, vh.value]]
}

function togglePlay() {
  const v = videoEl.value
  if (!v) return
  if (v.paused) v.play()
  else v.pause()
}

watch([corners, vw], () => nextTick(draw), { deep: true })
</script>
