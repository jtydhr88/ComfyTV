<template>
  <div
    ref="containerRef"
    class="ctv:relative ctv:w-full ctv:h-80 ctv:rounded-md ctv:overflow-hidden ctv:cursor-ew-resize
           ctv:bg-black ctv:border ctv:border-border-subtle"
    @pointerdown.stop
  >
    <template v-if="beforeImage || afterImage">
      <img
        v-if="afterImage"
        :src="afterImage"
        :alt="$t('imageCompare.after')"
        class="ctv:absolute ctv:inset-0 ctv:size-full ctv:object-contain ctv:select-none"
        draggable="false"
        @dragstart.prevent
      />
      <img
        v-if="beforeImage"
        :src="beforeImage"
        :alt="$t('imageCompare.before')"
        class="ctv:absolute ctv:inset-0 ctv:size-full ctv:object-contain ctv:select-none"
        draggable="false"
        :style="hasBoth ? { clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` } : undefined"
        @dragstart.prevent
      />
      <template v-if="hasBoth">
        <div
          class="ctv:absolute ctv:top-0 ctv:bottom-0 ctv:w-0.5 ctv:-ml-px ctv:z-[5] ctv:pointer-events-none
                 ctv:bg-white/85 ctv:shadow-[0_0_4px_rgb(0_0_0/0.6)]"
          :style="{ left: `${sliderPosition}%` }"
        />
        <div
          class="ctv:absolute ctv:top-1/2 ctv:size-6 ctv:-translate-x-1/2 ctv:-translate-y-1/2 ctv:rounded-full
                 ctv:border-2 ctv:border-white ctv:bg-white/30 ctv:backdrop-blur-[2px]
                 ctv:shadow-[0_1px_4px_rgb(0_0_0/0.5)] ctv:pointer-events-none ctv:z-[6]"
          :style="{ left: `${sliderPosition}%` }"
        />
        <span class="ctv:absolute ctv:top-2 ctv:left-2 ctv:z-[7] ctv:py-0.5 ctv:px-1.5 ctv:rounded-lg
                     ctv:bg-black/60 ctv:text-white/90 ctv:text-2xs ctv:tracking-wide ctv:pointer-events-none">
          {{ $t('imageCompare.before') }}
        </span>
        <span class="ctv:absolute ctv:top-2 ctv:right-2 ctv:z-[7] ctv:py-0.5 ctv:px-1.5 ctv:rounded-lg
                     ctv:bg-black/60 ctv:text-white/90 ctv:text-2xs ctv:tracking-wide ctv:pointer-events-none">
          {{ $t('imageCompare.after') }}
        </span>
      </template>
    </template>

    <div
      v-else
      class="ctv:absolute ctv:inset-0 ctv:flex ctv:items-center ctv:justify-center ctv:px-4 ctv:text-center
             ctv:text-white/50 ctv:text-xs"
    >{{ $t('imageCompare.noImages') }}</div>
  </div>
</template>

<script setup lang="ts">
import { useMouseInElement } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  beforeImage: string | null
  afterImage: string | null
}>()

const containerRef = ref<HTMLElement | null>(null)
const sliderPosition = ref(50)

const hasBoth = computed(() => Boolean(props.beforeImage && props.afterImage))

const { elementX, elementWidth, isOutside } = useMouseInElement(containerRef)
watch([elementX, elementWidth, isOutside], ([x, width, outside]) => {
  if (!outside && width > 0) {
    sliderPosition.value = Math.max(0, Math.min(100, (x / width) * 100))
  }
})
</script>
