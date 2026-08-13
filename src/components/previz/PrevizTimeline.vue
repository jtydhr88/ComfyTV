<template>
  <div
    ref="root"
    class="ctv:relative ctv:flex ctv:h-full ctv:min-h-0 ctv:select-none ctv:flex-col ctv:gap-0.5 ctv:overflow-hidden ctv:rounded-lg ctv:bg-node-background ctv:p-1.5 ctv:text-[10px]"
  >
    <div class="ctv:flex ctv:min-h-0 ctv:flex-1 ctv:flex-col ctv:gap-0.5 ctv:overflow-y-auto" @wheel.stop>
      <div class="ctv:flex ctv:items-stretch ctv:gap-1">
        <div class="ctv:w-20 ctv:shrink-0" />
        <div
          ref="laneArea"
          class="ctv:relative ctv:h-5 ctv:flex-1 ctv:cursor-pointer"
          @pointerdown="onRulerDown"
        >
          <div
            v-for="tick in ticks"
            :key="tick"
            class="ctv:absolute ctv:top-0 ctv:h-full ctv:border-l ctv:border-border-subtle ctv:pl-0.5 ctv:text-muted-foreground"
            :style="{ left: pct(tick) }"
          >
            {{ tick }}s
          </div>
        </div>
      </div>

      <div class="ctv:flex ctv:items-stretch ctv:gap-1">
        <div class="ctv:flex ctv:w-20 ctv:shrink-0 ctv:items-center ctv:truncate ctv:text-muted-foreground">
          {{ $t('previz.camera') }}
        </div>
        <div class="ctv:relative ctv:h-7 ctv:flex-1">
          <button
            v-for="(shot, i) in data.shots"
            :key="i"
            type="button"
            class="ctv:absolute ctv:top-0 ctv:h-full ctv:truncate ctv:rounded ctv:border ctv:px-1 ctv:text-left"
            :class="i === activeShot
              ? 'ctv:border-primary ctv:bg-primary/25 ctv:text-base-foreground'
              : 'ctv:border-border-subtle ctv:bg-secondary-background ctv:text-muted-foreground'"
            :style="{ left: pct(shot.start), width: pct(shot.dur) }"
            :title="`${shot.name} · ${shot.dur.toFixed(1)}s`"
            @pointerdown.stop
            @click="$emit('select-shot', i)"
          >
            {{ shot.name }}
          </button>
          <span
            v-for="key in camKeys"
            :key="`${key.shotIdx}:${key.ptIdx}`"
            class="ctv:absolute ctv:bottom-0 ctv:z-10 ctv:size-2 ctv:-translate-x-1/2 ctv:cursor-ew-resize ctv:rounded-full ctv:bg-[#7bd88f]"
            :style="{ left: pct(key.time) }"
            :title="`${key.time.toFixed(2)}s`"
            @pointerdown.stop.prevent="startKeyDrag($event, key)"
          />
        </div>
      </div>

      <div
        v-for="track in data.tracks"
        :key="track.label"
        class="ctv:flex ctv:items-stretch ctv:gap-1"
      >
        <div class="ctv:flex ctv:w-20 ctv:shrink-0 ctv:items-center ctv:truncate">
          <span
            class="ctv:mr-1 ctv:inline-block ctv:size-2 ctv:shrink-0 ctv:rounded-full"
            :style="{ background: trackColor(track.colorIndex) }"
          />
          {{ track.label }}
        </div>
        <div
          class="ctv:relative ctv:h-5 ctv:flex-1 ctv:rounded ctv:bg-secondary-background/60"
          @pointerdown="onRulerDown"
        >
          <div
            v-if="track.times.length >= 2"
            class="ctv:absolute ctv:top-1/2 ctv:h-1 ctv:-translate-y-1/2 ctv:rounded"
            :style="{
              left: pct(track.times[0]),
              width: pct(track.times[track.times.length - 1] - track.times[0]),
              background: trackColor(track.colorIndex),
              opacity: 0.4
            }"
          />
          <span
            v-for="(time, i) in track.times"
            :key="i"
            class="ctv:absolute ctv:top-1/2 ctv:z-10 ctv:size-2 ctv:-translate-x-1/2 ctv:-translate-y-1/2 ctv:cursor-ew-resize ctv:rounded-full"
            :style="{ left: pct(time), background: trackColor(track.colorIndex) }"
            :title="`${time.toFixed(2)}s`"
            @pointerdown.stop.prevent="startKeyDrag($event, { label: track.label, ptIdx: i, time })"
          />
        </div>
      </div>
    </div>

    <div class="ctv:pointer-events-none ctv:absolute ctv:inset-y-1.5" :style="playheadStyle">
      <div class="ctv:h-full ctv:w-px ctv:bg-danger-foreground/90" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const TRACK_COLORS = ['#4f8cff', '#ff6b81', '#ffd166', '#2ec4b6', '#b388ff', '#ff9f43']

