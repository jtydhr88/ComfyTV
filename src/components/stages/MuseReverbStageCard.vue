<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxSlider v-model="reverbTime" :label="$t('afx.reverbTime')" :min="100" :max="10000" :step="50" unit="ms" :decimals="0" :reset-to="2200" />
      <FxSlider v-model="roomScale" :label="$t('afx.roomScale')" :min="0.5" :max="4" :step="0.05" :reset-to="0.8" />
      <FxSlider v-model="predelay" :label="$t('afx.predelay')" :min="0" :max="500" :step="1" unit="ms" :decimals="0" :reset-to="10" />
      <FxSlider v-model="dryDb" :label="$t('afx.dry')" :min="-60" :max="6" :step="0.5" unit="dB" :reset-to="0" />
      <FxSlider v-model="lateDb" :label="$t('afx.late')" :min="-60" :max="6" :step="0.5" unit="dB" :reset-to="-14" />
      <FxSlider v-model="erDb" :label="$t('afx.early')" :min="-60" :max="6" :step="0.5" unit="dB" :reset-to="-14" />
      <FxSlider v-model="timeLow" :label="$t('afx.timeLow')" :min="50" :max="200" :step="1" unit="%" :decimals="0" :reset-to="100" />
      <FxSlider v-model="timeHigh" :label="$t('afx.timeHigh')" :min="50" :max="200" :step="1" unit="%" :decimals="0" :reset-to="60" />
      <FxSlider v-model="modAmp" :label="$t('afx.modulation')" :min="0" :max="1" :step="0.01" :reset-to="0.2" />
      <FxSlider v-model="stereoSpread" :label="$t('afx.stereoSpread')" :min="0" :max="150" :step="1" :decimals="0" :reset-to="100" />
      <FxChips v-model="quality" :options="QUALITY_OPTS" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceUrl" class="ctv:text-muted-foreground">{{ $t('fx.needsAudioOrVideo') }}</span>
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

const QUALITY_OPTS = [
  { value: '8', label: '8 lines' },
  { value: '16', label: '16 lines' },
]

const sourceUrl = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio') || pickSourceImageUrl(props.state.inputs, 'video'))
const reverbTime = useNumWidget(props.node, 'reverb_time_ms', 2200)
const roomScale = useNumWidget(props.node, 'room_scale', 0.8)
const predelay = useNumWidget(props.node, 'predelay_ms', 10)
const dryDb = useNumWidget(props.node, 'dry_db', 0)
const lateDb = useNumWidget(props.node, 'late_db', -14)
const erDb = useNumWidget(props.node, 'er_db', -14)
const timeLow = useNumWidget(props.node, 'time_low', 100)
const timeHigh = useNumWidget(props.node, 'time_high', 60)
const modAmp = useNumWidget(props.node, 'mod_amp', 0.2)
const stereoSpread = useNumWidget(props.node, 'stereo_spread', 100)
const quality = useStrWidget(props.node, 'quality', '16')
</script>
