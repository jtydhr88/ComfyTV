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
      <FxSlider v-model="rx" label="Rotate X" :min="-89" :max="89" :step="0.5" :reset-to="0" />
      <FxSlider v-model="ry" label="Rotate Y" :min="-89" :max="89" :step="0.5" :reset-to="0" />
      <FxSlider v-model="rz" label="Rotate Z" :min="-180" :max="180" :step="0.5" :reset-to="0" />
      <FxSlider v-model="tx" label="Move X" :min="-4" :max="4" :step="0.01" :reset-to="0" />
      <FxSlider v-model="ty" label="Move Y" :min="-4" :max="4" :step="0.01" :reset-to="0" />
      <FxSlider v-model="tz" label="Distance" :min="-0.95" :max="6" :step="0.01" :reset-to="0" />
      <FxSlider v-model="fov" label="FOV" :min="5" :max="140" :step="1" :decimals="0" :reset-to="40" />
      <FxSlider v-model="cardScale" label="Card Scale" :min="0.05" :max="8" :step="0.01" :reset-to="1" />

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
const fov = useNumWidget(props.node, 'fov', 40)
const tx = useNumWidget(props.node, 'tx', 0)
const ty = useNumWidget(props.node, 'ty', 0)
const tz = useNumWidget(props.node, 'tz', 0)
const rx = useNumWidget(props.node, 'rx', 0)
const ry = useNumWidget(props.node, 'ry', 0)
const rz = useNumWidget(props.node, 'rz', 0)
const cardScale = useNumWidget(props.node, 'card_scale', 1)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const el = playerRef.value?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.Card3DStage',
  getParams: () => ({
    fov: fov.value, tx: tx.value, ty: ty.value, tz: tz.value,
    rx: rx.value, ry: ry.value, rz: rz.value,
    card_scale: cardScale.value,
  }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})
</script>