interface TimelineShot {
  name: string
  dur: number
  start: number
  camTimes: number[]
}

interface TimelineTrack {
  label: string
  colorIndex: number
  times: number[]
}

const props = defineProps<{
  data: { duration: number; shots: TimelineShot[]; tracks: TimelineTrack[] }
  globalTime: number
  activeShot: number
}>()

const emit = defineEmits<{
  seek: [time: number]
  'select-shot': [index: number]
  'set-cam-time': [shotIdx: number, ptIdx: number, time: number]
  'set-path-time': [label: string, ptIdx: number, time: number]
}>()

const root = ref<HTMLElement | null>(null)
const laneArea = ref<HTMLElement | null>(null)

const safeDuration = computed(() => Math.max(0.1, props.data.duration))

function pct(seconds: number): string {
  return `${(Math.max(0, seconds) / safeDuration.value) * 100}%`
}

function trackColor(i: number): string {
  return TRACK_COLORS[i % TRACK_COLORS.length]
}

const ticks = computed(() => {
  const dur = safeDuration.value
  const step = dur > 40 ? 10 : dur > 16 ? 5 : dur > 8 ? 2 : 1
  const out: number[] = []
  for (let t = 0; t < dur; t += step) out.push(t)
  return out
})

const camKeys = computed(() =>
  props.data.shots.flatMap((shot, shotIdx) =>
    shot.camTimes.map((time, ptIdx) => ({
      shotIdx,
      ptIdx,
      time: shot.start + time,
      shotStart: shot.start,
      shotDur: shot.dur
    }))
  )
)

const playheadStyle = computed(() => {
  const lane = laneArea.value
  const rootEl = root.value
  if (!lane || !rootEl) return { left: '-9999px' }
  const laneRect = lane.getBoundingClientRect()
  const rootRect = rootEl.getBoundingClientRect()
  const x =
    laneRect.left -
    rootRect.left +
    (Math.max(0, Math.min(props.globalTime, safeDuration.value)) / safeDuration.value) *
      laneRect.width
  return { left: `${x}px` }
})

function timeFromEvent(e: PointerEvent): number {
  const lane = laneArea.value
  if (!lane) return 0
  const rect = lane.getBoundingClientRect()
  const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)))
  return f * safeDuration.value
}

function onRulerDown(e: PointerEvent): void {
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  emit('seek', timeFromEvent(e))
  const move = (ev: PointerEvent) => emit('seek', timeFromEvent(ev))
  const up = (ev: PointerEvent) => {
    if (target.hasPointerCapture(ev.pointerId)) target.releasePointerCapture(ev.pointerId)
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
}

type DragKey =
  | { shotIdx: number; ptIdx: number; time: number; shotStart: number; shotDur: number }
  | { label: string; ptIdx: number; time: number }

function startKeyDrag(e: PointerEvent, key: DragKey): void {
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent) => {
    const t = Math.round(timeFromEvent(ev) * 10) / 10
    if ('shotIdx' in key) {
      const local = Math.max(0, Math.min(key.shotDur, t - key.shotStart))
      emit('set-cam-time', key.shotIdx, key.ptIdx, local)
    } else {
      emit('set-path-time', key.label, key.ptIdx, t)
    }
  }
  const up = (ev: PointerEvent) => {
    if (target.hasPointerCapture(ev.pointerId)) target.releasePointerCapture(ev.pointerId)
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
}
</script>
