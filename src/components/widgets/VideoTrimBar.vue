<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div class="ctv:relative ctv:w-full ctv:h-[240px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle">
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
          class="ctv:block ctv:size-full ctv:object-contain ctv:cursor-pointer"
          playsinline preload="metadata"
          @click="playSelection"
        />
        <div v-if="isLoading"
             class="ctv:absolute ctv:inset-0 ctv:z-10 ctv:flex ctv:items-center ctv:justify-center ctv:text-xs
                    ctv:bg-black/80 ctv:text-white/85 ctv:pointer-events-none">
          {{ $t('videoTrim.loading') }}
        </div>
        <div v-else-if="loadError"
             class="ctv:absolute ctv:inset-0 ctv:z-10 ctv:flex ctv:items-center ctv:justify-center ctv:text-xs
                    ctv:bg-black/80 ctv:text-destructive-background ctv:pointer-events-none">
          {{ $t('videoTrim.loadError') }}
        </div>
      </template>
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
      <button
        type="button"
        class="ctv:flex ctv:items-center ctv:justify-center ctv:w-7 ctv:h-6 ctv:text-xs ctv:rounded ctv:cursor-pointer
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
               ctv:hover:border-primary-background ctv:disabled:opacity-40 ctv:disabled:cursor-default"
        :disabled="duration <= 0"
        :title="previewing ? $t('videoTrim.pause') : $t('videoTrim.playSelection')"
        @click="playSelection"
      ><i :class="['pi', previewing ? 'pi-pause' : 'pi-play']" /></button>
      <button
        type="button"
        class="ctv:flex ctv:items-center ctv:justify-center ctv:w-7 ctv:h-6 ctv:text-xs ctv:rounded ctv:cursor-pointer
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
               ctv:hover:border-primary-background"
        :title="muted ? $t('videoTrim.unmute') : $t('videoTrim.mute')"
        @click="muted = !muted"
      ><i :class="['pi', muted ? 'pi-volume-off' : 'pi-volume-up']" /></button>

      <span class="ctv:font-mono ctv:text-muted-foreground">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>
      <span v-if="isSplit" class="ctv:ml-auto ctv:font-mono ctv:text-base-foreground">
        <span class="ctv:text-primary-background ctv:font-bold">A</span> {{ selStart.toFixed(1) }}s
        · <span class="ctv:text-[#ffd089] ctv:font-bold">B</span> {{ Math.max(0, duration - selStart).toFixed(1) }}s
      </span>
      <span v-else class="ctv:ml-auto ctv:font-mono ctv:text-base-foreground">
        {{ formatTime(selStart) }} – {{ formatTime(selEnd) }}
        <span class="ctv:text-primary-background ctv:font-bold">({{ selDuration.toFixed(1) }}s)</span>
      </span>
    </div>

    <div
      ref="trackEl"
      class="ctv:relative ctv:w-full ctv:h-12 ctv:rounded ctv:overflow-hidden ctv:bg-secondary-background
             ctv:border ctv:border-border-subtle ctv:select-none ctv:touch-none"
      :class="duration > 0 ? 'ctv:cursor-crosshair' : 'ctv:cursor-default'"
      @pointerdown="(e) => onDragStart(e, 'scrub')"
      @pointermove="onDragMove"
      @pointerup="onDragEnd"
      @pointercancel="onDragEnd"
    >
      <div class="ctv:absolute ctv:inset-0 ctv:flex ctv:pointer-events-none">
        <img
          v-for="(thumb, i) in thumbnails"
          :key="i"
          :src="thumb"
          class="ctv:h-full ctv:object-cover ctv:min-w-0"
          :style="{ width: `${100 / THUMB_COUNT}%` }"
          draggable="false"
        />
      </div>

      <template v-if="duration > 0">
        <template v-if="isSplit">
          <div class="ctv:absolute ctv:inset-y-0 ctv:left-0 ctv:bg-primary-background/15 ctv:pointer-events-none"
               :style="{ width: `${startPct}%` }" />
          <div class="ctv:absolute ctv:inset-y-0 ctv:right-0 ctv:bg-[rgb(255_171_64/0.18)] ctv:pointer-events-none"
               :style="{ width: `${100 - startPct}%` }" />
        </template>
        <template v-else>
          <div class="ctv:absolute ctv:inset-y-0 ctv:left-0 ctv:bg-black/65 ctv:pointer-events-none"
               :style="{ width: `${startPct}%` }" />
          <div class="ctv:absolute ctv:inset-y-0 ctv:right-0 ctv:bg-black/65 ctv:pointer-events-none"
               :style="{ width: `${100 - endPct}%` }" />

          <div class="ctv:absolute ctv:inset-y-0 ctv:border-y-2 ctv:border-primary-background ctv:pointer-events-none"
               :style="{ left: `${startPct}%`, width: `${endPct - startPct}%` }" />
        </template>

        <div
          class="ctv:absolute ctv:inset-y-0 ctv:w-2.5 ctv:-ml-[5px] ctv:z-20 ctv:cursor-ew-resize ctv:flex ctv:items-center ctv:justify-center
                 ctv:bg-primary-background"
          :class="isSplit ? 'ctv:rounded-sm' : 'ctv:rounded-l-sm'"
          :style="{ left: `${startPct}%` }"
          @pointerdown.stop="(e) => onDragStart(e, 'start')"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
        ><span class="ctv:w-px ctv:h-4 ctv:bg-white/80" /></div>
        <div
          v-if="!isSplit"
          class="ctv:absolute ctv:inset-y-0 ctv:w-2.5 ctv:-ml-[5px] ctv:z-20 ctv:cursor-ew-resize ctv:flex ctv:items-center ctv:justify-center
                 ctv:bg-primary-background ctv:rounded-r-sm"
          :style="{ left: `${endPct}%` }"
          @pointerdown.stop="(e) => onDragStart(e, 'end')"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
        ><span class="ctv:w-px ctv:h-4 ctv:bg-white/80" /></div>

        <div class="ctv:absolute ctv:inset-y-0 ctv:w-px ctv:z-10 ctv:bg-white ctv:pointer-events-none
                    ctv:shadow-[0_0_3px_rgb(255_255_255/0.8)]"
             :style="{ left: `${playheadPct}%` }" />
      </template>
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-[11px]">
      <label class="ctv:flex-1 ctv:flex ctv:items-center ctv:gap-1 ctv:py-0.5 ctv:px-1 ctv:rounded
                    ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
        <span class="ctv:shrink-0 ctv:text-2xs ctv:text-muted-foreground">{{ isSplit ? $t('videoSplit.splitPoint') : $t('videoTrim.start') }}</span>
        <input
          type="number" min="0" step="0.1"
          :disabled="duration <= 0"
          class="ctv-trim-input ctv:w-full ctv:border-0 ctv:outline-none ctv:bg-transparent ctv:text-[11px] ctv:font-mono ctv:text-base-foreground ctv:disabled:opacity-40"
          :value="selStart.toFixed(2)"
          @change="(e) => onFieldChange('start', (e.target as HTMLInputElement).value)"
        />
      </label>
      <label v-if="!isSplit"
             class="ctv:flex-1 ctv:flex ctv:items-center ctv:gap-1 ctv:py-0.5 ctv:px-1 ctv:rounded
                    ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
        <span class="ctv:shrink-0 ctv:text-2xs ctv:text-muted-foreground">{{ $t('videoTrim.end') }}</span>
        <input
          type="number" min="0" step="0.1"
          :disabled="duration <= 0"
          class="ctv-trim-input ctv:w-full ctv:border-0 ctv:outline-none ctv:bg-transparent ctv:text-[11px] ctv:font-mono ctv:text-base-foreground ctv:disabled:opacity-40"
          :value="selEnd.toFixed(2)"
          @change="(e) => onFieldChange('end', (e.target as HTMLInputElement).value)"
        />
      </label>
      <button
        v-if="!isSplit"
        type="button"
        class="ctv:shrink-0 ctv:py-0.5 ctv:px-1.5 ctv:text-2xs ctv:rounded ctv:cursor-pointer
               ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:text-base-foreground
               ctv:hover:border-primary-background ctv:disabled:opacity-40 ctv:disabled:cursor-default"
        :disabled="duration <= 0"
        :title="$t('videoTrim.resetTooltip')"
        @click="resetSelection"
      >{{ $t('videoTrim.reset') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  formatTime,
  MIN_TRIM_GAP,
  THUMB_COUNT,
  useVideoTrim,
  type TrimRange,
} from '@/composables/widgets/useVideoTrim'

const props = withDefaults(defineProps<{
  sourceVideoUrl: string | null
  range: TrimRange
  mode?: 'trim' | 'split'
}>(), {
  mode: 'trim',
})

const isSplit = computed(() => props.mode === 'split')

const emit = defineEmits<{
  'update:range': [v: TrimRange]
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const trackEl = ref<HTMLDivElement | null>(null)
const muted = ref(true)

const rangeRef = ref<TrimRange>({ ...props.range })
watch(() => props.range, (v) => { rangeRef.value = { ...v } }, { deep: true })
watch(rangeRef, (v) => {
  if (v.start !== props.range.start || v.end !== props.range.end) {
    emit('update:range', { ...v })
  }
}, { deep: true })

const sourceVideoUrlRef = computed(() => props.sourceVideoUrl)

const {
  duration, currentTime, isLoading, loadError, previewing,
  selStart, selEnd, selDuration,
  setStart, setEnd, playSelection,
  onDragStart, onDragMove, onDragEnd,
  thumbnails,
} = useVideoTrim({
  videoEl,
  trackEl,
  sourceVideoUrl: sourceVideoUrlRef,
  modelValue: rangeRef,
})

const startPct = computed(() => duration.value > 0 ? (selStart.value / duration.value) * 100 : 0)
const endPct = computed(() => duration.value > 0 ? (selEnd.value / duration.value) * 100 : 100)
const playheadPct = computed(() => {
  if (duration.value <= 0) return 0
  return Math.min(100, (currentTime.value / duration.value) * 100)
})

function onFieldChange(which: 'start' | 'end', raw: string) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return
  if (which === 'start') setStart(Math.min(n, selEnd.value - MIN_TRIM_GAP))
  else setEnd(Math.max(n, selStart.value + MIN_TRIM_GAP))
}

function resetSelection() {
  rangeRef.value = { start: 0, end: 0 }
}
</script>

<style scoped>
.ctv-trim-input { -moz-appearance: textfield; }
.ctv-trim-input::-webkit-inner-spin-button,
.ctv-trim-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>
