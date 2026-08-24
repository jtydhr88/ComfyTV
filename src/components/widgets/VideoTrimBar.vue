<template>
  <div
    class="ctv-mt"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div class="ctv-mt-media ctv-mt-media--video">
      <div v-if="!sourceVideoUrl" class="ctv-mt-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 9h18M7 5v4M12 5v4M17 5v4M7 15v4M12 15v4M17 15v4M3 15h18" />
        </svg>
        <div>{{ $t('videoTrim.noInputVideo') }}</div>
      </div>

      <template v-else>
        <video
          ref="videoEl"
          :src="sourceVideoUrl"
          :muted="muted"
          playsinline preload="metadata"
          @click="playSelection"
        />
        <div v-if="isLoading" class="ctv-mt-overlay">{{ $t('videoTrim.loading') }}</div>
        <div v-else-if="loadError" class="ctv-mt-overlay ctv-mt-overlay--error">{{ $t('videoTrim.loadError') }}</div>
      </template>
    </div>

    <div class="ctv-mt-transport">
      <button
        type="button"
        class="ctv-mt-btn ctv-mt-btn--icon"
        :disabled="duration <= 0"
        :title="previewing ? $t('videoTrim.pause') : $t('videoTrim.playSelection')"
        @click="playSelection"
      >
        <svg v-if="previewing" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
      </button>
      <button
        type="button"
        class="ctv-mt-btn ctv-mt-btn--icon"
        :title="muted ? $t('videoTrim.unmute') : $t('videoTrim.mute')"
        @click="muted = !muted"
      >
        <svg v-if="muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z" /><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z" /><path d="M15.5 9a4 4 0 010 6M18 6.5a8 8 0 010 11" />
        </svg>
      </button>

      <span class="ctv-mt-time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
      <div class="ctv-mt-spacer" />
      <span v-if="isSplit" class="ctv-mt-time ctv-mt-time--strong">
        <span class="ctv-mt-accent">A</span> {{ selStart.toFixed(1) }}s
        · <span class="ctv-mt-amber">B</span> {{ Math.max(0, duration - selStart).toFixed(1) }}s
      </span>
      <span v-else class="ctv-mt-time ctv-mt-time--strong">
        {{ formatTime(selStart) }} – {{ formatTime(selEnd) }}
        <span class="ctv-mt-accent">({{ selDuration.toFixed(1) }}s)</span>
      </span>
    </div>

    <div
      ref="trackEl"
      tabindex="0"
      class="ctv-mt-track ctv-mt-track--clip"
      :class="{ 'ctv-mt-track--idle': duration <= 0 }"
      :title="$t('videoTrim.frameStepHint')"
      @pointerdown="(e) => onDragStart(e, 'scrub')"
      @pointermove="onDragMove"
      @pointerup="onDragEnd"
      @pointercancel="onDragEnd"
      @keydown="onTrackKeydown"
    >
      <div class="ctv-mt-film">
        <img
          v-for="(thumb, i) in thumbnails"
          :key="i"
          :src="thumb"
          :style="{ width: `${100 / THUMB_COUNT}%` }"
          draggable="false"
        />
      </div>

      <template v-if="duration > 0">
        <template v-if="isSplit">
          <div class="ctv-mt-dim ctv-mt-dim--a" :style="{ left: 0, width: `${startPct}%` }" />
          <div class="ctv-mt-dim ctv-mt-dim--b" :style="{ right: 0, width: `${100 - startPct}%` }" />
        </template>
        <template v-else>
          <div class="ctv-mt-dim" :style="{ left: 0, width: `${startPct}%` }" />
          <div class="ctv-mt-dim" :style="{ right: 0, width: `${100 - endPct}%` }" />
          <div class="ctv-mt-selframe" :style="{ left: `${startPct}%`, width: `${endPct - startPct}%` }" />
        </template>

        <div
          class="ctv-mt-handle"
          :class="isSplit ? 'ctv-mt-handle--solo' : 'ctv-mt-handle--l'"
          :style="{ left: `${startPct}%` }"
          @pointerdown.stop="(e) => onDragStart(e, 'start')"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
        ><span class="ctv-mt-grip" /></div>
        <div
          v-if="!isSplit"
          class="ctv-mt-handle ctv-mt-handle--r"
          :style="{ left: `${endPct}%` }"
          @pointerdown.stop="(e) => onDragStart(e, 'end')"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
        ><span class="ctv-mt-grip" /></div>

        <div class="ctv-mt-playhead" :style="{ left: `${playheadPct}%` }" />
      </template>
    </div>

    <div class="ctv-mt-fields">
      <label class="ctv-mt-field">
        <span>{{ isSplit ? $t('videoSplit.splitPoint') : $t('videoTrim.start') }}</span>
        <input
          type="number" min="0" step="0.1"
          :disabled="duration <= 0"
          :value="selStart.toFixed(2)"
          @change="(e) => onFieldChange('start', (e.target as HTMLInputElement).value)"
        />
      </label>
      <label v-if="!isSplit" class="ctv-mt-field">
        <span>{{ $t('videoTrim.end') }}</span>
        <input
          type="number" min="0" step="0.1"
          :disabled="duration <= 0"
          :value="selEnd.toFixed(2)"
          @change="(e) => onFieldChange('end', (e.target as HTMLInputElement).value)"
        />
      </label>
      <button
        v-if="!isSplit"
        type="button"
        class="ctv-mt-btn ctv-mt-btn--shrink"
        :disabled="duration <= 0"
        :title="$t('videoTrim.resetTooltip')"
        @click="resetSelection"
      ><span>{{ $t('videoTrim.reset') }}</span></button>
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
import './mediaTrackV2.css'

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
  onDragStart, onDragMove, onDragEnd, onTrackKeydown,
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
