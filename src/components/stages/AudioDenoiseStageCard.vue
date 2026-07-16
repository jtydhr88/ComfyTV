<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.method') }}</span>
      <FxChips
        v-model="method"
        :options="[
          { value: 'afftdn', label: 'FFT' },
          { value: 'anlmdn', label: 'NLM' },
          { value: 'silenceremove', label: 'Trim Silence' },
        ]"
      />

      <FxSlider
        v-if="method === 'afftdn' || method === 'anlmdn'"
        v-model="strength"
        :label="$t('fx.strength')"
        :min="0" :max="1" :step="0.01"
        :reset-to="0.3"
      />
      <template v-if="method === 'silenceremove'">
        <FxSlider
          v-model="silenceDb"
          :label="$t('fx.silenceDb')"
          :min="-80" :max="-20" :step="1"
          unit="dB" :reset-to="-50"
        />
        <FxSlider
          v-model="minSilence"
          :label="$t('fx.minSilence')"
          :min="0.1" :max="5" :step="0.1"
          unit="s" :reset-to="0.5"
        />
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

const method = useStrWidget(props.node, 'method', 'afftdn')
const strength = useNumWidget(props.node, 'strength', 0.3)
const silenceDb = useNumWidget(props.node, 'silence_db', -50)
const minSilence = useNumWidget(props.node, 'min_silence_s', 0.5)
</script>
