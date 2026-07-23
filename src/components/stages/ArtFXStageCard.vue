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
      <template v-if="mode === 'cartoon'">
        <FxSlider v-model="threshold" label="Edge Threshold" :min="0.01" :max="1" :step="0.005" :reset-to="0.12" />
        <FxSlider v-model="levels" label="Levels" :min="2" :max="32" :step="1" :decimals="0" :reset-to="8" />
        <FxSlider v-model="diffSpace" label="Edge Width" :min="1" :max="4" :step="1" :decimals="0" :reset-to="1" />
      </template>
      <template v-else-if="mode === 'charcoal'">
        <FxSlider v-model="edgeScale" label="Strength" :min="0.1" :max="8" :step="0.05" :reset-to="1.5" />
        <FxSlider v-model="scatter" label="Scatter" :min="1" :max="4" :step="1" :decimals="0" :reset-to="1" />
        <FxSlider v-model="colorMix" label="Color" :min="0" :max="1" :step="0.01" :reset-to="0" />
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="invert" class="ctv:accent-primary-background" />
          Invert
        </label>
      </template>
      <template v-else-if="mode === 'emboss'">
        <FxSlider v-model="azimuth" label="Light Angle" :min="0" :max="360" :step="1" :decimals="0" :reset-to="135" />
        <FxSlider v-model="elevation" label="Elevation" :min="0" :max="90" :step="1" :decimals="0" :reset-to="30" />
        <FxSlider v-model="embossWidth" label="Depth" :min="1" :max="40" :step="0.5" :reset-to="10" />
      </template>
      <template v-else>
        <FxSlider v-model="dotRadius" label="Dot Size" :min="1" :max="10" :step="0.5" :reset-to="4" />
        <FxSlider v-model="angleC" label="Cyan Angle" :min="0" :max="360" :step="1" :decimals="0" :reset-to="15" />
        <FxSlider v-model="angleM" label="Magenta Angle" :min="0" :max="360" :step="1" :decimals="0" :reset-to="45" />
        <FxSlider v-model="angleY" label="Yellow Angle" :min="0" :max="360" :step="1" :decimals="0" :reset-to="0" />
      </template>

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
import { useBoolWidget, useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const MODE_OPTS = [
  { value: 'cartoon', label: 'Cartoon' },
  { value: 'charcoal', label: 'Charcoal' },
  { value: 'emboss', label: 'Emboss' },
  { value: 'halftone', label: 'Halftone' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const mode = useStrWidget(props.node, 'mode', 'cartoon')
const threshold = useNumWidget(props.node, 'threshold', 0.12)
const levels = useNumWidget(props.node, 'levels', 8)
const diffSpace = useNumWidget(props.node, 'diff_space', 1)
const edgeScale = useNumWidget(props.node, 'edge_scale', 1.5)
const scatter = useNumWidget(props.node, 'scatter', 1)
const colorMix = useNumWidget(props.node, 'color_mix', 0)
const invert = useBoolWidget(props.node, 'invert', false)
const azimuth = useNumWidget(props.node, 'azimuth', 135)
const elevation = useNumWidget(props.node, 'elevation', 30)
const embossWidth = useNumWidget(props.node, 'emboss_width', 10)
const dotRadius = useNumWidget(props.node, 'dot_radius', 4)
const angleC = useNumWidget(props.node, 'angle_c', 15)
const angleM = useNumWidget(props.node, 'angle_m', 45)
const angleY = useNumWidget(props.node, 'angle_y', 0)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const el = playerRef.value?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.ArtFXStage',
  getParams: () => ({
    mode: mode.value,
    threshold: threshold.value,
    levels: levels.value,
    diff_space: diffSpace.value,
    edge_scale: edgeScale.value,
    scatter: scatter.value,
    color_mix: colorMix.value,
    invert: invert.value,
    azimuth: azimuth.value,
    elevation: elevation.value,
    emboss_width: embossWidth.value,
    dot_radius: dotRadius.value,
    angle_c: angleC.value,
    angle_m: angleM.value,
    angle_y: angleY.value,
  }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})
</script>
