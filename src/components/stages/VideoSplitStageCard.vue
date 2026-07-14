<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoTrimBar
      :source-video-url="sourceVideoUrl"
      :range="range"
      mode="split"
      @update:range="onRangeUpdate"
    />

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('videoSplit.splitting') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('videoSplit.done') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('videoSplit.adjustThenRun') }}</span>
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
import { computed, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import VideoTrimBar from '@/components/widgets/VideoTrimBar.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import type { TrimRange } from '@/composables/widgets/useVideoTrim'
import { bindWidgetCallback, onNodeConfigure, readWidgetNum, writeWidget } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const range = ref<TrimRange>({
  start: readWidgetNum(props.node, 'split_s', 0),
  end: 0,
})

function onRangeUpdate(v: TrimRange) {
  range.value = v
}

watch(range, (v) => {
  writeWidget(props.node, 'split_s', v.start)
}, { deep: true })

bindWidgetCallback(props.node, 'split_s', (value) => {
  const v = Number(value)
  if (Number.isFinite(v) && v !== range.value.start) {
    range.value = { ...range.value, start: v }
  }
})

onNodeConfigure(props.node, () => {
  const restored = readWidgetNum(props.node, 'split_s', range.value.start)
  if (restored !== range.value.start) {
    range.value = { start: restored, end: 0 }
  }
})
</script>
