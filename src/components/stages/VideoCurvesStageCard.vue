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
      <CurvesCanvas v-model="activeCurve" :color="CHANNEL_COLORS[channel]" />
      <div class="ctv:text-2xs ctv:text-center ctv:text-muted-foreground">{{ $t('fx.curveHint') }}</div>

      <div class="ctv:flex ctv:items-center ctv:gap-1">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.preset') }}</span>
        <select
          v-model="preset"
          class="ctv:flex-1 ctv:py-0.5 ctv:px-1 ctv:text-[11px] ctv:rounded ctv:bg-secondary-background
                 ctv:border ctv:border-border-subtle ctv:text-base-foreground"
        >
          <option v-for="p in PRESETS" :key="p" :value="p">{{ p }}</option>
        </select>
        <button
          type="button"
          class="ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground
                 ctv:hover:border-primary-background"
          @click="resetActive"
        >{{ $t('fx.resetCurve') }}</button>
      </div>
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
import { useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const PRESETS = ['none', 'color_negative', 'cross_process', 'darker',
  'increase_contrast', 'lighter', 'linear_contrast', 'medium_contrast',
  'negative', 'strong_contrast', 'vintage']

const CHANNEL_COLORS: Record<string, string> = {
  master: '#e0e0e0', red: '#ef5350', green: '#66bb6a', blue: '#42a5f5',
}
const CHANNELS = [
  { value: 'master', label: 'RGB' },
  { value: 'red', label: 'R' },
  { value: 'green', label: 'G' },
  { value: 'blue', label: 'B' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const preset = useStrWidget(props.node, 'preset', 'none')
const channel = ref('master')

const widgets = {
  master: useStrWidget(props.node, 'master_pts', ''),
  red: useStrWidget(props.node, 'red_pts', ''),
  green: useStrWidget(props.node, 'green_pts', ''),
  blue: useStrWidget(props.node, 'blue_pts', ''),
}

function parseCurve(raw: string): [number, number][] {
  try {
    const p = JSON.parse(raw || '[]')
    if (Array.isArray(p) && p.length >= 2) return p as [number, number][]
  } catch {  }
  return [[0, 0], [1, 1]]
}

const activeCurve = computed({
  get: () => parseCurve(widgets[channel.value as keyof typeof widgets].value),
  set: (pts: [number, number][]) => {
    const w = widgets[channel.value as keyof typeof widgets]
    const isIdentity = pts.length === 2
      && pts[0][0] === 0 && pts[0][1] === 0 && pts[1][0] === 1 && pts[1][1] === 1
    w.value = isIdentity ? '' : JSON.stringify(pts.map(([x, y]) =>
      [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]))
  },
})

function resetActive() {
  widgets[channel.value as keyof typeof widgets].value = ''
}
</script>
