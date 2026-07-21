<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl">
        <template #overlay>
          <canvas
            v-show="supported"
            ref="previewCanvas"
            class="ctv:absolute ctv:inset-0 ctv:size-full ctv:object-contain ctv:pointer-events-none"
          />
        </template>
      </VideoPlayerLite>
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="mode" :options="MODES" />
      <FxSlider v-model="amount" :label="$t('fx.amount')" :min="0" :max="20" :step="0.1" :reset-to="2" />
      <FxSlider v-if="mode === 'sharpen'" v-model="size" :label="$t('fx.size')" :min="3" :max="13" :step="2" :decimals="0" :reset-to="5" />
      <FxSlider v-if="mode === 'bilateral'" v-model="edgePreserve" :label="$t('fx.edgePreserve')" :min="0.01" :max="1" :step="0.01" :reset-to="0.1" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.previewNote') }}</span>
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
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useChainedFxPreview } from '@/composables/stages/useChainedFxPreview'
import { VideoBlurRenderer } from '@/widgets/glsl/videoBlurRenderer'
import type { VideoBlurMode, VideoBlurParams } from '@/composables/stages/videoBlurMath'
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
  { value: 'gaussian', label: 'Gaussian' },
  { value: 'box', label: 'Box' },
  { value: 'bilateral', label: 'Bilateral' },
  { value: 'sharpen', label: 'Sharpen' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const mode = useStrWidget(props.node, 'mode', 'gaussian')
const amount = useNumWidget(props.node, 'amount', 2)
const size = useNumWidget(props.node, 'size', 5)
const edgePreserve = useNumWidget(props.node, 'edge_preserve', 0.1)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const previewVideoEl = computed<HTMLVideoElement | null>(
  () => playerRef.value?.videoEl ?? null,
)

function previewParams(): Partial<VideoBlurParams> {
  return {
    mode: mode.value as VideoBlurMode,
    amount: amount.value,
    size: size.value,
    edgePreserve: edgePreserve.value,
  }
}

const { supported } = useChainedFxPreview({
  videoEl: previewVideoEl,
  canvasEl: previewCanvas,
  nodeId: String(props.node.id),
  node: props.node,
  createRenderer: () => new VideoBlurRenderer(),
  params: previewParams,
})
</script>
