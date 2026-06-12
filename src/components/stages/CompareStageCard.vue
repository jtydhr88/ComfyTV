<template>
  <div class="flex flex-col gap-1.5 size-full">
    <ImageCompare :before-image="imageA" :after-image="imageB" />

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-output
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import ImageCompare from '@/components/widgets/ImageCompare.vue'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: any
}>()

function resolvedInput(slot: string): string | null {
  const inp = props.state.inputs.find(i => i.slot === slot)
  if (!inp || inp.source !== 'upstream' || !inp.content) return null
  return inp.content
}

const imageA = computed(() => resolvedInput('image_a'))
const imageB = computed(() => resolvedInput('image_b'))
</script>
