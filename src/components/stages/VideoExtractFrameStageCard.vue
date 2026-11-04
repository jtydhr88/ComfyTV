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
            <path d="M8.5 15l2.5-3 2 2.5 1.5-1.5 2 2" />
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
        <span v-if="duration > 0" class="ctv-mt-time ctv-mt-accent">{{ formatTime(target) }}</span>
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
          <span
            class="ctv-mt-mark"
            :style="{ left: `${(target / duration) * 100}%`, background: slotColor(0), pointerEvents: 'none' }"
          />
        </template>
      </div>

      <div class="ctv-mt-fields">
        <FxChips v-model="position" :options="positions" class="ctv:grow" />
        <button
          type="button"
          class="ctv-mt-btn ctv-mt-btn--shrink"
          :disabled="duration <= 0"
          @click="useCurrentFrame"
        ><span>{{ $t('videoExtractFrame.usePlayhead') }}</span></button>
      </div>

      <div class="ctv-mt-status">
        <span v-if="!sourceVideoUrl">{{ $t('videoTrim.noInputVideo') }}</span>
        <span v-else-if="state.running">{{ $t('videoExtractFrame.processing') }}</span>
        <span v-else-if="state.output" class="ctv-mt-status--ok">{{ $t('videoExtractFrame.done') }}</span>
        <span v-else>{{ $t('videoExtractFrame.adjustThenRun') }}</span>
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
import { computed, ref, watch } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import FxChips from '@/components/widgets/fx/FxChips.vue'
import { t } from '@/i18n'
import { slotColor } from '@/composables/stages/imageSlotMentions'
import { pickSourceImageUrl } from '@/composables/stages/stageInputs'
import { useNumWidget, useStrWidget } from '@/composables/widgets/useWidgetModel'
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
  duration, currentTime, isLoading, previewing, stepSize,
  seek, playSelection,
  onDragStart, onDragMove, onDragEnd, onTrackKeydown,
  thumbnails,
} = useVideoTrim({
  videoEl,
  trackEl,
  sourceVideoUrl,
  modelValue: fullRange,
})

const position = useStrWidget(props.node, 'position', 'last')
const atSeconds = useNumWidget(props.node, 'at_seconds', 0)

const positions = computed(() => (['first', 'middle', 'last', 'custom'] as const).map(value => ({
  value, label: t(`videoExtractFrame.${value}`),
})))

const playheadPct = computed(() =>
  duration.value > 0 ? Math.min(100, (currentTime.value / duration.value) * 100) : 0)

const target = computed(() => {
  const d = duration.value
  if (position.value === 'first') return 0
  if (position.value === 'middle') return d / 2
  if (position.value === 'last') return Math.max(0, d - stepSize.value)
  return Math.min(d, atSeconds.value)
})

watch([target, duration], ([v, d]) => {
  if (d > 0) seek(v)
}, { immediate: true })

function useCurrentFrame() {
  atSeconds.value = Math.round(currentTime.value * 1000) / 1000
  position.value = 'custom'
}
</script>
