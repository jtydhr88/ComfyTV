<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="screen" :options="SCREENS" />
      <div v-if="screen === 'pick'" class="ctv:flex ctv:items-center ctv:gap-2 ctv:text-2xs ctv:text-muted-foreground">
        <input type="color" v-model="pickColor" class="ctv:w-8 ctv:h-5 ctv:p-0 ctv:border-0 ctv:cursor-pointer ctv:bg-transparent" />
        Screen color
      </div>

      <FxSlider v-model="redWeight" label="Red weight" :min="-1" :max="2" :step="0.01" :reset-to="0.5" />
      <FxSlider v-model="blueGreenWeight" label="B/G weight" :min="-1" :max="2" :step="0.01" :reset-to="0.5" />
      <FxSlider v-model="clipBlack" label="Clip black" :min="0" :max="1" :step="0.01" :reset-to="0" />
      <FxSlider v-model="clipWhite" label="Clip white" :min="0" :max="1" :step="0.01" :reset-to="1" />

      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="screenSubtraction" class="ctv:accent-primary-background" />
        Screen subtraction (despill)
      </label>

      <div class="ctv:flex ctv:items-center ctv:gap-2 ctv:text-2xs ctv:text-muted-foreground">
        <input type="color" v-model="alphaBias" class="ctv:w-8 ctv:h-5 ctv:p-0 ctv:border-0 ctv:cursor-pointer ctv:bg-transparent" />
        Alpha bias
        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:cursor-pointer">
          <input type="checkbox" v-model="useAlphaBias" class="ctv:accent-primary-background" />
          use for despill
        </label>
      </div>
      <div v-if="!useAlphaBias" class="ctv:flex ctv:items-center ctv:gap-2 ctv:text-2xs ctv:text-muted-foreground">
        <input type="color" v-model="despillBias" class="ctv:w-8 ctv:h-5 ctv:p-0 ctv:border-0 ctv:cursor-pointer ctv:bg-transparent" />
        Despill bias
      </div>

      <FxChips v-model="replaceMode" :options="REPLACES" />
      <div v-if="replaceMode === 'hard' || replaceMode === 'soft'" class="ctv:flex ctv:items-center ctv:gap-2 ctv:text-2xs ctv:text-muted-foreground">
        <input type="color" v-model="replaceColor" class="ctv:w-8 ctv:h-5 ctv:p-0 ctv:border-0 ctv:cursor-pointer ctv:bg-transparent" />
        Replace color
      </div>

      <FxChips v-model="output" :options="OUTPUTS" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="!plateWired && screen !== 'pick'" class="ctv:text-muted-foreground">Wire a clean plate (or use Pick)</span>
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

const SCREENS = [
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'pick', label: 'Pick' },
]
const REPLACES = [
  { value: 'none', label: 'No replace' },
  { value: 'source', label: 'Source' },
  { value: 'hard', label: 'Hard color' },
  { value: 'soft', label: 'Soft color' },
]
const OUTPUTS = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'matte', label: 'Matte' },
  { value: 'premult', label: 'Premult' },
  { value: 'composite', label: 'Comp' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const plateWired = computed(() =>
  Boolean(pickSourceImageUrl(props.state.inputs, 'clean_plate_video') || pickSourceImageUrl(props.state.inputs, 'clean_plate')))
const screen = useStrWidget(props.node, 'screen', 'green')
const pickColor = useStrWidget(props.node, 'pick_color', '#00FF00')
const redWeight = useNumWidget(props.node, 'red_weight', 0.5)
const blueGreenWeight = useNumWidget(props.node, 'blue_green_weight', 0.5)
const alphaBias = useStrWidget(props.node, 'alpha_bias', '#808080')
const despillBias = useStrWidget(props.node, 'despill_bias', '#808080')
const useAlphaBias = useBoolWidget(props.node, 'use_alpha_bias', true)
const screenSubtraction = useBoolWidget(props.node, 'screen_subtraction', true)
const clipBlack = useNumWidget(props.node, 'clip_black', 0)
const clipWhite = useNumWidget(props.node, 'clip_white', 1)
const replaceMode = useStrWidget(props.node, 'replace_mode', 'soft')
const replaceColor = useStrWidget(props.node, 'replace_color', '#808080')
const output = useStrWidget(props.node, 'output', 'alpha')
</script>
