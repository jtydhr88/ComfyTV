<template>
  <div
    v-if="store.isBusy"
    class="fixed bottom-4 right-4 z-[9999] inline-flex items-center gap-2
           py-1.5 px-3 rounded-full backdrop-blur pointer-events-none select-none
           bg-interface-menu-surface/85 border border-border-subtle
           text-base-foreground text-[11px] font-mono tracking-wide"
  >
    <span
      class="size-2 rounded-full"
      :class="store.currentNodeId
        ? 'bg-primary-background shadow-[0_0_8px_var(--primary-background)] animate-pulse'
        : 'bg-warning-background'"
    />
    <span class="font-medium">
      <template v-if="store.currentNodeId">
        {{ $t('execution.running', { nodeId: store.currentNodeId }) }}
      </template>
      <template v-else>
        {{ $t('execution.queued') }}
      </template>
    </span>
    <span
      v-if="store.queueRemaining > 1"
      class="py-px px-1.5 rounded-lg bg-base-foreground/10 text-2xs font-semibold"
    >
      +{{ store.queueRemaining - 1 }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useExecutionStore } from '@/stores/executionStore'

const store = useExecutionStore()
</script>
