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
      <FxSlider v-model="focusDepth" label="Focus" :min="0" :max="1" :step="0.005" :reset-to="0.5" />
      <FxSlider v-model="focusRange" label="Range" :min="0" :max="1" :step="0.005" :reset-to="0.15" />
      <FxSlider v-model="maxRadius" label="Max Blur" :min="1" :max="48" :step="1" :decimals="0" :reset-to="16" />
      <FxSlider v-model="layers" label="Layers" :min="3" :max="12" :step="1" :decimals="0" :reset-to="8" />
      <FxSlider v-model="highlightBoost" label="Highlights" :min="0" :max="3" :step="0.05" :reset-to="0" />
      <FxChips v-model="shape" :options="SHAPE_OPTS" />
      <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-2xs ctv:text-muted-foreground ctv:cursor-pointer">
        <input type="checkbox" v-model="invertDepth" class="ctv:accent-primary-background" />
        Invert depth
      </label>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="!hasDepth" class="ctv:text-warning-background">{{ $t('optics.needsDepth') }}</span>
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

const SHAPE_OPTS = [
  { value: 'disc', label: 'Disc' },
  { value: 'hex', label: 'Hex' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const hasDepth = computed(() =>
  !!pickSourceImageUrl(props.state.inputs, 'depth_image')
  || !!pickSourceImageUrl(props.state.inputs, 'depth_video'))
const focusDepth = useNumWidget(props.node, 'focus_depth', 0.5)
const focusRange = useNumWidget(props.node, 'focus_range', 0.15)
const maxRadius = useNumWidget(props.node, 'max_radius', 16)
const layers = useNumWidget(props.node, 'layers', 8)
const highlightBoost = useNumWidget(props.node, 'highlight_boost', 0)
const shape = useStrWidget(props.node, 'shape', 'disc')
const invertDepth = useBoolWidget(props.node, 'invert_depth', false)
</script>
