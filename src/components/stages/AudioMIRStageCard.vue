<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxChips
        v-model="mode"
        :options="[
          { value: 'beats', label: $t('afx.beats') },
          { value: 'onsets', label: $t('afx.onsets') },
          { value: 'notes', label: $t('afx.notes') },
        ]"
      />
      <template v-if="mode !== 'notes'">
        <FxSlider v-model="threshold" :label="$t('afx.threshold')" :min="0.05" :max="1" :step="0.01" :reset-to="0.3" />
        <FxSlider v-model="minGap" :label="$t('afx.minGap')" :min="0.01" :max="1" :step="0.01" unit="s" :reset-to="0.05" />
      </template>
      <FxChips v-model="field" :options="FIELD_OPTS" />
      <div class="ctv:text-2xs ctv:text-muted-foreground ctv:leading-snug">
        {{ $t('afx.mirHint') }}
      </div>
      <div v-if="labelCount" class="ctv:text-2xs ctv:text-success-background">
        {{ labelCount }} {{ mode }}
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

const FIELD_OPTS = ['v', 'scale', 'opacity', 'x', 'y', 'rotation']
  .map(v => ({ value: v, label: v }))

const sourceUrl = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio') || pickSourceImageUrl(props.state.inputs, 'video'))
const mode = useStrWidget(props.node, 'mode', 'beats')
const threshold = useNumWidget(props.node, 'threshold', 0.3)
const minGap = useNumWidget(props.node, 'min_gap_s', 0.05)
const field = useStrWidget(props.node, 'field', 'v')

const labelCount = computed(() => {
  const raw = props.state.outputs?.[1]
  if (typeof raw !== 'string' || !raw) return 0
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
})
</script>
