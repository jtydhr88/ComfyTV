import type { HandleId, Layer, LayerTransform, Point } from './types'
export const HANDLE_HIT_PX = 8
export const ROTATE_HANDLE_OFFSET_PX = 24

export function layerCenter(t: LayerTransform): Point {
  return { x: t.x + t.w / 2, y: t.y + t.h / 2 }
}
export function artboardToLocal(pt: Point, t: LayerTransform): Point {
  const c = layerCenter(t)
  const dx = pt.x - c.x
  const dy = pt.y - c.y
  const cos = Math.cos(-t.rotation)
  const sin = Math.sin(-t.rotation)
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos }
}

export function localToArtboard(pt: Point, t: LayerTransform): Point {
  const c = layerCenter(t)
  const cos = Math.cos(t.rotation)
  const sin = Math.sin(t.rotation)
  return { x: c.x + pt.x * cos - pt.y * sin, y: c.y + pt.x * sin + pt.y * cos }
}
export function hitTestLayer(layers: Layer[], pt: Point): string | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]
    if (!l.visible || l.locked) continue
    const p = artboardToLocal(pt, l.transform)
    if (Math.abs(p.x) <= l.transform.w / 2 && Math.abs(p.y) <= l.transform.h / 2) {
      return l.id
    }
  }
  return null
}
const HANDLE_DIRS: Record<Exclude<HandleId, 'rotate'>, { hx: number; hy: number }> = {
  nw: { hx: -1, hy: -1 }, n: { hx: 0, hy: -1 }, ne: { hx: 1, hy: -1 },
  e: { hx: 1, hy: 0 }, se: { hx: 1, hy: 1 }, s: { hx: 0, hy: 1 },
  sw: { hx: -1, hy: 1 }, w: { hx: -1, hy: 0 },
}

function localHandlePos(t: LayerTransform, id: HandleId, zoom: number): Point {
  if (id === 'rotate') {
    return { x: 0, y: -t.h / 2 - ROTATE_HANDLE_OFFSET_PX / zoom }
  }
  const d = HANDLE_DIRS[id]
  return { x: (d.hx * t.w) / 2, y: (d.hy * t.h) / 2 }
}

export function getHandlePositions(
  t: LayerTransform,
  zoom: number,
): Array<{ id: HandleId; x: number; y: number }> {
  const ids: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'rotate']
  return ids.map((id) => {
    const p = localToArtboard(localHandlePos(t, id, zoom), t)
    return { id, x: p.x, y: p.y }
  })
}
export function hitTestHandle(t: LayerTransform, pt: Point, zoom: number): HandleId | '' {
  const p = artboardToLocal(pt, t)
  const r = HANDLE_HIT_PX / zoom
  const order: HandleId[] = ['rotate', 'nw', 'ne', 'sw', 'se', 'n', 'e', 's', 'w']
  for (const id of order) {
    const h = localHandlePos(t, id, zoom)
    if (Math.abs(p.x - h.x) <= r && Math.abs(p.y - h.y) <= r) return id
  }
  return ''
}
export function resizeTransform(
  start: LayerTransform,
  handle: Exclude<HandleId, 'rotate'>,
  curPt: Point,
  opts?: { aspectLock?: boolean; minSize?: number },
): LayerTransform {
  const minSize = opts?.minSize ?? 8
  const d = HANDLE_DIRS[handle]
  const anchor: Point = { x: (-d.hx * start.w) / 2, y: (-d.hy * start.h) / 2 }
  const cur = artboardToLocal(curPt, start)

  let newW = d.hx === 0 ? start.w : Math.max(minSize, (cur.x - anchor.x) * d.hx)
  let newH = d.hy === 0 ? start.h : Math.max(minSize, (cur.y - anchor.y) * d.hy)

  if (opts?.aspectLock && d.hx !== 0 && d.hy !== 0) {
    const scale = Math.max(newW / start.w, newH / start.h)
    newW = Math.max(minSize, start.w * scale)
    newH = Math.max(minSize, start.h * scale)
  }

  const centerLocal: Point = {
    x: anchor.x + (d.hx * newW) / 2,
    y: anchor.y + (d.hy * newH) / 2,
  }
  const centerArtboard = localToArtboard(centerLocal, start)
  return {
    x: centerArtboard.x - newW / 2,
    y: centerArtboard.y - newH / 2,
    w: newW,
    h: newH,
    rotation: start.rotation,
  }
}

const SNAP_STEP = Math.PI / 12

export function rotateTransform(
  start: LayerTransform,
  startPt: Point,
  curPt: Point,
  snap15 = false,
): LayerTransform {
  const c = layerCenter(start)
  const a0 = Math.atan2(startPt.y - c.y, startPt.x - c.x)
  const a1 = Math.atan2(curPt.y - c.y, curPt.x - c.x)
  let rotation = start.rotation + (a1 - a0)
  if (snap15) rotation = Math.round(rotation / SNAP_STEP) * SNAP_STEP
  while (rotation > Math.PI) rotation -= Math.PI * 2
  while (rotation <= -Math.PI) rotation += Math.PI * 2
  return { ...start, rotation }
}

const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'] as const
export function cursorForHandle(handle: HandleId, rotation: number): string {
  if (handle === 'rotate') return 'grab'
  const d = HANDLE_DIRS[handle]
  const angle = Math.atan2(d.hy, d.hx) + rotation
  const sector = ((Math.round(angle / (Math.PI / 4)) % 4) + 4) % 4
  return RESIZE_CURSORS[sector]
}
