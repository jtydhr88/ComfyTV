<template>
  <div v-if="showServerSelect" class="v2-srv" @pointerdown.stop>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="3.5" y="4" width="17" height="6.5" rx="1.5" />
      <rect x="3.5" y="13.5" width="17" height="6.5" rx="1.5" />
      <circle cx="7" cy="7.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="7" cy="16.7" r="0.9" fill="currentColor" stroke="none" />
    </svg>
    <ComfyTVSelect
      class="v2-srv__select"
      :model-value="serverSelection"
      :options="serverOptions"
      :filterable="false"
      :disabled="state.running"
      @update:model-value="onServerPick"
    />
  </div>
</template>

<script setup lang="ts">
import ComfyTVSelect from '@/components/widgets/ComfyTVSelect.vue'
import { useStageServerSelect } from '@/composables/stages/useStageServerSelect'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const props = defineProps<{
  getNode: () => LGraphNode | undefined
  state: StageState
}>()

const { showServerSelect, serverOptions, serverSelection, onServerPick } =
  useStageServerSelect(() => props.state, props.getNode)
</script>

<style scoped>
.v2-srv {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: var(--v2-text-muted);
}
.v2-srv > svg {
  width: 14px;
  height: 14px;
  flex: none;
  opacity: 0.85;
}
.v2-srv__select {
  min-width: 0;
  max-width: 140px;
}
.v2-srv :deep(button) {
  height: 26px;
  padding: 0 8px;
  font-size: 11px;
  border-radius: 8px;
  border-width: 1px;
  background: transparent;
  border-color: var(--v2-chip-border);
}
.v2-srv :deep(button:hover) {
  background: var(--v2-hover-bg);
}
</style>
