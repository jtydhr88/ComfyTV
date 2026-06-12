<template>
  <div
    ref="containerRef"
    class="relative w-full h-80 rounded-md overflow-hidden cursor-ew-resize
           bg-black border border-border-subtle"
    @pointerdown.stop
  >
    <template v-if="beforeImage || afterImage">
      <img
        v-if="afterImage"
        :src="afterImage"
        :alt="$t('imageCompare.after')"
        class="absolute inset-0 size-full object-contain select-none"
        draggable="false"
        @dragstart.prevent
      />
      <img
        v-if="beforeImage"
        :src="beforeImage"
        :alt="$t('imageCompare.before')"
        class="absolute inset-0 size-full object-contain select-none"
        draggable="false"
        :style="hasBoth ? { clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` } : undefined"
        @dragstart.prevent
      />
      <template v-if="hasBoth">
        <div
          class="absolute top-0 bottom-0 w-0.5 -ml-px z-[5] pointer-events-none
                 bg-white/85 shadow-[0_0_4px_rgb(0_0_0/0.6)]"
          :style="{ left: `${sliderPosition}%` }"
        />
        <div
          class="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full
                 border-2 border-white bg-white/30 backdrop-blur-[2px]
                 shadow-[0_1px_4px_rgb(0_0_0/0.5)] pointer-events-none z-[6]"
          :style="{ left: `${sliderPosition}%` }"
        />
        <span class="absolute top-2 left-2 z-[7] py-0.5 px-1.5 rounded-lg
                     bg-black/60 text-white/90 text-2xs tracking-wide pointer-events-none">
          {{ $t('imageCompare.before') }}
        </span>
        <span class="absolute top-2 right-2 z-[7] py-0.5 px-1.5 rounded-lg
                     bg-black/60 text-white/90 text-2xs tracking-wide pointer-events-none">
          {{ $t('imageCompare.after') }}
        </span>
      </template>
    </template>

    <div
      v-else
      class="absolute inset-0 flex items-center justify-center px-4 text-center
             text-white/50 text-xs"
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
