<template>
  <FxCardShell :node="node">
    <template #player>
      <VideoPlayerLite :source-video-url="sourceVideoUrl">
        <template #overlay>
          <div
            v-if="sourceVideoUrl"
            class="ctv:absolute ctv:border ctv:border-dashed ctv:border-red-400/90 ctv:bg-red-400/10 ctv:pointer-events-none"
            :style="rectStyle"
          />
        </template>
      </VideoPlayerLite>
    </template>

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxChips v-model="method" :options="METHOD_OPTS" />
      <FxSlider v-model="rectX" label="X" :min="0" :max="1" :step="0.005" :reset-to="0.42" />
      <FxSlider v-model="rectY" label="Y" :min="0" :max="1" :step="0.005" :reset-to="0.42" />
      <FxSlider v-model="rectW" label="W" :min="0.01" :max="1" :step="0.005" :reset-to="0.16" />
      <FxSlider v-model="rectH" label="H" :min="0.01" :max="1" :step="0.005" :reset-to="0.16" />
      <FxSlider v-model="feather" label="Feather" :min="0" :max="1" :step="0.01" :reset-to="0.15" />
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
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
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const METHOD_OPTS = [
  { value: 'edge_blend', label: 'Edge Blend' },
  { value: 'inpaint', label: 'Inpaint' },
]

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))
const method = useStrWidget(props.node, 'method', 'edge_blend')
const rectX = useNumWidget(props.node, 'rect_x', 0.42)
const rectY = useNumWidget(props.node, 'rect_y', 0.42)
const rectW = useNumWidget(props.node, 'rect_w', 0.16)
const rectH = useNumWidget(props.node, 'rect_h', 0.16)
const feather = useNumWidget(props.node, 'feather', 0.15)

const rectStyle = computed(() => ({
  left: `${rectX.value * 100}%`,
  top: `${rectY.value * 100}%`,
  width: `${rectW.value * 100}%`,
  height: `${rectH.value * 100}%`,
}))
</script>
