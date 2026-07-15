<template>
  <div
    ref="viewportRef"
    class="ctv:relative ctv:size-full ctv:min-h-0 ctv:overflow-hidden ctv:rounded-lg ctv:bg-black/60"
    :style="{ cursor: viewportCursor }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerenter="hovering = true"
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { Asset } from '@/api/schemas'
import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import { useLoaderFileDrop } from '@/composables/stages/useLoaderFileDrop'
import { getEffectiveBrushSize, getEffectiveHardness } from '@/widgets/painter/brushUtils'
import { hexToRgb } from '@/widgets/painter/types'

const props = defineProps<{
  editor: LayerEditorController
}>()

const viewportRef = ref<HTMLDivElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const mainRef = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLCanvasElement | null>(null)
const hovering = ref(false)
const hoverCursor = ref('default')

const editor = props.editor
const spaceDown = ref(false)

let panning = false
let panLast = { x: 0, y: 0 }
let toolActive = false
let pendingMove: PointerEvent | null = null
let moveRaf: number | null = null
const adjusting = ref<{ x0: number; y0: number; size0: number; hardness0: number } | null>(null)
const ADJUST_DEAD_ZONE = 5

function artboardPt(e: PointerEvent) {
  return editor.panZoom.screenToArtboard(e.clientX, e.clientY)
}

function onPointerDown(e: PointerEvent): void {
  const zone = viewportRef.value
  if (!zone) return
  zone.focus?.()

  if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceDown.value)) {
    panning = true
    panLast = { x: e.offsetX, y: e.offsetY }
    zone.setPointerCapture(e.pointerId)
    return
  }
  if (e.button !== 0) return

  if (isPaintTool.value && e.altKey) {
    adjusting.value = {
      x0: e.offsetX,
      y0: e.offsetY,
      size0: editor.brushSize.value,
      hardness0: editor.brushHardness.value,
    }
    try { zone.setPointerCapture(e.pointerId) } catch {}
    e.preventDefault()
    return
  }

  const handled = editor.activeToolHandler().onPointerDown(e, artboardPt(e))
  if (handled) {
    toolActive = true
    try { zone.setPointerCapture(e.pointerId) } catch {}
  }
}

function handleBrushAdjust(e: PointerEvent): void {
  const a = adjusting.value
  if (!a) return
  const zoom = Math.max(0.01, editor.panZoom.zoom())
  const dx = (e.offsetX - a.x0) / zoom
  const dy = (e.offsetY - a.y0) / zoom
  const effDx = Math.abs(dx) < ADJUST_DEAD_ZONE ? 0 : dx
  const effDy = Math.abs(dy) < ADJUST_DEAD_ZONE ? 0 : dy
  editor.brushSize.value = Math.max(2, Math.min(400, Math.round(a.size0 + effDx / 2)))
  editor.brushHardness.value = Math.max(0, Math.min(1, a.hardness0 - effDy / 300))
}

function flushMove(): void {
  moveRaf = null
  const e = pendingMove
  pendingMove = null
  if (!e) return
  if (panning) {
    editor.panZoom.panBy(e.offsetX - panLast.x, e.offsetY - panLast.y)
    panLast = { x: e.offsetX, y: e.offsetY }
    return
  }
  if (adjusting.value) {
    handleBrushAdjust(e)
    return
  }
  if (toolActive) {
    editor.activeToolHandler().onPointerMove(e, artboardPt(e))
  } else {
    hoverCursor.value = editor.activeToolHandler().cursorFor(artboardPt(e))
  }
}

function onPointerMove(e: PointerEvent): void {
  if (!adjusting.value) {
    cursorPos.value = { x: e.offsetX, y: e.offsetY }
  }
  pendingMove = e
  if (moveRaf == null) moveRaf = requestAnimationFrame(flushMove)
}

function onPointerUp(e: PointerEvent): void {
  if (moveRaf != null) {
    cancelAnimationFrame(moveRaf)
    flushMove()
  }
  if (panning) {
    panning = false
  } else if (adjusting.value) {
    adjusting.value = null
  } else if (toolActive) {
    editor.activeToolHandler().onPointerUp(e, artboardPt(e))
    toolActive = false
  }
  try { viewportRef.value?.releasePointerCapture(e.pointerId) } catch {}
}

function onPointerLeave(e: PointerEvent): void {
  hovering.value = false
  if (toolActive) {
    editor.activeToolHandler().onPointerUp(e, artboardPt(e))
    toolActive = false
  }
  adjusting.value = null
}

function onWheel(e: WheelEvent): void {
  editor.panZoom.handleWheel(e)
  editor.requestRender()
}

function setSpaceDown(v: boolean): void {
  spaceDown.value = v
}

defineExpose({ setSpaceDown })

const cursorPos = ref({ x: 0, y: 0 })

const isPaintTool = computed(() => editor.tool.value === 'brush' || editor.tool.value === 'eraser')

const viewportCursor = computed(() => {
  if (panning || spaceDown.value) return spaceDown.value ? 'grab' : 'grabbing'
  if (isPaintTool.value) return 'none'
  if (editor.tool.value === 'text') return 'text'
  return hoverCursor.value
})

const brushCursorVisible = computed(
  () => (hovering.value || adjusting.value != null) && isPaintTool.value && !spaceDown.value,
)

const activeHardness = computed(
  () => (editor.tool.value === 'eraser' ? 1 : editor.brushHardness.value),
)
const brushCursorDiameter = computed(() => {
  const radius = editor.brushSize.value / 2
  const effectiveRadius = getEffectiveBrushSize(radius, activeHardness.value)
  return effectiveRadius * 2 * Math.max(0.01, editor.panZoom.zoom())
})

const brushCursorStyle = computed(() => {
  const d = brushCursorDiameter.value
  const pos = adjusting.value ? { x: adjusting.value.x0, y: adjusting.value.y0 } : cursorPos.value
  return {
    width: `${d}px`,
    height: `${d}px`,
    transform: `translate(${pos.x - d / 2}px, ${pos.y - d / 2}px)`,
  }
})
const brushGradient = computed(() => {
  const target = editor.paintTarget.value
  const rgb = target === 'mask' || editor.tool.value === 'eraser'
    ? { r: 255, g: 255, b: 255 }
    : hexToRgb(editor.brushColor.value)
  const alpha = 0.5 * Math.max(0.15, editor.brushOpacity.value)
  const radius = editor.brushSize.value / 2
  const effectiveRadius = getEffectiveBrushSize(radius, activeHardness.value)
  const effectiveHardness = getEffectiveHardness(radius, activeHardness.value, effectiveRadius)
  const base = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
  if (effectiveHardness >= 1) return base
  const midStop = effectiveHardness * 100
  const fadeMidStop = midStop + (100 - midStop) * 0.5
  return `radial-gradient(circle, ${base} 0%, ${base} ${midStop}%, ` +
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.25}) ${fadeMidStop}%, ` +
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0) 100%)`
})

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
  if (moveRaf != null) cancelAnimationFrame(moveRaf)
})
</script>
