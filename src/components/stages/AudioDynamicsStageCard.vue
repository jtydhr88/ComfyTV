<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full" @contextmenu.stop.prevent>
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.mode') }}</span>
      <FxChips
        v-model="mode"
        :options="[
          { value: 'compressor', label: 'Compressor' },
          { value: 'gate', label: 'Gate' },
          { value: 'limiter', label: 'Limiter' },
          { value: 'deesser', label: 'De-esser' },
        ]"
      />

      <FxSlider
        v-if="mode !== 'deesser'"
        v-model="thresholdDb"
        :label="$t('fx.thresholdDb')"
        :min="-60" :max="0" :step="0.5"
        unit="dB" :reset-to="-20"
      />
      <FxSlider
        v-if="mode === 'compressor' || mode === 'gate'"
        v-model="ratio"
        :label="$t('fx.ratio')"
        :min="1" :max="20" :step="0.5"
        :reset-to="4"
      />
      <FxSlider
        v-if="mode !== 'deesser'"
        v-model="attackMs"
        :label="$t('fx.attack')"
        :min="0.01" :max="2000" :step="1"
        unit="ms" :reset-to="20"
      />
      <FxSlider
        v-if="mode !== 'deesser'"
        v-model="releaseMs"
        :label="$t('fx.release')"
        :min="0.01" :max="9000" :step="1"
        unit="ms" :reset-to="250"
      />
      <FxSlider
        v-if="mode === 'compressor'"
        v-model="makeupDb"
        :label="$t('fx.makeup')"
        :min="0" :max="24" :step="0.5"
        unit="dB" :reset-to="0"
      />
      <FxSlider
        v-if="mode === 'compressor' || mode === 'gate'"
        v-model="knee"
        :label="$t('fx.knee')"
        :min="1" :max="8" :step="0.01"
        :reset-to="2.83"
      />
      <FxSlider
        v-if="mode === 'deesser'"
        v-model="intensity"
        :label="$t('fx.intensity')"
        :min="0" :max="1" :step="0.01"
        :reset-to="0.5"
      />

      <CompressionViz
        v-if="mode === 'compressor'"
        :threshold-db="thresholdDb"
        :ratio="ratio"
        :knee-factor="knee"
        :makeup-db="makeupDb"
        :input-url="sourceVideoUrl"
        :output-url="state.output"
      />
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
import CompressionViz from '@/components/widgets/fx/CompressionViz.vue'
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

const mode = useStrWidget(props.node, 'mode', 'compressor')
const thresholdDb = useNumWidget(props.node, 'threshold_db', -20)
const ratio = useNumWidget(props.node, 'ratio', 4)
const attackMs = useNumWidget(props.node, 'attack_ms', 20)
const releaseMs = useNumWidget(props.node, 'release_ms', 250)
const makeupDb = useNumWidget(props.node, 'makeup_db', 0)
const knee = useNumWidget(props.node, 'knee', 2.83)
const intensity = useNumWidget(props.node, 'intensity', 0.5)
</script>
