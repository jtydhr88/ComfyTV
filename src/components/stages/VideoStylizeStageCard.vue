<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl">
      <template #overlay>
        <canvas
          v-show="supported"
          ref="previewCanvas"
          class="ctv:absolute ctv:inset-0 ctv:size-full ctv:object-contain ctv:pointer-events-none"
        />
      </template>
    </VideoPlayerLite>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="effect" :options="EFFECTS" />
      <FxSlider v-if="showStrength" v-model="strength" :label="$t('fx.strength')" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      <FxSlider v-if="effect === 'pixelize'" v-model="block" :label="$t('fx.block')" :min="2" :max="64" :step="1" :decimals="0" :reset-to="8" />
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
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useVideoStylizePreview } from '@/composables/stages/useVideoStylizePreview'
import type { StylizeEffect, VideoStylizeParams } from '@/composables/stages/videoStylizeMath'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const EFFECTS = [
  { value: 'vignette', label: 'Vignette' },
  { value: 'grain', label: 'Grain' },
  { value: 'pixelize', label: 'Pixelize' },
  { value: 'edge', label: 'Edge' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'monochrome', label: 'Mono' },
  { value: 'old_film', label: 'Old Film' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const effect = useStrWidget(props.node, 'effect', 'vignette')
const strength = useNumWidget(props.node, 'strength', 0.5)
const block = useNumWidget(props.node, 'block', 8)

const showStrength = computed(() => !['sepia', 'monochrome', 'pixelize'].includes(effect.value))

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const previewVideoEl = computed<HTMLVideoElement | null>(
  () => playerRef.value?.videoEl ?? null,
)

function previewParams(): Partial<VideoStylizeParams> {
  return {
    effect: effect.value as StylizeEffect,
    strength: strength.value,
    block: block.value,
  }
}

const { supported } = useVideoStylizePreview({
  videoEl: previewVideoEl,
  canvasEl: previewCanvas,
  nodeId: String(props.node.id),
  params: previewParams,
})
</script>
