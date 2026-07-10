<template>

  <div class="ctv:flex ctv:flex-col ctv:gap-1">

    <div class="ctv:flex ctv:items-center ctv:gap-1.5">
      <button
        type="button"
        :class="iconBtnClass(false)"
        :aria-label="$t('scene3d.playPause')"
        @click="emit('togglePlay')"
      >
        <IconPause v-if="playing" class="ctv:size-3.5" />
        <IconPlay v-else class="ctv:size-3.5" />
      </button>
      <button
        type="button"
        :class="iconBtnClass(loop)"
        :aria-label="$t('scene3d.timelineLoop')"
        :title="$t('scene3d.timelineLoop')"
        @click="loop = !loop"
      >
        <IconRepeat class="ctv:size-3.5" />
      </button>
      <span class="ctv:min-w-14 ctv:text-2xs ctv:text-muted-foreground">
        {{ frame }} / {{ totalFrames }}
      </span>
      <div class="ctv:flex-1" />
      <IconZoomIn class="ctv:size-3 ctv:shrink-0 ctv:text-muted-foreground" />
      <ComfyTVSlider
        class="ctv:flex-none"
        style="width: 88px"
        hide-value
        :model-value="zoomExp"
        :min="-2"
        :max="2"
        :step="0.05"
        @update:model-value="(v) => (zoomExp = v)"
      />
    </div>


    <div class="ctv:flex ctv:w-full">
      <div
        class="ctv:shrink-0 ctv:overflow-hidden"
        :style="{ width: `${LABEL_WIDTH}px`, height: `${containerHeight}px` }"
      >

        <div :style="{ height: `${HEADER_HEIGHT}px` }" />

        <div ref="labelScrollRef" class="ctv:will-change-transform">
          <button
            v-for="entry in legend"
            :key="entry.id"
            type="button"
            :class="labelClass(entry.id === selectedId)"
            :style="{ height: `${ROW_STRIDE}px` }"
            :title="entry.label"
            @click="emit('trackSelect', entry.id)"
          >
            <span class="ctv:size-2 ctv:shrink-0 ctv:rounded-full" :style="{ backgroundColor: entry.color }" />
            <span class="ctv:truncate">{{ entry.label }}</span>
          </button>
        </div>
      </div>

      <div
        ref="containerRef"
        class="ctv-timeline-host ctv:relative ctv:min-w-0 ctv:flex-1 ctv:overflow-hidden ctv:rounded-lg"
        :style="{ height: `${containerHeight}px` }"
        data-capture-wheel="true"
        @pointerdown.stop
        @wheel.stop
      />
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import IconPause from '~icons/lucide/pause'
import IconPlay from '~icons/lucide/play'
import IconRepeat from '~icons/lucide/repeat'
import IconZoomIn from '~icons/lucide/zoom-in'

import ComfyTVSlider from '@/components/widgets/ComfyTVSlider.vue'
import {
  Scene3dTimelineTracks,
  type TimelineTracksData
} from '@/widgets/three/scene3d/timelineTracks'

const MAX_VISIBLE_ROWS = 4

const HEADER_HEIGHT = 22
const ROW_STRIDE = 24
const LABEL_WIDTH = 92

const props = defineProps<{
  data: TimelineTracksData | null
  legend: Array<{ id: string; label: string; color: string }>
  frame: number
  playing?: boolean
  selectedId?: string | null
}>()

const loop = defineModel<boolean>('loop', { default: true })

const emit = defineEmits<{
  seek: [frame: number]
  togglePlay: []
  cameraSpeed: [id: string, speed: number]
  characterPatch: [id: string, patch: { startOffset?: number; speed?: number }]
  trackSelect: [id: string]
}>()

function labelClass(active: boolean): string {
  return (
    'ctv:flex ctv:w-full ctv:cursor-pointer ctv:items-center ctv:gap-1 ctv:overflow-hidden ' +
    'ctv:border-0 ctv:pr-1 ctv:text-left ctv:text-2xs ctv:transition-colors ctv:[font-family:inherit] ' +
    (active
      ? 'ctv:bg-secondary-background-selected ctv:text-base-foreground'
      : 'ctv:bg-transparent ctv:text-muted-foreground ctv:hover:text-base-foreground')
  )
}

const containerRef = ref<HTMLElement>()
const labelScrollRef = ref<HTMLElement>()
const zoomExp = ref(0)
let widget: Scene3dTimelineTracks | null = null
let scrollEl: HTMLElement | null = null
const onTimelineScroll = (): void => {
  if (labelScrollRef.value && scrollEl) {
    labelScrollRef.value.style.transform = `translateY(${-scrollEl.scrollTop}px)`
  }
}

const totalFrames = computed(() => {
  if (!props.data) return 0
  const camEnd = Math.max(
    0,
    ...props.data.cameras.map((c) => c.sourceFrames / Math.max(0.1, c.speed))
  )
  const charEnd = Math.max(
    0,
    ...props.data.characters.map((c) => c.offsetFrames + c.displayFrames)
  )
  return Math.round(Math.max(camEnd, charEnd))
})

const containerHeight = ref(80)

function updateContainerHeight(): void {
  const desired = widget?.getDesiredHeight(MAX_VISIBLE_ROWS) ?? 0
  containerHeight.value = desired > 0 ? desired : 80
  onTimelineScroll()
}

onMounted(() => {
  if (!containerRef.value) return
  widget = new Scene3dTimelineTracks(containerRef.value, {
    onSeek: (frame) => emit('seek', frame),
    onCameraSpeed: (id, speed) => emit('cameraSpeed', id, speed),
    onCharacterPatch: (id, patch) => emit('characterPatch', id, patch),
    onTrackSelect: (id) => emit('trackSelect', id)
  })
  if (props.data) widget.setData(props.data)
  widget.setTime(props.frame)
  scrollEl = containerRef.value.querySelector<HTMLElement>('.scroll-container')
  scrollEl?.addEventListener('scroll', onTimelineScroll, { passive: true })
  requestAnimationFrame(() => updateContainerHeight())
})

watch(
  () => props.data,
  (data) => {
    if (widget && data) {
      widget.setData(data)
      requestAnimationFrame(() => updateContainerHeight())
    }
  },
  { deep: true }
)

watch(
  () => props.frame,
  (frame) => widget?.setTime(frame)
)

watch(containerHeight, () => {
  requestAnimationFrame(() => widget?.rescale())
})

watch(zoomExp, (value) => {
  widget?.setZoom(Math.pow(2, value))
})

function iconBtnClass(active: boolean) {
  return (
    'ctv:flex ctv:size-7 ctv:shrink-0 ctv:cursor-pointer ctv:items-center ctv:justify-center ' +
    'ctv:rounded-lg ctv:border-0 ctv:transition-colors ctv:outline-none ' +
    (active
      ? 'ctv:bg-secondary-background-selected ctv:text-base-foreground'
      : 'ctv:bg-secondary-background ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground')
  )
}

onBeforeUnmount(() => {
  scrollEl?.removeEventListener('scroll', onTimelineScroll)
  scrollEl = null
  widget?.dispose()
  widget = null
})
</script>

<style>


.ctv-timeline-host .scroll-container::-webkit-scrollbar {
  height: 12px;
  width: 12px;
}
.ctv-timeline-host .scroll-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.25);
}
.ctv-timeline-host .scroll-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25);
  border: 3px solid transparent;
  border-radius: 999px;
  background-clip: padding-box;
}
.ctv-timeline-host .scroll-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
  background-clip: padding-box;
}
.ctv-timeline-host .scroll-container {
  scrollbar-width: auto;
  scrollbar-color: rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0.25);
}
</style>
