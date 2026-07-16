<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxChips
        v-model="previewSide"
        :options="[
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
        ]"
      />
    </div>

    <VideoPlayerLite :source-video-url="previewSide === 'A' ? srcA : srcB" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <FxSlider
        v-model="duration"
        :label="$t('fx.duration')"
        :min="0.05" :max="10" :step="0.05"
        unit="s" :reset-to="1"
      />

      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('afx.curveOutA') }}</span>
      <div class="ctv:max-h-20 ctv:overflow-y-auto">
        <FxChips v-model="curve1" :options="curveOptions" />
      </div>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('afx.curveInB') }}</span>
      <div class="ctv:max-h-20 ctv:overflow-y-auto">
        <FxChips v-model="curve2" :options="curveOptions" />
      </div>

      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="overlap" class="ctv:accent-primary-background" />
        {{ $t('afx.overlap') }}
      </label>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!srcA || !srcB" class="ctv:text-muted-foreground">{{ $t('afx.needsTwoAudio') }}</span>
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
import { useBoolWidget, useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const previewSide = ref('A')

const srcA = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio_a') || pickSourceImageUrl(props.state.inputs, 'video_a'))
const srcB = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio_b') || pickSourceImageUrl(props.state.inputs, 'video_b'))

const curveOptions = [
  'tri', 'qsin', 'hsin', 'esin', 'log', 'ipar', 'qua', 'cub', 'squ', 'cbr',
  'par', 'exp', 'iqsin', 'ihsin', 'dese', 'desi', 'losi', 'sinc', 'isinc',
  'nofade',
].map(v => ({ value: v, label: v }))

const duration = useNumWidget(props.node, 'duration', 1)
const curve1 = useStrWidget(props.node, 'curve1', 'tri')
const curve2 = useStrWidget(props.node, 'curve2', 'tri')
const overlap = useBoolWidget(props.node, 'overlap', true)
</script>
