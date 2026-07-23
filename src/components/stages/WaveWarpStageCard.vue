<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl" />
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxSlider v-model="amplitude" label="Amplitude" :min="0" :max="200" :step="1" :decimals="0" :reset-to="16" />
      <FxSlider v-model="frequency" label="Frequency" :min="0.1" :max="40" :step="0.1" :reset-to="3" />
      <FxSlider v-model="speed" label="Speed" :min="-8" :max="8" :step="0.05" :reset-to="0.5" />
      <FxChips v-model="axis" :options="AXIS_OPTS" />
      <FxChips v-model="envelope" :options="ENV_OPTS" />

      <FxClipPreviewPanel :preview="preview" :enabled="!!sourceVideoUrl" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.chainMode') }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      hide-run-button
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
import FxClipPreviewPanel from '@/components/stages/FxClipPreviewPanel.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useFxClipPreview } from '@/composables/stages/useFxClipPreview'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const AXIS_OPTS = [
  { value: 'both', label: 'Both' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
]
const ENV_OPTS = [
  { value: 'parabolic', label: 'Parabolic' },
  { value: 'uniform', label: 'Uniform' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const amplitude = useNumWidget(props.node, 'amplitude', 16)
const frequency = useNumWidget(props.node, 'frequency', 3)
const speed = useNumWidget(props.node, 'speed', 0.5)
const axis = useStrWidget(props.node, 'axis', 'both')
const envelope = useStrWidget(props.node, 'envelope', 'parabolic')

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const el = playerRef.value?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.WaveWarpStage',
  getParams: () => ({
    amplitude: amplitude.value,
    frequency: frequency.value,
    speed: speed.value,
    axis: axis.value,
    envelope: envelope.value,
  }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})
</script>
