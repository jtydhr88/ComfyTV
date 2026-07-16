<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.mode') }}</span>
      <FxChips
        v-model="mode"
        :options="[
          { value: 'phaser', label: 'Phaser' },
          { value: 'flanger', label: 'Flanger' },
          { value: 'chorus', label: 'Chorus' },
          { value: 'vibrato', label: 'Vibrato' },
          { value: 'tremolo', label: 'Tremolo' },
          { value: 'pulsator', label: 'Pulsator' },
        ]"
      />

      <template v-if="mode === 'phaser'">
        <FxSlider v-model="phDelay" :label="$t('afx.delayMs')" :min="0" :max="5" :step="0.1" unit="ms" :reset-to="3" />
        <FxSlider v-model="phDecay" :label="$t('afx.decay')" :min="0" :max="0.99" :step="0.01" :reset-to="0.4" />
        <FxSlider v-model="phSpeed" :label="$t('afx.rateHz')" :min="0.1" :max="2" :step="0.05" unit="Hz" :reset-to="0.5" />
        <FxChips v-model="phType" :options="[
          { value: 'triangular', label: $t('afx.triangular') },
          { value: 'sinusoidal', label: $t('afx.sinusoidal') },
        ]" />
      </template>

      <template v-else-if="mode === 'flanger'">
        <FxSlider v-model="flDelay" :label="$t('afx.delayMs')" :min="0" :max="30" :step="0.5" unit="ms" :reset-to="0" />
        <FxSlider v-model="flDepth" :label="$t('afx.depth')" :min="0" :max="10" :step="0.1" :reset-to="2" />
        <FxSlider v-model="flRegen" :label="$t('afx.regen')" :min="-95" :max="95" :step="1" :decimals="0" :reset-to="0" />
        <FxSlider v-model="flWidth" :label="$t('afx.width')" :min="0" :max="100" :step="1" :decimals="0" :reset-to="71" />
        <FxSlider v-model="flSpeed" :label="$t('afx.rateHz')" :min="0.1" :max="10" :step="0.1" unit="Hz" :reset-to="0.5" />
      </template>

      <template v-else-if="mode === 'chorus'">
        <FxChips v-model="chorusPreset" :options="[
          { value: 'single', label: $t('afx.chorusSingle') },
          { value: 'double', label: $t('afx.chorusDouble') },
          { value: 'triple', label: $t('afx.chorusTriple') },
        ]" />
      </template>

      <template v-else-if="mode === 'vibrato' || mode === 'tremolo'">
        <FxSlider v-model="lfoF" :label="$t('afx.rateHz')" :min="0.1" :max="20" :step="0.1" unit="Hz" :reset-to="5" />
        <FxSlider v-model="lfoD" :label="$t('afx.depth')" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      </template>

      <template v-else-if="mode === 'pulsator'">
        <FxSlider v-model="puHz" :label="$t('afx.rateHz')" :min="0.01" :max="20" :step="0.01" unit="Hz" :reset-to="2" />
        <FxSlider v-model="puAmount" :label="$t('fx.amount')" :min="0" :max="1" :step="0.01" :reset-to="1" />
        <FxSlider v-model="puWidth" :label="$t('afx.width')" :min="0" :max="2" :step="0.01" :reset-to="1" />
        <FxChips v-model="puMode" :options="[
          { value: 'sine', label: 'Sine' },
          { value: 'triangle', label: 'Tri' },
          { value: 'square', label: 'Square' },
          { value: 'sawup', label: 'Saw↑' },
          { value: 'sawdown', label: 'Saw↓' },
        ]" />
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

const mode = useStrWidget(props.node, 'mode', 'phaser')
const phDelay = useNumWidget(props.node, 'ph_delay', 3)
const phDecay = useNumWidget(props.node, 'ph_decay', 0.4)
const phSpeed = useNumWidget(props.node, 'ph_speed', 0.5)
const phType = useStrWidget(props.node, 'ph_type', 'triangular')
const flDelay = useNumWidget(props.node, 'fl_delay', 0)
const flDepth = useNumWidget(props.node, 'fl_depth', 2)
const flRegen = useNumWidget(props.node, 'fl_regen', 0)
const flWidth = useNumWidget(props.node, 'fl_width', 71)
const flSpeed = useNumWidget(props.node, 'fl_speed', 0.5)
const chorusPreset = useStrWidget(props.node, 'chorus_preset', 'single')
const lfoF = useNumWidget(props.node, 'lfo_f', 5)
const lfoD = useNumWidget(props.node, 'lfo_d', 0.5)
const puHz = useNumWidget(props.node, 'pu_hz', 2)
const puAmount = useNumWidget(props.node, 'pu_amount', 1)
const puWidth = useNumWidget(props.node, 'pu_width', 1)
const puMode = useStrWidget(props.node, 'pu_mode', 'sine')
</script>
