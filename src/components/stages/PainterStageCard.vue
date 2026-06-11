<template>
  <div class="painter-stage">
    <PainterCanvas
      ref="painterRef"
      :node="node"
      :source-image-url="sourceImageUrl"
    />

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunWithMaskCommit"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import PainterCanvas from '@/components/widgets/PainterCanvas.vue'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: any
}>()

const painterRef = ref<InstanceType<typeof PainterCanvas> | null>(null)

const sourceImageUrl = computed<string | null>(() => {
  const inp = props.state.inputs.find(i => i.slot === 'image')
  if (!inp || inp.source !== 'upstream' || !inp.content) return null
  return inp.content
})

async function onRunWithMaskCommit() {
  try {
    await painterRef.value?.commitMask()
  } catch (e) {
    console.warn('[ComfyTV/painter] commitMask failed, running anyway:', e)
  }
  props.onRunRequest()
}
</script>

<style scoped>
.painter-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}
</style>
