<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:relative ctv:w-full ctv:h-40 ctv:rounded ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle">
      <img v-if="sourceImageUrl" :src="sourceImageUrl" class="ctv:block ctv:size-full ctv:object-contain" />
      <div v-else class="ctv:flex ctv:items-center ctv:justify-center ctv:size-full ctv:text-2xs ctv:text-muted-foreground">Wire an image</div>
    </div>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxSlider v-model="width" label="Width" :min="16" :max="4096" :step="16" :decimals="0" :reset-to="1280" />
      <FxSlider v-model="height" label="Height" :min="16" :max="4096" :step="16" :decimals="0" :reset-to="720" />
      <FxSlider v-model="fps" label="FPS" :min="1" :max="120" :step="1" :decimals="0" :reset-to="24" />
      <FxSlider v-model="duration" :label="$t('fx.duration')" :min="0.5" :max="120" :step="0.5" :reset-to="5" unit="s" />
      <FxSlider v-model="startZoom" label="Start zoom" :min="1" :max="6" :step="0.05" :reset-to="1" />
      <FxSlider v-model="endZoom" label="End zoom" :min="1" :max="6" :step="0.05" :reset-to="1.3" />
      <FxSlider v-model="startX" label="Start X" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      <FxSlider v-model="startY" label="Start Y" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      <FxSlider v-model="endX" label="End X" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      <FxSlider v-model="endY" label="End Y" :min="0" :max="1" :step="0.01" :reset-to="0.5" />
      <FxChips v-model="interp" :options="INTERPS" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceImageUrl" class="ctv:text-muted-foreground">Wire an image input</span>
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

const INTERPS = ['linear', 'smooth', 'ease_in', 'ease_out'].map(v => ({ value: v, label: v }))

const sourceImageUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'image'))
const width = useNumWidget(props.node, 'width', 1280)
const height = useNumWidget(props.node, 'height', 720)
const fps = useNumWidget(props.node, 'fps', 24)
const duration = useNumWidget(props.node, 'duration', 5)
const startZoom = useNumWidget(props.node, 'start_zoom', 1)
const endZoom = useNumWidget(props.node, 'end_zoom', 1.3)
const startX = useNumWidget(props.node, 'start_x', 0.5)
const startY = useNumWidget(props.node, 'start_y', 0.5)
const endX = useNumWidget(props.node, 'end_x', 0.5)
const endY = useNumWidget(props.node, 'end_y', 0.5)
const interp = useStrWidget(props.node, 'interp', 'smooth')
</script>
