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
      <FxSlider v-model="grainSize" label="Grain Size" :min="0" :max="4" :step="0.05" :reset-to="0.8" />
      <FxSlider v-model="shadows" label="Shadows" :min="0" :max="1" :step="0.01" :reset-to="0.3" />
      <FxSlider v-model="midtones" label="Midtones" :min="0" :max="1" :step="0.01" :reset-to="0.15" />
      <FxSlider v-model="highlights" label="Highlights" :min="0" :max="1" :step="0.01" :reset-to="0.05" />
      <FxSlider v-model="grainSat" label="Color" :min="0" :max="1" :step="0.01" :reset-to="0.4" />
      <FxSlider v-model="seed" label="Seed" :min="0" :max="9999" :step="1" :decimals="0" :reset-to="7" />

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

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const grainSize = useNumWidget(props.node, 'grain_size', 0.8)
const shadows = useNumWidget(props.node, 'shadows', 0.3)
const midtones = useNumWidget(props.node, 'midtones', 0.15)
const highlights = useNumWidget(props.node, 'highlights', 0.05)
const grainSat = useNumWidget(props.node, 'grain_sat', 0.4)
const seed = useNumWidget(props.node, 'seed', 7)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const el = playerRef.value?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.RegrainStage',
  getParams: () => ({
    grain_size: grainSize.value,
    shadows: shadows.value,
    midtones: midtones.value,
    highlights: highlights.value,
    grain_sat: grainSat.value,
    seed: seed.value,
  }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})
</script>
