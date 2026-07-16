<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('afx.deconvHint') }}</div>
      <FxSlider v-model="durationS" :label="$t('fx.duration')" :min="1" :max="30" :step="0.5" unit="s" :reset-to="5" />
      <FxSlider v-model="fmin" :label="$t('afx.fminLbl')" :min="10" :max="1000" :step="1" :decimals="0" unit="Hz" :reset-to="20" />
      <FxSlider v-model="fmax" :label="$t('afx.fmaxLbl')" :min="1000" :max="20000" :step="100" :decimals="0" unit="Hz" :reset-to="20000" />
      <FxSlider v-model="amp" :label="$t('afx.ampLbl')" :min="0.01" :max="1" :step="0.01" :reset-to="0.5" />
      <FxSlider v-model="irLenS" :label="$t('afx.irLen')" :min="0.1" :max="10" :step="0.1" unit="s" :reset-to="2" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('fx.needsAudioOrVideo') }}</span>
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
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useNumWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio') || pickSourceImageUrl(props.state.inputs, 'video'))

const durationS = useNumWidget(props.node, 'duration_s', 5)
const fmin = useNumWidget(props.node, 'fmin', 20)
const fmax = useNumWidget(props.node, 'fmax', 20000)
const amp = useNumWidget(props.node, 'amp', 0.5)
const irLenS = useNumWidget(props.node, 'ir_len_s', 2)
</script>
