<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full">
    <div
      class="ctv:flex ctv:flex-col ctv:gap-1.5"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
    >
      <div class="ctv:relative ctv:w-full ctv:h-[220px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle">
        <div v-if="!sourceVideoUrl"
             class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
          <i class="pi pi-video ctv:text-[32px] ctv:opacity-60" />
          <div class="ctv:text-xs">{{ $t('videoTrim.noInputVideo') }}</div>
        </div>
        <template v-else>
          <video
            ref="videoEl"
            :src="sourceVideoUrl"
            class="ctv:block ctv:size-full ctv:object-contain ctv:cursor-pointer"
            muted playsinline preload="metadata"
            @click="playSelection"
          />
          <div v-if="isLoading"
               class="ctv:absolute ctv:inset-0 ctv:z-10 ctv:flex ctv:items-center ctv:justify-center ctv:text-xs
                      ctv:bg-black/80 ctv:text-white/85 ctv:pointer-events-none">
            {{ $t('videoTrim.loading') }}
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
          :title="previewing ? $t('videoTrim.pause') : $t('videoCrop.play')"
          @click="playSelection"
        ><i :class="['pi', previewing ? 'pi-pause' : 'pi-play']" /></button>
        <span class="ctv:font-mono ctv:text-muted-foreground">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </span>
        <span class="ctv:ml-auto ctv:font-mono ctv:font-bold ctv:text-primary-background">
          {{ $t('videoFrames.marks', { n: marks.length }) }}
        </span>
      </div>

      <div
        ref="trackEl"
        class="ctv:relative ctv:w-full ctv:h-12 ctv:rounded ctv:bg-secondary-background
               ctv:border ctv:border-border-subtle ctv:select-none ctv:touch-none"
        :class="duration > 0 ? 'ctv:cursor-crosshair' : 'ctv:cursor-default'"
        @pointerdown="(e) => onDragStart(e, 'scrub')"
        @pointermove="onDragMove"
        @pointerup="onDragEnd"
        @pointercancel="onDragEnd"
      >
        <div class="ctv:absolute ctv:inset-0 ctv:flex ctv:pointer-events-none ctv:overflow-hidden ctv:rounded">
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
          <div class="ctv:absolute ctv:inset-y-0 ctv:w-px ctv:z-10 ctv:bg-white ctv:pointer-events-none
                      ctv:shadow-[0_0_3px_rgb(255_255_255/0.8)]"
               :style="{ left: `${playheadPct}%` }" />

          <button
            v-for="(t, i) in marks"
            :key="`${t}`"
            type="button"
            class="ctv:absolute ctv:-top-1 ctv:z-20 ctv:-ml-2 ctv:size-4 ctv:p-0 ctv:rounded-full ctv:cursor-pointer
                   ctv:border-2 ctv:border-black/60 ctv:text-[8px] ctv:font-bold ctv:leading-none ctv:text-black"
            :style="{ left: `${(t / duration) * 100}%`, background: slotColor(i) }"
            :title="$t('videoFrames.removeMarkTip', { t: t.toFixed(2) })"
            @pointerdown.stop
            @click.stop="removeMark(i)"
          >{{ i + 1 }}</button>
        </template>
      </div>

      <div class="ctv:flex ctv:items-center ctv:gap-1 ctv:text-[11px]">
        <button
          type="button"
          class="ctv:flex-1 ctv:py-1 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background
                 ctv:disabled:opacity-40 ctv:disabled:cursor-default"
          :disabled="duration <= 0 || marks.length >= MAX_MARKS"
          @click="addMarkAtPlayhead"
        ><i class="pi pi-plus" /> {{ $t('videoFrames.addMark') }}</button>

        <label class="ctv:flex ctv:items-center ctv:gap-1 ctv:py-0.5 ctv:px-1 ctv:rounded
                      ctv:bg-secondary-background ctv:border ctv:border-border-subtle">
          <input
            type="number" min="2" max="48" step="1"
            class="ctv-num-input ctv:w-8 ctv:border-0 ctv:outline-none ctv:bg-transparent ctv:text-center ctv:text-[11px] ctv:font-mono ctv:text-base-foreground"
            :value="uniformN"
            @change="(e) => { uniformN = Math.min(48, Math.max(2, Math.round(Number((e.target as HTMLInputElement).value) || 2))) }"
          />
        </label>
        <button
          type="button"
          class="ctv:flex-1 ctv:py-1 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-primary-background
                 ctv:disabled:opacity-40 ctv:disabled:cursor-default"
          :disabled="duration <= 0"
          @click="addUniform"
        >{{ $t('videoFrames.uniform') }}</button>

        <button
          type="button"
          class="ctv:shrink-0 ctv:py-1 ctv:px-2 ctv:text-2xs ctv:rounded ctv:cursor-pointer ctv:border ctv:transition-colors
                 ctv:bg-secondary-background ctv:border-border-subtle ctv:text-base-foreground ctv:hover:border-destructive-background
                 ctv:disabled:opacity-40 ctv:disabled:cursor-default"
          :disabled="marks.length === 0"
          @click="clearMarks"
        >{{ $t('videoFrames.clear') }}</button>
      </div>
    </div>

    <div class="ctv:text-2xs ctv:text-center ctv:py-0.5 ctv:tracking-wide">
      <span v-if="!sourceVideoUrl" class="ctv:text-muted-foreground">{{ $t('videoTrim.noInputVideo') }}</span>
      <span v-else-if="state.running" class="ctv:text-muted-foreground">{{ $t('videoFrames.processing') }}</span>
      <span v-else-if="state.output" class="ctv:text-success-background">{{ $t('videoFrames.done') }}</span>
      <span v-else-if="marks.length === 0" class="ctv:text-muted-foreground">{{ $t('videoFrames.addFirst') }}</span>
      <span v-else class="ctv:text-muted-foreground">{{ $t('videoFrames.readyToRun', { n: marks.length }) }}</span>
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
import { MAX_MARKS, normalizeMarks, parseMarks, uniformMarks } from '@/composables/stages/videoFrameMarks'
import {
  formatTime,
  THUMB_COUNT,
  useVideoTrim,
  type TrimRange,
} from '@/composables/widgets/useVideoTrim'
import { bindWidgetCallback, onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'

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
  onDragStart, onDragMove, onDragEnd,
  thumbnails,
} = useVideoTrim({
  videoEl,
  trackEl,
  sourceVideoUrl,
  modelValue: fullRange,
})

