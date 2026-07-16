<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.preset') }}</span>
      <FxChips
        v-model="preset"
        :options="[
          { value: 'mountains', label: $t('afx.echoMountains') },
          { value: 'mountains2', label: $t('afx.echoMountains2') },
          { value: 'doubled', label: $t('afx.echoDoubled') },
          { value: 'robot', label: $t('afx.echoRobot') },
          { value: 'custom', label: $t('afx.custom') },
        ]"
      />

      <template v-if="preset === 'custom'">
        <FxSlider v-model="inGain" :label="$t('afx.inGain')" :min="0" :max="1" :step="0.01" :reset-to="0.6" />
        <FxSlider v-model="outGain" :label="$t('afx.outGain')" :min="0" :max="1" :step="0.01" :reset-to="0.3" />
        <FxSlider v-model="delayMs" :label="$t('afx.delayMs')" :min="1" :max="5000" :step="1" :decimals="0" unit="ms" :reset-to="1000" />
        <FxSlider v-model="decay" :label="$t('afx.decay')" :min="0.01" :max="1" :step="0.01" :reset-to="0.5" />
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

const preset = useStrWidget(props.node, 'preset', 'mountains')
const inGain = useNumWidget(props.node, 'in_gain', 0.6)
const outGain = useNumWidget(props.node, 'out_gain', 0.3)
const delayMs = useNumWidget(props.node, 'delay_ms', 1000)
const decay = useNumWidget(props.node, 'decay', 0.5)
</script>
