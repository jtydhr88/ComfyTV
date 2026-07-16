<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div
      class="ctv:relative ctv:w-full ctv:h-[200px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <div v-if="!bgUrl"
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <i class="pi pi-clone ctv:text-[32px] ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('fx.needsBgFg') }}</div>
      </div>
      <template v-else>
        <video
          ref="videoEl" :src="bgUrl" muted playsinline preload="metadata"
          class="ctv:block ctv:size-full ctv:object-contain"
          @loadedmetadata="onMeta"
          @timeupdate="onTime"
        />
        <canvas
          ref="overlayEl"
          class="ctv:absolute ctv:inset-0 ctv:size-full ctv:touch-none"
          :class="dragging ? 'ctv:cursor-grabbing' : 'ctv:cursor-grab'"
          @pointerdown="onDown"
          @pointermove="onMovePtr"
          @pointerup="onUp"
          @pointercancel="onUp"
          @wheel.prevent="onWheel"
        />
      </template>
    </div>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop @pointermove.stop @pointerup.stop
    >
      <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('fx.dragHint') }}</div>

      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.operator') }}</span>
        <select
          v-model="operator"
          class="ctv:flex-1 ctv:py-0.5 ctv:px-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background
                 ctv:border ctv:border-border-subtle ctv:text-base-foreground"
        >
          <optgroup v-for="grp in OPERATOR_GROUPS" :key="grp.label" :label="grp.label">
            <option v-for="op in grp.ops" :key="op" :value="op">{{ op }}</option>
          </optgroup>
        </select>
      </div>

      <FxSlider v-model="opacity" :label="$t('fx.opacity')" :min="0" :max="1" :step="0.01" :reset-to="1" />
      <FxSlider v-model="scale" :label="$t('fx.scale')" :min="0.05" :max="4" :step="0.01" :reset-to="1" />
      <FxSlider v-model="rotation" :label="$t('fx.rotation')" :min="-360" :max="360" :step="0.5" :reset-to="0" unit="°" />

      <KeyframeTimeline
        :keys="keys"
        :duration="duration"
        :current-time="currentTime"
        :selected-index="selectedKey"
        :label="$t('fx.keyframes')"
        @add="addKey"
        @move="moveKey"
        @remove="removeKey"
        @select="selectKey"
      />
      <div v-if="selectedKey >= 0" class="ctv:flex ctv:items-center ctv:gap-1">
        <button
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
                 ctv:hover:border-primary-background"
          @click="updateSelectedKey"
        ><i class="pi pi-check" /> {{ $t('fx.addKey') }}</button>
        <button
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-destructive-background
                 ctv:hover:border-destructive-background"
          @click="removeKey(selectedKey)"
        ><i class="pi pi-times" /> {{ $t('fx.delKey') }}</button>
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!bgUrl || !fgUrl" class="ctv:text-muted-foreground">{{ $t('fx.needsBgFg') }}</span>
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
import KeyframeTimeline from '@/components/widgets/fx/KeyframeTimeline.vue'
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

const OPERATOR_GROUPS = [
  { label: 'Porter-Duff', ops: ['over', 'under', 'in', 'out', 'atop', 'xor', 'mask', 'stencil', 'matte', 'copy', 'conjoint-over', 'disjoint-over'] },
  { label: 'Light', ops: ['screen', 'multiply', 'overlay', 'hard-light', 'soft-light', 'color-dodge', 'color-burn', 'pinlight'] },
  { label: 'Arithmetic', ops: ['plus', 'minus', 'from', 'average', 'difference', 'divide', 'exclusion', 'min', 'max', 'geometric', 'hypot'] },
  { label: 'Grain', ops: ['grain-extract', 'grain-merge', 'freeze', 'reflect'] },
  { label: 'HSL', ops: ['hue', 'saturation', 'color', 'luminosity'] },
]

const bgUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'background'))
const fgUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'foreground'))

const operator = useStrWidget(props.node, 'operator', 'over')
const opacity = useNumWidget(props.node, 'opacity', 1)
const posX = useNumWidget(props.node, 'pos_x', 0)
const posY = useNumWidget(props.node, 'pos_y', 0)
const scale = useNumWidget(props.node, 'scale', 1)
const rotation = useNumWidget(props.node, 'rotation', 0)
const keyframesRaw = useStrWidget(props.node, 'keyframes', '')

interface CKey {
  t: number; x: number; y: number; scale: number
  rotation: number; opacity: number; interp: string
}

