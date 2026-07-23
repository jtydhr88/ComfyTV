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
      <FxChips v-model="mode" :options="MODE_OPTS" />
      <FxSlider v-model="gain" label="Gain (frames)" :min="-120" :max="120" :step="1" :decimals="0" :reset-to="24" />
      <FxSlider v-model="offset" label="Offset" :min="-60" :max="60" :step="0.5" :reset-to="0" />
      <FxChips v-model="filterMode" :options="FILTER_OPTS" />
      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="invert" class="ctv:accent-primary-background" />
        Invert
      </label>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="mode === 'map' && !hasMap" class="ctv:text-warning-background">{{ $t('fx.needsRetimeMap') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('fx.processing') }}</span>
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

const MODE_OPTS = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'map', label: 'Map' },
]
const FILTER_OPTS = [
  { value: 'linear', label: 'Linear' },
  { value: 'nearest', label: 'Nearest' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const hasMap = computed(() => !!pickSourceImageUrl(props.state.inputs, 'retime_image'))
const mode = useStrWidget(props.node, 'mode', 'horizontal')
const gain = useNumWidget(props.node, 'gain', 24)
const offset = useNumWidget(props.node, 'offset', 0)
const filterMode = useStrWidget(props.node, 'filter_mode', 'linear')
const invert = useBoolWidget(props.node, 'invert', false)
</script>
