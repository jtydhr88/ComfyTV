import type { ContentStore } from '../content'
import type { Document } from '../document'
import { findNode } from '../document'
import type { RasterData, Transform, Vec2 } from '../node'
import type { PaintTarget } from '../paint'

export function displayScale(transform: Transform, bitmapW: number, bitmapH: number): number {
  const sx = bitmapW / (transform.w || 1)
  const sy = bitmapH / (transform.h || 1)
  return (sx + sy) / 2
}

export function makeToLocal(transform: Transform, naturalW: number, naturalH: number): (pt: Vec2) => Vec2 {
  const cx = transform.x + transform.w / 2
  const cy = transform.y + transform.h / 2
  const c = Math.cos(-transform.rotation)
  const s = Math.sin(-transform.rotation)
  const sx = naturalW / (transform.w || 1)
  const sy = naturalH / (transform.h || 1)
  return (pt: Vec2): Vec2 => {
    const dx = pt.x - cx
    const dy = pt.y - cy
    const lx = dx * c - dy * s
    const ly = dx * s + dy * c
    return { x: (lx + transform.w / 2) * sx, y: (ly + transform.h / 2) * sy }
  }
}

export function rasterizeSelectionToLocal(
  selCanvas: HTMLCanvasElement,
  transform: Transform,
  bmpW: number,
  bmpH: number
): Float32Array | null {
  const c = document.createElement('canvas')
  c.width = bmpW
  c.height = bmpH
  const g = c.getContext('2d')
  if (!g) return null
  const sx = bmpW / (transform.w || 1)
  const sy = bmpH / (transform.h || 1)
  g.scale(sx, sy)
  g.translate(transform.w / 2, transform.h / 2)
  g.rotate(-transform.rotation)
  g.translate(-(transform.x + transform.w / 2), -(transform.y + transform.h / 2))
  g.drawImage(selCanvas, 0, 0)
  const data = g.getImageData(0, 0, bmpW, bmpH).data
  const out = new Float32Array(bmpW * bmpH)
  for (let p = 0; p < out.length; p++) out[p] = data[p * 4] / 255
  return out
}

function resolveSelection(
  doc: Document,
  content: ContentStore,
  transform: Transform,
  bmpW: number,
  bmpH: number
): Float32Array | null {
  if (!doc.selectionId) return null
  const channel = doc.channels.find((ch) => ch.id === doc.selectionId)
  if (!channel || !channel.enabled) return null
  const entry = content.get(channel.contentId)
  if (!entry) return null
  return rasterizeSelectionToLocal(entry.canvas, transform, bmpW, bmpH)
}

export function resolvePaintTarget(
  doc: Document,
  content: ContentStore,
  activeId: string | null,
  channel: 'content' | 'mask'
): PaintTarget | null {
  if (!activeId) return null
  const loc = findNode(doc.root, activeId)
  if (!loc) return null
  const node = loc.node
  if (node.locks.content) return null

  if (channel === 'mask') {
    if (!node.mask) return null
    const entry = content.get(node.mask.contentId)
    if (!entry) return null
    const tf =
      node.transform.w > 0 && node.transform.h > 0
        ? node.transform
        : { x: 0, y: 0, w: entry.width, h: entry.height, rotation: 0 }
    return {
      drawable: node,
      channel: 'mask',
      bitmap: entry.canvas,
      slot: node.mask,
      content,
      toLocal: makeToLocal(tf, entry.width, entry.height),
      selection: resolveSelection(doc, content, tf, entry.width, entry.height),
      scale: displayScale(tf, entry.width, entry.height),
    }
  }

  if (node.kind !== 'raster') return null
  const raster = node as RasterData
  const entry = content.get(raster.contentId)
  if (!entry) return null
  return {
    drawable: raster,
    channel: 'content',
    bitmap: entry.canvas,
    slot: raster,
    content,
    toLocal: makeToLocal(raster.transform, raster.naturalWidth, raster.naturalHeight),
    selection: resolveSelection(doc, content, raster.transform, raster.naturalWidth, raster.naturalHeight),
    lockAlpha: raster.lockAlpha === true,
    scale: displayScale(raster.transform, raster.naturalWidth, raster.naturalHeight),
  }
}
