<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.mode') }}</span>
      <FxChips
        v-model="mode"
        :options="[
          { value: 'loudness', label: $t('afx.loudness') },
          { value: 'volume', label: $t('afx.volume') },
          { value: 'stats', label: $t('afx.stats') },
          { value: 'silence', label: $t('afx.silence') },
        ]"
      />

      <template v-if="mode === 'silence'">
        <FxSlider
          v-model="silenceNoiseDb"
          :label="$t('fx.silenceDb')"
          :min="-100" :max="0" :step="1" :decimals="0"
          unit="dB" :reset-to="-60"
        />
        <FxSlider
          v-model="silenceDuration"
          :label="$t('fx.minSilence')"
          :min="0.1" :max="10" :step="0.1"
          unit="s" :reset-to="2"
        />
      </template>
    </div>

    <div
      v-if="report"
      class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:rounded ctv:border ctv:border-border-subtle ctv:p-1.5 ctv:text-2xs"
      @pointerdown.stop
    >
      <div
        v-for="row in reportRows"
        :key="row.label"
        class="ctv:flex ctv:justify-between ctv:gap-2"
      >
        <span class="ctv:text-muted-foreground">{{ row.label }}</span>
        <span class="ctv:font-mono">{{ row.value }}</span>
      </div>

      <template v-if="platforms.length">
        <div class="ctv:mt-1 ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('afx.compliance') }}</div>
        <div
          v-for="p in platforms"
          :key="p.name"
          class="ctv:flex ctv:justify-between ctv:gap-2"
        >
          <span class="ctv:text-muted-foreground">{{ p.name }}</span>
          <span
            class="ctv:font-mono"
            :class="{
              'ctv:text-success-background': p.verdict === 'ok',
              'ctv:text-warning-background': p.verdict === 'quiet',
              'ctv:text-destructive-background': p.verdict === 'over',
            }"
          >{{ p.verdict === 'ok' ? '✓' : p.verdict === 'quiet' ? '▽' : '✗' }} {{ p.target_lufs }} LUFS</span>
        </div>
      </template>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('fx.needsAudioOrVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('fx.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('afx.analyzeHint') }}</span>
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
import { useAudioAnalysis } from '@/composables/stages/useAudioAnalysis'
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

const mode = useStrWidget(props.node, 'mode', 'loudness')
const silenceNoiseDb = useNumWidget(props.node, 'silence_noise_db', -60)
const silenceDuration = useNumWidget(props.node, 'silence_duration', 2)

const { report, platforms, reportRows } = useAudioAnalysis(() => props.state.output)
</script>
