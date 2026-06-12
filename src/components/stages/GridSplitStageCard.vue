<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div class="ctv:relative ctv:w-full ctv:h-[280px] ctv:rounded-md ctv:overflow-hidden ctv:border ctv:border-border-subtle
                ctv:bg-black ctv:flex ctv:items-center ctv:justify-center">
      <div v-if="!sourceImageUrl"
           class="ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <div class="ctv:text-[32px] ctv:opacity-60">▦</div>
        <div class="ctv:text-xs">{{ $t('gridSplit.connectImage') }}</div>
      </div>
      <template v-else>
        <img
          :src="sourceImageUrl"
          class="ctv:max-w-full ctv:max-h-full ctv:object-contain ctv:select-none ctv:pointer-events-none"
          draggable="false"
          @dragstart.prevent
        />
        <div class="ctv:absolute ctv:inset-0 ctv:pointer-events-none">
          <div
            v-for="c in cols - 1"
            :key="`v${c}`"
            class="ctv:absolute ctv:top-0 ctv:bottom-0 ctv:w-px ctv:bg-white/70 ctv:shadow-[0_0_2px_rgb(0_0_0/0.6)]"
            :style="{ left: `${(c / cols) * 100}%` }"
          />
          <div
            v-for="r in rows - 1"
            :key="`h${r}`"
            class="ctv:absolute ctv:left-0 ctv:right-0 ctv:h-px ctv:bg-white/70 ctv:shadow-[0_0_2px_rgb(0_0_0/0.6)]"
            :style="{ top: `${(r / rows) * 100}%` }"
          />
        </div>
      </template>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5">
      <span v-if="!sourceImageUrl" class="ctv:text-muted-foreground">{{ $t('gridSplit.connectImage') }}</span>
      <span v-else-if="splitting" class="ctv:text-muted-foreground">{{ $t('gridSplit.splitting', { n: rows * cols }) }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('gridSplit.done', { n: rows * cols }) }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('gridSplit.pickGrid') }}</span>
    </div>

    <div class="ctv:flex ctv:gap-1 ctv:flex-wrap">
      <button
        v-for="p in PRESETS"
        :key="p.label"
        type="button"
        class="ctv:flex-1 ctv:min-w-[44px] ctv:py-1 ctv:px-1.5 ctv:rounded ctv:text-xs ctv:font-mono ctv:cursor-pointer ctv:border"
        :class="rows === p.r && cols === p.c
          ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background ctv:font-semibold'
          : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:bg-secondary-background-hover'"
        @click="setGrid(p.r, p.c)"
      >{{ p.label }}</button>
    </div>
    <div class="ctv:flex ctv:gap-2">
      <div
        v-for="[lbl, val, setRow] in [
          [$t('gridSplit.rows'), rows, (n: number) => setGrid(n, cols)],
          [$t('gridSplit.cols'), cols, (n: number) => setGrid(rows, n)],
        ] as const"
        :key="String(lbl)"
        class="ctv:flex-1 ctv:flex ctv:items-center ctv:gap-1.5 ctv:py-0.5 ctv:px-1.5 ctv:rounded
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle"
      >
        <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ lbl }}</span>
        <button
          type="button"
          class="ctv:size-5 ctv:rounded-sm ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:text-base-foreground ctv:text-[13px] ctv:leading-none ctv:cursor-pointer ctv:hover:bg-secondary-background-hover"
          @click="setRow(val - 1)"
        >−</button>
        <span class="ctv:ml-auto ctv:min-w-4 ctv:text-center ctv:font-mono ctv:text-xs ctv:text-base-foreground">{{ val }}</span>
        <button
          type="button"
          class="ctv:size-5 ctv:rounded-sm ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:text-base-foreground ctv:text-[13px] ctv:leading-none ctv:cursor-pointer ctv:hover:bg-secondary-background-hover"
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
