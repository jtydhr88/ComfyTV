<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="mode" :options="MODES" />

      <template v-if="mode === 'window'">
        <FxSlider v-model="frameMin" label="First frame" :min="-60" :max="0" :step="1" :decimals="0" :reset-to="-5" />
        <FxSlider v-model="frameMax" label="Last frame" :min="0" :max="60" :step="1" :decimals="0" :reset-to="0" />
        <FxSlider v-model="interval" label="Interval" :min="1" :max="10" :step="1" :decimals="0" :reset-to="1" />
        <FxChips v-model="operation" :options="OPERATIONS" />
        <FxSlider v-model="decay" label="Decay" :min="0" :max="1" :step="0.01" :reset-to="0" />
      </template>
      <template v-else>
        <FxSlider v-model="shutter" label="Shutter (frames)" :min="0" :max="8" :step="0.05" :reset-to="0.5" />
        <FxChips v-model="shutterType" :options="SHUTTER_TYPES" />
        <FxSlider v-if="shutterType === 'custom'" v-model="shutterOffset" label="Offset" :min="-8" :max="8" :step="0.05" :reset-to="0" />
        <FxSlider v-model="divisions" label="Divisions" :min="1" :max="64" :step="1" :decimals="0" :reset-to="10" />
      </template>
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
import { computed } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
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
  { value: 'window', label: 'Frame window' },
  { value: 'shutter', label: 'Shutter' },
]
const OPERATIONS = ['average', 'min', 'max', 'sum', 'product'].map(v => ({ value: v, label: v }))
const SHUTTER_TYPES = ['centered', 'start', 'end', 'custom'].map(v => ({ value: v, label: v }))

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const mode = useStrWidget(props.node, 'mode', 'window')
const frameMin = useNumWidget(props.node, 'frame_min', -5)
const frameMax = useNumWidget(props.node, 'frame_max', 0)
const interval = useNumWidget(props.node, 'interval', 1)
const operation = useStrWidget(props.node, 'operation', 'average')
const decay = useNumWidget(props.node, 'decay', 0)
const shutter = useNumWidget(props.node, 'shutter', 0.5)
const shutterType = useStrWidget(props.node, 'shutter_type', 'centered')
const shutterOffset = useNumWidget(props.node, 'shutter_offset', 0)
const divisions = useNumWidget(props.node, 'divisions', 10)
</script>
