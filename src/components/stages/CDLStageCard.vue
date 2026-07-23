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
      <div
        class="ctv:h-48 ctv:shrink-0 ctv:overflow-y-auto ctv-scroll-thin ctv:flex ctv:flex-col ctv:gap-1"
        @wheel.stop
      >
        <span :class="lbl">Slope</span>
        <FxSlider v-model="slopeR" label="R" :min="0" :max="4" :step="0.01" :reset-to="1" :gradient="channelStops('reds')" />
        <FxSlider v-model="slopeG" label="G" :min="0" :max="4" :step="0.01" :reset-to="1" :gradient="channelStops('greens')" />
        <FxSlider v-model="slopeB" label="B" :min="0" :max="4" :step="0.01" :reset-to="1" :gradient="channelStops('blues')" />
        <span :class="lbl">Offset</span>
        <FxSlider v-model="offsetR" label="R" :min="-1" :max="1" :step="0.005" :reset-to="0" :gradient="channelStops('reds')" />
        <FxSlider v-model="offsetG" label="G" :min="-1" :max="1" :step="0.005" :reset-to="0" :gradient="channelStops('greens')" />
        <FxSlider v-model="offsetB" label="B" :min="-1" :max="1" :step="0.005" :reset-to="0" :gradient="channelStops('blues')" />
        <span :class="lbl">Power</span>
        <FxSlider v-model="powerR" label="R" :min="0.1" :max="4" :step="0.01" :reset-to="1" :gradient="channelStops('reds')" />
        <FxSlider v-model="powerG" label="G" :min="0.1" :max="4" :step="0.01" :reset-to="1" :gradient="channelStops('greens')" />
        <FxSlider v-model="powerB" label="B" :min="0.1" :max="4" :step="0.01" :reset-to="1" :gradient="channelStops('blues')" />
      </div>
      <FxSlider v-model="cdlSat" label="Saturation" :min="0" :max="4" :step="0.01" :reset-to="1" />

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
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useFxClipPreview } from '@/composables/stages/useFxClipPreview'
import { useNumWidget } from '@/composables/widgets/useWidgetModel'
import { channelStops } from '@/components/widgets/colorStops'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const lbl = 'ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:opacity-60'
const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const slopeR = useNumWidget(props.node, 'slope_r', 1)
const slopeG = useNumWidget(props.node, 'slope_g', 1)
const slopeB = useNumWidget(props.node, 'slope_b', 1)
const offsetR = useNumWidget(props.node, 'offset_r', 0)
const offsetG = useNumWidget(props.node, 'offset_g', 0)
const offsetB = useNumWidget(props.node, 'offset_b', 0)
const powerR = useNumWidget(props.node, 'power_r', 1)
const powerG = useNumWidget(props.node, 'power_g', 1)
const powerB = useNumWidget(props.node, 'power_b', 1)
const cdlSat = useNumWidget(props.node, 'cdl_sat', 1)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const el = playerRef.value?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.CDLStage',
  getParams: () => ({
    slope_r: slopeR.value, slope_g: slopeG.value, slope_b: slopeB.value,
    offset_r: offsetR.value, offset_g: offsetG.value, offset_b: offsetB.value,
    power_r: powerR.value, power_g: powerG.value, power_b: powerB.value,
    cdl_sat: cdlSat.value,
  }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})
</script>
