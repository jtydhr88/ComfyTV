import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'

import { getEffectiveBrushSize, getEffectiveHardness } from '@/widgets/painter/brushUtils'
import { StrokeProcessor } from '@/widgets/painter/StrokeProcessor'
import {
  hexToRgb,
  PAINTER_TOOLS,
  toHex,
  type PainterTool,
  type Point,
} from '@/widgets/painter/types'

import { type LGraphNode } from '@/lib/comfyApp'
import { uploadBlobNamed } from '@/utils/uploadCanvas'
import { getWidget } from '@/utils/widget'


export interface UsePainterOptions {
  canvasEl: Ref<HTMLCanvasElement | null>
  cursorEl: Ref<HTMLElement | null>
  sourceImageUrl: Ref<string | null>
  node?: LGraphNode
  maskWidgetName?: string
}


const PROP_KEY = 'comfytv_painter_settings'


interface PersistedSettings {
  tool: PainterTool
  brushSize: number
  brushColor: string
  brushOpacity: number
  brushHardness: number
}


export function usePainter(options: UsePainterOptions) {
  const { canvasEl, cursorEl, sourceImageUrl, node, maskWidgetName = 'mask_data' } = options

  const tool = ref<PainterTool>(PAINTER_TOOLS.BRUSH)
  const brushSize = ref(20)
  const brushColor = ref('#ffffff')
  const brushOpacity = ref(1)
  const brushHardness = ref(1)

  const canvasWidth = ref(512)
  const canvasHeight = ref(512)
  const cursorVisible = ref(false)
  const isDirty = ref(false)

  let isDrawing = false
  let strokeProcessor: StrokeProcessor | null = null
  let lastPoint: Point | null = null
  let cachedRect: DOMRect | null = null

  let mainCtx: CanvasRenderingContext2D | null = null
  let strokeCanvas: HTMLCanvasElement | null = null
  let strokeCtx: CanvasRenderingContext2D | null = null
  let baseCanvas: HTMLCanvasElement | null = null
  let baseCtx: CanvasRenderingContext2D | null = null
  let hasBaseSnapshot = false

  let dirtyX0 = 0, dirtyY0 = 0, dirtyX1 = 0, dirtyY1 = 0
  let hasDirtyRect = false

  let strokeBrush: {
    radius: number
    effectiveRadius: number
    effectiveHardness: number
    hardness: number
    r: number; g: number; b: number
  } | null = null

  function loadSettings() {
    const stored = node?.properties?.[PROP_KEY] as Partial<PersistedSettings> | undefined
    if (!stored) return
    if (stored.tool === PAINTER_TOOLS.BRUSH || stored.tool === PAINTER_TOOLS.ERASER) tool.value = stored.tool
    if (typeof stored.brushSize === 'number') brushSize.value = stored.brushSize
    if (typeof stored.brushColor === 'string') brushColor.value = stored.brushColor
    if (typeof stored.brushOpacity === 'number') brushOpacity.value = stored.brushOpacity
    if (typeof stored.brushHardness === 'number') brushHardness.value = stored.brushHardness
  }

  function saveSettings() {
    if (!node) return
    if (!node.properties) node.properties = {}
    node.properties[PROP_KEY] = {
      tool: tool.value,
      brushSize: brushSize.value,
      brushColor: brushColor.value,
      brushOpacity: brushOpacity.value,
      brushHardness: brushHardness.value,
    }
  }

  function activeHardness() {
    return tool.value === PAINTER_TOOLS.ERASER ? 1 : brushHardness.value
  }

  const displayBrushSize = computed(() => {
    const radius = brushSize.value / 2
    const effectiveRadius = getEffectiveBrushSize(radius, activeHardness())
    return effectiveRadius * 2
  })

  function getCtx() {
    if (!mainCtx && canvasEl.value) {
      mainCtx = canvasEl.value.getContext('2d') ?? null
    }
    return mainCtx
  }

  function cacheCanvasRect() {
    const el = canvasEl.value
    if (el) cachedRect = el.getBoundingClientRect()
  }

  function getCanvasPoint(e: PointerEvent): Point | null {
    const el = canvasEl.value
    if (!el) return null
    const rect = cachedRect ?? el.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * el.width,
      y: ((e.clientY - rect.top) / rect.height) * el.height,
    }
  }

  function expandDirtyRect(cx: number, cy: number, r: number) {
    const x0 = cx - r, y0 = cy - r, x1 = cx + r, y1 = cy + r
    if (!hasDirtyRect) {
      dirtyX0 = x0; dirtyY0 = y0; dirtyX1 = x1; dirtyY1 = y1
      hasDirtyRect = true
    } else {
      if (x0 < dirtyX0) dirtyX0 = x0
      if (y0 < dirtyY0) dirtyY0 = y0
      if (x1 > dirtyX1) dirtyX1 = x1
      if (y1 > dirtyY1) dirtyY1 = y1
    }
  }

  function snapshotBrush() {
    const el = canvasEl.value
    const cssWidth = el ? Math.max(1, el.clientWidth) : 1
    const cssToBitmap = el && el.width ? el.width / cssWidth : 1
    const radius = (brushSize.value / 2) * cssToBitmap
    const hardness = activeHardness()
    const effectiveRadius = getEffectiveBrushSize(radius, hardness)
    strokeBrush = {
      radius,
      effectiveRadius,
      effectiveHardness: getEffectiveHardness(radius, hardness, effectiveRadius),
      hardness,
      ...hexToRgb(brushColor.value),
    }
  }

  function drawCircle(ctx: CanvasRenderingContext2D, point: Point) {
    const b = strokeBrush!
    expandDirtyRect(point.x, point.y, b.effectiveRadius)
    ctx.beginPath()
    ctx.arc(point.x, point.y, b.effectiveRadius, 0, Math.PI * 2)
    if (b.hardness < 1) {
      const gradient = ctx.createRadialGradient(
        point.x, point.y, 0, point.x, point.y, b.effectiveRadius,
      )
      gradient.addColorStop(0, `rgba(${b.r}, ${b.g}, ${b.b}, 1)`)
      gradient.addColorStop(b.effectiveHardness, `rgba(${b.r}, ${b.g}, ${b.b}, 1)`)
      gradient.addColorStop(1, `rgba(${b.r}, ${b.g}, ${b.b}, 0)`)
      ctx.fillStyle = gradient
    }
    ctx.fill()
  }

  function drawSegment(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
    const b = strokeBrush!
    if (b.hardness < 1) {
      const dx = to.x - from.x, dy = to.y - from.y
      const dist = Math.hypot(dx, dy)
      const step = Math.max(1, b.effectiveRadius / 2)
      if (dist > 0) {
        const steps = Math.ceil(dist / step)
        const dab: Point = { x: 0, y: 0 }
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          dab.x = from.x + dx * t
          dab.y = from.y + dy * t
          drawCircle(ctx, dab)
        }
      }
    } else {
      expandDirtyRect(from.x, from.y, b.effectiveRadius)
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
      drawCircle(ctx, to)
    }
  }

  function applyBrushStyle(ctx: CanvasRenderingContext2D) {
    const b = strokeBrush!
    const color = `rgb(${b.r}, ${b.g}, ${b.b})`
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.lineWidth = b.effectiveRadius * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  function ensureStrokeCanvas() {
    const el = canvasEl.value
    if (!el) return null
    if (!strokeCanvas || strokeCanvas.width !== el.width || strokeCanvas.height !== el.height) {
      strokeCanvas = document.createElement('canvas')
      strokeCanvas.width = el.width
      strokeCanvas.height = el.height
      strokeCtx = strokeCanvas.getContext('2d')
    }
    strokeCtx?.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height)
    return strokeCtx
  }

  function ensureBaseCanvas() {
    const el = canvasEl.value
    if (!el) return null
    if (!baseCanvas || baseCanvas.width !== el.width || baseCanvas.height !== el.height) {
      baseCanvas = document.createElement('canvas')
      baseCanvas.width = el.width
      baseCanvas.height = el.height
      baseCtx = baseCanvas.getContext('2d')
    }
    return baseCtx
  }

  function compositeStrokeToMain(isPreview = false) {
    const el = canvasEl.value
    const ctx = getCtx()
    if (!el || !ctx || !strokeCanvas) return

    const useDirty = hasDirtyRect
    const sx = Math.max(0, Math.floor(dirtyX0))
    const sy = Math.max(0, Math.floor(dirtyY0))
    const sr = Math.min(el.width, Math.ceil(dirtyX1))
    const sb = Math.min(el.height, Math.ceil(dirtyY1))
    const sw = sr - sx, sh = sb - sy
    hasDirtyRect = false

    if (hasBaseSnapshot && baseCanvas) {
      if (useDirty && sw > 0 && sh > 0) {
        ctx.clearRect(sx, sy, sw, sh)
        ctx.drawImage(baseCanvas, sx, sy, sw, sh, sx, sy, sw, sh)
      } else {
        ctx.clearRect(0, 0, el.width, el.height)
        ctx.drawImage(baseCanvas, 0, 0)
      }
    }

    ctx.save()
    const isEraser = tool.value === PAINTER_TOOLS.ERASER
    ctx.globalAlpha = isEraser ? 1 : brushOpacity.value
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    if (useDirty && sw > 0 && sh > 0) {
      ctx.drawImage(strokeCanvas, sx, sy, sw, sh, sx, sy, sw, sh)
    } else {
      ctx.drawImage(strokeCanvas, 0, 0)
    }
    ctx.restore()

    if (!isPreview) hasBaseSnapshot = false
  }

  function startStroke(e: PointerEvent) {
    const point = getCanvasPoint(e)
    if (!point) return
    const el = canvasEl.value
    if (!el) return

    const bCtx = ensureBaseCanvas()
    if (bCtx) {
      bCtx.clearRect(0, 0, el.width, el.height)
      bCtx.drawImage(el, 0, 0)
      hasBaseSnapshot = true
    }

    isDrawing = true
    isDirty.value = true
    snapshotBrush()
    strokeProcessor = new StrokeProcessor(Math.max(1, strokeBrush!.radius / 2))
    strokeProcessor.addPoint(point)
    lastPoint = point

    const ctx = ensureStrokeCanvas()
    if (!ctx) return
    ctx.save()
    applyBrushStyle(ctx)
    drawCircle(ctx, point)
    ctx.restore()

    compositeStrokeToMain(true)
  }

  function continueStroke(e: PointerEvent) {
    if (!isDrawing || !strokeProcessor || !strokeCtx) return
    const point = getCanvasPoint(e)
    if (!point) return

    const points = strokeProcessor.addPoint(point)
    if (points.length === 0 && lastPoint) points.push(point)
    if (points.length === 0) return

    strokeCtx.save()
    applyBrushStyle(strokeCtx)
    let prev = lastPoint ?? points[0]
    for (const p of points) {
      drawSegment(strokeCtx, prev, p)
      prev = p
    }
    lastPoint = prev
    strokeCtx.restore()

    compositeStrokeToMain(true)
  }

  function endStroke() {
    if (!isDrawing || !strokeProcessor) return
    const points = strokeProcessor.endStroke()
    if (strokeCtx && points.length > 0) {
      strokeCtx.save()
      applyBrushStyle(strokeCtx)
      let prev = lastPoint ?? points[0]
      for (const p of points) {
        drawSegment(strokeCtx, prev, p)
        prev = p
      }
      strokeCtx.restore()
    }
    compositeStrokeToMain()
    isDrawing = false
    strokeProcessor = null
    strokeBrush = null
    lastPoint = null
  }

  function resizeCanvas() {
    const el = canvasEl.value
    if (!el) return
    let tmp: HTMLCanvasElement | null = null
    if (el.width > 0 && el.height > 0) {
      tmp = document.createElement('canvas')
      tmp.width = el.width
      tmp.height = el.height
      tmp.getContext('2d')!.drawImage(el, 0, 0)
    }
    el.width = canvasWidth.value
    el.height = canvasHeight.value
    mainCtx = null
    if (tmp) getCtx()?.drawImage(tmp, 0, 0)
    strokeCanvas = null
    strokeCtx = null
    baseCanvas = null
    baseCtx = null
    hasBaseSnapshot = false
  }

  function handleClear() {
    const el = canvasEl.value
    const ctx = getCtx()
    if (!el || !ctx) return
    ctx.clearRect(0, 0, el.width, el.height)
    isDirty.value = true
    labelCounter = 0
    writeMaskWidget('')
  }

  let shapeStart: Point | null = null
  let labelCounter = 0

  function isShapeTool(): boolean {
    return tool.value === PAINTER_TOOLS.RECT || tool.value === PAINTER_TOOLS.ELLIPSE
  }

  function annotationLineWidth(): number {
    return Math.max(2, brushSize.value / 4)
  }

  function startShape(e: PointerEvent) {
    const point = getCanvasPoint(e)
    const el = canvasEl.value
    if (!point || !el) return
    const bCtx = ensureBaseCanvas()
    if (bCtx) {
      bCtx.clearRect(0, 0, el.width, el.height)
      bCtx.drawImage(el, 0, 0)
      hasBaseSnapshot = true
    }
    shapeStart = point
    isDirty.value = true
  }

  function previewShape(e: PointerEvent) {
    const ctx = getCtx()
    const el = canvasEl.value
    if (!shapeStart || !ctx || !el || !baseCanvas) return
    const p = getCanvasPoint(e)
    if (!p) return
    ctx.clearRect(0, 0, el.width, el.height)
    ctx.drawImage(baseCanvas, 0, 0)
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = brushOpacity.value
    ctx.strokeStyle = brushColor.value
    ctx.lineWidth = annotationLineWidth()
    ctx.lineJoin = 'round'
    const x = Math.min(shapeStart.x, p.x)
    const y = Math.min(shapeStart.y, p.y)
    const w = Math.abs(p.x - shapeStart.x)
    const h = Math.abs(p.y - shapeStart.y)
    if (tool.value === PAINTER_TOOLS.ELLIPSE) {
      ctx.beginPath()
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.strokeRect(x, y, w, h)
    }
    ctx.restore()
  }

  function endShape() {
    shapeStart = null
    hasBaseSnapshot = false
  }

  function placeLabel(e: PointerEvent) {
    const ctx = getCtx()
    const el = canvasEl.value
    const p = getCanvasPoint(e)
    if (!ctx || !el || !p) return
    labelCounter++
    isDirty.value = true
    const r = Math.max(10, brushSize.value / 2)
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = brushColor.value
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.round(r * 1.1)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(labelCounter), p.x, p.y + 1)
    ctx.restore()
  }

  function updateCursorPos(e: PointerEvent) {
    const el = cursorEl.value
    if (!el) return
    const size = displayBrushSize.value
    el.style.transform = `translate(${e.offsetX - size / 2}px, ${e.offsetY - size / 2}px)`
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    cacheCanvasRect()
    updateCursorPos(e)
    if (tool.value === PAINTER_TOOLS.LABEL) {
      placeLabel(e)
    } else if (isShapeTool()) {
      startShape(e)
    } else {
      startStroke(e)
    }
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* tests */ }
  }

  let pendingMoveEvent: PointerEvent | null = null
  let rafId: number | null = null

  function flushPendingStroke() {
    if (pendingMoveEvent) {
      continueStroke(pendingMoveEvent)
      pendingMoveEvent = null
    }
    rafId = null
  }

  function handlePointerMove(e: PointerEvent) {
    updateCursorPos(e)
    if (shapeStart) { previewShape(e); return }
    if (!isDrawing) return
    pendingMoveEvent = e
    if (!rafId) rafId = requestAnimationFrame(flushPendingStroke)
  }

  function handlePointerUp(e: PointerEvent) {
    if (e.button !== 0) return
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* tests */ }
    if (shapeStart) { endShape(); return }
    if (rafId) { cancelAnimationFrame(rafId); flushPendingStroke() }
    endStroke()
  }

  function handlePointerLeave() {
    cursorVisible.value = false
    if (shapeStart) { endShape(); return }
    if (rafId) { cancelAnimationFrame(rafId); flushPendingStroke() }
    endStroke()
  }

  function handlePointerEnter() {
    cursorVisible.value = true
  }

  function loadSourceImage(url: string | null) {
    if (!url) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      canvasWidth.value = img.naturalWidth
      canvasHeight.value = img.naturalHeight
    }
    img.onerror = () => {
      console.warn('[ComfyTV/painter] failed to load source image:', url)
    }
    img.src = url
  }

  function writeMaskWidget(annotatedPath: string) {
    const w = getWidget(node, maskWidgetName)
    if (w) {
      w.value = annotatedPath
      w.callback?.(annotatedPath)
    }
  }

  async function commitMask(): Promise<string> {
    const el = canvasEl.value
    if (!el) return ''
    if (!isDirty.value) {
      const existing = getWidget(node, maskWidgetName)?.value
      if (typeof existing === 'string' && existing) return existing
    }

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width  = el.width
    exportCanvas.height = el.height
    const ectx = exportCanvas.getContext('2d')!
    ectx.fillStyle = '#ffffff'
    ectx.fillRect(0, 0, el.width, el.height)
    ectx.globalCompositeOperation = 'destination-out'
    ectx.drawImage(el, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) =>
      exportCanvas.toBlob(resolve, 'image/png'),
    )
    if (!blob) return ''

    const nodeId = String(node?.id ?? 'unknown')
    const filename = `comfytv-painter-${nodeId}-${Date.now()}.png`

    let uploaded
    try {
      uploaded = await uploadBlobNamed(blob, { subfolder: 'painter', filename })
    } catch (e) {
      console.error('[ComfyTV/painter] mask upload failed', e)
      return ''
    }

    const annotated = `painter/${uploaded.name} [input]`
    writeMaskWidget(annotated)
    isDirty.value = false
    return annotated
  }

  watch([canvasWidth, canvasHeight], resizeCanvas)
  watch([tool, brushSize, brushColor, brushOpacity, brushHardness], saveSettings)
  watch(sourceImageUrl, (url) => loadSourceImage(url), { immediate: false })

  onMounted(() => {
    loadSettings()
    resizeCanvas()
    if (sourceImageUrl.value) loadSourceImage(sourceImageUrl.value)
  })

  onUnmounted(() => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
  })

  const brushColorDisplay = computed({
    get: () => toHex(brushColor.value),
    set: (v: unknown) => { brushColor.value = toHex(v) },
  })

  return {
    tool, brushSize, brushColor, brushOpacity, brushHardness,
    canvasWidth, canvasHeight,
    cursorVisible, displayBrushSize,
    isDirty,
    brushColorDisplay,
    handlePointerDown, handlePointerMove, handlePointerUp,
    handlePointerEnter, handlePointerLeave,
    handleClear,
    commitMask,
  }
}
