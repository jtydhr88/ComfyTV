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
      <div class="ctv-scroll-thin ctv:max-h-16 ctv:overflow-y-auto" @wheel.stop>
        <FxChips v-model="model" :options="MODEL_OPTS" />
      </div>
      <FxChips v-model="direction" :options="DIR_OPTS" />
      <template v-if="isFisheye">
        <FxSlider v-model="fov" label="FOV" :min="20" :max="180" :step="1" :decimals="0" :reset-to="140" />
      </template>
      <template v-else>
        <FxSlider v-model="k1" :label="kLabels[0]" :min="-1" :max="1" :step="0.005" :reset-to="0" />
        <FxSlider v-model="k2" :label="kLabels[1]" :min="-1" :max="1" :step="0.005" :reset-to="0" />
      </template>
      <template v-if="model === '3de_classic'">
        <FxSlider v-model="cxCurv" label="Curvature X" :min="-0.5" :max="0.5" :step="0.005" :reset-to="0" />
        <FxSlider v-model="cyCurv" label="Curvature Y" :min="-0.5" :max="0.5" :step="0.005" :reset-to="0" />
      </template>
      <template v-if="model === '3de_radial'">
        <FxSlider v-model="tangU" label="Tangential U" :min="-0.5" :max="0.5" :step="0.005" :reset-to="0" />
        <FxSlider v-model="tangV" label="Tangential V" :min="-0.5" :max="0.5" :step="0.005" :reset-to="0" />
      </template>
      <FxSlider v-if="model === 'panotools'" v-model="ptC" label="C" :min="-1" :max="1" :step="0.005" :reset-to="0" />
      <FxSlider v-model="centerX" label="Center X" :min="-0.5" :max="0.5" :step="0.005" :reset-to="0" />
      <FxSlider v-model="centerY" label="Center Y" :min="-0.5" :max="0.5" :step="0.005" :reset-to="0" />
      <FxSlider v-model="squeeze" label="Squeeze" :min="0.5" :max="2" :step="0.01" :reset-to="1" />
      <FxSlider v-model="lensScale" label="Scale" :min="0.25" :max="4" :step="0.01" :reset-to="1" />
      <FxChips v-model="edge" :options="EDGE_OPTS" />

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

const MODEL_OPTS = [
  { value: 'nuke_k1k2', label: 'K1/K2' },
  { value: 'pf_barrel', label: 'PFBarrel' },
  { value: '3de_classic', label: '3DE Classic' },
  { value: '3de_radial', label: '3DE Radial' },
  { value: 'panotools', label: 'PanoTools' },
  { value: 'fisheye_equidistant', label: 'Fish EQ' },
  { value: 'fisheye_orthographic', label: 'Fish Ortho' },
  { value: 'fisheye_equisolid', label: 'Fish Solid' },
  { value: 'fisheye_stereographic', label: 'Fish Stereo' },
]
const DIR_OPTS = [
  { value: 'undistort', label: 'Undistort' },
  { value: 'distort', label: 'Distort' },
]
const EDGE_OPTS = [
  { value: 'blank', label: 'Blank' },
  { value: 'clamp', label: 'Clamp' },
  { value: 'mirror', label: 'Mirror' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const model = useStrWidget(props.node, 'model', 'nuke_k1k2')
const direction = useStrWidget(props.node, 'direction', 'undistort')
const k1 = useNumWidget(props.node, 'k1', 0)
const k2 = useNumWidget(props.node, 'k2', 0)
const fov = useNumWidget(props.node, 'fov', 140)
const centerX = useNumWidget(props.node, 'center_x', 0)
const centerY = useNumWidget(props.node, 'center_y', 0)
const squeeze = useNumWidget(props.node, 'squeeze', 1)
const lensScale = useNumWidget(props.node, 'lens_scale', 1)
const cxCurv = useNumWidget(props.node, 'cx_curv', 0)
const cyCurv = useNumWidget(props.node, 'cy_curv', 0)
const tangU = useNumWidget(props.node, 'tang_u', 0)
const tangV = useNumWidget(props.node, 'tang_v', 0)
const ptC = useNumWidget(props.node, 'pt_c', 0)
const edge = useStrWidget(props.node, 'edge', 'clamp')

const isFisheye = computed(() => model.value.startsWith('fisheye'))
const kLabels = computed(() => {
  if (model.value === 'pf_barrel') return ['C3', 'C5']
  if (model.value === '3de_classic') return ['Distortion', 'Quartic']
  if (model.value === '3de_radial') return ['C2', 'C4']
  if (model.value === 'panotools') return ['A', 'B']
  return ['K1', 'K2']
})

const playerRef = ref<InstanceType<typeof VideoPlayerLite> | null>(null)

function playhead(): number {
  const el = playerRef.value?.videoEl ?? null
  if (el && Number.isFinite(el.currentTime)) return el.currentTime
  const d = playerRef.value?.duration ?? 0
  return d > 0 ? d / 2 : 0
}

const preview = useFxClipPreview({
  nodeId: 'ComfyTV.LensDistortStage',
  getParams: () => ({
    model: model.value, direction: direction.value,
    k1: k1.value, k2: k2.value, fov: fov.value,
    center_x: centerX.value, center_y: centerY.value,
    squeeze: squeeze.value, lens_scale: lensScale.value,
    cx_curv: cxCurv.value, cy_curv: cyCurv.value,
    tang_u: tangU.value, tang_v: tangV.value, pt_c: ptC.value,
    edge: edge.value,
  }),
  getVideo: () => sourceVideoUrl.value,
  getPlayhead: playhead,
})
</script>
