import { computed, onBeforeUnmount, ref, type Ref } from 'vue'

import type { LayerEditorController } from './useLayerEditorStage'
import { brushProfile } from '../engine'

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let r = 0, g = 0, b = 0
  if (hex.length === 4 || hex.length === 5) {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  } else if (hex.length === 7 || hex.length === 9) {
    r = parseInt(hex.slice(1, 3), 16)
    g = parseInt(hex.slice(3, 5), 16)
    b = parseInt(hex.slice(5, 7), 16)
  }
  return { r, g, b }
}

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
  let pendingMoves: PointerEvent[] = []
  let moveRaf: number | null = null

  function artboardPt(e: PointerEvent) {
    return editor.panZoom.screenToArtboard(e.clientX, e.clientY)
  }

  function inputSamples(e: PointerEvent): PointerEvent[] {
    if (typeof e.getCoalescedEvents !== 'function') return [e]
    const coalesced = e.getCoalescedEvents()
    return coalesced.length ? coalesced : [e]
  }

  function onPointerDown(e: PointerEvent): void {
    const zone = viewportEl.value
    if (!zone) return
    zone.focus?.()
    pendingMoves = []

    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceDown.value)) {
      panning = true
      panLast = { x: e.offsetX, y: e.offsetY }
      zone.setPointerCapture(e.pointerId)
      return
    }
    if (e.button !== 0) return

    if (isPaintTool.value && e.ctrlKey) {
      editor.pickColorAt(artboardPt(e))
      return
    }
    if (isPaintTool.value && e.altKey && editor.tool.value !== 'clone') {
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
    const events = pendingMoves
    pendingMoves = []
    const e = events[events.length - 1]
    if (!e) return
    if (panning) {
      editor.panZoom.panBy(e.offsetX - panLast.x, e.offsetY - panLast.y)
      panLast = { x: e.offsetX, y: e.offsetY }
      editor.requestOverlayRender()
      return
    }
    if (adjusting.value) {
      handleBrushAdjust(e)
      return
    }
    if (toolActive) {
      const handler = editor.activeToolHandler()
      if (wantsAllSamples.value) {
        for (const ev of events) {
          for (const s of inputSamples(ev)) handler.onPointerMove(s, artboardPt(s))
        }
      } else {
        handler.onPointerMove(e, artboardPt(e))
      }
    } else {
      hoverCursor.value = editor.activeToolHandler().cursorFor(artboardPt(e))
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (!adjusting.value) {
      cursorPos.value = { x: e.offsetX, y: e.offsetY }
    }
    pendingMoves.push(e)
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
    viewportEl.value?.focus?.({ preventScroll: true })
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

  const isPaintTool = computed(() =>
    ['brush', 'eraser', 'airbrush', 'smudge', 'clone', 'dodge', 'burn'].includes(editor.tool.value),
  )

  const wantsAllSamples = computed(() =>
    ['brush', 'eraser', 'pencil', 'airbrush', 'smudge', 'clone', 'dodge', 'burn', 'mask-brush', 'mask-eraser', 'lasso'].includes(editor.tool.value),
  )

  const viewportCursor = computed(() => {
    if (panning || spaceDown.value) return spaceDown.value ? 'grab' : 'grabbing'
    if (isPaintTool.value) return hoverCursor.value === 'not-allowed' ? 'not-allowed' : 'none'
    if (editor.tool.value === 'text') return 'text'
    return hoverCursor.value
  })

  const brushCursorVisible = computed(
    () => (hovering.value || adjusting.value != null) && isPaintTool.value && !spaceDown.value
      && hoverCursor.value !== 'not-allowed',
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
    let rgb = hexToRgb(editor.brushColor.value)
    if (editor.tool.value === 'eraser') {
      rgb = { r: 255, g: 255, b: 255 }
    } else if (editor.paintTarget.value === 'mask') {
      const g = Math.round(0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b)
      rgb = { r: g, g, b: g }
    }
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
