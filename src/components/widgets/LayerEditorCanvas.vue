<template>
  <div
    ref="viewportRef"
    class="ctv:relative ctv:size-full ctv:min-h-0 ctv:overflow-hidden ctv:rounded-lg ctv:bg-black/60"
    :style="{ cursor: viewportCursor }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
    @wheel.prevent="onWheel"
    @dragenter="drop.onDragEnter"
    @dragover="drop.onDragOver"
    @dragleave="drop.onDragLeave"
    @drop="drop.onDrop"
  >
    <div ref="containerRef" class="ctv:absolute ctv:top-0 ctv:left-0 ctv:pointer-events-none">
      <canvas ref="mainRef" class="ctv:absolute ctv:top-0 ctv:left-0 ctv:size-full" />
      <canvas ref="overlayRef" class="ctv:absolute ctv:top-0 ctv:left-0 ctv:size-full" />
    </div>

    <div
      v-show="brushCursorVisible"
      class="ctv:absolute ctv:top-0 ctv:left-0 ctv:rounded-full ctv:pointer-events-none ctv:overflow-hidden
             ctv:border ctv:border-black/70 ctv:shadow-[0_0_0_1px_rgb(255_255_255/0.8)] ctv:will-change-transform"
      :style="brushCursorStyle"
    >
      <div
        v-show="adjusting != null"
        class="ctv:size-full ctv:rounded-full"
        :style="{ background: brushGradient }"
      />
    </div>

    <div
      v-if="drop.dragActive.value"
      class="ctv:absolute ctv:inset-0 ctv:z-10 ctv:flex ctv:items-center ctv:justify-center
             ctv:pointer-events-none ctv:border-2 ctv:border-dashed ctv:border-primary-background
             ctv:bg-primary-background/10 ctv:text-sm ctv:text-primary-background"
    >
      {{ $t('layerEditor.dropHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import type { Asset } from '@/api/schemas'
import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import { useLayerEditorCanvas } from '@/composables/widgets/useLayerEditorCanvas'
import { useLoaderFileDrop } from '@/composables/stages/useLoaderFileDrop'

const props = defineProps<{
  editor: LayerEditorController
}>()

const viewportRef = ref<HTMLDivElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const mainRef = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLCanvasElement | null>(null)

const editor = props.editor

const {
  adjusting,
  viewportCursor,
  brushCursorVisible,
  brushCursorStyle,
  brushGradient,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerEnter,
  onPointerLeave,
  onWheel,
  setSpaceDown,
} = useLayerEditorCanvas(editor, viewportRef)

defineExpose({ setSpaceDown })

const drop = useLoaderFileDrop({
  kind: () => 'image',
  onFiles: (files: File[]) => {
    for (const f of files) editor.addImageFromFile(f)
  },
  onAsset: (asset: Asset) => {
    void editor.addImageFromUrl(asset.payload_url, asset.name)
  },
})

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!viewportRef.value || !containerRef.value || !mainRef.value || !overlayRef.value) return
  editor.setElements({
    viewport: viewportRef.value,
    container: containerRef.value,
    main: mainRef.value,
    overlay: overlayRef.value,
  })
  resizeObserver = new ResizeObserver(() => editor.panZoom.invalidate())
  resizeObserver.observe(viewportRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>
