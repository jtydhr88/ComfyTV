<template>
  <div class="ctv:grid ctv:size-full ctv:min-h-0 ctv:min-w-0 ctv:grid-cols-[18px_minmax(0,1fr)] ctv:grid-rows-[18px_minmax(0,1fr)] ctv:gap-0 ctv:overflow-hidden ctv:rounded-md ctv:border ctv:border-[#161616]">
    <div class="ctv:flex ctv:items-center ctv:justify-center ctv:bg-[#202020] ctv:text-[8px] ctv:text-[#7a7a7a] ctv:select-none">px</div>
    <RulerBar
      orientation="h"
      :lower="rulerRange.hLower"
      :upper="rulerRange.hUpper"
      :position="rulerPos.x"
      :max-size="rulerMaxSize"
      @rulerdown="onRulerDown('y', $event)"
      @rulermove="onRulerMove"
      @rulerup="onRulerUp"
      @rulercancel="onRulerCancel"
    />
    <RulerBar
      orientation="v"
      :lower="rulerRange.vLower"
      :upper="rulerRange.vUpper"
      :position="rulerPos.y"
      :max-size="rulerMaxSize"
      @rulerdown="onRulerDown('x', $event)"
      @rulermove="onRulerMove"
      @rulerup="onRulerUp"
      @rulercancel="onRulerCancel"
    />
  <div
    ref="viewportRef"
    data-capture-wheel="true"
    tabindex="-1"
    class="ctv:relative ctv:size-full ctv:min-h-0 ctv:overflow-hidden ctv:bg-[#141414] ctv:outline-none"
    :style="{ cursor: guideHoverAxis ? (guideHoverAxis === 'x' ? 'ew-resize' : 'ns-resize') : viewportCursor }"
    @pointerdown="onPointerDownWrapped"
    @pointermove="onPointerMoveWrapped"
    @pointerup="onPointerUpWrapped"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeaveWrapped"
    @wheel.prevent="onWheel"
    @contextmenu.prevent
    @dragenter="drop.onDragEnter"
    @dragover="drop.onDragOver"
    @dragleave="drop.onDragLeave"
    @drop="drop.onDrop"
  >
    <div
      ref="containerRef"
      class="ctv:absolute ctv:top-0 ctv:left-0 ctv:pointer-events-none"
      :style="canvasBackdropStyle"
    >
      <canvas ref="mainRef" class="ctv:absolute ctv:top-0 ctv:left-0 ctv:size-full" />
      <slot name="onion" />
    </div>
    <canvas ref="overlayRef" class="ctv:absolute ctv:inset-0 ctv:size-full ctv:pointer-events-none" />

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
      {{ $t('pictor.dropHint') }}
    </div>

    <div
      v-if="editor.floating.value"
      class="ctv:absolute ctv:top-2 ctv:left-1/2 ctv:z-20 ctv:flex ctv:-translate-x-1/2 ctv:items-center ctv:gap-1
             ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-base-background/95 ctv:p-1 ctv:text-2xs ctv:shadow-lg"
      @pointerdown.stop
    >
      <button type="button" :class="floatBtnClass" @click="editor.anchorFloating('active')">
        {{ $t('pictor.anchor') }}
      </button>
      <button type="button" :class="floatBtnClass" @click="editor.anchorFloating('new')">
        {{ $t('pictor.anchorAsNewLayer') }}
      </button>
      <button type="button" :class="floatBtnClass" @click="editor.cancelFloating()">
        {{ $t('pictor.cancelFloating') }}
      </button>
    </div>
  </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import type { LayerEditorController } from './useLayerEditorStage'
import RulerBar from './RulerBar.vue'
import { useLayerEditorCanvas } from './useLayerEditorCanvas'

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

const rulerRange = reactive({ hLower: 0, hUpper: 1024, vLower: 0, vUpper: 1024 })
const rulerPos = reactive<{ x: number | null; y: number | null }>({ x: null, y: null })
const rulerMaxSize = ref(1024)
let rulerRaf = 0

function updateRulerRange() {
  if (rulerRaf) return
  rulerRaf = requestAnimationFrame(() => {
    rulerRaf = 0
    const vp = viewportRef.value
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const tl = editor.panZoom.screenToArtboard(rect.left, rect.top)
    const br = editor.panZoom.screenToArtboard(rect.right, rect.bottom)
    rulerRange.hLower = tl.x
    rulerRange.hUpper = br.x
    rulerRange.vLower = tl.y
    rulerRange.vUpper = br.y
    const size = editor.canvasSize.value
    rulerMaxSize.value = Math.max(size.width, size.height)
  })
}

function onPointerMoveWrapped(e: PointerEvent) {
  const p = editor.panZoom.screenToArtboard(e.clientX, e.clientY)
  rulerPos.x = p.x
  rulerPos.y = p.y
  if (guideDrag.value || pendingRulerGuide.value) {
    guideDragMove(e)
    return
  }
  const gi = guideIndexNear(e.clientX, e.clientY)
  guideHoverAxis.value = gi >= 0 ? editor.guides()[gi]!.axis : null
  onPointerMove(e)
}

function onPointerLeaveWrapped(e: PointerEvent) {
  rulerPos.x = null
  rulerPos.y = null
  guideHoverAxis.value = null
  onPointerLeave(e)
}

let offPanZoom: (() => void) | null = null

