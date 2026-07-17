<template>
  <div
    class="ctv:flex ctv:flex-col ctv:w-full"
    @pointerdown.stop
    @pointermove.stop
    @pointerup.stop
  >
    <div
      ref="containerEl"
      class="ctv:relative ctv:w-full ctv:h-[340px] ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle ctv:touch-none ctv:select-none"
      :style="{ cursor: sourceImageUrl ? 'crosshair' : 'default' }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @contextmenu.prevent
    >
      <div v-if="!sourceImageUrl"
           class="ctv:h-full ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:text-white/50">
        <i class="pi pi-image ctv:text-[32px] ctv:opacity-60" />
        <div class="ctv:text-xs">{{ $t('splitPart.noInputImage') }}</div>
      </div>

      <template v-else>
        <img
          ref="imageEl"
          :src="sourceImageUrl"
          class="ctv:block ctv:size-full ctv:object-contain ctv:pointer-events-none ctv:select-none"
          draggable="false"
          alt=""
          @load="onImageLoad"
          @dragstart.prevent
        />

        <div
          v-for="b in boxOverlays"
          :key="`box-${b.id}`"
          class="ctv:absolute ctv:pointer-events-none ctv:rounded-xs"
          :style="{
            left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px`,
            border: `2px solid ${b.color}`,
            background: b.active ? `${b.color}2a` : `${b.color}14`,
            boxShadow: b.active ? `0 0 0 1px ${b.color}` : 'none',
          }"
        />

        <div
          v-if="draftBox"
          class="ctv:absolute ctv:pointer-events-none ctv:rounded-xs ctv:border-2 ctv:border-dashed ctv:border-white/80 ctv:bg-white/10"
          :style="{ left: `${draftBox.x}px`, top: `${draftBox.y}px`, width: `${draftBox.w}px`, height: `${draftBox.h}px` }"
        />

        <span
          v-for="pt in pointOverlays"
          :key="pt.key"
          class="ctv:absolute ctv:pointer-events-none ctv:flex ctv:items-center ctv:justify-center
                 ctv:size-4 ctv:-ml-2 ctv:-mt-2 ctv:rounded-full ctv:text-[9px] ctv:font-bold ctv:leading-none ctv:text-white"
          :style="{
            left: `${pt.x}px`, top: `${pt.y}px`,
            background: pt.label === 1 ? pt.color : '#3a3a42',
            border: `2px solid ${pt.label === 1 ? '#ffffff' : pt.color}`,
            opacity: pt.active ? 1 : 0.75,
          }"
        >{{ pt.label === 1 ? '+' : '−' }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { usePartAnnotation } from '@/composables/widgets/usePartAnnotation'
import type { Part, PartBox } from '@/widgets/splitpart/types'

const props = defineProps<{
  sourceImageUrl: string | null
  parts: Part[]
  activePartId: number | null
  tool: string
}>()

const emit = defineEmits<{
  (e: 'add-point', p: { x: number; y: number; label: 0 | 1 }): void
  (e: 'add-box', b: PartBox): void
}>()

const containerEl = ref<HTMLDivElement | null>(null)
const imageEl = ref<HTMLImageElement | null>(null)

const {
  draftBox,
  boxOverlays,
  pointOverlays,
  onImageLoad,
  onPointerDown,
  onPointerMove,
  onPointerUp,
} = usePartAnnotation({
  containerEl,
  imageEl,
  parts: () => props.parts,
  activePartId: () => props.activePartId,
  tool: () => props.tool,
  onAddPoint: (p) => emit('add-point', p),
  onAddBox: (b) => emit('add-box', b),
})
</script>
