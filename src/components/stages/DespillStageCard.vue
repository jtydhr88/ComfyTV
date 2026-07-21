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
      <FxChips v-model="screen" :options="SCREENS" />
      <FxSlider v-model="spillMix" label="Spillmap mix" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      <FxSlider v-model="expand" label="Expand" :min="0" :max="1" :step="0.01" :reset-to="0" />
      <FxSlider v-model="redScale" label="Red scale" :min="-2" :max="2" :step="0.01" :reset-to="0" :gradient="CHANNEL_STOPS.red" />
      <FxSlider v-model="greenScale" label="Green scale" :min="-2" :max="2" :step="0.01" :reset-to="-1" :gradient="CHANNEL_STOPS.green" />
      <FxSlider v-model="blueScale" label="Blue scale" :min="-2" :max="2" :step="0.01" :reset-to="0" :gradient="CHANNEL_STOPS.blue" />
      <FxSlider v-model="brightness" label="Brightness" :min="-1" :max="1" :step="0.01" :reset-to="0" :gradient="LUMA_STOPS" />
      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="outputSpillmap" class="ctv:accent-primary-background" />
        Output spillmap
      </label>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
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
import { VideoDespillRenderer } from '@/widgets/glsl/keyingRenderers'
import { useBoolWidget, useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'
import { CHANNEL_STOPS, LUMA_STOPS } from '@/components/widgets/colorStops'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const SCREENS = [
  { value: 'green', label: 'Greenscreen' },
  { value: 'blue', label: 'Bluescreen' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const screen = useStrWidget(props.node, 'screen', 'green')
const spillMix = useNumWidget(props.node, 'spill_mix', 0.5)
const expand = useNumWidget(props.node, 'expand', 0)
const redScale = useNumWidget(props.node, 'red_scale', 0)
const greenScale = useNumWidget(props.node, 'green_scale', -1)
const blueScale = useNumWidget(props.node, 'blue_scale', 0)
const brightness = useNumWidget(props.node, 'brightness', 0)
const outputSpillmap = useBoolWidget(props.node, 'output_spillmap', false)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const videoEl = computed<HTMLVideoElement | null>(() => playerRef.value?.videoEl ?? null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)

const { supported } = useChainedFxPreview({
  videoEl,
  canvasEl: previewCanvas,
  nodeId: String(props.node.id),
  node: props.node,
  params: () => ({
    screen: screen.value,
    spillMix: spillMix.value,
    expand: expand.value,
    redScale: redScale.value,
    greenScale: greenScale.value,
    blueScale: blueScale.value,
    brightness: brightness.value,
    outputSpillmap: outputSpillmap.value,
  }),
  createRenderer: () => new VideoDespillRenderer(),
})
</script>
