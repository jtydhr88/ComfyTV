<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="band" :options="BANDS" />
      <template v-if="band === 'custom'">
        <FxSlider v-model="freqLo" label="Freq low" :min="10" :max="16000" :step="10" :decimals="0" :reset-to="40" unit="Hz" />
        <FxSlider v-model="freqHi" label="Freq high" :min="20" :max="16000" :step="10" :decimals="0" :reset-to="200" unit="Hz" />
      </template>
      <FxSlider v-model="attack" label="Attack" :min="0.001" :max="1" :step="0.001" :reset-to="0.02" unit="s" />
      <FxSlider v-model="release" label="Release" :min="0.01" :max="2" :step="0.01" :reset-to="0.25" unit="s" />
      <FxSlider v-model="rate" label="Keys / s" :min="1" :max="60" :step="1" :decimals="0" :reset-to="10" />
      <FxSlider v-model="minValue" label="Min value" :min="-10" :max="10" :step="0.05" :reset-to="0" />
      <FxSlider v-model="maxValue" label="Max value" :min="-10" :max="10" :step="0.05" :reset-to="1" />
      <FxSlider v-model="gain" label="Gain" :min="0.1" :max="8" :step="0.1" :reset-to="1" />
      <FxChips v-model="field" :options="FIELDS" />
      <div class="ctv:text-2xs ctv:text-muted-foreground">Outputs keyframes — wire into Transform's track input.</div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!hasSource" class="ctv:text-muted-foreground">Wire an audio (or video) input</span>
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

const BANDS = ['bass', 'mid', 'high', 'full', 'custom'].map(v => ({ value: v, label: v }))
const FIELDS = ['v', 'scale', 'opacity', 'x', 'y', 'rotation'].map(v => ({ value: v, label: v }))

const hasSource = computed(() =>
  Boolean(pickSourceImageUrl(props.state.inputs, 'audio') || pickSourceImageUrl(props.state.inputs, 'video')))
const band = useStrWidget(props.node, 'band', 'bass')
const freqLo = useNumWidget(props.node, 'freq_lo', 40)
const freqHi = useNumWidget(props.node, 'freq_hi', 200)
const attack = useNumWidget(props.node, 'attack', 0.02)
const release = useNumWidget(props.node, 'release', 0.25)
const rate = useNumWidget(props.node, 'rate', 10)
const minValue = useNumWidget(props.node, 'min_value', 0)
const maxValue = useNumWidget(props.node, 'max_value', 1)
const gain = useNumWidget(props.node, 'gain', 1)
const field = useStrWidget(props.node, 'field', 'v')
</script>
