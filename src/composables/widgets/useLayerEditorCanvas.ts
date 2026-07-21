import { computed, onBeforeUnmount, ref, type Ref } from 'vue'

import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import { brushProfile } from '@/widgets/layerEditor/engine'
import { hexToRgb } from '@/widgets/painter/types'

export const ADJUST_DEAD_ZONE = 5
export const BRUSH_SIZE_MIN = 2
export const BRUSH_SIZE_MAX = 400

export interface BrushAdjustOrigin {
  x0: number
  y0: number
  size0: number
  hardness0: number
}

export function adjustedBrush(
  origin: BrushAdjustOrigin,
  offsetX: number,
  offsetY: number,
  zoom: number,
): { size: number; hardness: number } {
  const z = Math.max(0.01, zoom)
  const dx = (offsetX - origin.x0) / z
  const dy = (offsetY - origin.y0) / z
  const effDx = Math.abs(dx) < ADJUST_DEAD_ZONE ? 0 : dx
  const effDy = Math.abs(dy) < ADJUST_DEAD_ZONE ? 0 : dy
  return {
    size: Math.max(BRUSH_SIZE_MIN, Math.min(BRUSH_SIZE_MAX, Math.round(origin.size0 + effDx / 2))),
    hardness: Math.max(0, Math.min(1, origin.hardness0 - effDy / 300)),
  }
}


export function brushCursorDiameterPx(size: number, zoom: number): number {
  return size * Math.max(0.01, zoom)
}


export function brushGradientCss(
  rgb: { r: number; g: number; b: number },
  opacity: number,
  hardness: number,
): string {
  const alpha = 0.5 * Math.max(0.15, opacity)
  if (hardness >= 0.999) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
  const stops = [0, 0.3, 0.5, 0.65, 0.8, 0.9, 1].map((r) => {
    const a = Number((alpha * brushProfile(r, hardness)).toFixed(3))
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a}) ${Math.round(r * 100)}%`
  })
  return `radial-gradient(circle, ${stops.join(', ')})`
}

export function useLayerEditorCanvas(
  editor: LayerEditorController,
  viewportEl: Ref<HTMLElement | null>,
) {
  const hovering = ref(false)
  const hoverCursor = ref('default')
  const spaceDown = ref(false)
  const cursorPos = ref({ x: 0, y: 0 })
  const adjusting = ref<BrushAdjustOrigin | null>(null)

  let panning = false
  let panLast = { x: 0, y: 0 }
  let toolActive = false
  let pendingMove: PointerEvent | null = null
  let moveRaf: number | null = null

  function artboardPt(e: PointerEvent) {
    return editor.panZoom.screenToArtboard(e.clientX, e.clientY)
  }

  function onPointerDown(e: PointerEvent): void {
    const zone = viewportEl.value
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
    const next = adjustedBrush(a, e.offsetX, e.offsetY, editor.panZoom.zoom())
    editor.brushSize.value = next.size
    editor.brushHardness.value = next.hardness
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
    try { viewportEl.value?.releasePointerCapture(e.pointerId) } catch {}
  }

  function onPointerEnter(): void {
    hovering.value = true
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

  const isPaintTool = computed(
    () => editor.tool.value === 'brush' || editor.tool.value === 'eraser',
  )

  const viewportCursor = computed(() => {
    if (panning || spaceDown.value) return spaceDown.value ? 'grab' : 'grabbing'
    if (isPaintTool.value) return 'none'
    if (editor.tool.value === 'text') return 'text'
    return hoverCursor.value
  })

  const brushCursorVisible = computed(
    () => (hovering.value || adjusting.value != null) && isPaintTool.value && !spaceDown.value,
  )


  const activeHardness = computed(() => editor.brushHardness.value)

  const brushCursorStyle = computed(() => {
    const d = brushCursorDiameterPx(editor.brushSize.value, editor.panZoom.zoom())
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
    return brushGradientCss(rgb, editor.brushOpacity.value, activeHardness.value)
  })

  onBeforeUnmount(() => {
    if (moveRaf != null) cancelAnimationFrame(moveRaf)
  })

  return {
    hovering,
    hoverCursor,
    spaceDown,
    cursorPos,
    adjusting,
    isPaintTool,
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
  }
}
