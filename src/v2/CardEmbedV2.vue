<template>
  <div class="v2-fx-embed" @pointerdown.stop>
    <component
      :is="card"
      :state="state"
      :node="node"
      :on-run-request="onRunRequest ?? noop"
      :on-cancel-request="onCancelRequest ?? noop"
      :on-disconnect="onDisconnect ?? noop"
      :on-action="onAction ?? noop"
    />
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

defineProps<{
  card: Component
  node: LGraphNode
  state: StageState
  onRunRequest?: () => void
  onCancelRequest?: () => void
  onDisconnect?: (slot: string) => void
  onAction?: (id: string) => void
}>()

const noop = () => {}
</script>

<style scoped>
.v2-fx-embed {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.v2-fx-embed > :deep(*) {
  flex: 1;
  min-height: 0;
}

.v2-fx-embed :deep(> div > :last-child) {
  display: none;
}
</style>
