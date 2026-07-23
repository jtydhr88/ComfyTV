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
      <FxChips v-model="mode" :options="MODE_OPTS" />
      <template v-if="mode === 'vertigo'">
        <FxSlider v-model="phaseIncrement" label="Speed" :min="0" :max="1" :step="0.005" :reset-to="0.08" />
        <FxSlider v-model="zoom" label="Zoom" :min="-0.5" :max="0.5" :step="0.005" :reset-to="0.06" />
        <FxSlider v-model="feedbackMix" label="Feedback" :min="0" :max="0.98" :step="0.01" :reset-to="0.75" />
      </template>
      <template v-else-if="mode === 'nervous'">
        <FxChips v-model="style" :options="STYLE_OPTS" />
        <FxSlider v-model="frames" label="Frames" :min="2" :max="32" :step="1" :decimals="0" :reset-to="32" />
        <FxSlider v-model="seed" label="Seed" :min="0" :max="9999" :step="1" :decimals="0" :reset-to="7" />
      </template>
      <div v-else class="ctv:text-2xs ctv:text-muted-foreground ctv:py-1">
        {{ $t('fx.echoHint') }}
      </div>

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

const MODE_OPTS = [
  { value: 'vertigo', label: 'Vertigo' },
  { value: 'echo', label: 'Echo' },
  { value: 'nervous', label: 'Nervous' },
]
const STYLE_OPTS = [
  { value: 'shuffle', label: 'Shuffle' },
  { value: 'scratch', label: 'Scratch' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const mode = useStrWidget(props.node, 'mode', 'vertigo')
const phaseIncrement = useNumWidget(props.node, 'phase_increment', 0.08)
const zoom = useNumWidget(props.node, 'zoom', 0.06)
const feedbackMix = useNumWidget(props.node, 'feedback_mix', 0.75)
const style = useStrWidget(props.node, 'style', 'shuffle')
const frames = useNumWidget(props.node, 'frames', 32)
const seed = useNumWidget(props.node, 'seed', 7)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const el = playerRef.value?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.FeedbackFXStage',
  getParams: () => ({
    mode: mode.value,
    phase_increment: phaseIncrement.value,
    zoom: zoom.value,
    feedback_mix: feedbackMix.value,
    style: style.value,
    frames: frames.value,
    seed: seed.value,
  }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})
</script>
