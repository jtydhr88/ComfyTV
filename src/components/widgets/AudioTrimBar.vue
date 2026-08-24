<template>
  <div
    class="ctv-mt"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <audio
      v-if="sourceAudioUrl"
      ref="audioEl"
      :src="sourceAudioUrl"
      preload="metadata"
      class="ctv:hidden"
    />

    <div class="ctv-mt-transport">
      <button
        type="button"
        class="ctv-mt-btn ctv-mt-btn--icon"
        :disabled="duration <= 0"
        :title="previewing ? $t('audioTrim.pause') : $t('audioTrim.playSelection')"
        @click="playSelection"
      >
        <svg v-if="previewing" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
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
      class="ctv-mt-track ctv-mt-track--clip ctv-mt-track--wave"
      :class="{ 'ctv-mt-track--idle': duration <= 0 }"
      :title="$t('audioTrim.frameStepHint')"
      @pointerdown="(e) => onDragStart(e, 'scrub')"
      @pointermove="onDragMove"
      @pointerup="onDragEnd"
      @pointercancel="onDragEnd"
      @keydown="onTrackKeydown"
    >
      <canvas ref="waveCanvas" class="ctv-mt-wave" />

      <div v-if="!sourceAudioUrl" class="ctv-mt-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
        </svg>
        <div>{{ $t('audioTrim.noInputAudio') }}</div>
      </div>
      <div v-else-if="isLoading" class="ctv-mt-empty">{{ $t('audioTrim.loading') }}</div>
      <div v-else-if="loadError" class="ctv-mt-empty ctv-mt-empty--error">{{ $t('audioTrim.loadError') }}</div>

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
        <span>{{ isSplit ? $t('audioSplit.splitPoint') : $t('audioTrim.start') }}</span>
        <input
          type="number" min="0" step="0.1"
          :disabled="duration <= 0"
          :value="selStart.toFixed(2)"
          @change="(e) => onFieldChange('start', (e.target as HTMLInputElement).value)"
        />
      </label>
      <label v-if="!isSplit" class="ctv-mt-field">
        <span>{{ $t('audioTrim.end') }}</span>
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
        :title="$t('audioTrim.resetTooltip')"
        @click="resetSelection"
      ><span>{{ $t('audioTrim.reset') }}</span></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  formatTime,
  MIN_TRIM_GAP,
  useMediaTrim,
  type TrimRange,
} from '@/composables/widgets/useMediaTrim'
import { useAudioWaveform } from '@/composables/widgets/useAudioWaveform'
import './mediaTrackV2.css'

const props = withDefaults(defineProps<{
  sourceAudioUrl: string | null
  range: TrimRange
  mode?: 'trim' | 'split'
}>(), {
  mode: 'trim',
})

const isSplit = computed(() => props.mode === 'split')

const emit = defineEmits<{
  'update:range': [v: TrimRange]
}>()

const audioEl = ref<HTMLAudioElement | null>(null)
const trackEl = ref<HTMLDivElement | null>(null)
const waveCanvas = ref<HTMLCanvasElement | null>(null)

const rangeRef = ref<TrimRange>({ ...props.range })
watch(() => props.range, (v) => { rangeRef.value = { ...v } }, { deep: true })
watch(rangeRef, (v) => {
  if (v.start !== props.range.start || v.end !== props.range.end) {
    emit('update:range', { ...v })
  }
}, { deep: true })

const sourceAudioUrlRef = computed(() => props.sourceAudioUrl)

const {
  duration, currentTime, isLoading, loadError, previewing,
  selStart, selEnd, selDuration,
  setStart, setEnd, playSelection,
  onDragStart, onDragMove, onDragEnd, onTrackKeydown, stepSize,
} = useMediaTrim({
  mediaEl: audioEl,
  trackEl,
  sourceUrl: sourceAudioUrlRef,
  modelValue: rangeRef,
})
stepSize.value = 0.01

useAudioWaveform({
  url: sourceAudioUrlRef,
  enabled: computed(() => !!props.sourceAudioUrl),
  canvas: waveCanvas,
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
