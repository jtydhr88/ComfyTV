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
      <span :class="lbl">Input</span>
      <div class="ctv-scroll-thin ctv:max-h-16 ctv:overflow-y-auto" @wheel.stop>
        <FxChips v-model="projIn" :options="PROJ_OPTS" />
      </div>
      <span :class="lbl">Output</span>
      <div class="ctv-scroll-thin ctv:max-h-16 ctv:overflow-y-auto" @wheel.stop>
        <FxChips v-model="projOut" :options="PROJ_OPTS" />
      </div>
      <FxSlider v-model="yaw" label="Yaw" :min="-180" :max="180" :step="1" :decimals="0" :reset-to="0" />
      <FxSlider v-model="pitch" label="Pitch" :min="-180" :max="180" :step="1" :decimals="0" :reset-to="0" />
      <FxSlider v-model="roll" label="Roll" :min="-180" :max="180" :step="1" :decimals="0" :reset-to="0" />
      <FxSlider v-model="fov" label="FOV" :min="0" :max="360" :step="1" :decimals="0" :reset-to="0" />

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
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const PROJ_OPTS = ['equirect', 'flat', 'fisheye', 'dfisheye', 'sg', 'eac',
  'ball', 'hammer', 'cylindrical', 'pannini', 'barrel']
  .map(v => ({ value: v, label: v }))

const lbl = 'ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:opacity-60'
const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const projIn = useStrWidget(props.node, 'proj_in', 'equirect')
const projOut = useStrWidget(props.node, 'proj_out', 'flat')
const yaw = useNumWidget(props.node, 'v360_yaw', 0)
const pitch = useNumWidget(props.node, 'v360_pitch', 0)
const roll = useNumWidget(props.node, 'v360_roll', 0)
const fov = useNumWidget(props.node, 'v360_fov', 0)

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const el = playerRef.value?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.Video360Stage',
  getParams: () => ({
    proj_in: projIn.value, proj_out: projOut.value,
    v360_yaw: yaw.value, v360_pitch: pitch.value, v360_roll: roll.value,
    v360_fov: fov.value,
  }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})
</script>
