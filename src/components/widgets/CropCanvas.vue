<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div ref="containerEl"
         class="ctv:relative ctv:w-full ctv:h-[340px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle">
      <div v-if="!imageUrl"
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <div class="ctv:text-[32px] ctv:opacity-60">⊟</div>
        <div class="ctv:text-xs">{{ $t('imageCrop.noInputImage') }}</div>
      </div>

      <template v-else>
        <img
          ref="imageEl"
          :src="imageUrl"
          :alt="$t('imageCrop.cropPreviewAlt')"
          class="ctv:block ctv:size-full ctv:object-contain ctv:pointer-events-none ctv:select-none"
          draggable="false"
          @load="handleImageLoad"
          @error="handleImageError"
          @dragstart.prevent
        />

        <div v-if="isLoading"
             class="ctv:absolute ctv:inset-0 ctv:z-10 ctv:flex ctv:items-center ctv:justify-center ctv:text-xs
                    ctv:bg-black/90 ctv:text-white/85">
          {{ $t('imageCrop.loading') }}
        </div>

        <div
          v-if="!isLoading"
          class="ctv:absolute ctv:box-content ctv:border-2 ctv:border-white ctv:cursor-move ctv:select-none
                 ctv:shadow-[0_0_0_9999px_rgb(0_0_0/0.5)]"
          :style="cropBoxStyle"
          @pointerdown="handleDragStart"
          @pointermove="handleDragMove"
          @pointerup="handleDragEnd"
        />

        <div
          v-for="handle in resizeHandles"
          v-show="!isLoading"
          :key="handle.direction"
          :class="['ctv:absolute', handle.isCorner ? 'ctv:bg-white/85 ctv:rounded-sm' : 'ctv:bg-transparent']"
          :style="{ ...handle.style, cursor: handle.cursor }"
          @pointerdown="(e) => handleResizeStart(e, handle.direction)"
          @pointermove="handleResizeMove"
          @pointerup="handleResizeEnd"
        />
      </template>
    </div>

    <div class="ctv:flex ctv:flex-col ctv:gap-1">
      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
        <span class="ctv:min-w-9 ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ $t('imageCrop.ratio') }}</span>
        <select
          v-model="selectedRatio"
          class="ctv-crop-select ctv:shrink-0 ctv:py-[3px] ctv:px-1.5 ctv:text-[11px] ctv:rounded
                 ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle"
        >
          <option v-for="key in ratioKeys" :key="key" :value="key">
            {{ key === 'custom' ? $t('imageCrop.custom') : key }}
          </option>
        </select>
        <button
          type="button"
          :class="[
            'ctv:w-7 ctv:h-6 ctv:text-xs ctv:rounded ctv:cursor-pointer ctv:border',
            isLockEnabled
              ? 'ctv:bg-secondary-background-selected ctv:border-primary-background ctv:text-primary-background'
              : 'ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground',
          ]"
          :title="isLockEnabled ? $t('imageCrop.unlockRatio') : $t('imageCrop.lockRatio')"
          @click="isLockEnabled = !isLockEnabled"
        >{{ isLockEnabled ? '🔒' : '🔓' }}</button>
      </div>

      <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-[11px]">
        <label v-for="b in BOUND_FIELDS" :key="b.label"
               class="ctv:flex-1 ctv:flex ctv:items-center ctv:gap-1 ctv:py-0.5 ctv:px-1 ctv:rounded
                      ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
          <span class="ctv:w-3 ctv:text-2xs ctv:text-muted-foreground">{{ b.label }}</span>
          <input
            type="number"
            :min="b.min" step="1"
            class="ctv-bound-input ctv:w-full ctv:border-0 ctv:outline-none ctv:bg-transparent ctv:text-[11px] ctv:font-mono ctv:text-base-foreground"
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
