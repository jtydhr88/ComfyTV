<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div ref="boxEl"
         class="ctv:relative ctv:w-full ctv:h-[220px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle">
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
          :style="videoStyle"
          class="ctv:block ctv:size-full ctv:object-contain ctv:cursor-pointer"
          playsinline preload="metadata"
          @loadedmetadata="onMeta"
          @timeupdate="onTime"
          @play="playing = true"
          @pause="playing = false"
          @error="loadError = true"
          @click="togglePlay"
        />
        <div v-if="loadError"
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { formatTime } from '@/composables/widgets/useVideoTrim'

const props = withDefaults(defineProps<{
  sourceVideoUrl: string | null
  playbackRate?: number
  volume?: number
  videoStyle?: Record<string, string>
  defaultMuted?: boolean
}>(), {
  playbackRate: 1,
  volume: 1,
  defaultMuted: true,
})

const emit = defineEmits<{
  meta: [v: { width: number; height: number; duration: number }]
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const boxEl = ref<HTMLDivElement | null>(null)
const seekEl = ref<HTMLDivElement | null>(null)

const muted = ref(props.defaultMuted)
const playing = ref(false)
const duration = ref(0)
const currentTime = ref(0)
const loadError = ref(false)

function applyTuning() {
  const v = videoEl.value
  if (!v) return
  v.playbackRate = Math.min(4, Math.max(0.25, props.playbackRate))
  v.volume = Math.min(1, Math.max(0, props.volume))
}
watch(() => [props.playbackRate, props.volume], applyTuning)

function onMeta() {
  const v = videoEl.value
  if (!v) return
  duration.value = v.duration || 0
  loadError.value = false
  applyTuning()
  emit('meta', { width: v.videoWidth, height: v.videoHeight, duration: duration.value })
}
function onTime() {
  const v = videoEl.value
  if (v) currentTime.value = v.currentTime
}

watch(() => props.sourceVideoUrl, () => {
  duration.value = 0
  currentTime.value = 0
  playing.value = false
  loadError.value = false
})

function togglePlay() {
  const v = videoEl.value
  if (!v || duration.value <= 0) return
  if (v.paused) void v.play().catch(() => {})
  else v.pause()
}

const progressPct = computed(() =>
  duration.value > 0 ? Math.min(100, (currentTime.value / duration.value) * 100) : 0)

const seeking = ref(false)
function seekFromClientX(clientX: number) {
  const el = seekEl.value
  const v = videoEl.value
  if (!el || !v || duration.value <= 0) return
  const rect = el.getBoundingClientRect()
  const frac = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
  v.currentTime = Math.min(Math.max(0, frac), 1) * duration.value
  currentTime.value = v.currentTime
}
function onSeekStart(e: PointerEvent) {
  if (duration.value <= 0) return
  videoEl.value?.pause()
  seeking.value = true
  ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
  seekFromClientX(e.clientX)
}
function onSeekMove(e: PointerEvent) {
  if (seeking.value) seekFromClientX(e.clientX)
}
function onSeekEnd() {
  seeking.value = false
}

onBeforeUnmount(() => {
  videoEl.value?.pause()
})

defineExpose({ videoEl, boxEl, duration })
</script>
