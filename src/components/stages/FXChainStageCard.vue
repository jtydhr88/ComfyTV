<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div :class="sectionLabel">{{ $t('fxChain.title') }}</div>

      <div
        v-if="orderedRows.length === 0"
        class="ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:h-24
               ctv:rounded-md ctv:bg-black/40 ctv:border ctv:border-dashed ctv:border-border-subtle ctv:text-white/50"
      >
        <i class="pi pi-bolt ctv:text-[24px] ctv:opacity-60" />
        <div class="ctv:text-xs ctv:text-center ctv:px-2">{{ $t('fxChain.empty') }}</div>
      </div>

      <div v-else class="ctv:flex ctv:flex-col ctv:gap-1">
        <div
          v-for="(row, idx) in orderedRows"
          :key="row.slot"
          class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:p-1 ctv:rounded-md
                 ctv:bg-black/40 ctv:border ctv:border-border-subtle"
        >
          <span class="ctv:shrink-0 ctv:w-4 ctv:text-center ctv:text-2xs ctv:font-bold ctv:font-mono ctv:text-[#b8c4ff]">
            {{ idx + 1 }}
          </span>

          <div class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:shrink-0">
            <button
              type="button"
              class="ctv-fxc-btn"
              :disabled="idx === 0"
              :title="$t('fxChain.moveUp')"
              @click="onMoveUp(idx)"
            ><i class="pi pi-chevron-up ctv:text-[9px]" /></button>
            <button
              type="button"
              class="ctv-fxc-btn"
              :disabled="idx === orderedRows.length - 1"
              :title="$t('fxChain.moveDown')"
              @click="onMoveDown(idx)"
            ><i class="pi pi-chevron-down ctv:text-[9px]" /></button>
          </div>

          <span
            class="ctv:flex-1 ctv:min-w-0 ctv:truncate ctv:text-[11px] ctv:font-semibold"
            :class="row.known ? 'ctv:text-base-foreground' : 'ctv:italic ctv:text-muted-foreground'"
            :title="row.known ? row.kind : formatSlot(row.slot)"
          >
            {{ row.known ? row.label : $t('fxChain.unknown') }}
          </span>

          <span
            class="ctv:shrink-0 ctv:py-px ctv:px-1.5 ctv:text-3xs ctv:font-bold ctv:tracking-wide ctv:rounded-sm"
            :class="row.domain === 'audio'
              ? 'ctv:bg-[rgb(255_100_100/0.22)] ctv:text-[#ffb0b0]'
              : 'ctv:bg-[rgb(255_171_64/0.25)] ctv:text-[#ffd089]'"
          >
            {{ $t(`fxChain.domain.${row.domain}`) }}
          </span>

          <span class="ctv:shrink-0 ctv:text-3xs ctv:font-mono ctv:text-muted-foreground">
            {{ formatSlot(row.slot) }}
          </span>
        </div>
      </div>

      <div
        v-if="orderedRows.length > 1"
        class="ctv:text-3xs ctv:text-center ctv:text-muted-foreground ctv:tracking-wide ctv:truncate"
        :title="orderedSummary"
      >
        {{ orderedSummary }}
      </div>
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
import { formatSlot } from '@/composables/stages/useStageCard'
import { useFxChain } from '@/composables/stages/useFxChain'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const { orderedRows, onMoveUp, onMoveDown, orderedSummary } = useFxChain(props.node, () => props.state)

const sectionLabel = 'ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:opacity-60'
</script>

<style scoped>
.ctv-fxc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 12px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid var(--ctv-border-subtle, rgb(255 255 255 / 0.15));
  background: transparent;
  color: inherit;
}
.ctv-fxc-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
</style>
