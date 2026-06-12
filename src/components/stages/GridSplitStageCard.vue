<template>
  <div class="grid-split-stage">
    <div class="preview-shell">
      <div v-if="!sourceImageUrl" class="empty-state">
        <div class="empty-icon">▦</div>
        <div class="empty-text">{{ $t('gridSplit.connectImage') }}</div>
      </div>
      <template v-else>
        <img
          :src="sourceImageUrl"
          class="preview-img"
          draggable="false"
          @dragstart.prevent
        />
        <div class="grid-overlay">
          <div
            v-for="c in cols - 1"
            :key="`v${c}`"
            class="line v"
            :style="{ left: `${(c / cols) * 100}%` }"
          />
          <div
            v-for="r in rows - 1"
            :key="`h${r}`"
            class="line h"
            :style="{ top: `${(r / rows) * 100}%` }"
          />
        </div>
      </template>
    </div>

    <div class="status">
      <span v-if="!sourceImageUrl" class="muted">{{ $t('gridSplit.connectImage') }}</span>
      <span v-else-if="splitting" class="muted">{{ $t('gridSplit.splitting', { n: rows * cols }) }}</span>
      <span v-else-if="state.output" class="ok">{{ $t('gridSplit.done', { n: rows * cols }) }}</span>
      <span v-else class="muted">{{ $t('gridSplit.pickGrid') }}</span>
    </div>

    <div class="presets">
      <button
        v-for="p in PRESETS"
        :key="p.label"
        type="button"
        class="preset"
        :class="{ active: rows === p.r && cols === p.c }"
        @click="setGrid(p.r, p.c)"
      >{{ p.label }}</button>
    </div>
    <div class="steppers">
      <div class="stepper">
        <span class="label">{{ $t('gridSplit.rows') }}</span>
        <button type="button" @click="setGrid(rows - 1, cols)">−</button>
        <span class="num">{{ rows }}</span>
        <button type="button" @click="setGrid(rows + 1, cols)">+</button>
      </div>
      <div class="stepper">
        <span class="label">{{ $t('gridSplit.cols') }}</span>
        <button type="button" @click="setGrid(rows, cols - 1)">−</button>
        <span class="num">{{ cols }}</span>
        <button type="button" @click="setGrid(rows, cols + 1)">+</button>
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
  node: any
}>()

const { sourceImageUrl, rows, cols, setGrid, splitting } = useGridSplit(props.node, props.state)
</script>

<style scoped>
.grid-split-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}
.preview-shell {
  position: relative;
  width: 100%;
  height: 280px;
  background: #0a0a0f;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
}
.grid-overlay { position: absolute; inset: 0; pointer-events: none; }
.line { position: absolute; background: rgba(255, 255, 255, 0.7); box-shadow: 0 0 2px rgba(0,0,0,0.6); }
.line.v { top: 0; bottom: 0; width: 1px; }
.line.h { left: 0; right: 0; height: 1px; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: rgba(255, 255, 255, 0.5); gap: 6px;
}
.empty-icon { font-size: 32px; opacity: 0.6; }
.empty-text { font-size: 12px; }

.status { font-size: 10px; text-align: center; padding: 2px 0; }
.status .muted { color: rgba(255, 255, 255, 0.5); }
.status .ok    { color: #b5e3a5; }

.presets { display: flex; gap: 4px; flex-wrap: wrap; }
.preset {
  flex: 1 1 0; min-width: 44px;
  padding: 4px 6px; font-size: 11px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px; color: rgba(255, 255, 255, 0.85); cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.preset:hover { background: rgba(255, 255, 255, 0.1); }
.preset.active {
  background: rgba(233, 61, 130, 0.25);
  border-color: rgba(233, 61, 130, 0.6);
  color: #ffb0d8; font-weight: 600;
}

.steppers { display: flex; gap: 8px; }
.stepper {
  flex: 1; display: flex; align-items: center; gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px; padding: 2px 6px;
}
.stepper .label {
  font-size: 10px; color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase; letter-spacing: 0.4px;
}
.stepper button {
  width: 20px; height: 20px; border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04); color: rgba(255, 255, 255, 0.85);
  cursor: pointer; font-size: 13px; line-height: 1;
}
.stepper button:hover { background: rgba(255, 255, 255, 0.12); }
.stepper .num {
  margin-left: auto; min-width: 16px; text-align: center;
  font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
}
</style>
