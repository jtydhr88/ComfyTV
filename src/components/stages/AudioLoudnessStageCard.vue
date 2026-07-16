<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.mode') }}</span>
      <FxChips
        v-model="mode"
        :options="[
          { value: 'ebu_r128', label: 'EBU R128' },
          { value: 'dynamic', label: 'Dynamic' },
          { value: 'normalize', label: $t('afx.normalize') },
        ]"
      />

      <template v-if="mode === 'ebu_r128'">
        <FxSlider
          v-model="targetI"
          :label="$t('fx.targetI')"
          :min="-30" :max="-10" :step="0.5"
          :reset-to="-16"
        />
        <FxSlider
          v-model="targetTp"
          :label="$t('fx.targetTp')"
          :min="-3" :max="0" :step="0.1"
          :reset-to="-1.5"
        />
        <FxSlider
          v-model="targetLra"
          :label="$t('fx.targetLra')"
          :min="1" :max="20" :step="0.5"
          :reset-to="11"
        />
      </template>
      <template v-if="mode === 'dynamic'">
        <FxSlider
          v-model="dynFrameMs"
          :label="$t('fx.frameLen')"
          :min="10" :max="8000" :step="10" :decimals="0"
          :reset-to="500"
        />
        <FxSlider
          v-model="dynGauss"
          :label="$t('fx.gaussWin')"
          :min="3" :max="301" :step="2" :decimals="0"
          :reset-to="31"
        />
      </template>
      <template v-if="mode === 'normalize'">
        <FxChips
          v-model="peakMode"
          :options="[
            { value: 'true_peak', label: 'dBTP' },
            { value: 'sample', label: 'dBFS' },
          ]"
        />
        <FxSlider
          v-model="peakTargetDb"
          :label="$t('afx.peakTarget')"
          :min="-30" :max="0" :step="0.1"
          unit="dB" :reset-to="-1"
        />
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="useRms" class="ctv:accent-primary-background" />
          {{ $t('afx.rmsConstraint') }}
        </label>
        <FxSlider
          v-if="useRms"
          v-model="rmsTargetDb"
          :label="'RMS'"
          :min="-30" :max="0" :step="0.5"
          unit="dB" :reset-to="-9"
        />
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
          <input type="checkbox" v-model="useLufs" class="ctv:accent-primary-background" />
          {{ $t('afx.lufsConstraint') }}
        </label>
        <FxSlider
          v-if="useLufs"
          v-model="targetI"
          :label="$t('fx.targetI')"
          :min="-30" :max="-10" :step="0.5"
          :reset-to="-16"
        />
        <div class="ctv:text-2xs ctv:text-muted-foreground">{{ $t('afx.strictestNote') }}</div>
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
import { useBoolWidget, useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

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

const mode = useStrWidget(props.node, 'mode', 'ebu_r128')
const targetI = useNumWidget(props.node, 'target_i', -16)
const targetTp = useNumWidget(props.node, 'target_tp', -1.5)
const targetLra = useNumWidget(props.node, 'target_lra', 11)
const dynFrameMs = useNumWidget(props.node, 'dyn_frame_ms', 500)
const dynGauss = useNumWidget(props.node, 'dyn_gauss', 31)
const peakMode = useStrWidget(props.node, 'peak_mode', 'true_peak')
const peakTargetDb = useNumWidget(props.node, 'peak_target_db', -1)
const useRms = useBoolWidget(props.node, 'use_rms', false)
const rmsTargetDb = useNumWidget(props.node, 'rms_target_db', -9)
const useLufs = useBoolWidget(props.node, 'use_lufs', false)
</script>
