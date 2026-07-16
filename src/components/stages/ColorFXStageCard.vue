<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="mode" :options="MODES" />

      <template v-if="mode === 'selectivecolor'">
        <FxChips v-model="scMethod" :options="METHODS" />
        <FxSlider v-for="z in ZONES" :key="z.id" v-model="z.model.value" :label="z.label" :min="-1" :max="1" :step="0.01" :reset-to="0" />
      </template>

      <template v-else-if="mode === 'chromashift'">
        <FxSlider v-model="shiftRh" label="Red H" :min="-255" :max="255" :step="1" :decimals="0" :reset-to="0" />
        <FxSlider v-model="shiftRv" label="Red V" :min="-255" :max="255" :step="1" :decimals="0" :reset-to="0" />
        <FxSlider v-model="shiftBh" label="Blue H" :min="-255" :max="255" :step="1" :decimals="0" :reset-to="0" />
        <FxSlider v-model="shiftBv" label="Blue V" :min="-255" :max="255" :step="1" :decimals="0" :reset-to="0" />
        <FxChips v-model="shiftEdge" :options="EDGES" />
      </template>

      <template v-else-if="mode === 'pseudocolor'">
        <FxChips v-model="pseudoPreset" :options="PRESETS" />
        <FxSlider v-model="pseudoOpacity" label="Opacity" :min="0" :max="1" :step="0.01" :reset-to="1" />
      </template>

      <template v-else-if="mode === 'elbg'">
        <FxSlider v-model="elbgColors" label="Colors" :min="1" :max="50" :step="1" :decimals="0" :reset-to="9" />
        <FxSlider v-model="elbgSteps" label="Steps" :min="1" :max="10" :step="1" :decimals="0" :reset-to="1" />
      </template>

      <template v-else-if="mode === 'colorspace'">
        <FxChips v-model="csTarget" :options="CS_TARGETS" />
      </template>

      <div v-else class="ctv:text-2xs ctv:text-muted-foreground">Gray-world auto white balance — no parameters.</div>
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
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
  { value: 'selectivecolor', label: 'Selective' },
  { value: 'chromashift', label: 'Chroma shift' },
  { value: 'pseudocolor', label: 'Pseudocolor' },
  { value: 'elbg', label: 'Quantize' },
  { value: 'colorspace', label: 'Colorspace' },
  { value: 'grayworld', label: 'Auto WB' },
]
const METHODS = [
  { value: 'absolute', label: 'Absolute' },
  { value: 'relative', label: 'Relative' },
]
const EDGES = [
  { value: 'smear', label: 'Smear' },
  { value: 'wrap', label: 'Wrap' },
]
const PRESETS = ['viridis', 'magma', 'inferno', 'plasma', 'turbo', 'cividis',
  'spectral', 'cool', 'heat', 'fiery', 'blues', 'green', 'helix']
  .map(v => ({ value: v, label: v }))
const CS_TARGETS = ['bt709', 'bt601-6-625', 'bt2020', 'smpte170m']
  .map(v => ({ value: v, label: v }))

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const mode = useStrWidget(props.node, 'mode', 'selectivecolor')
const scMethod = useStrWidget(props.node, 'sc_method', 'absolute')
const ZONE_IDS = ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas', 'whites', 'neutrals', 'blacks']
const ZONES = ZONE_IDS.map(id => ({
  id,
  label: id[0].toUpperCase() + id.slice(1),
  model: useNumWidget(props.node, `sc_${id}`, 0),
}))
const shiftRh = useNumWidget(props.node, 'shift_rh', 0)
const shiftRv = useNumWidget(props.node, 'shift_rv', 0)
const shiftBh = useNumWidget(props.node, 'shift_bh', 0)
const shiftBv = useNumWidget(props.node, 'shift_bv', 0)
const shiftEdge = useStrWidget(props.node, 'shift_edge', 'smear')
const pseudoPreset = useStrWidget(props.node, 'pseudo_preset', 'viridis')
const pseudoOpacity = useNumWidget(props.node, 'pseudo_opacity', 1)
const elbgColors = useNumWidget(props.node, 'elbg_colors', 9)
const elbgSteps = useNumWidget(props.node, 'elbg_steps', 1)
const csTarget = useStrWidget(props.node, 'cs_target', 'bt709')
</script>
