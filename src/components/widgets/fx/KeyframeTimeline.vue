<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:select-none">
    <div class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span class="ctv:text-2xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">{{ label }}</span>
      <span class="ctv:ml-auto ctv:text-2xs ctv:font-mono ctv:text-muted-foreground">
        {{ keys.length }} ⬩ {{ formatT(currentTime) }}
      </span>
    </div>
    <div
      ref="track"
      class="ctv:relative ctv:h-6 ctv:rounded ctv:bg-secondary-background ctv:border ctv:border-border-subtle ctv:cursor-copy ctv:touch-none"
      @pointerdown="onTrackDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <div
        v-if="duration > 0"
        class="ctv:absolute ctv:inset-y-0 ctv:w-px ctv:bg-primary-background/70 ctv:pointer-events-none"
        :style="{ left: `${keyLeftPercent(currentTime, duration)}%` }"
      />
      <div
        v-for="(k, i) in keys"
        :key="i"
        class="ctv:absolute ctv:top-1/2 ctv:w-2.5 ctv:h-2.5 ctv:-translate-x-1/2 ctv:-translate-y-1/2 ctv:rotate-45 ctv:cursor-grab ctv:border"
        :class="i === selectedIndex
          ? 'ctv:bg-primary-background ctv:border-white'
          : 'ctv:bg-muted-foreground ctv:border-black/40 ctv:hover:bg-primary-background/70'"
        :style="{ left: `${keyLeftPercent(k.t, duration)}%` }"
        @pointerdown.stop="onKeyDown(i, $event)"
        @dblclick.stop="$emit('remove', i)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  formatT,
  keyLeftPercent,
  useKeyframeTimeline,
} from '@/composables/widgets/useKeyframeTimeline'

const props = withDefaults(defineProps<{
  keys: { t: number }[]
  duration: number
  currentTime?: number
  selectedIndex?: number
  label?: string
}>(), { currentTime: 0, selectedIndex: -1, label: 'Keyframes' })

const emit = defineEmits<{
  add: [t: number]
  move: [i: number, t: number]
  remove: [i: number]
  select: [i: number]
  scrub: [t: number]
}>()

const track = ref<HTMLDivElement | null>(null)

const { onTrackDown, onKeyDown, onMove, onUp } = useKeyframeTimeline({
  track,
  getKeys: () => props.keys,
  getDuration: () => props.duration,
  onAdd: (t) => emit('add', t),
  onMoveKey: (i, t) => emit('move', i, t),
  onSelect: (i) => emit('select', i),
})
</script>
