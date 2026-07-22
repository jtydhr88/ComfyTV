import { PropCommand } from '../commands/prop'
import type { NodeTexture } from '../compositor'
import { Dirty, type Command } from '../history'
import { generateId } from '../id'
import { defaultMode } from '../mode'
import type { NodeKind, RenderNodeCtx } from '../nodeKind'
import type { Rect, Transform, VectorData, Vec2 } from '../node'
import {
  clonePath,
  pathBounds,
  strokeSegments,
  transformPath,
  type Anchor,
  type FillStyle,
  type PathData,
  type Stroke,
  type StrokeStyle,
} from '../vector'

const num = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? v : d)
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

function strokeWidthOf(node: VectorData): number {
  return node.stroke ? Math.max(0, node.stroke.width) : 0
}

export function deriveVectorTransform(path: PathData, strokeWidth: number): Transform {
  const b = pathBounds(path, strokeWidth)
  if (!b) return { x: 0, y: 0, w: 1, h: 1, rotation: 0 }
  return { x: b.x, y: b.y, w: b.w, h: b.h, rotation: 0 }
}

function normalizeAnchor(raw: unknown): Anchor | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const pos = (r.pos ?? {}) as Record<string, unknown>
  if (typeof pos.x !== 'number' || typeof pos.y !== 'number') return null
  return {
    pos: { x: pos.x, y: pos.y },
    type: r.type === 'control' ? 'control' : 'anchor',
    selected: false,
  }
}

function normalizeStroke(raw: unknown): Stroke | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const anchors = (Array.isArray(r.anchors) ? r.anchors : [])
    .map(normalizeAnchor)
    .filter((x): x is Anchor => x !== null)
  if (anchors.length < 3 || anchors.length % 3 !== 0) return null
  return { id: str(r.id, generateId('stroke')), anchors, closed: bool(r.closed, false) }
}

export function normalizeVectorPath(raw: unknown): PathData {
  const r = (raw ?? {}) as Record<string, unknown>
  const strokes = (Array.isArray(r.strokes) ? r.strokes : [])
    .map(normalizeStroke)
    .filter((x): x is Stroke => x !== null)
  return { strokes }
}

function normalizeFill(raw: unknown): FillStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  if (typeof r.color !== 'string') return undefined
  return {
    color: r.color,
    rule: r.rule === 'evenodd' ? 'evenodd' : 'nonzero',
    opacity: clamp01(num(r.opacity, 1)),
  }
}

function normalizeStrokeStyle(raw: unknown): StrokeStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  if (typeof r.color !== 'string') return undefined
  const cap = r.cap === 'round' || r.cap === 'square' ? r.cap : 'butt'
  const join = r.join === 'round' || r.join === 'bevel' ? r.join : 'miter'
  return {
    color: r.color,
    width: Math.max(0, num(r.width, 2)),
    cap,
    join,
    miterLimit: typeof r.miterLimit === 'number' ? r.miterLimit : undefined,
    dash: Array.isArray(r.dash) ? r.dash.filter((d): d is number => typeof d === 'number') : undefined,
    opacity: clamp01(num(r.opacity, 1)),
  }
}

function tracePath(g: CanvasRenderingContext2D, path: PathData): void {
  g.beginPath()
  for (const stroke of path.strokes) {
    const segs = strokeSegments(stroke)
    if (segs.length === 0) continue
    g.moveTo(segs[0].from.x, segs[0].from.y)
    for (const s of segs) g.bezierCurveTo(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.to.x, s.to.y)
    if (stroke.closed) g.closePath()
  }
}

export function rasterizeVector(node: VectorData): { canvas: HTMLCanvasElement; bounds: Rect } | null {
  const bounds = pathBounds(node.path, strokeWidthOf(node))
  if (!bounds) return null
  const canvas = document.createElement('canvas')
  canvas.width = bounds.w
  canvas.height = bounds.h
  const g = canvas.getContext('2d')
  if (!g) return null
  g.translate(-bounds.x, -bounds.y)
  tracePath(g, node.path)
  if (node.fill) {
    g.globalAlpha = clamp01(node.fill.opacity ?? 1)
    g.fillStyle = node.fill.color
    g.fill(node.fill.rule ?? 'nonzero')
  }
  if (node.stroke && node.stroke.width > 0) {
    g.globalAlpha = clamp01(node.stroke.opacity ?? 1)
    g.strokeStyle = node.stroke.color
    g.lineWidth = node.stroke.width
    g.lineCap = node.stroke.cap
    g.lineJoin = node.stroke.join
    if (node.stroke.miterLimit !== undefined) g.miterLimit = node.stroke.miterLimit
    if (node.stroke.dash?.length) g.setLineDash(node.stroke.dash)
    g.stroke()
  }
  return { canvas, bounds }
}

function vectorStamp(node: VectorData): string {
  return JSON.stringify([
    node.path.strokes.map((s) => [s.closed, s.anchors.map((x) => [x.pos.x, x.pos.y, x.type])]),
    node.fill ?? null,
    node.stroke ?? null,
  ])
}

const bitmapCache = new Map<string, { stamp: string; canvas: HTMLCanvasElement | null }>()

