<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:relative ctv:w-full ctv:h-[200px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle">
      <video
        ref="videoEl"
        :src="sourceVideoUrl ?? undefined"
        muted
        playsinline
        preload="metadata"
        class="ctv:block ctv:size-full ctv:object-contain"
        @loadedmetadata="onMeta"
        @click="onVideoClick"
      />
      <canvas ref="overlayEl" class="ctv:absolute ctv:inset-0 ctv:size-full ctv:pointer-events-none" />
    </div>

    <div class="ctv:text-2xs ctv:text-muted-foreground ctv:tracking-wide">{{ $t('fx.trackHint') }}</div>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxSlider v-model="tStart" :label="$t('fx.tStart')" :min="0" :max="3600" :step="0.05" />
      <FxSlider v-model="tEnd" :label="$t('fx.tEnd')" :min="-1" :max="3600" :step="0.05" />
      <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('fx.tEndAuto') }}</div>
      <FxSlider v-model="pattern" :label="$t('fx.pattern')" :min="4" :max="64" :step="1" :decimals="0" />
      <FxSlider v-model="search" :label="$t('fx.searchR')" :min="8" :max="128" :step="1" :decimals="0" />
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
import { computed, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useNumWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const pointX = useNumWidget(props.node, 'point_x', 0)
const pointY = useNumWidget(props.node, 'point_y', 0)
const tStart = useNumWidget(props.node, 't_start', 0)
const tEnd = useNumWidget(props.node, 't_end', -1)
const pattern = useNumWidget(props.node, 'pattern', 16)
const search = useNumWidget(props.node, 'search', 32)

const videoEl = ref<HTMLVideoElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)
const videoW = ref(0)
const videoH = ref(0)
const duration = ref(0)

function onMeta() {
  const v = videoEl.value
  if (!v) return
  videoW.value = v.videoWidth
  videoH.value = v.videoHeight
  duration.value = v.duration || 0
  redraw()
}

function fitMetrics() {
  const v = videoEl.value
  if (!v || videoW.value <= 0 || videoH.value <= 0) return null
  const boxW = v.clientWidth
  const boxH = v.clientHeight
  const s = Math.min(boxW / videoW.value, boxH / videoH.value)
  const dispW = videoW.value * s
  const dispH = videoH.value * s
  return { s, offX: (boxW - dispW) / 2, offY: (boxH - dispH) / 2, boxW, boxH }
}

function onVideoClick(e: MouseEvent) {
  const m = fitMetrics()
  if (!m) return
  const px = (e.offsetX - m.offX) / m.s
  const py = (e.offsetY - m.offY) / m.s
  pointX.value = Math.round(Math.min(videoW.value, Math.max(0, px)))
  pointY.value = Math.round(Math.min(videoH.value, Math.max(0, py)))
}

function redraw() {
  const canvas = overlayEl.value
  const m = fitMetrics()
  if (!canvas) return
  canvas.width = canvas.clientWidth
  canvas.height = canvas.clientHeight
  const ctx = canvas.getContext('2d')
  if (!ctx || !m) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const dx = m.offX + pointX.value * m.s
  const dy = m.offY + pointY.value * m.s

  ctx.strokeStyle = '#4ade80'
  ctx.lineWidth = 1
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(dx - 8, dy)
  ctx.lineTo(dx + 8, dy)
  ctx.moveTo(dx, dy - 8)
  ctx.lineTo(dx, dy + 8)
  ctx.stroke()

  const pHalf = pattern.value * m.s
  ctx.strokeStyle = '#4ade80'
  ctx.strokeRect(dx - pHalf, dy - pHalf, pHalf * 2, pHalf * 2)

  const sHalf = search.value * m.s
  ctx.strokeStyle = '#facc15'
  ctx.setLineDash([4, 3])
  ctx.strokeRect(dx - sHalf, dy - sHalf, sHalf * 2, sHalf * 2)
  ctx.setLineDash([])
}

watch([pointX, pointY, pattern, search], redraw)
</script>
