<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.mode') }}</span>
      <FxChips
        v-model="mode"
        :options="[
          { value: 'speed', label: $t('afx.speed') },
          { value: 'pitch', label: $t('afx.pitch') },
          { value: 'reverse', label: $t('afx.reverse') },
        ]"
      />

      <FxSlider
        v-if="mode === 'speed'"
        v-model="tempo"
        :label="$t('afx.tempo')"
        :min="0.25" :max="4" :step="0.05"
        unit="×" :reset-to="1"
      />
      <FxSlider
        v-if="mode === 'pitch'"
        v-model="semitones"
        :label="$t('afx.semitones')"
        :min="-24" :max="24" :step="0.5"
        :reset-to="0"
      />
      <div v-if="mode === 'speed'" class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('afx.speedNote') }}</div>
      <div v-if="mode === 'pitch'" class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('afx.pitchNote') }}</div>
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

const mode = useStrWidget(props.node, 'mode', 'speed')
const tempo = useNumWidget(props.node, 'tempo', 1)
const semitones = useNumWidget(props.node, 'semitones', 0)
</script>
