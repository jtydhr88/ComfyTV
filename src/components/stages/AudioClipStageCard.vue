<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full ctv:grow">
    <AudioTrimBar
      :source-audio-url="sourceAudioUrl"
      :range="range"
      @update:range="onRangeUpdate"
    />

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceAudioUrl" class="ctv:text-muted-foreground">{{ $t('audioTrim.noInputAudio') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('audioTrim.trimming') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('audioTrim.trimmed') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('audioTrim.adjustThenRun') }}</span>
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
import AudioTrimBar from '@/components/widgets/AudioTrimBar.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import type { TrimRange } from '@/composables/widgets/useMediaTrim'
import { bindWidgetCallback, onNodeConfigure, readWidgetNum, writeWidget } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceAudioUrl = computed(() =>
  pickSourceImageUrl(props.state.inputs, 'audio') || pickSourceImageUrl(props.state.inputs, 'video'))

const range = ref<TrimRange>({
  start: readWidgetNum(props.node, 'start_s', 0),
  end:   readWidgetNum(props.node, 'end_s', 0),
})

function onRangeUpdate(v: TrimRange) {
  range.value = v
}

watch(range, (v) => {
  writeWidget(props.node, 'start_s', v.start)
  writeWidget(props.node, 'end_s', v.end)
}, { deep: true })

function bindEdge(name: string, key: keyof TrimRange) {
  bindWidgetCallback(props.node, name, (value) => {
    const v = Number(value)
    if (Number.isFinite(v) && v !== range.value[key]) {
      range.value = { ...range.value, [key]: v }
    }
  })
}
bindEdge('start_s', 'start')
bindEdge('end_s', 'end')

onNodeConfigure(props.node, () => {
  const restored: TrimRange = {
    start: readWidgetNum(props.node, 'start_s', range.value.start),
    end:   readWidgetNum(props.node, 'end_s', range.value.end),
  }
  if (restored.start !== range.value.start || restored.end !== range.value.end) {
    range.value = restored
  }
})
</script>
