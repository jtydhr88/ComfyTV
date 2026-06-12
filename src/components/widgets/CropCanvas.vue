<template>
  <div
    class="flex flex-col gap-1.5 w-full"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div ref="containerEl"
         class="relative w-full h-[340px] rounded-md overflow-hidden bg-black border border-border-subtle">
      <div v-if="!imageUrl"
           class="h-full flex flex-col items-center justify-center gap-1.5 text-white/50">
        <div class="text-[32px] opacity-60">⊟</div>
        <div class="text-xs">{{ $t('imageCrop.noInputImage') }}</div>
      </div>

      <template v-else>
        <img
          ref="imageEl"
          :src="imageUrl"
          :alt="$t('imageCrop.cropPreviewAlt')"
          class="block size-full object-contain pointer-events-none select-none"
          draggable="false"
          @load="handleImageLoad"
          @error="handleImageError"
          @dragstart.prevent
        />

        <div v-if="isLoading"
             class="absolute inset-0 z-10 flex items-center justify-center text-xs
                    bg-black/90 text-white/85">
          {{ $t('imageCrop.loading') }}
        </div>

        <div
          v-if="!isLoading"
          class="absolute box-content border-2 border-white cursor-move select-none
                 shadow-[0_0_0_9999px_rgb(0_0_0/0.5)]"
          :style="cropBoxStyle"
          @pointerdown="handleDragStart"
          @pointermove="handleDragMove"
          @pointerup="handleDragEnd"
        />

        <div
          v-for="handle in resizeHandles"
          v-show="!isLoading"
          :key="handle.direction"
          :class="['absolute', handle.isCorner ? 'bg-white/85 rounded-sm' : 'bg-transparent']"
          :style="{ ...handle.style, cursor: handle.cursor }"
          @pointerdown="(e) => handleResizeStart(e, handle.direction)"
          @pointermove="handleResizeMove"
          @pointerup="handleResizeEnd"
        />
      </template>
    </div>

    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-1.5 text-[11px]">
        <span class="min-w-9 text-2xs uppercase tracking-wide text-muted-foreground">{{ $t('imageCrop.ratio') }}</span>
        <select
          v-model="selectedRatio"
          class="ctv-crop-select shrink-0 py-[3px] px-1.5 text-[11px] rounded
                 bg-secondary-background text-base-foreground border border-border-subtle"
        >
          <option v-for="key in ratioKeys" :key="key" :value="key">
            {{ key === 'custom' ? $t('imageCrop.custom') : key }}
          </option>
        </select>
        <button
          type="button"
          :class="[
            'w-7 h-6 text-xs rounded cursor-pointer border',
            isLockEnabled
              ? 'bg-secondary-background-selected border-primary-background text-primary-background'
              : 'bg-secondary-background border-border-subtle text-base-foreground',
          ]"
          :title="isLockEnabled ? $t('imageCrop.unlockRatio') : $t('imageCrop.lockRatio')"
          @click="isLockEnabled = !isLockEnabled"
        >{{ isLockEnabled ? '🔒' : '🔓' }}</button>
      </div>

      <div class="flex items-center gap-1 text-[11px]">
        <label v-for="b in BOUND_FIELDS" :key="b.label"
               class="flex-1 flex items-center gap-1 py-0.5 px-1 rounded
                      bg-secondary-background border border-border-subtle">
          <span class="w-3 text-2xs text-muted-foreground">{{ b.label }}</span>
          <input
            type="number"
            :min="b.min" step="1"
            class="ctv-bound-input w-full border-0 outline-none bg-transparent text-[11px] font-mono text-base-foreground"
            :value="boundFieldValue(b)"
            @change="(e) => boundFieldSet(b, (e.target as HTMLInputElement).value)"
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

type BoundField = { label: 'X' | 'Y' | 'W' | 'H'; min: number }
const BOUND_FIELDS: BoundField[] = [
  { label: 'X', min: 0 },
  { label: 'Y', min: 0 },
  { label: 'W', min: 16 },
  { label: 'H', min: 16 },
]
function boundFieldValue(b: BoundField): number {
  return b.label === 'X' ? cropX.value
    : b.label === 'Y' ? cropY.value
    : b.label === 'W' ? cropWidth.value
    : cropHeight.value
}
function boundFieldSet(b: BoundField, raw: string) {
  const v = clampInt(raw, b.min)
  if (b.label === 'X') cropX.value = v
  else if (b.label === 'Y') cropY.value = v
  else if (b.label === 'W') cropWidth.value = v
  else cropHeight.value = v
}
</script>

<style scoped>
.ctv-crop-select :deep(option) {
  background: var(--interface-menu-surface, #1a1a1f);
  color: var(--base-foreground, #ddd);
}
.ctv-bound-input { -moz-appearance: textfield; }
.ctv-bound-input::-webkit-inner-spin-button,
.ctv-bound-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>
