<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full ctv:flex-1"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div ref="boxEl"
         class="ctv:relative ctv:w-full ctv:flex-1 ctv:min-h-[140px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle">
      <div v-if="!sourceVideoUrl"
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <i class="pi pi-video ctv:text-[32px] ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('videoTrim.noInputVideo') }}</div>
      </div>

      <template v-else>
        <video
          ref="videoEl"
          :src="effectiveUrl ?? undefined"
          :muted="muted"
          :style="videoStyle"
          class="ctv:block ctv:size-full ctv:object-contain ctv:cursor-pointer"
          playsinline preload="metadata"
          @loadedmetadata="onMeta"
          @timeupdate="onTimeUpdate"
          @play="onPlay"
          @pause="onPause"
          @error="onError"
          @click="togglePlay"
        />
        <span
          v-if="isProxy"
          class="ctv:absolute ctv:top-1 ctv:left-1 ctv:z-10 ctv:px-1 ctv:py-px ctv:rounded-sm ctv:text-3xs ctv:font-semibold ctv:tracking-wide
                 ctv:bg-black/60 ctv:text-warning-background ctv:pointer-events-none"
        >PROXY</span>
        <span
          v-else-if="building"
          class="ctv:absolute ctv:top-1 ctv:left-1 ctv:z-10 ctv:px-1 ctv:py-px ctv:rounded-sm ctv:text-3xs ctv:font-semibold ctv:tracking-wide
                 ctv:bg-black/60 ctv:text-muted-foreground ctv:pointer-events-none"
        >PROXY {{ pct }}%</span>
        <button
          v-else-if="canProxy"
          type="button"
          class="ctv:absolute ctv:top-1 ctv:left-1 ctv:z-10 ctv:px-1 ctv:py-px ctv:rounded-sm ctv:text-3xs ctv:font-semibold ctv:tracking-wide
                 ctv:cursor-pointer ctv:border ctv:border-warning-background/60 ctv:bg-black/60 ctv:text-warning-background
                 ctv:hover:bg-warning-background/25"
          :title="$t('fx.makeProxyHint')"
          @click.stop="requestProxy"
        >{{ $t('fx.makeProxy') }}</button>
        <slot name="overlay" />
        <div v-if="loadError"
             class="ctv:absolute ctv:inset-0 ctv:z-10 ctv:flex ctv:items-center ctv:justify-center ctv:text-xs
                    ctv:bg-black/80 ctv:text-destructive-background ctv:pointer-events-none">
          {{ $t('videoTrim.loadError') }}
        </div>
      </template>
    </div>

    <div class="ctv:flex ctv:shrink-0 ctv:items-center ctv:gap-1.5 ctv:text-[11px]">
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
import { computed, ref, watch } from 'vue'
import { useProxiedVideoUrl } from '@/composables/widgets/useProxiedVideoUrl'
import { useVideoPlayback } from '@/composables/widgets/useVideoPlayback'
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

const sourceVideoUrlRef = computed(() => props.sourceVideoUrl)
const {
  url: effectiveUrl, isProxy, canProxy, building, pct, requestProxy,
} = useProxiedVideoUrl(sourceVideoUrlRef)

let carryTime: number | null = null
watch(isProxy, (now, was) => {
  if (now && !was) {
    const v = videoEl.value
    carryTime = v && Number.isFinite(v.currentTime) && v.currentTime > 0
      ? v.currentTime
      : null
  }
})

const {
  muted, playing, duration, currentTime, loadError, progressPct,
  onLoadedMetadata, onTimeUpdate, onPlay, onPause, onError,
  togglePlay, onSeekStart, onSeekMove, onSeekEnd,
} = useVideoPlayback({
  videoEl,
  seekEl,
  sourceVideoUrl: effectiveUrl,
  initialMuted: props.defaultMuted,
})

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
  onLoadedMetadata()
  applyTuning()
  if (carryTime != null) {
    if (carryTime < (v.duration || Infinity)) v.currentTime = carryTime
    carryTime = null
  }
  emit('meta', { width: v.videoWidth, height: v.videoHeight, duration: duration.value })
}

defineExpose({ videoEl, boxEl, duration })
</script>
