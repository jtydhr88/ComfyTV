<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" :default-muted="false" />

    <div class="ctv:flex ctv:flex-col ctv:gap-1" @pointerdown.stop @pointermove.stop @pointerup.stop>
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('fx.mode') }}</span>
      <FxChips
        v-model="mode"
        :options="[
          { value: 'softclip', label: 'Soft clip' },
          { value: 'psyclip', label: 'Psy clip' },
          { value: 'crush', label: 'Crush' },
          { value: 'exciter', label: 'Exciter' },
          { value: 'crystalizer', label: 'Crystal' },
        ]"
      />

      <template v-if="mode === 'softclip'">
        <div class="ctv:max-h-20 ctv:overflow-y-auto">
          <FxChips v-model="scType" :options="softclipTypes" />
        </div>
        <FxSlider v-model="scThreshold" :label="$t('fx.threshold')" :min="0.01" :max="1" :step="0.01" :reset-to="1" />
      </template>
      <template v-else-if="mode === 'psyclip'">
        <FxSlider v-model="pyClip" :label="$t('afx.clipLevel')" :min="0.02" :max="1" :step="0.01" :reset-to="1" />
        <FxSlider v-model="pyAdaptive" :label="$t('afx.adaptive')" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      </template>
      <template v-else-if="mode === 'crush'">
        <FxSlider v-model="crBits" :label="$t('afx.bits')" :min="1" :max="64" :step="0.5" :reset-to="8" />
        <FxSlider v-model="crMix" :label="$t('afx.mix')" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
        <FxChips v-model="crMode" :options="[
          { value: 'lin', label: 'Linear' },
          { value: 'log', label: 'Log' },
        ]" />
      </template>
      <template v-else-if="mode === 'exciter'">
        <FxSlider v-model="exAmount" :label="$t('fx.amount')" :min="0" :max="8" :step="0.1" :reset-to="1" />
        <FxSlider v-model="exDrive" :label="$t('afx.drive')" :min="0.1" :max="10" :step="0.1" :reset-to="8.5" />
        <FxSlider v-model="exBlend" :label="$t('fx.blend')" :min="-10" :max="10" :step="0.1" :reset-to="0" />
        <FxSlider v-model="exFreq" :label="$t('afx.freqHz')" :min="2000" :max="12000" :step="10" :decimals="0" unit="Hz" :reset-to="7500" />
      </template>
      <template v-else-if="mode === 'crystalizer'">
        <FxSlider v-model="czI" :label="$t('fx.intensity')" :min="-10" :max="10" :step="0.1" :reset-to="2" />
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

const softclipTypes = ['hard', 'tanh', 'atan', 'cubic', 'exp', 'alg', 'quintic', 'sin', 'erf']
  .map(v => ({ value: v, label: v }))

const mode = useStrWidget(props.node, 'mode', 'softclip')
const scType = useStrWidget(props.node, 'sc_type', 'hard')
const scThreshold = useNumWidget(props.node, 'sc_threshold', 1)
const pyClip = useNumWidget(props.node, 'py_clip', 1)
const pyAdaptive = useNumWidget(props.node, 'py_adaptive', 0.5)
const crBits = useNumWidget(props.node, 'cr_bits', 8)
const crMix = useNumWidget(props.node, 'cr_mix', 0.5)
const crMode = useStrWidget(props.node, 'cr_mode', 'lin')
const exAmount = useNumWidget(props.node, 'ex_amount', 1)
const exDrive = useNumWidget(props.node, 'ex_drive', 8.5)
const exBlend = useNumWidget(props.node, 'ex_blend', 0)
const exFreq = useNumWidget(props.node, 'ex_freq', 7500)
const czI = useNumWidget(props.node, 'cz_i', 2)
</script>
