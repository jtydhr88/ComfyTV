<template>
  <div ref="rootEl" class="outpaint-stage">
    <div
      ref="canvasEl"
      class="canvas-area"
      :class="{ 'is-empty': !sourceImageUrl }"
    >
      <template v-if="!sourceImageUrl">
        <div class="empty-state">
          <div class="empty-icon">↔</div>
          <div class="empty-text">{{ $t('outpaint.noInputImage') }}</div>
        </div>
      </template>
      <template v-else>
        <div class="pad-area" :style="padAreaStyle" />
        <img
          :src="sourceImageUrl"
          class="src-img"
          :style="imgStyle"
          draggable="false"
          @load="onSourceLoaded"
          @dragstart.prevent
        />
        <div
          v-for="side in SIDES"
          :key="side"
          class="handle"
          :class="`handle-${side}`"
          :style="handleStyle(side)"
          @pointerdown="onHandlePointerDown($event, side)"
        >
          <span class="handle-grip" />
        </div>
        <span
          v-for="side in SIDES"
          :key="`v-${side}`"
          class="pad-value"
          :class="`pad-value-${side}`"
          :style="badgeStyle(side)"
        >{{ pad[side] }}px</span>
      </template>
    </div>

    <div class="controls">
      <div class="row">
        <label v-for="side in SIDES" :key="`in-${side}`" class="num">
          <span class="num-label">{{ $t(`outpaint.${side}`) }}</span>
          <input
            type="number" min="0" max="4096" step="8"
            :value="pad[side]"
            :disabled="!sourceImageUrl"
            @change="(e) => setPad(side, Number((e.target as HTMLInputElement).value))"
          />
        </label>
        <button
          type="button"
          class="reset-btn"
          :disabled="!sourceImageUrl"
          @click="resetAll"
        >{{ $t('outpaint.reset') }}</button>
      </div>
      <div class="row dim-row">
        <span class="muted">{{ $t('outpaint.output') }}:</span>
        <span class="dim">{{ outDims }}</span>
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
import { ref } from 'vue'

import StageCard from '@/components/stages/StageCard.vue'
import { SIDES, useOutpaintCanvas } from '@/composables/stages/useOutpaintCanvas'
import type { StageState } from '@/stores/stageStore'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: any
}>()

const rootEl   = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLDivElement | null>(null)

const {
  sourceImageUrl,
  pad, setPad, resetAll,
  onSourceLoaded,
  padAreaStyle, imgStyle, handleStyle, badgeStyle,
  outDims,
  onHandlePointerDown,
} = useOutpaintCanvas(props.node, props.state, canvasEl, rootEl)
</script>

<style scoped>
.outpaint-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
}

.canvas-area {
  position: relative;
  flex: 1 1 auto;
  min-height: 280px;
  background: #0a0a0f;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  overflow: hidden;
  user-select: none;
}
.canvas-area.is-empty { display: flex; align-items: center; justify-content: center; }
.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  color: rgba(255, 255, 255, 0.5);
}
.empty-icon { font-size: 28px; opacity: 0.6; }
.empty-text { font-size: 12px; }

.pad-area {
  position: absolute;
  background-image:
    linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%),
    linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%);
  background-size: 12px 12px;
  background-position: 0 0, 6px 6px;
  border: 1px dashed rgba(255, 140, 200, 0.45);
}
.src-img {
  position: absolute;
  pointer-events: none;
  outline: 1px solid rgba(255, 255, 255, 0.7);
}

.handle {
  position: absolute;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  z-index: 3;
}
.handle-left, .handle-right  { cursor: ew-resize; }
.handle-top,  .handle-bottom { cursor: ns-resize; }
.handle::before {
  content: '';
  position: absolute;
  background: rgba(78, 168, 255, 0.65);
  border-radius: 2px;
}
.handle-left::before,  .handle-right::before  { width: 3px; height: 100%; }
.handle-top::before,   .handle-bottom::before { height: 3px; width: 100%; }
.handle:hover::before { background: rgba(78, 168, 255, 1); }
.handle-grip {
  position: absolute;
  width: 12px; height: 12px;
  background: #4ea8ff;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0,0,0,0.5);
}

.pad-value {
  position: absolute;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.6);
  color: rgba(255, 255, 255, 0.9);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: ui-monospace, monospace;
  z-index: 2;
  pointer-events: none;
}

.controls { display: flex; flex-direction: column; gap: 4px; }
.row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.num {
  display: flex; align-items: center; gap: 3px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  padding: 2px 4px;
}
.num-label {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  min-width: 32px;
}
.num input {
  width: 48px;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  padding: 1px 3px;
  font-size: 11px;
  font-family: ui-monospace, monospace;
}
.num input:disabled { opacity: 0.4; }

.reset-btn {
  margin-left: auto;
  padding: 3px 10px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
  border-radius: 3px;
  cursor: pointer;
}
.reset-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); }
.reset-btn:disabled { opacity: 0.4; cursor: default; }

.dim-row .muted { font-size: 10px; color: rgba(255, 255, 255, 0.4); }
.dim { font-size: 11px; color: rgba(255, 255, 255, 0.8); font-family: ui-monospace, monospace; }
</style>
