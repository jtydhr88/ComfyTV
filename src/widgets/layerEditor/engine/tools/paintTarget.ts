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

  if (channel === 'mask') {
    if (!node.mask) return null
    const entry = content.get(node.mask.contentId)
    if (!entry) return null
    return {
      drawable: node,
      channel: 'mask',
      bitmap: entry.canvas,
      slot: node.mask,
      content,
      toLocal: makeToLocal(node.transform, entry.width, entry.height),
      scale: displayScale(node.transform, entry.width, entry.height),
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
    scale: displayScale(raster.transform, raster.naturalWidth, raster.naturalHeight),
  }
}
