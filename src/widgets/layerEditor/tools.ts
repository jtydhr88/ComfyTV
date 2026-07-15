import { StrokeProcessor } from '@/widgets/painter/StrokeProcessor'
import type { Point } from '@/widgets/painter/types'

import type { ContentStore } from './ContentStore'
import { applyBrushStyle, drawCircle, drawSegment, makeStrokeBrush, type StrokeBrush } from './strokeEngine'
import {
  artboardToLocal,
  cursorForHandle,
  hitTestHandle,
  hitTestLayer,
  resizeTransform,
  rotateTransform,
} from './transformMath'
import { cloneState, createTextLayer } from './stateSerde'
import type { HandleId, Layer, LayerEditorState, LayerTransform } from './types'

export interface BrushParams {
  size: number
  opacity: number
  hardness: number
  color: string
}
export interface ToolContext {
  getState: () => LayerEditorState
  getActiveId: () => string | null
  setActiveLayer: (id: string | null) => void
  content: ContentStore
  zoom: () => number
  commit: (next: LayerEditorState, mergeKey?: string) => void
  requestRender: () => void
  brush: () => BrushParams
  brushTool: () => 'brush' | 'eraser'
  paintTarget: () => 'content' | 'mask'
  setOverride: (key: string, canvas: HTMLCanvasElement | null) => void
  openTextEditor: (layerId: string) => void
}

export interface ToolHandler {
  onPointerDown: (e: PointerEvent, pt: Point) => boolean
  onPointerMove: (e: PointerEvent, pt: Point) => void
  onPointerUp: (e: PointerEvent, pt: Point) => void
  cursorFor: (pt: Point) => string
}

function findLayer(state: LayerEditorState, id: string | null): Layer | undefined {
  return id ? state.layers.find((l) => l.id === id) : undefined
}

type SelectSession =
  | { kind: 'idle' }
  | { kind: 'moving'; layerId: string; start: LayerTransform; startPt: Point }
  | { kind: 'resizing'; layerId: string; handle: Exclude<HandleId, 'rotate'>; start: LayerTransform }
  | { kind: 'rotating'; layerId: string; start: LayerTransform; startPt: Point }

export function createSelectTool(ctx: ToolContext): ToolHandler {
  let session: SelectSession = { kind: 'idle' }

  function commitTransform(layerId: string, transform: LayerTransform, mergeKey: string): void {
    const next = cloneState(ctx.getState())
    const layer = findLayer(next, layerId)
    if (!layer) return
    layer.transform = transform
    ctx.commit(next, mergeKey)
  }

  return {
    onPointerDown(e, pt) {
      const state = ctx.getState()
      const active = findLayer(state, ctx.getActiveId())

      if (active && !active.locked) {
        const handle = hitTestHandle(active.transform, pt, ctx.zoom())
        if (handle === 'rotate') {
          session = { kind: 'rotating', layerId: active.id, start: { ...active.transform }, startPt: pt }
          return true
        }
        if (handle) {
          session = { kind: 'resizing', layerId: active.id, handle, start: { ...active.transform } }
          return true
        }
      }

      const hitId = hitTestLayer(state.layers, pt)
      if (hitId) {
        ctx.setActiveLayer(hitId)
        const layer = findLayer(state, hitId)!
        session = { kind: 'moving', layerId: hitId, start: { ...layer.transform }, startPt: pt }
        return true
      }

      ctx.setActiveLayer(null)
      return false
    },

    onPointerMove(e, pt) {
      if (session.kind === 'moving') {
        const t = session.start
        commitTransform(session.layerId, {
          ...t,
          x: t.x + (pt.x - session.startPt.x),
          y: t.y + (pt.y - session.startPt.y),
        }, `move:${session.layerId}`)
      } else if (session.kind === 'resizing') {
        const next = resizeTransform(session.start, session.handle, pt, {
          aspectLock: e.shiftKey,
        })
        commitTransform(session.layerId, next, `resize:${session.layerId}`)
      } else if (session.kind === 'rotating') {
        const next = rotateTransform(session.start, session.startPt, pt, e.shiftKey)
        commitTransform(session.layerId, next, `rotate:${session.layerId}`)
      }
    },

    onPointerUp() {
      session = { kind: 'idle' }
    },

    cursorFor(pt) {
      const state = ctx.getState()
      const active = findLayer(state, ctx.getActiveId())
      if (active && !active.locked) {
        const handle = hitTestHandle(active.transform, pt, ctx.zoom())
        if (handle) return cursorForHandle(handle, active.transform.rotation)
      }
      return hitTestLayer(state.layers, pt) ? 'move' : 'default'
    },
  }
}

interface PaintSession {
  layerId: string
  target: 'content' | 'mask'
  overrideKey: string
  base: HTMLCanvasElement
  strokeCanvas: HTMLCanvasElement
  strokeCtx: CanvasRenderingContext2D
  preview: HTMLCanvasElement
  previewCtx: CanvasRenderingContext2D
  brush: StrokeBrush
  compositeOp: GlobalCompositeOperation
  compositeAlpha: number
  processor: StrokeProcessor
  lastPoint: Point | null
  toLocalPx: (pt: Point) => Point
}

