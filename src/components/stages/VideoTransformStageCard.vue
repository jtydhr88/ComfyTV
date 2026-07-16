<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" @meta="(m) => duration = m.duration" />

    <div class="ctv:text-2xs ctv:text-muted-foreground ctv:tracking-wide">{{ $t('fx.dragHint') }}</div>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxSlider v-model="posX" :label="$t('fx.position') + ' X'" :min="-2000" :max="2000" :step="1" :decimals="0" :reset-to="0" />
      <FxSlider v-model="posY" :label="$t('fx.position') + ' Y'" :min="-2000" :max="2000" :step="1" :decimals="0" :reset-to="0" />
      <FxSlider v-model="scale" :label="$t('fx.scale')" :min="0.05" :max="5" :step="0.01" :reset-to="1" />
      <FxSlider v-model="rotation" :label="$t('fx.rotation')" :min="-360" :max="360" :step="0.5" :reset-to="0" unit="°" />
      <FxSlider v-model="skewX" :label="$t('fx.skew')" :min="-2" :max="2" :step="0.01" :reset-to="0" />
      <FxSlider v-model="motionBlur" :label="$t('fx.motionBlur')" :min="0" :max="4" :step="0.5" :reset-to="0" />

      <KeyframeTimeline
        :keys="keys"
        :duration="duration"
        :selected-index="selectedIndex"
        :label="$t('fx.keyframes')"
        @add="onAddKey"
        @move="onMoveKey"
        @remove="onRemoveKey"
        @select="onSelectKey"
      />

      <div v-if="selectedIndex >= 0" class="ctv:flex ctv:items-center ctv:gap-1">
        <button
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background"
          @click="writeSlidersToSelectedKey"
        >{{ $t('fx.addKey') }}</button>
        <button
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background"
          @click="onRemoveKey(selectedIndex)"
        >{{ $t('fx.delKey') }}</button>
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
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
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

type TransformKey = {
  t: number
  x: number
  y: number
  scale: number
  rotation: number
  interp: string
}

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const posX = useNumWidget(props.node, 'pos_x', 0)
const posY = useNumWidget(props.node, 'pos_y', 0)
const scale = useNumWidget(props.node, 'scale', 1)
const rotation = useNumWidget(props.node, 'rotation', 0)
const skewX = useNumWidget(props.node, 'skew_x', 0)
const motionBlur = useNumWidget(props.node, 'motion_blur', 0)
const keyframesRaw = useStrWidget(props.node, 'keyframes', '')

const duration = ref(0)
const selectedIndex = ref(-1)

const keys = computed<TransformKey[]>({
  get() {
    try {
      const v = JSON.parse(keyframesRaw.value || '[]')
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  },
  set(v) {
    keyframesRaw.value = v.length ? JSON.stringify(v) : ''
  },
})

function onAddKey(t: number) {
  const k: TransformKey = {
    t,
    x: posX.value,
    y: posY.value,
    scale: scale.value,
    rotation: rotation.value,
    interp: 'smooth',
  }
  const next = [...keys.value, k].sort((a, b) => a.t - b.t)
  keys.value = next
  selectedIndex.value = next.indexOf(k)
}

function onMoveKey(i: number, t: number) {
  const cur = keys.value
  if (i < 0 || i >= cur.length) return
  const k = { ...cur[i], t }
  const next = [...cur.filter((_, idx) => idx !== i), k].sort((a, b) => a.t - b.t)
  keys.value = next
  selectedIndex.value = next.indexOf(k)
}

function onRemoveKey(i: number) {
  const cur = keys.value
  if (i < 0 || i >= cur.length) return
  keys.value = cur.filter((_, idx) => idx !== i)
  selectedIndex.value = -1
}

function onSelectKey(i: number) {
  const k = keys.value[i]
  if (!k) return
  selectedIndex.value = i
  posX.value = k.x
  posY.value = k.y
  scale.value = k.scale
  rotation.value = k.rotation
}

function writeSlidersToSelectedKey() {
  const cur = keys.value
  const i = selectedIndex.value
  if (i < 0 || i >= cur.length) return
  const next = cur.map((k, idx) => idx === i
    ? { ...k, x: posX.value, y: posY.value, scale: scale.value, rotation: rotation.value }
    : k)
  keys.value = next
}
</script>
