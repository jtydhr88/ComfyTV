<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxChips v-model="previewCh" :options="channelChips" />
    </div>

    <VideoPlayerLite :source-video-url="srcOf(previewCh)" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <template v-for="ch in connected" :key="ch">
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ ch.toUpperCase() }}</span>
        <FxSlider
          :model-value="gains[ch].value"
          :label="$t('afx.gain')"
          :min="-60" :max="12" :step="0.5"
          unit="dB" :reset-to="0"
          @update:model-value="v => gains[ch].value = v"
        />
        <FxSlider
          :model-value="pans[ch].value"
          :label="$t('afx.pan')"
          :min="-1" :max="1" :step="0.01"
          :reset-to="0"
          @update:model-value="v => pans[ch].value = v"
        />
      </template>

      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('afx.panLaw') }}</span>
      <FxChips
        v-model="panLaw"
        :options="[
          { value: 'audacity', label: $t('afx.panLawLinear') },
          { value: 'constant_power', label: $t('afx.panLawPower') },
        ]"
      />
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('afx.dither') }}</span>
      <FxChips
        v-model="dither"
        :options="[
          { value: 'none', label: 'None' },
          { value: 'tpdf', label: 'TPDF' },
          { value: 'shaped', label: 'Shaped' },
        ]"
      />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!connected.length" class="ctv:text-muted-foreground">{{ $t('fx.needsAudioOrVideo') }}</span>
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

const CHANNELS = ['a', 'b', 'c', 'd'] as const
const previewCh = ref('a')

function srcOf(ch: string) {
  return pickSourceImageUrl(props.state.inputs, `audio_${ch}`)
}

const connected = computed(() => CHANNELS.filter(ch => srcOf(ch)))
const channelChips = computed(() =>
  CHANNELS.map(ch => ({ value: ch, label: ch.toUpperCase() + (srcOf(ch) ? '' : ' ·') })))

const gains = Object.fromEntries(
  CHANNELS.map(ch => [ch, useNumWidget(props.node, `gain_${ch}`, 0)]))
const pans = Object.fromEntries(
  CHANNELS.map(ch => [ch, useNumWidget(props.node, `pan_${ch}`, 0)]))

const panLaw = useStrWidget(props.node, 'pan_law', 'audacity')
const dither = useStrWidget(props.node, 'dither', 'none')
</script>
