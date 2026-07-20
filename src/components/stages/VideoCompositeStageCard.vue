<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full" @contextmenu.stop.prevent>
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
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import KeyframeTimeline from '@/components/widgets/fx/KeyframeTimeline.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useCompositeOverlay } from '@/composables/stages/useCompositeOverlay'
import { useKeyframes } from '@/composables/widgets/useKeyframes'
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

const {
  keys,
  selected: selectedKey,
  addAt: addKey,
  moveAt: moveKey,
  removeAt: removeKey,
  select: selectKey,
  updateSelected: updateSelectedKey,
} = useKeyframes<CKey>({
  raw: keyframesRaw,
  snapshot: (t) => ({
    t,
    x: posX.value, y: posY.value, scale: scale.value,
    rotation: rotation.value, opacity: opacity.value, interp: 'smooth',
  }),
  apply: (k) => {
    posX.value = k.x
    posY.value = k.y
    scale.value = k.scale
    rotation.value = k.rotation
    opacity.value = k.opacity
  },
})

const videoEl = ref<HTMLVideoElement | null>(null)
const overlayEl = ref<HTMLCanvasElement | null>(null)

const {
  duration, currentTime, dragging,
  onMeta, onTime, onDown, onMovePtr, onUp, onWheel,
} = useCompositeOverlay({ videoEl, overlayEl, posX, posY, scale, rotation })
</script>
