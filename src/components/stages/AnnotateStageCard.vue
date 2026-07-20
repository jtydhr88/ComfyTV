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
      <FxChips v-model="mode" :options="MODES" />

      <template v-if="mode === 'box' || mode === 'grid'">
        <template v-if="mode === 'box'">
          <FxSlider v-model="x" label="X" :min="0" :max="1" :step="0.01" :reset-to="0.25" />
          <FxSlider v-model="y" label="Y" :min="0" :max="1" :step="0.01" :reset-to="0.25" />
        </template>
        <FxSlider v-model="w" label="W" :min="0.01" :max="1" :step="0.01" :reset-to="0.5" />
        <FxSlider v-model="h" label="H" :min="0.01" :max="1" :step="0.01" :reset-to="0.5" />
        <div class="ctv:flex ctv:items-center ctv:gap-2 ctv:text-2xs ctv:text-muted-foreground">
          <input type="color" v-model="color" class="ctv:w-8 ctv:h-5 ctv:p-0 ctv:border-0 ctv:cursor-pointer ctv:bg-transparent" />
          Color
        </div>
        <FxSlider v-model="thickness" label="Thickness" :min="1" :max="40" :step="1" :decimals="0" :reset-to="3" />
        <FxSlider v-model="opacity" label="Opacity" :min="0" :max="1" :step="0.01" :reset-to="1" />
      </template>

      <template v-else-if="mode === 'fillborders'">
        <FxChips v-model="borderMode" :options="BORDER_MODES" />
        <FxSlider v-model="borderPx" label="Border (px)" :min="0" :max="512" :step="1" :decimals="0" :reset-to="32" />
      </template>

      <template v-else>
        <FxSlider v-model="scrollH" label="Horizontal" :min="-1" :max="1" :step="0.01" :reset-to="0" />
        <FxSlider v-model="scrollV" label="Vertical" :min="-1" :max="1" :step="0.01" :reset-to="0" />
      </template>
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

const MODES = [
  { value: 'box', label: 'Box' },
  { value: 'grid', label: 'Grid' },
  { value: 'fillborders', label: 'Fill borders' },
  { value: 'scroll', label: 'Scroll' },
]
const BORDER_MODES = ['smear', 'mirror', 'fixed', 'reflect', 'wrap', 'fade']
  .map(v => ({ value: v, label: v }))

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const mode = useStrWidget(props.node, 'mode', 'box')
const x = useNumWidget(props.node, 'x', 0.25)
const y = useNumWidget(props.node, 'y', 0.25)
const w = useNumWidget(props.node, 'w', 0.5)
const h = useNumWidget(props.node, 'h', 0.5)
const color = useStrWidget(props.node, 'color', '#4ADE80')
const thickness = useNumWidget(props.node, 'thickness', 3)
const opacity = useNumWidget(props.node, 'opacity', 1)
const borderMode = useStrWidget(props.node, 'border_mode', 'mirror')
const borderPx = useNumWidget(props.node, 'border_px', 32)
const scrollH = useNumWidget(props.node, 'scroll_h', 0)
const scrollV = useNumWidget(props.node, 'scroll_v', 0)
</script>
