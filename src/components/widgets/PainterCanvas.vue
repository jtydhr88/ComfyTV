<template>
  <div
    class="painter"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div class="canvas-shell" :style="canvasShellStyle">
      <img
        v-if="sourceImageUrl"
        :src="sourceImageUrl"
        class="bg-img"
        draggable="false"
        @dragstart.prevent
      />
      <canvas
        ref="canvasEl"
        class="paint-canvas"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointerenter="handlePointerEnter"
        @pointerleave="handlePointerLeave"
      />
      <div
        v-show="cursorVisible"
        ref="cursorEl"
        class="cursor-circle"
        :style="cursorStyle"
      />
    </div>

    <div class="size-readout" v-if="sourceImageUrl">
      {{ canvasWidth }} × {{ canvasHeight }}
    </div>

    <div class="controls">
      <div class="row">
        <span class="label">{{ $t('painter.tool') }}</span>
        <div class="tool-toggle">
          <button
            type="button"
            :class="['toggle-btn', tool === 'brush' && 'active']"
            :title="$t('painter.brush')"
            @click="tool = 'brush'"
          >✏️</button>
          <button
            type="button"
            :class="['toggle-btn', tool === 'eraser' && 'active']"
            :title="$t('painter.eraser')"
            @click="tool = 'eraser'"
          >🧽</button>
          <button
            type="button"
            :class="['toggle-btn', tool === 'rect' && 'active']"
            :title="$t('painter.rect')"
            @click="tool = 'rect'"
          >▭</button>
          <button
            type="button"
            :class="['toggle-btn', tool === 'ellipse' && 'active']"
            :title="$t('painter.ellipse')"
            @click="tool = 'ellipse'"
          >◯</button>
          <button
            type="button"
            :class="['toggle-btn', tool === 'label' && 'active']"
            :title="$t('painter.label')"
            @click="tool = 'label'"
          >①</button>
        </div>
      </div>

      <div class="row">
        <span class="label">{{ $t('painter.size') }}</span>
        <input
          type="range"
          min="1" max="200" step="1"
          :value="brushSize"
          @input="(e) => brushSize = Number((e.target as HTMLInputElement).value)"
        />
        <span class="value">{{ brushSize }}</span>
      </div>

      <template v-if="tool !== 'eraser'">
        <div class="row">
          <span class="label">{{ $t('painter.color') }}</span>
          <input
            type="color"
            class="color-swatch"
            :value="brushColorDisplay"
            @input="(e) => brushColorDisplay = (e.target as HTMLInputElement).value"
          />
          <span class="value mono">{{ brushColorDisplay }}</span>
        </div>

        <div class="row">
          <span class="label">{{ $t('painter.opacity') }}</span>
          <input
            type="range"
            min="0" max="100" step="1"
            :value="brushOpacityPercent"
            @input="(e) => brushOpacityPercent = Number((e.target as HTMLInputElement).value)"
          />
          <span class="value">{{ brushOpacityPercent }}%</span>
        </div>
      </template>

      <template v-if="tool === 'brush'">
        <div class="row">
          <span class="label">{{ $t('painter.hardness') }}</span>
          <input
            type="range"
            min="0" max="100" step="1"
            :value="brushHardnessPercent"
            @input="(e) => brushHardnessPercent = Number((e.target as HTMLInputElement).value)"
          />
          <span class="value">{{ brushHardnessPercent }}%</span>
        </div>
      </template>

      <button class="clear-btn" type="button" @click="handleClear">
        ↶ {{ $t('painter.clear') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePainter } from '@/composables/widgets/usePainter'

const props = defineProps<{
  node: any
  sourceImageUrl: string | null
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const cursorEl = ref<HTMLElement | null>(null)
const sourceImageUrlRef = computed(() => props.sourceImageUrl)

const {
  tool, brushSize, brushOpacity, brushHardness, brushColorDisplay,
  canvasWidth, canvasHeight,
  cursorVisible, displayBrushSize,
  handlePointerDown, handlePointerMove, handlePointerUp,
  handlePointerEnter, handlePointerLeave,
  handleClear,
  commitMask,
} = usePainter({
  canvasEl,
  cursorEl,
  sourceImageUrl: sourceImageUrlRef,
  node: props.node,
})

defineExpose({ commitMask })

const SHELL_MAX_HEIGHT_PX = 360
const canvasShellStyle = computed(() => {
  const ratio = canvasWidth.value / Math.max(1, canvasHeight.value)
  return {
    aspectRatio: `${canvasWidth.value} / ${canvasHeight.value}`,
    maxWidth: `${SHELL_MAX_HEIGHT_PX * ratio}px`,
  }
})

const cursorStyle = computed(() => ({
  width: `${displayBrushSize.value}px`,
  height: `${displayBrushSize.value}px`,
}))

const brushOpacityPercent = computed({
  get: () => Math.round(brushOpacity.value * 100),
  set: (v: number) => { brushOpacity.value = v / 100 },
})
const brushHardnessPercent = computed({
  get: () => Math.round(brushHardness.value * 100),
  set: (v: number) => { brushHardness.value = v / 100 },
})
</script>

<style scoped>
.painter {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.canvas-shell {
  position: relative;
  width: 100%;
  max-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0f;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.bg-img,
.paint-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.bg-img {
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
.paint-canvas {
  cursor: none;
  touch-action: none;
}
.cursor-circle {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.7);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8);
  pointer-events: none;
  will-change: transform;
}

.size-readout {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row {
  display: grid;
  grid-template-columns: 64px 1fr 48px;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}
.label {
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 10px;
}
.value {
  text-align: right;
  color: rgba(255, 255, 255, 0.85);
}
.value.mono {
  font-family: ui-monospace, SFMono-Regular, monospace;
}
input[type='range'] {
  width: 100%;
}
.color-swatch {
  width: 28px;
  height: 18px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.tool-toggle {
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  padding: 2px;
}
.toggle-btn {
  flex: 1;
  padding: 3px 8px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
}
.toggle-btn:hover {
  color: rgba(255, 255, 255, 0.9);
}
.toggle-btn.active {
  background: rgba(233, 61, 130, 0.25);
  color: #ffb0d8;
  font-weight: 600;
}

.clear-btn {
  margin-top: 2px;
  padding: 5px 10px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: background 120ms;
}
.clear-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}
</style>
