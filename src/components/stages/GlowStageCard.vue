<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoPlayerLite :source-video-url="sourceVideoUrl" />

    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <FxSlider v-model="threshold" :label="$t('fx.threshold')" :min="0" :max="0.99" :step="0.01" :reset-to="0.7" />
      <FxSlider v-model="size" :label="$t('fx.size')" :min="0.5" :max="50" :step="0.5" :reset-to="4" />
      <FxSlider v-model="bloomRatio" label="Bloom ratio" :min="1.1" :max="4" :step="0.1" :reset-to="2" />
      <FxSlider v-model="bloomCount" label="Bloom count" :min="1" :max="8" :step="1" :decimals="0" :reset-to="5" />
      <FxSlider v-model="gain" label="Gain" :min="0" :max="8" :step="0.1" :reset-to="1" />
      <FxSlider v-model="mix" label="Mix" :min="0" :max="1" :step="0.01" :reset-to="1" />
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
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
const threshold = useNumWidget(props.node, 'threshold', 0.7)
const size = useNumWidget(props.node, 'size', 4)
const bloomRatio = useNumWidget(props.node, 'bloom_ratio', 2)
const bloomCount = useNumWidget(props.node, 'bloom_count', 5)
const gain = useNumWidget(props.node, 'gain', 1)
const mix = useNumWidget(props.node, 'mix', 1)
</script>
