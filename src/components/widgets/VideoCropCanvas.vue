<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div ref="containerEl"
         class="ctv:relative ctv:w-full ctv:h-[300px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle">
      <div v-if="!sourceVideoUrl"
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <i class="pi pi-video ctv:text-[32px] ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('videoTrim.noInputVideo') }}</div>
      </div>

      <template v-else>
        <video
          ref="videoEl"
          :src="sourceVideoUrl"
          :muted="muted"
          class="ctv:block ctv:size-full ctv:object-contain ctv:pointer-events-none ctv:select-none"
          playsinline preload="metadata"
          @loadedmetadata="onVideoReady"
          @timeupdate="onTimeUpdate"
          @error="onVideoError"
        />

        <div v-if="isLoading"
             class="ctv:absolute ctv:inset-0 ctv:z-10 ctv:flex ctv:items-center ctv:justify-center ctv:text-xs
                    ctv:bg-black/90 ctv:text-white/85">
          {{ $t('videoTrim.loading') }}
        </div>
        <div v-else-if="loadError"
             class="ctv:absolute ctv:inset-0 ctv:z-10 ctv:flex ctv:items-center ctv:justify-center ctv:text-xs
                    ctv:bg-black/90 ctv:text-destructive-background">
          {{ $t('videoTrim.loadError') }}
        </div>

        <div
          v-if="!isLoading && !loadError"
          class="ctv:absolute ctv:box-content ctv:border-2 ctv:border-white ctv:cursor-move ctv:select-none
                 ctv:shadow-[0_0_0_9999px_rgb(0_0_0/0.5)]"
          :style="cropBoxStyle"
          @pointerdown="handleDragStart"
          @pointermove="handleDragMove"
          @pointerup="handleDragEnd"
        />

        <div
          v-for="handle in resizeHandles"
          v-show="!isLoading && !loadError"
          :key="handle.direction"
          :class="['ctv:absolute', handle.isCorner ? 'ctv:bg-white/85 ctv:rounded-sm' : 'ctv:bg-transparent']"
          :style="{ ...handle.style, cursor: handle.cursor }"
          @pointerdown="(e) => handleResizeStart(e, handle.direction)"
          @pointermove="handleResizeMove"
          @pointerup="handleResizeEnd"
        />
      </template>
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
      <button
        type="button"
        class="ctv:flex ctv:items-center ctv:justify-center ctv:w-7 ctv:h-6 ctv:text-xs ctv:rounded ctv:cursor-pointer
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
               ctv:hover:border-primary-background ctv:disabled:opacity-40 ctv:disabled:cursor-default"
        :disabled="duration <= 0"
        :title="playing ? $t('videoTrim.pause') : $t('videoCrop.play')"
        @click="togglePlay"
      ><i :class="['pi', playing ? 'pi-pause' : 'pi-play']" /></button>
      <button
        type="button"
        class="ctv:flex ctv:items-center ctv:justify-center ctv:w-7 ctv:h-6 ctv:text-xs ctv:rounded ctv:cursor-pointer
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
               ctv:hover:border-primary-background"
        :title="muted ? $t('videoTrim.unmute') : $t('videoTrim.mute')"
        @click="muted = !muted"
      ><i :class="['pi', muted ? 'pi-volume-off' : 'pi-volume-up']" /></button>

      <div
        ref="seekEl"
        class="ctv:relative ctv:flex-1 ctv:h-2 ctv:rounded-full ctv:overflow-hidden ctv:bg-secondary-background
               ctv:border ctv:border-border-subtle ctv:touch-none"
        :class="duration > 0 ? 'ctv:cursor-pointer' : 'ctv:cursor-default'"
        @pointerdown="onSeekStart"
        @pointermove="onSeekMove"
        @pointerup="onSeekEnd"
        @pointercancel="onSeekEnd"
      >
        <div class="ctv:absolute ctv:inset-y-0 ctv:left-0 ctv:bg-primary-background ctv:pointer-events-none"
             :style="{ width: `${progressPct}%` }" />
      </div>

      <span class="ctv:shrink-0 ctv:font-mono ctv:text-muted-foreground">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>
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
        ><i :class="['pi', isLockEnabled ? 'pi-lock' : 'pi-lock-open']" /></button>
      </div>

      <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-[11px]">
        <label v-for="b in BOUND_FIELDS" :key="b.label"
               class="ctv:flex-1 ctv:flex ctv:items-center ctv:gap-1 ctv:py-0.5 ctv:px-1 ctv:rounded
                      ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
          <span class="ctv:w-3 ctv:text-2xs ctv:text-muted-foreground">{{ b.label }}</span>
          <input
            type="number"
            :min="b.min" step="1"
            :disabled="duration <= 0"
            class="ctv-bound-input ctv:w-full ctv:border-0 ctv:outline-none ctv:bg-transparent ctv:text-[11px] ctv:font-mono ctv:text-base-foreground ctv:disabled:opacity-40"
            :value="boundFieldValue(b)"
            @change="(e) => boundFieldSet(b, (e.target as HTMLInputElement).value)"
          />
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ASPECT_RATIOS, useImageCrop, type Bounds, type CropMediaElement } from '@/composables/widgets/useImageCrop'
import { useVideoPlayback } from '@/composables/widgets/useVideoPlayback'
import { formatTime } from '@/composables/widgets/useVideoTrim'

const props = defineProps<{
  sourceVideoUrl: string | null
  bounds: Bounds
}>()

const emit = defineEmits<{
  'update:bounds': [v: Bounds]
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const containerEl = ref<HTMLDivElement | null>(null)
const seekEl = ref<HTMLDivElement | null>(null)

const boundsRef = ref<Bounds>({ ...props.bounds })
watch(() => props.bounds, (v) => { boundsRef.value = { ...v } }, { deep: true })
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

const sourceVideoUrlRef = computed(() => props.sourceVideoUrl)
const mediaElRef = computed<CropMediaElement | null>(() => videoEl.value)

const {
  isLoading,
  cropX, cropY, cropWidth, cropHeight,
  selectedRatio, isLockEnabled,
  cropBoxStyle, resizeHandles,
  handleImageLoad, handleImageError,
  handleDragStart, handleDragMove, handleDragEnd,
  handleResizeStart, handleResizeMove, handleResizeEnd,
} = useImageCrop({
  imageEl: mediaElRef,
  containerEl,
  sourceImageUrl: sourceVideoUrlRef,
  modelValue: boundsRef,
})

const {
  muted, playing, duration, currentTime, loadError, progressPct,
  onLoadedMetadata, onTimeUpdate, onError,
  togglePlay, onSeekStart, onSeekMove, onSeekEnd,
} = useVideoPlayback({ videoEl, seekEl, sourceVideoUrl: sourceVideoUrlRef })

function onVideoReady() {
  onLoadedMetadata()
  handleImageLoad()
}
function onVideoError() {
  onError()
  handleImageError()
}

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
