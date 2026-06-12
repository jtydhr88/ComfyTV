<template>
  <div
    v-if="store.isBusy"
    class="ctv:fixed ctv:bottom-4 ctv:right-4 ctv:z-[9999] ctv:inline-flex ctv:items-center ctv:gap-2
           ctv:py-1.5 ctv:px-3 ctv:rounded-full ctv:backdrop-blur ctv:pointer-events-none ctv:select-none
           ctv:bg-interface-menu-surface/85 ctv:border ctv:border-border-subtle
           ctv:text-base-foreground ctv:text-[11px] ctv:font-mono ctv:tracking-wide"
  >
    <span
      class="ctv:size-2 ctv:rounded-full"
      :class="store.currentNodeId
        ? 'ctv:bg-primary-background ctv:shadow-[0_0_8px_var(--primary-background)] ctv:animate-pulse'
        : 'ctv:bg-warning-background'"
    />
    <span class="ctv:font-medium">
      <template v-if="store.currentNodeId">
        {{ $t('execution.running', { nodeId: store.currentNodeId }) }}
      </template>
      <template v-else>
        {{ $t('execution.queued') }}
      </template>
    </span>
    <span
      v-if="store.queueRemaining > 1"
      class="ctv:py-px ctv:px-1.5 ctv:rounded-lg ctv:bg-base-foreground/10 ctv:text-2xs ctv:font-semibold"
    >
      +{{ store.queueRemaining - 1 }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useExecutionStore } from '@/stores/executionStore'

const store = useExecutionStore()
</script>
