<template>
  <div
    v-if="store.isBusy"
    class="status-pill"
    :class="{ 'is-running': !!store.currentNodeId }"
  >
    <span class="dot" />
    <span class="label">
      <template v-if="store.currentNodeId">
        {{ $t('execution.running', { nodeId: store.currentNodeId }) }}
      </template>
      <template v-else>
        {{ $t('execution.queued') }}
      </template>
    </span>
    <span v-if="store.queueRemaining > 1" class="queue">
      +{{ store.queueRemaining - 1 }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useExecutionStore } from '@/stores/executionStore'

const store = useExecutionStore()
</script>

<style scoped>
.status-pill {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(20, 20, 30, 0.85);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 99px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.3px;
  z-index: 9999;
  backdrop-filter: blur(6px);
  pointer-events: none;
  user-select: none;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(230, 180, 60, 0.8);
}
.is-running .dot {
  background: rgba(78, 168, 255, 0.95);
  box-shadow: 0 0 8px rgba(78, 168, 255, 0.6);
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
}
.label { font-weight: 500; }
.queue {
  padding: 1px 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
}
</style>
