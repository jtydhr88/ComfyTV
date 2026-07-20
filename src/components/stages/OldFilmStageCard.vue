<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite :source-video-url="sourceVideoUrl" />
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxSlider v-model="delta" label="Jitter (px)" :min="0" :max="400" :step="1" :decimals="0" :reset-to="14" />
      <FxSlider v-model="every" label="Jitter frames %" :min="0" :max="100" :step="1" :decimals="0" :reset-to="20" />
      <FxSlider v-model="brightnessUp" label="Flicker up" :min="0" :max="100" :step="1" :decimals="0" :reset-to="20" />
      <FxSlider v-model="brightnessDown" label="Flicker down" :min="0" :max="100" :step="1" :decimals="0" :reset-to="30" />
      <FxSlider v-model="brightnessEvery" label="Flicker frames %" :min="0" :max="100" :step="1" :decimals="0" :reset-to="70" />
      <FxSlider v-model="developUp" label="Develop up" :min="0" :max="100" :step="1" :decimals="0" :reset-to="60" />
      <FxSlider v-model="developDown" label="Develop down" :min="0" :max="100" :step="1" :decimals="0" :reset-to="20" />
      <FxSlider v-model="developDuration" label="Develop cycle (frames)" :min="0" :max="600" :step="1" :decimals="0" :reset-to="70" />
      <FxSlider v-model="linesNum" label="Scratch lines" :min="0" :max="100" :step="1" :decimals="0" :reset-to="5" />
      <FxSlider v-model="lineWidth" label="Line width" :min="0" :max="100" :step="1" :decimals="0" :reset-to="2" />
      <FxSlider v-model="linesDarker" label="Darker" :min="0" :max="100" :step="1" :decimals="0" :reset-to="40" />
      <FxSlider v-model="linesLighter" label="Lighter" :min="0" :max="100" :step="1" :decimals="0" :reset-to="40" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
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
  </FxCardShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxCardShell from '@/components/stages/FxCardShell.vue'
import VideoPlayerLite from '@/components/widgets/VideoPlayerLite.vue'
import FxSlider from '@/components/widgets/fx/FxSlider.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useNumWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const delta = useNumWidget(props.node, 'delta', 14)
const every = useNumWidget(props.node, 'every', 20)
const brightnessUp = useNumWidget(props.node, 'brightness_up', 20)
const brightnessDown = useNumWidget(props.node, 'brightness_down', 30)
const brightnessEvery = useNumWidget(props.node, 'brightness_every', 70)
const developUp = useNumWidget(props.node, 'develop_up', 60)
const developDown = useNumWidget(props.node, 'develop_down', 20)
const developDuration = useNumWidget(props.node, 'develop_duration', 70)
const linesNum = useNumWidget(props.node, 'lines_num', 5)
const lineWidth = useNumWidget(props.node, 'line_width', 2)
const linesDarker = useNumWidget(props.node, 'lines_darker', 40)
const linesLighter = useNumWidget(props.node, 'lines_lighter', 40)
</script>
