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
      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
        <span class="ctv:min-w-16 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.keyColor') }}</span>
        <input
          type="color" :value="keyColor"
          class="ctv:w-8 ctv:h-6 ctv:p-0 ctv:border ctv:border-border-subtle ctv:rounded ctv:cursor-pointer ctv:bg-transparent"
          @input="(e) => keyColor = (e.target as HTMLInputElement).value"
        />
        <span class="ctv:font-mono ctv:text-2xs ctv:text-muted-foreground">{{ keyColor }}</span>
      </div>

      <FxChips v-model="space" :options="SPACE_OPTS" />
      <FxChips v-model="shape" :options="SHAPE_OPTS" />
      <FxChips v-model="edge" :options="EDGE_OPTS" />
      <FxSlider v-model="delta1" :label="deltaLabels[0]" :min="0.001" :max="2" :step="0.005" :reset-to="0.2" />
      <FxSlider v-model="delta2" :label="deltaLabels[1]" :min="0.001" :max="2" :step="0.005" :reset-to="0.2" />
      <FxSlider v-model="delta3" :label="deltaLabels[2]" :min="0.001" :max="2" :step="0.005" :reset-to="0.2" />
      <FxSlider v-if="edge === 'slope'" v-model="slope" label="Slope" :min="0.001" :max="1" :step="0.005" :reset-to="0.2" />
      <div class="ctv:flex ctv:items-center ctv:gap-3">
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="invert" class="ctv:accent-primary-background" />
          Invert
        </label>
        <FxChips v-model="output" :options="OUT_OPTS" class="ctv:flex-1" />
      </div>

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

const SPACE_OPTS = [
  { value: 'rgb', label: 'RGB' },
  { value: 'abi', label: 'ABI' },
  { value: 'hci', label: 'HCI' },
]
const SHAPE_OPTS = [
  { value: 'box', label: 'Box' },
  { value: 'ellipsoid', label: 'Ellipsoid' },
  { value: 'octahedron', label: 'Octahedron' },
]
const EDGE_OPTS = [
  { value: 'hard', label: 'Hard' },
  { value: 'fat', label: 'Fat' },
  { value: 'normal', label: 'Normal' },
  { value: 'skiny', label: 'Skinny' },
  { value: 'slope', label: 'Slope' },
]
const OUT_OPTS = [
  { value: 'matte', label: 'Matte' },
  { value: 'image', label: 'Image' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const keyColor = useStrWidget(props.node, 'key_color', '#00FF00')
const space = useStrWidget(props.node, 'space', 'rgb')
const shape = useStrWidget(props.node, 'shape', 'ellipsoid')
const edge = useStrWidget(props.node, 'edge', 'normal')
const delta1 = useNumWidget(props.node, 'delta_1', 0.2)
const delta2 = useNumWidget(props.node, 'delta_2', 0.2)
const delta3 = useNumWidget(props.node, 'delta_3', 0.2)
const slope = useNumWidget(props.node, 'slope', 0.2)
const invert = useBoolWidget(props.node, 'invert', false)
const output = useStrWidget(props.node, 'output', 'matte')

const deltaLabels = computed(() => {
  if (space.value === 'abi') return ['A Range', 'B Range', 'I Range']
  if (space.value === 'hci') return ['Hue Range', 'Chroma Range', 'I Range']
  return ['R Range', 'G Range', 'B Range']
})

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const el = playerRef.value?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.Select0rStage',
  getParams: () => ({
    key_color: keyColor.value,
    space: space.value,
    shape: shape.value,
    edge: edge.value,
    delta_1: delta1.value,
    delta_2: delta2.value,
    delta_3: delta3.value,
    slope: slope.value,
    invert: invert.value,
    output: output.value,
  }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})
</script>
