<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="channel" :options="CHANNELS" />
      <div
        class="ctv:h-2 ctv:rounded"
        style="background: linear-gradient(to right, #d0d 0%, #f00 16.7%, #ff0 33.3%, #0f0 50%, #0ff 66.7%, #00f 83.3%, #d0d 100%)"
      />
      <CurvesCanvas v-model="activeCurve" :color="CHANNEL_COLORS[channel]" />
      <div class="ctv:text-2xs ctv:text-center ctv:text-muted-foreground">{{ $t('fx.curveHint') }}</div>

      <FxSlider v-model="satThrsh" label="Sat threshold" :min="0" :max="1" :step="0.01" />
      <FxSlider v-model="luminanceMix" label="Luma mix" :min="0" :max="1" :step="0.01" />
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
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import CurvesCanvas from '@/components/widgets/fx/CurvesCanvas.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useHueCorrectCurves } from '@/composables/stages/useHueCorrectCurves'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const CHANNELS = [
  { value: 'sat', label: 'Sat' },
  { value: 'lum', label: 'Lum' },
  { value: 'red', label: 'R' },
  { value: 'green', label: 'G' },
  { value: 'blue', label: 'B' },
  { value: 'r_sup', label: 'Rs' },
  { value: 'g_sup', label: 'Gs' },
  { value: 'b_sup', label: 'Bs' },
  { value: 'hue', label: 'Hue' },
]

const CHANNEL_COLORS: Record<string, string> = {
  sat: '#e0e0e0',
  lum: '#9e9e9e',
  red: '#ef5350',
  green: '#66bb6a',
  blue: '#42a5f5',
  r_sup: '#b71c1c',
  g_sup: '#1b5e20',
  b_sup: '#0d47a1',
  hue: '#ffa726',
}

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const curves = useStrWidget(props.node, 'curves', '')
const satThrsh = useNumWidget(props.node, 'sat_thrsh', 0)
const luminanceMix = useNumWidget(props.node, 'luminance_mix', 0)
const channel = ref('sat')

const { activeCurve } = useHueCorrectCurves({ curves, channel })
</script>
