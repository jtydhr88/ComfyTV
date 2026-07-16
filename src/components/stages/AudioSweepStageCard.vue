<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('afx.sweepHint') }}</div>
      <FxSlider v-model="durationS" :label="$t('fx.duration')" :min="1" :max="30" :step="0.5" unit="s" :reset-to="5" />
      <FxSlider v-model="fmin" :label="$t('afx.fminLbl')" :min="10" :max="1000" :step="1" :decimals="0" unit="Hz" :reset-to="20" />
      <FxSlider v-model="fmax" :label="$t('afx.fmaxLbl')" :min="1000" :max="20000" :step="100" :decimals="0" unit="Hz" :reset-to="20000" />
      <FxSlider v-model="amp" :label="$t('afx.ampLbl')" :min="0.01" :max="1" :step="0.01" :reset-to="0.5" />
      <FxSlider v-model="tailS" :label="$t('afx.tailLbl')" :min="0" :max="10" :step="0.5" unit="s" :reset-to="5" />
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
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import { useNumWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const durationS = useNumWidget(props.node, 'duration_s', 5)
const fmin = useNumWidget(props.node, 'fmin', 20)
const fmax = useNumWidget(props.node, 'fmax', 20000)
const amp = useNumWidget(props.node, 'amp', 0.5)
const tailS = useNumWidget(props.node, 'tail_s', 5)
</script>
