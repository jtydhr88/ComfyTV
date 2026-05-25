<template>
  <div
    class="crop-widget"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div ref="containerEl" class="image-shell">
      <div v-if="!imageUrl" class="empty-state">
        <div class="empty-icon">⊟</div>
        <div class="empty-text">{{ $t('imageCrop.noInputImage') }}</div>
      </div>

      <template v-else>
        <img
          ref="imageEl"
          :src="imageUrl"
          :alt="$t('imageCrop.cropPreviewAlt')"
          class="bg-img"
          draggable="false"
          @load="handleImageLoad"
          @error="handleImageError"
          @dragstart.prevent
        />

        <div v-if="isLoading" class="loading-shade">
          {{ $t('imageCrop.loading') }}
        </div>

        <div
          v-if="!isLoading"
          class="crop-box"
          :style="cropBoxStyle"
          @pointerdown="handleDragStart"
          @pointermove="handleDragMove"
          @pointerup="handleDragEnd"
        />

        <div
          v-for="handle in resizeHandles"
          v-show="!isLoading"
          :key="handle.direction"
          :class="['handle', handle.isCorner && 'corner']"
          :style="{ ...handle.style, cursor: handle.cursor }"
          @pointerdown="(e) => handleResizeStart(e, handle.direction)"
          @pointermove="handleResizeMove"
          @pointerup="handleResizeEnd"
        />
      </template>
    </div>

    <div class="controls">
      <div class="row">
        <span class="label">{{ $t('imageCrop.ratio') }}</span>
        <select v-model="selectedRatio" class="select">
          <option v-for="key in ratioKeys" :key="key" :value="key">
            {{ key === 'custom' ? $t('imageCrop.custom') : key }}
          </option>
        </select>
        <button
          type="button"
          class="lock-btn"
          :class="{ active: isLockEnabled }"
          :title="isLockEnabled ? $t('imageCrop.unlockRatio') : $t('imageCrop.lockRatio')"
          @click="isLockEnabled = !isLockEnabled"
        >
          {{ isLockEnabled ? '🔒' : '🔓' }}
        </button>
      </div>

      <div class="row bounds-row">
        <label class="bound">
          <span class="bound-label">X</span>
          <input
            type="number"
            min="0" step="1"
            :value="cropX"
            @change="(e) => cropX = clampInt((e.target as HTMLInputElement).value)"
          />
        </label>
        <label class="bound">
          <span class="bound-label">Y</span>
          <input
            type="number"
            min="0" step="1"
            :value="cropY"
            @change="(e) => cropY = clampInt((e.target as HTMLInputElement).value)"
          />
        </label>
        <label class="bound">
          <span class="bound-label">W</span>
          <input
            type="number"
            min="16" step="1"
            :value="cropWidth"
            @change="(e) => cropWidth = clampInt((e.target as HTMLInputElement).value, 16)"
          />
        </label>
        <label class="bound">
          <span class="bound-label">H</span>
          <input
            type="number"
            min="16" step="1"
            :value="cropHeight"
            @change="(e) => cropHeight = clampInt((e.target as HTMLInputElement).value, 16)"
          />
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ASPECT_RATIOS, useImageCrop, type Bounds } from '@/composables/widgets/useImageCrop'

const props = defineProps<{
  sourceImageUrl: string | null
  bounds: Bounds
}>()

const emit = defineEmits<{
  'update:bounds': [v: Bounds]
}>()

const imageEl = ref<HTMLImageElement | null>(null)
const containerEl = ref<HTMLDivElement | null>(null)

const boundsRef = ref<Bounds>({ ...props.bounds })
function syncFromProp() { boundsRef.value = { ...props.bounds } }
import { watch } from 'vue'
watch(() => props.bounds, syncFromProp, { deep: true })
watch(boundsRef, (v) => {
  if (
    v.x !== props.bounds.x ||
    v.y !== props.bounds.y ||
    v.width !== props.bounds.width ||
    v.height !== props.bounds.height
  ) {
    emit('update:bounds', { ...v })
  }
}, { deep: true })

import { computed } from 'vue'
const sourceImageUrlRef = computed(() => props.sourceImageUrl)

const {
  imageUrl, isLoading,
  cropX, cropY, cropWidth, cropHeight,
  selectedRatio, isLockEnabled,
  cropBoxStyle, resizeHandles,
  handleImageLoad, handleImageError,
  handleDragStart, handleDragMove, handleDragEnd,
  handleResizeStart, handleResizeMove, handleResizeEnd,
} = useImageCrop({
  imageEl,
  containerEl,
  sourceImageUrl: sourceImageUrlRef,
  modelValue: boundsRef,
})

const ratioKeys = Object.keys(ASPECT_RATIOS)

function clampInt(raw: string, min = 0): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.round(n))
}
</script>

<style scoped>
.crop-widget {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.image-shell {
  position: relative;
  width: 100%;
  height: 340px;
  background: #0a0a0f;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  gap: 6px;
}
.empty-icon { font-size: 32px; opacity: 0.6; }
.empty-text { font-size: 12px; }

.bg-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.loading-shade {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 15, 0.9);
  color: rgba(255, 255, 255, 0.85);
  z-index: 10;
  font-size: 12px;
}

.crop-box {
  position: absolute;
  box-sizing: content-box;
  border: 2px solid #fff;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  cursor: move;
  user-select: none;
}

.handle {
  position: absolute;
  background: transparent;
}
.handle.corner {
  background: rgba(255, 255, 255, 0.85);
  border-radius: 2px;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}
.label {
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 10px;
  min-width: 36px;
}
.select {
  flex: 0 0 auto;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 11px;
}
.select :deep(option) {
  background: #1a1a1f;
  color: #ddd;
}
.lock-btn {
  width: 28px;
  height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  font-size: 12px;
}
.lock-btn.active {
  background: rgba(233, 61, 130, 0.25);
  border-color: rgba(233, 61, 130, 0.6);
  color: #ffb0d8;
}

.bounds-row { gap: 4px; }
.bound {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  padding: 2px 4px;
}
.bound-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  width: 12px;
}
.bound input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  -moz-appearance: textfield;
}
.bound input::-webkit-inner-spin-button,
.bound input::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>
