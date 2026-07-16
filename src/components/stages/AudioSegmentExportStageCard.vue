<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('afx.detect') }}</span>
      <FxChips
        v-model="detect"
        :options="[
          { value: 'silence', label: $t('afx.bySilence') },
          { value: 'json', label: $t('afx.byJson') },
        ]"
      />

      <template v-if="detect === 'silence'">
        <FxSlider v-model="thresholdDb" :label="$t('fx.threshold')" :min="-90" :max="-20" :step="1" :decimals="0" unit="dB" :reset-to="-60" />
        <FxSlider v-model="minSilence" :label="$t('fx.minSilence')" :min="0.01" :max="5" :step="0.01" unit="s" :reset-to="0.5" />
        <FxSlider v-model="minSegment" :label="$t('afx.minSegment')" :min="0.01" :max="10" :step="0.01" unit="s" :reset-to="0.1" />
      </template>
      <FxSlider v-model="fadeMs" :label="$t('afx.edgeFade')" :min="0" :max="500" :step="0.5" unit="ms" :reset-to="1.45" />

      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('afx.namingLbl') }}</span>
      <FxChips
        v-model="naming"
        :options="[
          { value: 'num_and_prefix', label: prefixLabel + '-01' },
          { value: 'num_and_name', label: '01-' + prefixLabel },
          { value: 'name', label: prefixLabel },
        ]"
      />
      <input
        v-model="prefix"
        type="text"
        class="ctv:w-full ctv:rounded ctv:border ctv:border-border-subtle ctv:bg-transparent ctv:px-1.5 ctv:py-0.5 ctv:text-2xs"
        :placeholder="$t('afx.prefixPh')"
      >
    </div>

    <div
      v-if="files.length"
      class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:rounded ctv:border ctv:border-border-subtle ctv:p-1.5 ctv:text-2xs ctv:max-h-32 ctv:overflow-y-auto"
      @pointerdown.stop
    >
      <div v-for="f in files" :key="f.index" class="ctv:flex ctv:justify-between ctv:gap-2">
        <span class="ctv:text-muted-foreground ctv:truncate">{{ f.name }}</span>
        <span class="ctv:font-mono ctv:shrink-0">{{ f.start.toFixed(2) }}–{{ f.end.toFixed(2) }}s</span>
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('fx.needsAudioOrVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="files.length" class="ctv:text-success-background">{{ files.length }} {{ $t('afx.filesOut') }}</span>
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

const detect = useStrWidget(props.node, 'detect', 'silence')
const thresholdDb = useNumWidget(props.node, 'threshold_db', -60)
const minSilence = useNumWidget(props.node, 'min_silence_s', 0.5)
const minSegment = useNumWidget(props.node, 'min_segment_s', 0.1)
const fadeMs = useNumWidget(props.node, 'fade_ms', 1.45)
const naming = useStrWidget(props.node, 'naming', 'num_and_prefix')
const prefix = useStrWidget(props.node, 'prefix', 'segment')

const prefixLabel = computed(() => prefix.value || 'segment')

interface SegFile { index: number, name: string, url: string, start: number, end: number }

const files = computed<SegFile[]>(() => {
  if (!props.state.output) return []
  try {
    const parsed = JSON.parse(props.state.output)
    return Array.isArray(parsed?.files) ? parsed.files : []
  } catch {
    return []
  }
})
</script>
