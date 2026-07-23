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
      <div class="ctv-scroll-thin ctv:max-h-24 ctv:overflow-y-auto" @wheel.stop>
        <FxChips v-model="mapKind" :options="MAP_OPTS" />
      </div>
      <FxSlider v-model="threshold" label="Threshold" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      <FxSlider v-model="softness" label="Softness" :min="0" :max="1" :step="0.01" :reset-to="0.1" />
      <FxChips v-model="animate" :options="ANIMATE_OPTS" />
      <FxChips v-model="output" :options="OUTPUT_OPTS" />
      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="invert" class="ctv:accent-primary-background" />
        Invert
      </label>

      <FxClipPreviewPanel :preview="preview" :enabled="!!sourceVideoUrl" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="hasShapeImage" class="ctv:text-muted-foreground">{{ $t('fx.adjustThenRun') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('fx.chainMode') }}</span>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :hide-run-button="!hasShapeImage"
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
import { useBoolWidget, useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const MAP_OPTS = ['linear_x', 'linear_y', 'bilinear_x', 'bilinear_y',
  'radial', 'square', 'diamond', 'clock', 'symmetric_clock', 'spiral',
  'burst', 'curtain', 'blinds_h', 'blinds_v', 'checker', 'cloud']
  .map(v => ({ value: v, label: v.replace('_', ' ') }))
const ANIMATE_OPTS = [
  { value: 'static', label: 'Static' },
  { value: 'sweep_in', label: 'Sweep In' },
  { value: 'sweep_out', label: 'Sweep Out' },
]
const OUTPUT_OPTS = [
  { value: 'stencil', label: 'Stencil' },
  { value: 'matte', label: 'Matte' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const hasShapeImage = computed(() => !!pickSourceImageUrl(props.state.inputs, 'shape_image'))
const mapKind = useStrWidget(props.node, 'map_kind', 'radial')
const threshold = useNumWidget(props.node, 'threshold', 0.5)
const softness = useNumWidget(props.node, 'softness', 0.1)
const animate = useStrWidget(props.node, 'animate', 'static')
const output = useStrWidget(props.node, 'output', 'stencil')
const invert = useBoolWidget(props.node, 'invert', false)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const el = playerRef.value?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.ShapeMaskStage',
  getParams: () => ({
    map_kind: mapKind.value, threshold: threshold.value,
    softness: softness.value, animate: animate.value,
    output: output.value, invert: invert.value,
  }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})
</script>
