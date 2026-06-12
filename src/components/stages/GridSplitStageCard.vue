<template>
  <div class="flex flex-col gap-1.5 size-full">
    <div class="relative w-full h-[280px] rounded-md overflow-hidden border border-border-subtle
                bg-black flex items-center justify-center">
      <div v-if="!sourceImageUrl"
           class="flex flex-col items-center justify-center gap-1.5 text-white/50">
        <div class="text-[32px] opacity-60">▦</div>
        <div class="text-xs">{{ $t('gridSplit.connectImage') }}</div>
      </div>
      <template v-else>
        <img
          :src="sourceImageUrl"
          class="max-w-full max-h-full object-contain select-none pointer-events-none"
          draggable="false"
          @dragstart.prevent
        />
        <div class="absolute inset-0 pointer-events-none">
          <div
            v-for="c in cols - 1"
            :key="`v${c}`"
            class="absolute top-0 bottom-0 w-px bg-white/70 shadow-[0_0_2px_rgb(0_0_0/0.6)]"
            :style="{ left: `${(c / cols) * 100}%` }"
          />
          <div
            v-for="r in rows - 1"
            :key="`h${r}`"
            class="absolute left-0 right-0 h-px bg-white/70 shadow-[0_0_2px_rgb(0_0_0/0.6)]"
            :style="{ top: `${(r / rows) * 100}%` }"
          />
        </div>
      </template>
    </div>

    <div class="text-2xs text-center py-0.5">
      <span v-if="!sourceImageUrl" class="text-muted-foreground">{{ $t('gridSplit.connectImage') }}</span>
      <span v-else-if="splitting" class="text-muted-foreground">{{ $t('gridSplit.splitting', { n: rows * cols }) }}</span>
      <span v-else-if="state.output" class="text-success-background">{{ $t('gridSplit.done', { n: rows * cols }) }}</span>
      <span v-else class="text-muted-foreground">{{ $t('gridSplit.pickGrid') }}</span>
    </div>

    <div class="flex gap-1 flex-wrap">
      <button
        v-for="p in PRESETS"
        :key="p.label"
        type="button"
        class="flex-1 min-w-[44px] py-1 px-1.5 rounded text-xs font-mono cursor-pointer border"
        :class="rows === p.r && cols === p.c
          ? 'bg-secondary-background-selected border-primary-background text-primary-background font-semibold'
          : 'bg-secondary-background border-border-subtle text-base-foreground hover:bg-secondary-background-hover'"
        @click="setGrid(p.r, p.c)"
      >{{ p.label }}</button>
    </div>
    <div class="flex gap-2">
      <div
        v-for="[lbl, val, setRow] in [
          [$t('gridSplit.rows'), rows, (n: number) => setGrid(n, cols)],
          [$t('gridSplit.cols'), cols, (n: number) => setGrid(rows, n)],
        ] as const"
        :key="String(lbl)"
        class="flex-1 flex items-center gap-1.5 py-0.5 px-1.5 rounded
               bg-secondary-background border border-border-subtle"
      >
        <span class="text-2xs uppercase tracking-wide text-muted-foreground">{{ lbl }}</span>
        <button
          type="button"
          class="size-5 rounded-sm border border-border-subtle bg-secondary-background text-base-foreground text-[13px] leading-none cursor-pointer hover:bg-secondary-background-hover"
          @click="setRow(val - 1)"
        >−</button>
        <span class="ml-auto min-w-4 text-center font-mono text-xs text-base-foreground">{{ val }}</span>
        <button
          type="button"
          class="size-5 rounded-sm border border-border-subtle bg-secondary-background text-base-foreground text-[13px] leading-none cursor-pointer hover:bg-secondary-background-hover"
          @click="setRow(val + 1)"
        >+</button>
      </div>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-context
    />
  </div>
</template>

<script setup lang="ts">
import StageCard from '@/components/stages/StageCard.vue'
import { useGridSplit } from '@/composables/stages/useGridSplit'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

const PRESETS = [
  { label: '1×2', r: 1, c: 2 },
  { label: '2×1', r: 2, c: 1 },
  { label: '2×2', r: 2, c: 2 },
  { label: '2×3', r: 2, c: 3 },
  { label: '3×3', r: 3, c: 3 },
] as const

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const { sourceImageUrl, rows, cols, setGrid, splitting } = useGridSplit(props.node, props.state)
</script>