const keys = computed<CKey[]>({
  get: () => {
    try {
      const p = JSON.parse(keyframesRaw.value || '[]')
      return Array.isArray(p) ? p : []
    } catch { return [] }
  },
  set: (v: CKey[]) => {
    keyframesRaw.value = v.length
      ? JSON.stringify(v.slice().sort((a, b) => a.t - b.t))
      : ''
  },
})
const selectedKey = ref(-1)
const duration = ref(0)
const currentTime = ref(0)

function snapshotKey(t: number): CKey {
  return {
    t: Math.round(t * 100) / 100,
    x: posX.value, y: posY.value, scale: scale.value,
    rotation: rotation.value, opacity: opacity.value, interp: 'smooth',
  }
}
function addKey(t: number) {
  const next = [...keys.value, snapshotKey(t)].sort((a, b) => a.t - b.t)
  keys.value = next
  selectedKey.value = next.findIndex((k) => k.t === Math.round(t * 100) / 100)
}
function moveKey(i: number, t: number) {
  const next = keys.value.slice()
  if (!next[i]) return
  next[i] = { ...next[i], t: Math.round(t * 100) / 100 }
  keys.value = next
}
function removeKey(i: number) {
  const next = keys.value.slice()
  next.splice(i, 1)
  keys.value = next
  selectedKey.value = -1
}
function selectKey(i: number) {
  selectedKey.value = i
  const k = keys.value[i]
  if (!k) return
  posX.value = k.x
  posY.value = k.y
  scale.value = k.scale
  rotation.value = k.rotation
  opacity.value = k.opacity
}
function updateSelectedKey() {
  const i = selectedKey.value
  if (i < 0 || !keys.value[i]) return
  const next = keys.value.slice()
  next[i] = { ...snapshotKey(next[i].t) }
  keys.value = next
}

const videoEl = ref<HTMLVideoElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)
const vw = ref(0)
const vh = ref(0)
const dragging = ref(false)
let dragStart: { px: number; py: number; x0: number; y0: number } | null = null

function fit() {
  const box = overlayEl.value
  if (!box || !vw.value) return { s: 1, offX: 0, offY: 0 }
  const s = Math.min(box.clientWidth / vw.value, box.clientHeight / vh.value)
  return { s, offX: (box.clientWidth - vw.value * s) / 2, offY: (box.clientHeight - vh.value * s) / 2 }
}

function draw() {
  const c = overlayEl.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  if (c.width !== c.clientWidth) { c.width = c.clientWidth; c.height = c.clientHeight }
  ctx.clearRect(0, 0, c.width, c.height)
  if (!vw.value) return
  const { s, offX, offY } = fit()
  const cx = (vw.value / 2 + posX.value) * s + offX
  const cy = (vh.value / 2 - posY.value) * s + offY
  const hw = (vw.value * scale.value * s) / 2
  const hh = (vh.value * scale.value * s) / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((-rotation.value * Math.PI) / 180)
  ctx.strokeStyle = '#ffb74d'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 4])
  ctx.strokeRect(-hw, -hh, hw * 2, hh * 2)
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.arc(0, 0, 4, 0, Math.PI * 2)
  ctx.fillStyle = '#ffb74d'
  ctx.fill()
  ctx.restore()
}

function onMeta() {
  const v = videoEl.value
  if (!v) return
  vw.value = v.videoWidth
  vh.value = v.videoHeight
  duration.value = v.duration || 0
  nextTick(draw)
}
function onTime() {
  currentTime.value = videoEl.value?.currentTime ?? 0
}

function onDown(e: PointerEvent) {
  e.stopPropagation()
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  dragging.value = true
  dragStart = { px: e.clientX, py: e.clientY, x0: posX.value, y0: posY.value }
}
function onMovePtr(e: PointerEvent) {
  if (!dragging.value || !dragStart) return
  e.stopPropagation()
  const { s } = fit()
  posX.value = Math.round(dragStart.x0 + (e.clientX - dragStart.px) / s)
  posY.value = Math.round(dragStart.y0 - (e.clientY - dragStart.py) / s)
}
function onUp(e: PointerEvent) {
  dragging.value = false
  dragStart = null
  e.stopPropagation()
}
function onWheel(e: WheelEvent) {
  scale.value = Math.min(4, Math.max(0.05,
    Math.round(scale.value * (e.deltaY > 0 ? 0.95 : 1.05) * 100) / 100))
}

watch([posX, posY, scale, rotation, vw], () => nextTick(draw))
</script>