export function vectorBitmap(node: VectorData): HTMLCanvasElement | null {
  const stamp = vectorStamp(node)
  const hit = bitmapCache.get(node.id)
  if (hit && hit.stamp === stamp) return hit.canvas
  if (bitmapCache.size > 128) {
    const first = bitmapCache.keys().next().value
    if (first !== undefined) bitmapCache.delete(first)
  }
  const canvas = rasterizeVector(node)?.canvas ?? null
  bitmapCache.set(node.id, { stamp, canvas })
  return canvas
}

export const vectorKind: NodeKind<VectorData> = {
  kind: 'vector',

  create(init: Partial<VectorData> = {}): VectorData {
    const path = init.path ? clonePath(init.path) : { strokes: [] }
    const stroke = init.stroke
    const node: VectorData = {
      kind: 'vector',
      id: init.id ?? generateId('vector'),
      name: init.name ?? 'Shape',
      visible: init.visible ?? true,
      opacity: init.opacity ?? 1,
      mode: init.mode ?? defaultMode('normal'),
      transform: { x: 0, y: 0, w: 1, h: 1, rotation: 0 },
      locks: init.locks ?? { content: false, position: false, visibility: false },
      path,
      fill: init.fill,
      stroke,
      mask: init.mask,
    }
    node.transform = deriveVectorTransform(path, strokeWidthOf(node))
    return node
  },

  normalize(raw: unknown): VectorData {
    const r = (raw ?? {}) as Record<string, unknown>
    const locks = (r.locks ?? {}) as Record<string, unknown>
    const path = normalizeVectorPath(r.path)
    const stroke = normalizeStrokeStyle(r.stroke)
    return {
      kind: 'vector',
      id: str(r.id, generateId('vector')),
      name: str(r.name, 'Shape'),
      visible: bool(r.visible, true),
      opacity: clamp01(num(r.opacity, 1)),
      mode: (r.mode as VectorData['mode']) ?? defaultMode('normal'),
      transform: deriveVectorTransform(path, stroke ? Math.max(0, stroke.width) : 0),
      locks: {
        content: bool(locks.content, false),
        position: bool(locks.position, false),
        visibility: bool(locks.visibility, false),
      },
      path,
      fill: normalizeFill(r.fill),
      stroke,
      mask: r.mask as VectorData['mask'],
    }
  },

  serialize(node: VectorData): unknown {
    return {
      kind: 'vector',
      id: node.id,
      name: node.name,
      visible: node.visible,
      opacity: node.opacity,
      mode: node.mode,
      transform: node.transform,
      locks: node.locks,
      path: clonePath(node.path),
      fill: node.fill ? { ...node.fill } : undefined,
      stroke: node.stroke ? { ...node.stroke, dash: node.stroke.dash ? [...node.stroke.dash] : undefined } : undefined,
      mask: node.mask,
    }
  },

  contentIds(node: VectorData): string[] {
    return node.mask ? [node.mask.contentId].filter(Boolean) : []
  },

  async hydrate(node: VectorData, deps): Promise<void> {
    if (node.mask && !deps.content.has(node.mask.contentId) && node.mask.url) {
      const canvas = await deps.loadUrl(node.mask.url)
      deps.content.register(canvas, { id: node.mask.contentId, uploadedUrl: node.mask.url })
    }
  },

  renderNode(node: VectorData, ctx: RenderNodeCtx): NodeTexture | null {
    const bitmap = vectorBitmap(node)
    if (!bitmap) return null
    return ctx.placed(`content:${node.id}`, vectorStamp(node), bitmap, node.transform)
  },

  bbox(node: VectorData): Rect {
    return { x: node.transform.x, y: node.transform.y, w: node.transform.w, h: node.transform.h }
  },

  thumbnail(node: VectorData): HTMLCanvasElement | null {
    return vectorBitmap(node)
  },

  hitTest(node: VectorData, pt: Vec2): boolean {
    const b = this.bbox(node)
    return pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h
  },

  onTransformCommitted(node: VectorData, before: Transform): Command | null {
    const after = node.transform
    const changed =
      after.x !== before.x ||
      after.y !== before.y ||
      after.w !== before.w ||
      after.h !== before.h ||
      after.rotation !== before.rotation
    if (!changed) return null
    const beforePath = clonePath(node.path)
    const sx = before.w > 0 ? after.w / before.w : 1
    const sy = before.h > 0 ? after.h / before.h : 1
    const rot = after.rotation - before.rotation
    const cx = after.x + after.w / 2
    const cy = after.y + after.h / 2
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    node.path = transformPath(node.path, (pt) => {
      const px = (pt.x - before.x) * sx + after.x
      const py = (pt.y - before.y) * sy + after.y
      if (rot === 0) return { x: px, y: py }
      const dx = px - cx
      const dy = py - cy
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
    })
    node.transform = deriveVectorTransform(node.path, strokeWidthOf(node))
    const snapshot = () => ({ path: clonePath(node.path), transform: { ...node.transform } })
    const restore = (v: { path: PathData; transform: Transform }) => {
      node.path = clonePath(v.path)
      node.transform = { ...v.transform }
    }
    return new PropCommand(
      'Shape Transform',
      Dirty.DRAWABLE,
      snapshot,
      restore,
      { path: beforePath, transform: { ...before } },
      snapshot()
    )
  },
}
