<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.method') }}</span>
      <FxChips
        v-model="method"
        :options="[
          { value: 'declick', label: $t('afx.declick') },
          { value: 'declip', label: $t('afx.declip') },
          { value: 'denorm', label: $t('afx.denorm') },
          { value: 'wavelet', label: $t('afx.wavelet') },
          { value: 'hum', label: $t('afx.hum') },
        ]"
      />

      <template v-if="method === 'declick'">
        <FxSlider v-model="dkWindow" :label="$t('afx.window')" :min="10" :max="100" :step="1" :decimals="0" unit="ms" :reset-to="55" />
        <FxSlider v-model="dkThreshold" :label="$t('fx.threshold')" :min="1" :max="100" :step="1" :decimals="0" :reset-to="2" />
        <FxSlider v-model="dkBurst" :label="$t('afx.burst')" :min="0" :max="10" :step="0.1" :reset-to="2" />
      </template>
      <template v-else-if="method === 'declip'">
        <FxSlider v-model="dcThreshold" :label="$t('fx.threshold')" :min="1" :max="100" :step="1" :decimals="0" :reset-to="10" />
        <FxSlider v-model="dcHsize" :label="$t('afx.hsize')" :min="100" :max="9999" :step="1" :decimals="0" :reset-to="1000" />
      </template>
      <template v-else-if="method === 'denorm'">
        <FxSlider v-model="dnLevel" :label="$t('afx.levelDb')" :min="-451" :max="-90" :step="1" :decimals="0" unit="dB" :reset-to="-351" />
      </template>
      <template v-else-if="method === 'wavelet'">
        <FxSlider v-model="wtSigma" :label="$t('afx.sigma')" :min="0" :max="1" :step="0.001" :decimals="3" :reset-to="0.05" />
        <FxSlider v-model="wtPercent" :label="$t('afx.percent')" :min="0" :max="100" :step="1" :decimals="0" unit="%" :reset-to="85" />
        <FxSlider v-model="wtLevels" :label="$t('afx.levels')" :min="1" :max="12" :step="1" :decimals="0" :reset-to="10" />
      </template>
      <template v-else-if="method === 'hum'">
        <FxChips
          v-model="humPreset"
          :options="[
            { value: '50', label: '50 Hz' },
            { value: '60', label: '60 Hz' },
          ]"
        />
        <FxSlider v-model="humFreq" :label="$t('afx.freqHz')" :min="10" :max="2000" :step="1" :decimals="0" unit="Hz" :reset-to="50" />
        <FxSlider v-model="humHarmonics" :label="$t('afx.harmonics')" :min="1" :max="16" :step="1" :decimals="0" :reset-to="8" />
        <FxSlider v-model="humQ" :label="'Q'" :min="1" :max="100" :step="0.5" :reset-to="8" />
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

const method = useStrWidget(props.node, 'method', 'declick')
const dkWindow = useNumWidget(props.node, 'dk_window', 55)
const dkThreshold = useNumWidget(props.node, 'dk_threshold', 2)
const dkBurst = useNumWidget(props.node, 'dk_burst', 2)
const dcThreshold = useNumWidget(props.node, 'dc_threshold', 10)
const dcHsize = useNumWidget(props.node, 'dc_hsize', 1000)
const dnLevel = useNumWidget(props.node, 'dn_level', -351)
const wtSigma = useNumWidget(props.node, 'wt_sigma', 0)
const wtPercent = useNumWidget(props.node, 'wt_percent', 85)
const wtLevels = useNumWidget(props.node, 'wt_levels', 10)
const humFreq = useNumWidget(props.node, 'hum_freq', 50)
const humHarmonics = useNumWidget(props.node, 'hum_harmonics', 8)
const humQ = useNumWidget(props.node, 'hum_q', 8)

const humPreset = computed({
  get: () => (Math.abs(humFreq.value - 60) < 1 ? '60' : '50'),
  set: (v: string) => { humFreq.value = v === '60' ? 60 : 50 },
})
</script>
