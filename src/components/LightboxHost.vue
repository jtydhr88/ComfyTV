<template>
  <Teleport to="body">
    <div
      v-if="isOpen && current"
      class="ctv:fixed ctv:inset-0 ctv:z-[9999] ctv:flex ctv:items-center ctv:justify-center ctv:cursor-zoom-out ctv:bg-black/90"
      role="dialog"
      @click.self="close"
      @wheel.prevent.stop
    >
      <div
        ref="container"
        class="ctv:inline-flex ctv:items-center ctv:justify-center ctv:touch-none ctv:select-none ctv:cursor-grab"
        @click.stop
      >
        <img
          ref="img"
          :src="current.url"
          class="ctv:block ctv:max-w-[60vw] ctv:max-h-[60vh] ctv:object-contain ctv:cursor-[inherit]
                 ctv:shadow-[0_8px_40px_rgb(0_0_0/0.6)]"
          draggable="false"
          :alt="current.label || current.url"
        />
      </div>

      <button
        v-if="count > 1"
        type="button"
        class="ctv:absolute ctv:left-4 ctv:top-1/2 ctv:-translate-y-1/2 ctv:size-10 ctv:flex ctv:items-center ctv:justify-center
               ctv:rounded-full ctv:bg-black/55 ctv:text-white ctv:border ctv:border-white/30
               ctv:hover:bg-black/85 ctv:hover:border-white/55 ctv:cursor-pointer
               ctv:disabled:opacity-30 ctv:disabled:cursor-default ctv:disabled:hover:bg-black/55 ctv:disabled:hover:border-white/30"
        :disabled="!hasPrev"
        :title="$t('stage.action.prev')"
        @click.stop="prev"
      ><i class="pi pi-chevron-left" /></button>

      <button
        v-if="count > 1"
        type="button"
        class="ctv:absolute ctv:right-4 ctv:top-1/2 ctv:-translate-y-1/2 ctv:size-10 ctv:flex ctv:items-center ctv:justify-center
               ctv:rounded-full ctv:bg-black/55 ctv:text-white ctv:border ctv:border-white/30
               ctv:hover:bg-black/85 ctv:hover:border-white/55 ctv:cursor-pointer
               ctv:disabled:opacity-30 ctv:disabled:cursor-default ctv:disabled:hover:bg-black/55 ctv:disabled:hover:border-white/30"
        :disabled="!hasNext"
        :title="$t('stage.action.next')"
        @click.stop="next"
      ><i class="pi pi-chevron-right" /></button>

      <div
        v-if="count > 1 || current.label"
        class="ctv:absolute ctv:bottom-4 ctv:left-1/2 ctv:-translate-x-1/2 ctv:flex ctv:items-center ctv:gap-2 ctv:max-w-[70vw]
               ctv:py-1 ctv:px-3 ctv:rounded-full ctv:text-xs ctv:leading-none
               ctv:bg-black/55 ctv:text-white ctv:border ctv:border-white/20"
      >
        <span v-if="count > 1" class="ctv:tabular-nums ctv:shrink-0">{{ index + 1 }} / {{ count }}</span>
        <span v-if="current.label" class="ctv:truncate">{{ current.label }}</span>
      </div>

      <button
        type="button"
        class="ctv:absolute ctv:top-4 ctv:right-4 ctv:size-9 ctv:flex ctv:items-center ctv:justify-center ctv:text-sm ctv:leading-none
               ctv:rounded-full ctv:cursor-pointer
               ctv:bg-black/55 ctv:text-white ctv:border ctv:border-white/30
               ctv:hover:bg-black/85 ctv:hover:border-white/55"
        :title="$t('stage.action.close')"
        @click.stop="close"
      ><i class="pi pi-times" /></button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useImagePanZoom } from '@/composables/widgets/useImagePanZoom'
import { useLightbox } from '@/composables/useLightbox'

const { isOpen, current, count, index, hasPrev, hasNext, close, prev, next } =
  useLightbox()

const container = ref<HTMLElement | null>(null)
const img = ref<HTMLImageElement | null>(null)

useImagePanZoom(container, img, {
  resetKey: current,
  minZoom: 0.2,
  maxZoom: 8,
})

function onKeydown(e: KeyboardEvent) {
  if (!isOpen.value) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
