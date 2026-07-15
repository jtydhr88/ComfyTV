import type { ContentStore } from './ContentStore'
import { getHandlePositions, HANDLE_HIT_PX, layerCenter } from './transformMath'
import type { HandleId, Layer, LayerEditorState, TextLayer } from './types'

export interface RenderDeps {
  content: ContentStore
  getTextBitmap: (layer: TextLayer) => HTMLCanvasElement | null
  overrides?: Map<string, HTMLCanvasElement>
}

export interface RenderSelection {
  activeId: string | null
  selectedIds: Set<string>
}

const MASKED_CACHE_LIMIT = 16
const maskedCache = new Map<string, HTMLCanvasElement>()

function getMaskedBitmap(
  src: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  cacheKey: string | null,
): HTMLCanvasElement {
  if (cacheKey) {
    const hit = maskedCache.get(cacheKey)
    if (hit) {
      maskedCache.delete(cacheKey)
      maskedCache.set(cacheKey, hit)
      return hit
    }
  }
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(mask, 0, 0, src.width, src.height)
  if (cacheKey) {
    maskedCache.set(cacheKey, c)
    if (maskedCache.size > MASKED_CACHE_LIMIT) {
      const oldest = maskedCache.keys().next().value
      if (oldest !== undefined) maskedCache.delete(oldest)
    }
  }
  return c
}

function resolveLayerBitmap(
  layer: Layer,
  deps: RenderDeps,
): { bitmap: HTMLCanvasElement | null; cacheKeyPart: string | null } {
  const override = deps.overrides?.get(`content:${layer.id}`)
  if (override) return { bitmap: override, cacheKeyPart: null }
  if (layer.type === 'raster') {
    const entry = deps.content.get(layer.contentId)
    return { bitmap: entry?.canvas ?? null, cacheKeyPart: layer.contentId }
  }
  return { bitmap: deps.getTextBitmap(layer), cacheKeyPart: null }
}

function resolveMaskBitmap(
  layer: Layer,
  deps: RenderDeps,
): { bitmap: HTMLCanvasElement | null; cacheKeyPart: string | null } {
  if (!layer.mask?.enabled) return { bitmap: null, cacheKeyPart: null }
  const override = deps.overrides?.get(`mask:${layer.id}`)
  if (override) return { bitmap: override, cacheKeyPart: null }
  const entry = deps.content.get(layer.mask.contentId)
  return { bitmap: entry?.canvas ?? null, cacheKeyPart: layer.mask.contentId }
}
function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, deps: RenderDeps): void {
  const { bitmap, cacheKeyPart } = resolveLayerBitmap(layer, deps)
  const t = layer.transform
  if (!bitmap) {
    ctx.save()
    const c = layerCenter(t)
    ctx.translate(c.x, c.y)
    ctx.rotate(t.rotation)
    ctx.globalAlpha = 0.25
    ctx.fillStyle = '#808080'
    ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h)
    ctx.restore()
    return
  }

  let src = bitmap
  const mask = resolveMaskBitmap(layer, deps)
  if (mask.bitmap) {
    const cacheKey = cacheKeyPart && mask.cacheKeyPart
      ? `${cacheKeyPart}|${mask.cacheKeyPart}`
      : null
    src = getMaskedBitmap(bitmap, mask.bitmap, cacheKey)
  }

  const c = layerCenter(t)
  ctx.save()
  ctx.globalAlpha = layer.opacity
  ctx.globalCompositeOperation = layer.blendMode
  ctx.translate(c.x, c.y)
  ctx.rotate(t.rotation)
  ctx.drawImage(src, -t.w / 2, -t.h / 2, t.w, t.h)
  ctx.restore()
}

let checkerPattern: CanvasPattern | null = null

function getCheckerPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (checkerPattern) return checkerPattern
  const size = 8
  const c = document.createElement('canvas')
  c.width = size * 2
  c.height = size * 2
  const pctx = c.getContext('2d')!
  pctx.fillStyle = '#3a3a44'
  pctx.fillRect(0, 0, size * 2, size * 2)
  pctx.fillStyle = '#2c2c34'
  pctx.fillRect(0, 0, size, size)
  pctx.fillRect(size, size, size, size)
  checkerPattern = ctx.createPattern(c, 'repeat')!
  return checkerPattern
}

export function renderMain(
  ctx: CanvasRenderingContext2D,
  state: LayerEditorState,
  deps: RenderDeps,
  opts?: { checker?: boolean; background?: 'transparent' | 'white' },
): void {
  const { width: w, height: h } = state
  ctx.clearRect(0, 0, w, h)
  if (opts?.checker !== false) {
    ctx.fillStyle = getCheckerPattern(ctx)
    ctx.fillRect(0, 0, w, h)
  } else if (opts?.background === 'white') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  for (const layer of state.layers) {
    if (!layer.visible) continue
    drawLayer(ctx, layer, deps)
  }
}

export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  state: LayerEditorState,
  sel: RenderSelection,
  zoom: number,
): void {
  ctx.clearRect(0, 0, state.width, state.height)
  const lw = 1.5 / zoom

  for (const layer of state.layers) {
    if (!sel.selectedIds.has(layer.id) || layer.id === sel.activeId) continue
    const t = layer.transform
    const c = layerCenter(t)
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.rotate(t.rotation)
    ctx.strokeStyle = '#4aa3ff'
    ctx.globalAlpha = 0.5
    ctx.lineWidth = lw
    ctx.setLineDash([4 / zoom, 4 / zoom])
    ctx.strokeRect(-t.w / 2, -t.h / 2, t.w, t.h)
    ctx.restore()
  }

  const active = state.layers.find((l) => l.id === sel.activeId)
  if (!active) return
  const t = active.transform
  const c = layerCenter(t)

  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(t.rotation)
  ctx.strokeStyle = '#4aa3ff'
  ctx.lineWidth = 2 / zoom
  ctx.setLineDash([6 / zoom, 4 / zoom])
  ctx.strokeRect(-t.w / 2, -t.h / 2, t.w, t.h)
  ctx.setLineDash([])
  ctx.restore()

  const hs = HANDLE_HIT_PX * 0.75 / zoom
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#4aa3ff'
  ctx.lineWidth = 1.5 / zoom
  const handles = getHandlePositions(t, zoom)
  const topCenter = handles.find((p) => p.id === 'n')
  const rotate = handles.find((p) => p.id === 'rotate')
  if (topCenter && rotate) {
    ctx.beginPath()
    ctx.moveTo(topCenter.x, topCenter.y)
    ctx.lineTo(rotate.x, rotate.y)
    ctx.stroke()
  }
  for (const p of handles) {
    if (p.id === 'rotate') {
      ctx.beginPath()
      ctx.arc(p.x, p.y, hs, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    } else {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(t.rotation)
      ctx.fillRect(-hs, -hs, hs * 2, hs * 2)
      ctx.strokeRect(-hs, -hs, hs * 2, hs * 2)
      ctx.restore()
    }
  }
  ctx.restore()
}
export function exportComposited(
  state: LayerEditorState,
  deps: RenderDeps,
  background: 'transparent' | 'white' = 'white',
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = state.width
  c.height = state.height
  const ctx = c.getContext('2d')!
  renderMain(ctx, state, deps, { checker: false, background })
  return c
}
export function exportLayerAlone(
  state: LayerEditorState,
  layer: Layer,
  deps: RenderDeps,
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = state.width
  c.height = state.height
  const ctx = c.getContext('2d')!
  drawLayer(ctx, { ...layer, blendMode: 'source-over' } as Layer, deps)
  return c
}

export type { HandleId }