export function createPaintTool(ctx: ToolContext): ToolHandler {
  let session: PaintSession | null = null

  function compositePreview(s: PaintSession): void {
    const pctx = s.previewCtx
    pctx.clearRect(0, 0, s.preview.width, s.preview.height)
    pctx.drawImage(s.base, 0, 0)
    pctx.save()
    pctx.globalAlpha = s.compositeAlpha
    pctx.globalCompositeOperation = s.compositeOp
    pctx.drawImage(s.strokeCanvas, 0, 0)
    pctx.restore()
    ctx.requestRender()
  }

  function beginSession(pt: Point): PaintSession | null {
    const state = ctx.getState()
    const layer = findLayer(state, ctx.getActiveId())
    if (!layer || layer.locked) return null

    const target = ctx.paintTarget()
    let baseEntry
    if (target === 'mask') {
      if (!layer.mask) return null
      baseEntry = ctx.content.get(layer.mask.contentId)
    } else {
      if (layer.type !== 'raster') return null
      baseEntry = ctx.content.get(layer.contentId)
    }
    if (!baseEntry) return null

    const tool = ctx.brushTool()
    const params = ctx.brush()
    const t = layer.transform
    const sx = baseEntry.width / t.w
    const sy = baseEntry.height / t.h
    const pixelScale = (sx + sy) / 2

    const strokeCanvas = document.createElement('canvas')
    strokeCanvas.width = baseEntry.width
    strokeCanvas.height = baseEntry.height
    const preview = document.createElement('canvas')
    preview.width = baseEntry.width
    preview.height = baseEntry.height
    const compositeOp: GlobalCompositeOperation =
      target === 'mask'
        ? (tool === 'brush' ? 'destination-out' : 'source-over')
        : (tool === 'brush' ? 'source-over' : 'destination-out')

    const brush = makeStrokeBrush(
      params.size * pixelScale,
      tool === 'eraser' ? 1 : params.hardness,
      target === 'mask' ? '#ffffff' : params.color,
    )

    const s: PaintSession = {
      layerId: layer.id,
      target,
      overrideKey: `${target}:${layer.id}`,
      base: baseEntry.canvas,
      strokeCanvas,
      strokeCtx: strokeCanvas.getContext('2d')!,
      preview,
      previewCtx: preview.getContext('2d')!,
      brush,
      compositeOp,
      compositeAlpha: tool === 'brush' ? params.opacity : 1,
      processor: new StrokeProcessor(Math.max(1, brush.radius / 2)),
      lastPoint: null,
      toLocalPx: (p: Point) => {
        const local = artboardToLocal(p, t)
        return { x: (local.x + t.w / 2) * sx, y: (local.y + t.h / 2) * sy }
      },
    }

    const start = s.toLocalPx(pt)
    s.processor.addPoint(start)
    s.lastPoint = start
    s.strokeCtx.save()
    applyBrushStyle(s.strokeCtx, s.brush)
    drawCircle(s.strokeCtx, s.brush, start)
    s.strokeCtx.restore()
    return s
  }

  function drawPoints(s: PaintSession, points: Point[]): void {
    if (points.length === 0) return
    s.strokeCtx.save()
    applyBrushStyle(s.strokeCtx, s.brush)
    let prev = s.lastPoint ?? points[0]
    for (const p of points) {
      drawSegment(s.strokeCtx, s.brush, prev, p)
      prev = p
    }
    s.lastPoint = prev
    s.strokeCtx.restore()
  }

  function finishSession(s: PaintSession): void {
    drawPoints(s, s.processor.endStroke())
    compositePreview(s)

    const newId = ctx.content.register(s.preview)
    const next = cloneState(ctx.getState())
    const layer = findLayer(next, s.layerId)
    if (layer) {
      if (s.target === 'mask' && layer.mask) {
        layer.mask.contentId = newId
        delete layer.mask.url
      } else if (s.target === 'content' && layer.type === 'raster') {
        layer.contentId = newId
        delete layer.url
      }
      ctx.commit(next)
    }
    ctx.setOverride(s.overrideKey, null)
    ctx.requestRender()
  }

  return {
    onPointerDown(e, pt) {
      session = beginSession(pt)
      if (!session) return false
      ctx.setOverride(session.overrideKey, session.preview)
      compositePreview(session)
      return true
    },

    onPointerMove(e, pt) {
      const s = session
      if (!s) return
      const local = s.toLocalPx(pt)
      const points = s.processor.addPoint(local)
      if (points.length === 0 && s.lastPoint) points.push(local)
      drawPoints(s, points)
      compositePreview(s)
    },

    onPointerUp() {
      if (!session) return
      finishSession(session)
      session = null
    },

    cursorFor() {
      return 'none'
    },
  }
}

export function createTextTool(ctx: ToolContext): ToolHandler {
  return {
    onPointerDown(e, pt) {
      const state = ctx.getState()
      const hitId = hitTestLayer(state.layers, pt)
      const hit = findLayer(state, hitId)
      if (hit?.type === 'text') {
        ctx.setActiveLayer(hit.id)
        ctx.openTextEditor(hit.id)
        return true
      }
      const next = cloneState(state)
      const layer = createTextLayer({ text: '', at: pt })
      next.layers.push(layer)
      ctx.commit(next)
      ctx.setActiveLayer(layer.id)
      ctx.openTextEditor(layer.id)
      return true
    },
    onPointerMove() {},
    onPointerUp() {},
    cursorFor() {
      return 'text'
    },
  }
}
