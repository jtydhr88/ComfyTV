<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <VideoCropCanvas
      :source-video-url="sourceVideoUrl"
      :bounds="bounds"
      @update:bounds="onBoundsUpdate"
    />

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('videoCrop.cropping') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('videoCrop.cropped') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('videoCrop.adjustThenRun') }}</span>
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
import VideoCropCanvas from '@/components/widgets/VideoCropCanvas.vue'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import type { Bounds } from '@/composables/widgets/useImageCrop'
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

const bounds = ref<Bounds>({
  x:      readWidgetNum(props.node, 'x', 0),
  y:      readWidgetNum(props.node, 'y', 0),
  width:  readWidgetNum(props.node, 'w', 0),
  height: readWidgetNum(props.node, 'h', 0),
})

function onBoundsUpdate(v: Bounds) {
  bounds.value = v
}

watch(bounds, (v) => {
  writeWidget(props.node, 'x', v.x)
  writeWidget(props.node, 'y', v.y)
  writeWidget(props.node, 'w', v.width)
  writeWidget(props.node, 'h', v.height)
}, { deep: true })

function bindBound(name: string, key: keyof Bounds) {
  bindWidgetCallback(props.node, name, (value) => {
    const v = Number(value)
    if (Number.isFinite(v) && v !== bounds.value[key]) {
      bounds.value = { ...bounds.value, [key]: v }
    }
  })
}
bindBound('x', 'x')
bindBound('y', 'y')
bindBound('w', 'width')
bindBound('h', 'height')

onNodeConfigure(props.node, () => {
  const restored: Bounds = {
    x:      readWidgetNum(props.node, 'x', bounds.value.x),
    y:      readWidgetNum(props.node, 'y', bounds.value.y),
    width:  readWidgetNum(props.node, 'w', bounds.value.width),
    height: readWidgetNum(props.node, 'h', bounds.value.height),
  }
  if (restored.x !== bounds.value.x || restored.y !== bounds.value.y
    || restored.width !== bounds.value.width || restored.height !== bounds.value.height) {
    bounds.value = restored
  }
})
</script>
