<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite :source-video-url="sourceVideoUrl" @meta="(m) => duration = m.duration" />
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="mode" :options="MODES" />

      <template v-if="mode === 'hold'">
        <FxSlider v-model="holdFrame" label="Hold frame" :min="0" :max="10000" :step="1" :decimals="0" :reset-to="0" />
        <FxSlider v-model="holdIncrement" label="Increment" :min="0" :max="1000" :step="1" :decimals="0" :reset-to="0" />
        <div class="ctv:text-3xs ctv:text-muted-foreground ctv:tracking-wide">
          0 = freeze on the frame · N = advance every N frames
        </div>
      </template>

      <FxSlider v-if="mode === 'speed'" v-model="speed" label="Speed ×" :min="0.05" :max="8" :step="0.05" :reset-to="1" />

      <KeyframeTimeline
        v-if="mode === 'speed'"
        :keys="keys"
        :duration="duration"
        :selected-index="selectedIndex"
        :label="$t('fx.keyframes')"
        @add="onAddKey"
        @move="onMoveKey"
        @remove="onRemoveKey"
        @select="onSelectKey"
      />

      <div v-if="mode === 'speed' && selectedIndex >= 0" class="ctv:flex ctv:items-center ctv:gap-1">
        <button
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background"
          @click="writeSliderToSelectedKey"
        >{{ $t('fx.addKey') }}</button>
        <button
          type="button"
          class="ctv:flex-1 ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background"
          @click="onRemoveKey(selectedIndex)"
        >{{ $t('fx.delKey') }}</button>
      </div>

      <FxSlider v-if="mode === 'speed'" v-model="smoothFps" label="Smooth fps" :min="0" :max="120" :step="1" :decimals="0" :reset-to="0" />
      <div v-if="mode === 'speed'" class="ctv:text-3xs ctv:text-muted-foreground ctv:tracking-wide">
        0 = off · >0 = optical-flow pre-interpolation (slow)
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
      <span v-else-if="mode === 'speed' && keys.length === 0" class="ctv:text-muted-foreground">Add speed keyframes on the timeline</span>
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
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxCardShell from '@/components/stages/FxCardShell.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import KeyframeTimeline from '@/components/widgets/fx/KeyframeTimeline.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
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

type SpeedKey = {
  t: number
  v: number
  interp: string
}

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const speedKeysRaw = useStrWidget(props.node, 'speed_keys', '')
const smoothFps = useNumWidget(props.node, 'smooth_fps', 0)
const mode = useStrWidget(props.node, 'mode', 'speed')
const holdFrame = useNumWidget(props.node, 'hold_frame', 0)
const holdIncrement = useNumWidget(props.node, 'hold_increment', 0)

const MODES = [
  { value: 'speed', label: 'Speed ramp' },
  { value: 'hold', label: 'Frame hold' },
]

const speed = ref(1)
const duration = ref(0)

const {
  keys,
  selected: selectedIndex,
  addAt: onAddKey,
  moveAt: onMoveKey,
  removeAt: onRemoveKey,
  select: onSelectKey,
  updateSelected: writeSliderToSelectedKey,
} = useKeyframes<SpeedKey>({
  raw: speedKeysRaw,
  snapshot: (t) => ({ t, v: speed.value, interp: 'smooth' }),
  apply: (k) => { speed.value = k.v },
  update: (k) => ({ ...k, v: speed.value }),
  followMove: true,
})
</script>
