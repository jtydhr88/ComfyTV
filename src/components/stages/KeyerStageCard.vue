<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite ref="playerRef" :source-video-url="sourceVideoUrl">
        <template #overlay>
          <canvas
            v-show="supported"
            ref="previewCanvas"
            class="ctv:absolute ctv:inset-0 ctv:size-full ctv:object-contain ctv:pointer-events-none ctv-checker"
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
      <div v-if="mode === 'color' || mode === 'screen'" class="ctv:flex ctv:items-center ctv:gap-2 ctv:text-2xs ctv:text-muted-foreground">
        <input type="color" v-model="keyColor" class="ctv:w-8 ctv:h-5 ctv:p-0 ctv:border-0 ctv:cursor-pointer ctv:bg-transparent" />
        Key color
      </div>

      <FxSlider v-model="center" label="Center" :min="0" :max="1" :step="0.01" :reset-to="1" />
      <FxSlider v-model="toleranceLower" label="Tol lower" :min="-1" :max="0" :step="0.01" :reset-to="0" />
      <FxSlider v-model="softnessLower" label="Soft lower" :min="-1" :max="0" :step="0.01" :reset-to="-0.5" />
      <template v-if="mode !== 'screen'">
        <FxSlider v-model="toleranceUpper" label="Tol upper" :min="0" :max="1" :step="0.01" :reset-to="0" />
        <FxSlider v-model="softnessUpper" label="Soft upper" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      </template>
      <template v-if="mode === 'screen' || mode === 'none'">
        <FxSlider v-model="despill" label="Despill" :min="0" :max="2" :step="0.01" :reset-to="1" />
        <FxSlider v-model="despillAngle" label="Despill angle" :min="0" :max="180" :step="1" :decimals="0" :reset-to="120" />
      </template>

      <FxChips v-model="output" :options="OUTPUTS" />
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
import { useFxVideoPreview } from '@/composables/stages/useFxVideoPreview'
import { VideoKeyerRenderer } from '@/widgets/glsl/keyingRenderers'
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
  { value: 'luminance', label: 'Luma' },
  { value: 'color', label: 'Color' },
  { value: 'screen', label: 'Screen' },
  { value: 'none', label: 'Despill only' },
]
const OUTPUTS = [
  { value: 'matte', label: 'Matte' },
  { value: 'alpha', label: 'Alpha' },
  { value: 'premult', label: 'Premult' },
  { value: 'composite', label: 'Comp' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const mode = useStrWidget(props.node, 'mode', 'luminance')
const keyColor = useStrWidget(props.node, 'key_color', '#000000')
const softnessLower = useNumWidget(props.node, 'softness_lower', -0.5)
const toleranceLower = useNumWidget(props.node, 'tolerance_lower', 0)
const center = useNumWidget(props.node, 'center', 1)
const toleranceUpper = useNumWidget(props.node, 'tolerance_upper', 0)
const softnessUpper = useNumWidget(props.node, 'softness_upper', 0.5)
const despill = useNumWidget(props.node, 'despill', 1)
const despillAngle = useNumWidget(props.node, 'despill_angle', 120)
const output = useStrWidget(props.node, 'output', 'matte')

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)
const videoEl = computed<HTMLVideoElement | null>(() => playerRef.value?.videoEl ?? null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)

const { supported } = useFxVideoPreview({
  videoEl,
  canvasEl: previewCanvas,
  nodeId: String(props.node.id),
  params: () => ({
    mode: mode.value,
    keyColor: keyColor.value,
    softnessLower: softnessLower.value,
    toleranceLower: toleranceLower.value,
    center: center.value,
    toleranceUpper: toleranceUpper.value,
    softnessUpper: softnessUpper.value,
    despill: despill.value,
    despillAngle: despillAngle.value,
    output: output.value,
  }),
  createRenderer: () => new VideoKeyerRenderer(),
})
</script>

<style scoped>
.ctv-checker {
  background-image:
    linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%),
    linear-gradient(45deg, #333 25%, #222 25%, #222 75%, #333 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
}
</style>
