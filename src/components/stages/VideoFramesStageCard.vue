<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full ctv:grow">
    <div
      class="ctv-mt"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div class="ctv-mt-media ctv-mt-media--frames">
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
            muted playsinline preload="metadata"
            @click="playSelection"
          />
          <div v-if="isLoading" class="ctv-mt-overlay">{{ $t('videoTrim.loading') }}</div>
        </template>
      </div>

      <div class="ctv-mt-transport">
        <button
          type="button"
          class="ctv-mt-btn ctv-mt-btn--icon"
          :disabled="duration <= 0"
          :title="previewing ? $t('videoTrim.pause') : $t('videoCrop.play')"
          @click="playSelection"
        >
          <svg v-if="previewing" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
        </button>
        <span class="ctv-mt-time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
        <div class="ctv-mt-spacer" />
        <span class="ctv-mt-time ctv-mt-accent">{{ $t('videoFrames.marks', { n: marks.length }) }}</span>
      </div>

      <div
        ref="trackEl"
        tabindex="0"
        class="ctv-mt-track"
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
          <div class="ctv-mt-playhead" :style="{ left: `${playheadPct}%` }" />

          <button
            v-for="(t, i) in marks"
            :key="`${t}`"
            type="button"
            class="ctv-mt-mark"
            :style="{ left: `${(t / duration) * 100}%`, background: slotColor(i) }"
            :title="$t('videoFrames.removeMarkTip', { t: t.toFixed(2) })"
            @pointerdown.stop
            @click.stop="removeMark(i)"
          >{{ i + 1 }}</button>
        </template>
      </div>

      <div class="ctv-mt-fields">
        <button
          type="button"
          class="ctv-mt-btn ctv-mt-btn--grow"
          :disabled="duration <= 0 || marks.length >= MAX_MARKS"
          @click="addMarkAtPlayhead"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
          <span>{{ $t('videoFrames.addMark') }}</span>
        </button>

        <label class="ctv-mt-field ctv-mt-field--count">
          <input
            type="number" min="2" max="48" step="1"
            :value="uniformN"
            @change="(e) => setUniformN((e.target as HTMLInputElement).value)"
          />
        </label>
        <button
          type="button"
          class="ctv-mt-btn ctv-mt-btn--grow"
          :disabled="duration <= 0"
          @click="addUniform"
        ><span>{{ $t('videoFrames.uniform') }}</span></button>

        <button
          type="button"
          class="ctv-mt-btn ctv-mt-btn--shrink ctv-mt-btn--danger"
          :disabled="marks.length === 0"
          @click="clearMarks"
        ><span>{{ $t('videoFrames.clear') }}</span></button>
      </div>

      <div class="ctv-mt-status">
        <span v-if="!sourceVideoUrl">{{ $t('videoTrim.noInputVideo') }}</span>
        <span v-else-if="state.running">{{ $t('videoFrames.processing') }}</span>
        <span v-else-if="state.output" class="ctv-mt-status--ok">{{ $t('videoFrames.done') }}</span>
        <span v-else-if="marks.length === 0">{{ $t('videoFrames.addFirst') }}</span>
        <span v-else>{{ $t('videoFrames.readyToRun', { n: marks.length }) }}</span>
      </div>
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { slotColor } from '@/composables/stages/imageSlotMentions'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useFrameMarks } from '@/composables/stages/useFrameMarks'
import { MAX_MARKS } from '@/composables/stages/videoFrameMarks'
import {
  formatTime,
  THUMB_COUNT,
  useVideoTrim,
  type TrimRange,
} from '@/composables/widgets/useVideoTrim'
import '@/components/widgets/mediaTrackV2.css'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const sourceVideoUrl = computed(() => pickSourceImageUrl(props.state.inputs, 'video'))

const videoEl = ref<HTMLVideoElement | null>(null)
const trackEl = ref<HTMLDivElement | null>(null)
const fullRange = ref<TrimRange>({ start: 0, end: 0 })

const {
  duration, currentTime, isLoading, previewing,
  playSelection,
  onDragStart, onDragMove, onDragEnd, onTrackKeydown,
  thumbnails,
} = useVideoTrim({
  videoEl,
  trackEl,
  sourceVideoUrl,
  modelValue: fullRange,
})

const playheadPct = computed(() =>
  duration.value > 0 ? Math.min(100, (currentTime.value / duration.value) * 100) : 0)

const {
  marks, uniformN, setUniformN,
  addMarkAtPlayhead, addUniform, removeMark, clearMarks,
} = useFrameMarks(props.node, { duration, currentTime })
</script>
