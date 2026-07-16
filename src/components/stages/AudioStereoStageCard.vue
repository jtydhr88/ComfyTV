<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.mode') }}</span>
      <FxChips
        v-model="mode"
        :options="[
          { value: 'widen', label: $t('afx.widen') },
          { value: 'extrastereo', label: 'Extra' },
          { value: 'crossfeed', label: 'Crossfeed' },
          { value: 'haas', label: 'Haas' },
          { value: 'balance', label: $t('afx.balance') },
          { value: 'mono', label: $t('afx.mono') },
          { value: 'swap', label: $t('afx.swap') },
        ]"
      />

      <template v-if="mode === 'widen'">
        <FxSlider v-model="swDelay" :label="$t('afx.delayMs')" :min="1" :max="100" :step="1" :decimals="0" unit="ms" :reset-to="20" />
        <FxSlider v-model="swFeedback" :label="$t('afx.feedback')" :min="0" :max="0.9" :step="0.01" :reset-to="0.3" />
        <FxSlider v-model="swCrossfeed" :label="'Crossfeed'" :min="0" :max="0.8" :step="0.01" :reset-to="0.3" />
        <FxSlider v-model="swDrymix" :label="$t('afx.drymix')" :min="0" :max="1" :step="0.01" :reset-to="0.8" />
      </template>
      <template v-else-if="mode === 'extrastereo'">
        <FxSlider v-model="esM" :label="$t('fx.amount')" :min="-10" :max="10" :step="0.1" :reset-to="2.5" />
      </template>
      <template v-else-if="mode === 'crossfeed'">
        <FxSlider v-model="cfStrength" :label="$t('fx.strength')" :min="0" :max="1" :step="0.01" :reset-to="0.2" />
        <FxSlider v-model="cfRange" :label="$t('afx.range')" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      </template>
      <template v-else-if="mode === 'haas'">
        <FxSlider v-model="haasSideGain" :label="$t('afx.sideGain')" :min="0.06" :max="4" :step="0.01" :reset-to="1" />
        <FxSlider v-model="haasLeftDelay" :label="$t('afx.leftDelay')" :min="0" :max="40" :step="0.01" unit="ms" :reset-to="2.05" />
        <FxSlider v-model="haasRightDelay" :label="$t('afx.rightDelay')" :min="0" :max="40" :step="0.01" unit="ms" :reset-to="2.12" />
      </template>
      <template v-else-if="mode === 'balance'">
        <FxSlider v-model="balance" :label="$t('afx.balance')" :min="-1" :max="1" :step="0.01" :reset-to="0" />
      </template>
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

const sourceVideoUrl = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio') || pickSourceImageUrl(props.state.inputs, 'video'))

const mode = useStrWidget(props.node, 'mode', 'widen')
const swDelay = useNumWidget(props.node, 'sw_delay', 20)
const swFeedback = useNumWidget(props.node, 'sw_feedback', 0.3)
const swCrossfeed = useNumWidget(props.node, 'sw_crossfeed', 0.3)
const swDrymix = useNumWidget(props.node, 'sw_drymix', 0.8)
const esM = useNumWidget(props.node, 'es_m', 2.5)
const cfStrength = useNumWidget(props.node, 'cf_strength', 0.2)
const cfRange = useNumWidget(props.node, 'cf_range', 0.5)
const haasSideGain = useNumWidget(props.node, 'haas_side_gain', 1)
const haasLeftDelay = useNumWidget(props.node, 'haas_left_delay', 2.05)
const haasRightDelay = useNumWidget(props.node, 'haas_right_delay', 2.12)
const balance = useNumWidget(props.node, 'balance', 0)
</script>
