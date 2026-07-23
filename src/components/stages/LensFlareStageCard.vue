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
      <FxSlider v-model="posX" label="Light X" :min="0" :max="1" :step="0.005" :reset-to="0.75" />
      <FxSlider v-model="posY" label="Light Y" :min="0" :max="1" :step="0.005" :reset-to="0.25" />
      <FxSlider v-model="intensity" label="Intensity" :min="0" :max="3" :step="0.01" :reset-to="0.8" />
      <FxSlider v-model="size" label="Size" :min="0.05" :max="1" :step="0.01" :reset-to="0.25" />
      <FxSlider v-model="streak" label="Streak" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      <FxSlider v-model="ghosts" label="Ghosts" :min="0" :max="8" :step="1" :decimals="0" :reset-to="5" />

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
const posX = useNumWidget(props.node, 'pos_x', 0.75)
const posY = useNumWidget(props.node, 'pos_y', 0.25)
const intensity = useNumWidget(props.node, 'intensity', 0.8)
const size = useNumWidget(props.node, 'size', 0.25)
const streak = useNumWidget(props.node, 'streak', 0.5)
const ghosts = useNumWidget(props.node, 'ghosts', 5)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const el = playerRef.value?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.LensFlareStage',
  getParams: () => ({
    pos_x: posX.value, pos_y: posY.value, intensity: intensity.value,
    size: size.value, streak: streak.value, ghosts: ghosts.value,
  }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})
</script>
