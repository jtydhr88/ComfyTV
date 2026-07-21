import type { Vec2 } from './node'

export type AnchorType = 'anchor' | 'control'

export interface Anchor {
  pos: Vec2
  type: AnchorType
  selected: boolean
}

export interface Stroke {
  id: string
  anchors: Anchor[]
  closed: boolean
}

export interface PathData {
  strokes: Stroke[]
}

export type AnchorFeature = 'none' | 'edge' | 'aligned' | 'symmetric'

export interface FillStyle {
  color: string
  rule?: 'nonzero' | 'evenodd'
  opacity?: number
}

export interface StrokeStyle {
  color: string
  width: number
  cap: 'butt' | 'round' | 'square'
  join: 'miter' | 'round' | 'bevel'
  miterLimit?: number
  dash?: number[]
  opacity?: number
}

function cubic(p0: Vec2, c0: Vec2, c1: Vec2, p1: Vec2, t: number): Vec2 {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * c0.x + c * c1.x + d * p1.x,
    y: a * p0.y + b * c0.y + c * c1.y + d * p1.y,
  }
}

export function flattenStroke(stroke: Stroke, steps = 16): Vec2[] {
  const on = stroke.anchors.filter((a) => a.type === 'anchor')
  if (on.length === 0) return []
  if (on.length === 1) return [on[0].pos]

  const idx = stroke.anchors
    .map((a, i) => (a.type === 'anchor' ? i : -1))
    .filter((i) => i >= 0)

  const out: Vec2[] = [on[0].pos]
  const segs = stroke.closed ? idx.length : idx.length - 1
  for (let s = 0; s < segs; s++) {
    const ai = idx[s]
    const bi = idx[(s + 1) % idx.length]
    const p0 = stroke.anchors[ai].pos
    const p1 = stroke.anchors[bi].pos

    const c0 = stroke.anchors[(ai + 1) % stroke.anchors.length]
    const c1 = stroke.anchors[(bi - 1 + stroke.anchors.length) % stroke.anchors.length]
    const h0 = c0.type === 'control' ? c0.pos : p0
    const h1 = c1.type === 'control' ? c1.pos : p1
    for (let k = 1; k <= steps; k++) out.push(cubic(p0, h0, h1, p1, k / steps))
  }
  return out
}

export function flatten(path: PathData, steps = 16): Vec2[][] {
  return path.strokes.map((s) => flattenStroke(s, steps))
}
