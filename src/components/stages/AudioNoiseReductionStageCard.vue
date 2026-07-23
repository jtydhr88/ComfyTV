<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxSlider v-model="reductionDb" :label="$t('afx.reduction')" :min="1" :max="48" :step="0.5" unit="dB" :reset-to="12" />
      <FxSlider v-model="sensitivity" :label="$t('afx.sensitivity')" :min="0.5" :max="24" :step="0.25" :reset-to="6" />
      <FxSlider v-model="freqSmooth" :label="$t('afx.freqSmoothing')" :min="0" :max="12" :step="1" :decimals="0" :reset-to="6" />
      <div class="ctv:text-2xs ctv:text-muted-foreground ctv:leading-snug">
        {{ hasNoiseSample ? $t('afx.nrProfileWired') : $t('afx.nrProfileAuto') }}
      </div>
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

const sourceUrl = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio') || pickSourceImageUrl(props.state.inputs, 'video'))
const hasNoiseSample = computed(() => !!pickSourceImageUrl(props.state.inputs, 'noise_sample'))
const reductionDb = useNumWidget(props.node, 'reduction_db', 12)
const sensitivity = useNumWidget(props.node, 'sensitivity', 6)
const freqSmooth = useNumWidget(props.node, 'freq_smooth_bands', 6)
</script>
