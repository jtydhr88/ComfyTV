<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="srcMain" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxSlider v-model="threshold" :label="$t('afx.threshold')" :min="0.001" :max="1" :step="0.005" :decimals="3" :reset-to="0.05" />
      <FxSlider v-model="ratio" label="Ratio" :min="1" :max="20" :step="0.5" :reset-to="8" />
      <FxSlider v-model="attack" label="Attack" :min="1" :max="2000" :step="1" :decimals="0" unit="ms" :reset-to="20" />
      <FxSlider v-model="release" label="Release" :min="10" :max="9000" :step="10" :decimals="0" unit="ms" :reset-to="400" />
      <FxSlider v-model="makeup" label="Makeup" :min="1" :max="8" :step="0.1" :reset-to="1" />
      <FxSlider v-model="sideGain" label="Voice Gain" :min="0" :max="4" :step="0.05" :reset-to="1" />
      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="mixBack" class="ctv:accent-primary-background" />
        {{ $t('afx.mixBack') }}
      </label>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!srcMain || !srcSide" class="ctv:text-muted-foreground">{{ $t('afx.needsTwoAudio') }}</span>
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
import { useBoolWidget, useNumWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const srcMain = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio')
  || pickSourceImageUrl(props.state.inputs, 'video'))
const srcSide = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'sidechain')
  || pickSourceImageUrl(props.state.inputs, 'sidechain_video'))
const threshold = useNumWidget(props.node, 'threshold', 0.05)
const ratio = useNumWidget(props.node, 'ratio', 8)
const attack = useNumWidget(props.node, 'attack', 20)
const release = useNumWidget(props.node, 'release', 400)
const makeup = useNumWidget(props.node, 'makeup', 1)
const sideGain = useNumWidget(props.node, 'side_gain', 1)
const mixBack = useBoolWidget(props.node, 'mix_back', true)
</script>
