<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <CropCanvas
      :source-image-url="sourceImageUrl"
      :bounds="bounds"
      @update:bounds="onBoundsUpdate"
    />

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceImageUrl" class="ctv:text-muted-foreground">{{ $t('imageCrop.noInputImage') }}</span>
      <span v-else-if="computing" class="ctv:text-muted-foreground">{{ $t('imageCrop.applying') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('imageCrop.applied') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('imageCrop.adjustToApply') }}</span>
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
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import CropCanvas from '@/components/widgets/CropCanvas.vue'
import { useCropStage } from '@/composables/stages/useCropStage'
import type { Bounds } from '@/composables/widgets/useImageCrop'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const { sourceImageUrl, bounds, setBounds, computing } = useCropStage(props.node, props.state)

function onBoundsUpdate(v: Bounds) {
  setBounds(v)
}
</script>