const playheadPct = computed(() =>
  duration.value > 0 ? Math.min(100, (currentTime.value / duration.value) * 100) : 0)


const marks = ref<number[]>(parseMarks(readWidgetStr(props.node, 'marks', '')))
const uniformN = ref(6)

function writeMarks(v: number[]) {
  marks.value = v
  writeWidget(props.node, 'marks', JSON.stringify(v))
}

function addMarkAtPlayhead() {
  if (duration.value <= 0) return
  writeMarks(normalizeMarks([...marks.value, currentTime.value]))
}

function addUniform() {
  if (duration.value <= 0) return
  writeMarks(uniformMarks(uniformN.value, duration.value))
}

function removeMark(i: number) {
  writeMarks(marks.value.filter((_, idx) => idx !== i))
}

function clearMarks() {
  writeMarks([])
}

bindWidgetCallback(props.node, 'marks', (value) => {
  const parsed = parseMarks(String(value ?? ''))
  if (parsed.join() !== marks.value.join()) marks.value = parsed
})

onNodeConfigure(props.node, () => {
  const restored = parseMarks(readWidgetStr(props.node, 'marks', ''))
  if (restored.join() !== marks.value.join()) marks.value = restored
})
</script>

<style scoped>
.ctv-num-input { -moz-appearance: textfield; }
.ctv-num-input::-webkit-inner-spin-button,
.ctv-num-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>
