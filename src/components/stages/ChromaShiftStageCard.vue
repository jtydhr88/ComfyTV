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
      <FxSlider v-model="shiftRh" label="Red H" :min="-255" :max="255" :step="1" :decimals="0" :reset-to="0" />
      <FxSlider v-model="shiftRv" label="Red V" :min="-255" :max="255" :step="1" :decimals="0" :reset-to="0" />
      <FxSlider v-model="shiftBh" label="Blue H" :min="-255" :max="255" :step="1" :decimals="0" :reset-to="0" />
      <FxSlider v-model="shiftBv" label="Blue V" :min="-255" :max="255" :step="1" :decimals="0" :reset-to="0" />
      <FxChips v-model="shiftEdge" :options="EDGES" />
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
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useChainedFxPreview } from '@/composables/stages/useChainedFxPreview'
import { VideoChromaShiftRenderer } from '@/widgets/glsl/videoChromaShiftRenderer'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const EDGES = [
  { value: 'smear', label: 'Smear' },
  { value: 'wrap', label: 'Wrap' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const shiftRh = useNumWidget(props.node, 'shift_rh', 0)
const shiftRv = useNumWidget(props.node, 'shift_rv', 0)
const shiftBh = useNumWidget(props.node, 'shift_bh', 0)
const shiftBv = useNumWidget(props.node, 'shift_bv', 0)
const shiftEdge = useStrWidget(props.node, 'shift_edge', 'smear')

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const videoEl = computed<HTMLVideoElement | null>(() => playerRef.value?.videoEl ?? null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)

const { supported } = useChainedFxPreview({
  videoEl,
  canvasEl: previewCanvas,
  nodeId: String(props.node.id),
  node: props.node,
  params: () => ({
    shiftRh: shiftRh.value,
    shiftRv: shiftRv.value,
    shiftBh: shiftBh.value,
    shiftBv: shiftBv.value,
    shiftEdge: shiftEdge.value,
  }),
  createRenderer: () => new VideoChromaShiftRenderer(),
})
</script>
