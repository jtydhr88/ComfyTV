<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <canvas
      ref="previewEl"
      class="ctv:w-full ctv:h-40 ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-secondary-background"
    />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="kind" :options="KINDS" />

      <FxSlider v-model="width" label="Width" :min="16" :max="4096" :step="16" :decimals="0" :reset-to="1280" />
      <FxSlider v-model="height" label="Height" :min="16" :max="4096" :step="16" :decimals="0" :reset-to="720" />
      <FxSlider v-model="fps" label="FPS" :min="1" :max="120" :step="1" :decimals="0" :reset-to="24" />
      <FxSlider v-model="duration" :label="$t('fx.duration')" :min="0.5" :max="120" :step="0.5" :reset-to="5" unit="s" />

      <div class="ctv:flex ctv:items-center ctv:gap-3 ctv:text-2xs ctv:text-muted-foreground">
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:cursor-pointer">
          <input type="color" v-model="color0" class="ctv:w-8 ctv:h-5 ctv:p-0 ctv:border-0 ctv:cursor-pointer ctv:bg-transparent" />
          Color A
        </label>
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:cursor-pointer">
          <input type="color" v-model="color1" class="ctv:w-8 ctv:h-5 ctv:p-0 ctv:border-0 ctv:cursor-pointer ctv:bg-transparent" />
          Color B
        </label>
      </div>

      <FxSlider v-model="p0x" label="P0 X" :min="0" :max="1" :step="0.01" :reset-to="0" />
      <FxSlider v-model="p0y" label="P0 Y" :min="0" :max="1" :step="0.01" :reset-to="0" />
      <FxSlider v-model="p1x" label="P1 X" :min="0" :max="1" :step="0.01" :reset-to="1" />
      <FxSlider v-model="p1y" label="P1 Y" :min="0" :max="1" :step="0.01" :reset-to="1" />

      <FxChips v-if="kind === 'ramp' || kind === 'radial'" v-model="interp" :options="INTERPS" />
      <FxSlider v-if="kind === 'rectangle'" v-model="softness" label="Softness" :min="0" :max="1" :step="0.01" :reset-to="0" />

      <template v-if="kind === 'noise'">
        <FxSlider v-model="noiseScale" label="Noise scale" :min="4" :max="512" :step="1" :decimals="0" :reset-to="64" />
        <FxSlider v-model="noiseOctaves" label="Octaves" :min="1" :max="8" :step="1" :decimals="0" :reset-to="4" />
        <FxSlider v-model="noiseSpeed" label="Speed" :min="0" :max="10" :step="0.1" :reset-to="1" />
        <FxSlider v-model="seed" label="Seed" :min="0" :max="99999" :step="1" :decimals="0" :reset-to="7" />
      </template>

      <FxSlider v-if="kind === 'checkerboard'" v-model="boxSize" label="Box size" :min="2" :max="1024" :step="2" :decimals="0" :reset-to="64" />
      <FxSlider v-if="kind === 'colorbars'" v-model="barIntensity" label="Bar intensity (IRE)" :min="1" :max="100" :step="1" :decimals="0" :reset-to="75" />
      <template v-if="kind === 'colorwheel'">
        <FxSlider v-model="wheelGamma" label="Gamma" :min="0" :max="4" :step="0.05" :reset-to="0.45" />
        <FxSlider v-model="wheelRotate" label="Rotate" :min="-180" :max="180" :step="1" :decimals="0" :reset-to="0" unit="°" />
      </template>
      <template v-if="kind === 'count'">
        <FxChips v-model="countStyle" :options="COUNT_STYLES" />
        <FxChips v-model="countDirection" :options="COUNT_DIRECTIONS" />
      </template>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
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
import { ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { usePatternPreview } from '@/composables/stages/usePatternPreview'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const KINDS = [
  { value: 'ramp', label: 'Ramp' },
  { value: 'radial', label: 'Radial' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'noise', label: 'Noise' },
  { value: 'checkerboard', label: 'Checker' },
  { value: 'colorbars', label: 'SMPTE bars' },
  { value: 'colorwheel', label: 'Color wheel' },
  { value: 'count', label: 'Countdown' },
]

const INTERPS = [
  { value: 'linear', label: 'Linear' },
  { value: 'smooth', label: 'Smooth' },
  { value: 'ease_in', label: 'Ease in' },
  { value: 'ease_out', label: 'Ease out' },
]

const kind = useStrWidget(props.node, 'kind', 'ramp')
const width = useNumWidget(props.node, 'width', 1280)
const height = useNumWidget(props.node, 'height', 720)
const fps = useNumWidget(props.node, 'fps', 24)
const duration = useNumWidget(props.node, 'duration', 5)
const color0 = useStrWidget(props.node, 'color0', '#000000')
const color1 = useStrWidget(props.node, 'color1', '#ffffff')
const p0x = useNumWidget(props.node, 'p0_x', 0)
const p0y = useNumWidget(props.node, 'p0_y', 0)
const p1x = useNumWidget(props.node, 'p1_x', 1)
const p1y = useNumWidget(props.node, 'p1_y', 1)
const interp = useStrWidget(props.node, 'interp', 'linear')
const softness = useNumWidget(props.node, 'softness', 0)
const noiseScale = useNumWidget(props.node, 'noise_scale', 64)
const noiseOctaves = useNumWidget(props.node, 'noise_octaves', 4)
const noiseSpeed = useNumWidget(props.node, 'noise_speed', 1)
const seed = useNumWidget(props.node, 'seed', 7)
const boxSize = useNumWidget(props.node, 'box_size', 64)
const barIntensity = useNumWidget(props.node, 'bar_intensity', 75)
const wheelGamma = useNumWidget(props.node, 'wheel_gamma', 0.45)
const wheelRotate = useNumWidget(props.node, 'wheel_rotate', 0)
const countStyle = useStrWidget(props.node, 'count_style', 'seconds')
const countDirection = useStrWidget(props.node, 'count_direction', 'down')

const COUNT_STYLES = [
  { value: 'seconds', label: 'Seconds' },
  { value: 'frames', label: 'Frames' },
]
const COUNT_DIRECTIONS = [
  { value: 'down', label: 'Count down' },
  { value: 'up', label: 'Count up' },
]

const previewEl = ref<HTMLCanvasElement>()

usePatternPreview({
  canvasEl: previewEl,
  params: {
    kind, width, height, color0, color1,
    p0x, p0y, p1x, p1y,
    interp, softness, noiseScale, noiseOctaves, noiseSpeed, seed,
  },
})
</script>