const guideHoverAxis = ref<'x' | 'y' | null>(null)
const guideDrag = ref<{ index: number; axis: 'x' | 'y'; added: boolean; beforePos?: number } | null>(null)
const pendingRulerGuide = ref<{ axis: 'x' | 'y' } | null>(null)

function docPosFor(axis: 'x' | 'y', clientX: number, clientY: number): number {
  const p = editor.panZoom.screenToArtboard(clientX, clientY)
  const size = editor.canvasSize.value
  const raw = axis === 'x' ? p.x : p.y
  const max = axis === 'x' ? size.width : size.height
  return Math.max(0, Math.min(max, raw))
}

function insideViewport(clientX: number, clientY: number): boolean {
  const vp = viewportRef.value
  if (!vp) return false
  const r = vp.getBoundingClientRect()
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
}

function guideIndexNear(clientX: number, clientY: number): number {
  const container = containerRef.value
  if (!container) return -1
  const rect = container.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return -1
  const size = editor.canvasSize.value
  const gs = editor.guides()
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i]!
    const screen = g.axis === 'x'
      ? rect.left + (g.pos / size.width) * rect.width
      : rect.top + (g.pos / size.height) * rect.height
    const d = g.axis === 'x' ? Math.abs(clientX - screen) : Math.abs(clientY - screen)
    if (d <= 4) return i
  }
  return -1
}

function endGuideDrag(clientX: number, clientY: number) {
  pendingRulerGuide.value = null
  const d = guideDrag.value
  if (!d) return
  guideDrag.value = null
  editor.guideEndDrag(d.index, {
    added: d.added,
    beforePos: d.beforePos,
    keep: insideViewport(clientX, clientY),
  })
}

function guideDragMove(e: PointerEvent) {
  if (e.buttons === 0) {
    endGuideDrag(e.clientX, e.clientY)
    return
  }
  const pt = editor.panZoom.screenToArtboard(e.clientX, e.clientY)
  rulerPos.x = pt.x
  rulerPos.y = pt.y
  const pending = pendingRulerGuide.value
  if (pending) {
    if (!insideViewport(e.clientX, e.clientY)) return
    pendingRulerGuide.value = null
    const index = editor.guideAddLive(pending.axis, docPosFor(pending.axis, e.clientX, e.clientY))
    guideDrag.value = { index, axis: pending.axis, added: true }
    return
  }
  const d = guideDrag.value
  if (!d) return
  editor.guideMoveLive(d.index, docPosFor(d.axis, e.clientX, e.clientY))
}

function onRulerDown(axis: 'x' | 'y', e: PointerEvent) {
  pendingRulerGuide.value = { axis }
  void e
}

function onRulerMove(e: PointerEvent) {
  if (!pendingRulerGuide.value && !guideDrag.value) return
  guideDragMove(e)
}

function onRulerUp(e: PointerEvent) {
  if (!pendingRulerGuide.value && !guideDrag.value) return
  endGuideDrag(e.clientX, e.clientY)
}

function onRulerCancel() {
  const d = guideDrag.value
  guideDrag.value = null
  pendingRulerGuide.value = null
  if (d) {
    editor.guideEndDrag(d.index, { added: d.added, beforePos: d.beforePos, keep: !d.added })
  }
}

function onPointerDownWrapped(e: PointerEvent) {
  if (guideDrag.value || pendingRulerGuide.value) {
    endGuideDrag(e.clientX, e.clientY)
  }
  if (e.button === 0 && !editor.floating.value) {
    const gi = guideIndexNear(e.clientX, e.clientY)
    if (gi >= 0) {
      const g = editor.guides()[gi]!
      guideDrag.value = { index: gi, axis: g.axis, added: false, beforePos: g.pos }
      try { viewportRef.value?.setPointerCapture(e.pointerId) } catch {}
      e.preventDefault()
      e.stopPropagation()
      return
    }
  }
  onPointerDown(e)
}

function onPointerUpWrapped(e: PointerEvent) {
  if (guideDrag.value || pendingRulerGuide.value) {
    endGuideDrag(e.clientX, e.clientY)
    return
  }
  onPointerUp(e)
}

const canvasBackdropStyle = {
  backgroundImage: 'conic-gradient(#6a6a6a 25%, #4c4c4c 0 50%, #6a6a6a 0 75%, #4c4c4c 0)',
  backgroundSize: '8px 8px',
  boxShadow: '0 0 0 1px rgb(0 0 0 / 0.9), 0 4px 16px rgb(0 0 0 / 0.55)',
}

const floatBtnClass =
  'ctv:inline-flex ctv:h-6 ctv:items-center ctv:rounded-md ctv:border-0 ctv:bg-secondary-background ' +
  'ctv:px-2 ctv:text-2xs ctv:text-base-foreground ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:transition-colors ctv:hover:bg-secondary-background-hover'

const drop = editor.host.createCanvasDropHandler({
  addImageFromFile: editor.addImageFromFile,
  importPsdFile: editor.importPsdFile,
  addMedia: editor.addMedia,
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
  resizeObserver = new ResizeObserver(() => {
    editor.panZoom.invalidate()
    editor.requestOverlayRender()
    updateRulerRange()
  })
  resizeObserver.observe(viewportRef.value)
  offPanZoom = editor.panZoom.onChange(updateRulerRange)
  updateRulerRange()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  offPanZoom?.()
  if (rulerRaf) cancelAnimationFrame(rulerRaf)
  guideDrag.value = null
  pendingRulerGuide.value = null
})
</script>
