import type { Vec2 } from './node'
import { strokeSegments, type PathData, type Stroke } from './vector'

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function cubicAt(from: Vec2, c1: Vec2, c2: Vec2, to: Vec2, t: number): Vec2 {
  const u = 1 - t
  const w0 = u * u * u
  const w1 = 3 * u * u * t
  const w2 = 3 * u * t * t
  const w3 = t * t * t
  return {
    x: w0 * from.x + w1 * c1.x + w2 * c2.x + w3 * to.x,
    y: w0 * from.y + w1 * c1.y + w2 * c2.y + w3 * to.y,
  }
}

function flatEnough(from: Vec2, c1: Vec2, c2: Vec2, to: Vec2, tol: number): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  if (len <= 1e-9) {
    return Math.hypot(c1.x - from.x, c1.y - from.y) <= tol && Math.hypot(c2.x - from.x, c2.y - from.y) <= tol
  }
  const d1 = Math.abs((c1.x - from.x) * dy - (c1.y - from.y) * dx) / len
  const d2 = Math.abs((c2.x - from.x) * dy - (c2.y - from.y) * dx) / len
  return d1 <= tol && d2 <= tol
}

function subdivide(
  out: Vec2[],
  from: Vec2, c1: Vec2, c2: Vec2, to: Vec2,
  tol: number,
  depth: number
): void {
  if (depth >= 12 || flatEnough(from, c1, c2, to, tol)) {
    out.push(to)
    return
  }
  const a = lerp(from, c1, 0.5)
  const b = lerp(c1, c2, 0.5)
  const c = lerp(c2, to, 0.5)
  const d = lerp(a, b, 0.5)
  const e = lerp(b, c, 0.5)
  const m = lerp(d, e, 0.5)
  subdivide(out, from, a, d, m, tol, depth + 1)
  subdivide(out, m, e, c, to, tol, depth + 1)
}

export function flattenStrokeAdaptive(stroke: Stroke, tolerance = 0.25): Vec2[] {
  const segs = strokeSegments(stroke)
  if (segs.length === 0) {
    return stroke.anchors.filter((a) => a.type === 'anchor').map((a) => ({ ...a.pos }))
  }
  const out: Vec2[] = [{ ...segs[0].from }]
  for (const s of segs) subdivide(out, s.from, s.c1, s.c2, s.to, tolerance, 0)
  return out
}

export function flattenPathAdaptive(path: PathData, tolerance = 0.25): Vec2[][] {
  return path.strokes.map((s) => flattenStrokeAdaptive(s, tolerance))
}

export function resamplePolyline(pts: Vec2[], step: number): Vec2[] {
  if (pts.length < 2 || step <= 0) return pts.map((p) => ({ ...p }))
  const out: Vec2[] = [{ ...pts[0] }]
  let carry = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len <= 1e-9) continue
    let d = step - carry
    while (d <= len) {
      const t = d / len
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      d += step
    }
    carry = len - (d - step)
  }
  const last = pts[pts.length - 1]
  const tail = out[out.length - 1]
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > 1e-6) out.push({ ...last })
  return out
}

export interface SegmentHit {
  strokeIndex: number
  segIndex: number
  t: number
  point: Vec2
  dist: number
}

export function nearestPointOnPath(path: PathData, pt: Vec2): SegmentHit | null {
  let best: SegmentHit | null = null
  for (let si = 0; si < path.strokes.length; si++) {
    const segs = strokeSegments(path.strokes[si])
    for (let gi = 0; gi < segs.length; gi++) {
      const s = segs[gi]
      let bestT = 0
      let bestD = Infinity
      const SAMPLES = 24
      for (let k = 0; k <= SAMPLES; k++) {
        const t = k / SAMPLES
        const p = cubicAt(s.from, s.c1, s.c2, s.to, t)
        const d = Math.hypot(p.x - pt.x, p.y - pt.y)
        if (d < bestD) {
          bestD = d
          bestT = t
        }
      }
      let lo = Math.max(0, bestT - 1 / SAMPLES)
      let hi = Math.min(1, bestT + 1 / SAMPLES)
      for (let iter = 0; iter < 24; iter++) {
        const t1 = lo + (hi - lo) / 3
        const t2 = hi - (hi - lo) / 3
        const p1 = cubicAt(s.from, s.c1, s.c2, s.to, t1)
        const p2 = cubicAt(s.from, s.c1, s.c2, s.to, t2)
        const d1 = Math.hypot(p1.x - pt.x, p1.y - pt.y)
        const d2 = Math.hypot(p2.x - pt.x, p2.y - pt.y)
        if (d1 < d2) hi = t2
        else lo = t1
      }
      const t = (lo + hi) / 2
      const p = cubicAt(s.from, s.c1, s.c2, s.to, t)
      const d = Math.hypot(p.x - pt.x, p.y - pt.y)
      if (!best || d < best.dist) {
        best = { strokeIndex: si, segIndex: gi, t, point: p, dist: d }
      }
    }
  }
  return best
}

export interface AnchorHit {
  strokeIndex: number
  tripleIndex: number
  slot: 'leading' | 'anchor' | 'trailing'
  dist: number
}

export function hitAnchor(path: PathData, pt: Vec2, tolerance: number, includeControls = true): AnchorHit | null {
  let best: AnchorHit | null = null
  for (let si = 0; si < path.strokes.length; si++) {
    const anchors = path.strokes[si].anchors
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i]
      const isAnchor = a.type === 'anchor'
      if (!isAnchor && !includeControls) continue
      const d = Math.hypot(a.pos.x - pt.x, a.pos.y - pt.y)
      const effective = isAnchor ? d : d + tolerance * 0.25
      if (d > tolerance) continue
      if (!best || effective < best.dist) {
        best = {
          strokeIndex: si,
          tripleIndex: Math.floor(i / 3),
          slot: i % 3 === 0 ? 'leading' : i % 3 === 1 ? 'anchor' : 'trailing',
          dist: effective,
        }
      }
    }
  }
  return best
}

/** De Casteljau split: insert a new anchor triple at parameter t of a segment. */
export function insertAnchorOnSegment(stroke: Stroke, segIndex: number, t: number): Stroke {
  const count = stroke.anchors.length / 3
  const i = segIndex
  const j = (segIndex + 1) % count
  const from = stroke.anchors[i * 3 + 1].pos
  const c1 = stroke.anchors[i * 3 + 2].pos
  const c2 = stroke.anchors[j * 3].pos
  const to = stroke.anchors[j * 3 + 1].pos
  const a = lerp(from, c1, t)
  const b = lerp(c1, c2, t)
  const c = lerp(c2, to, t)
  const d = lerp(a, b, t)
  const e = lerp(b, c, t)
  const m = lerp(d, e, t)

  const anchors = stroke.anchors.map((x) => ({ ...x, pos: { ...x.pos } }))
  anchors[i * 3 + 2].pos = a
  anchors[j * 3].pos = c
  const triple = [
    { pos: d, type: 'control' as const, selected: false },
    { pos: m, type: 'anchor' as const, selected: false },
    { pos: e, type: 'control' as const, selected: false },
  ]
  anchors.splice((i + 1) * 3, 0, ...triple)
  return { ...stroke, anchors }
}

export function removeAnchorTriple(stroke: Stroke, tripleIndex: number): Stroke {
  const anchors = stroke.anchors.map((x) => ({ ...x, pos: { ...x.pos } }))
  anchors.splice(tripleIndex * 3, 3)
  return { ...stroke, anchors }
}

/** Move a whole anchor triple by a delta (anchor drags carry their handles). */
export function moveAnchorTriple(stroke: Stroke, tripleIndex: number, dx: number, dy: number): Stroke {
  const anchors = stroke.anchors.map((x, i) => {
    if (Math.floor(i / 3) !== tripleIndex) return x
    return { ...x, pos: { x: x.pos.x + dx, y: x.pos.y + dy } }
  })
  return { ...stroke, anchors }
}

/** Move one control handle; mirrors the opposite handle unless broken. */
export function moveControl(
  stroke: Stroke,
  tripleIndex: number,
  slot: 'leading' | 'trailing',
  to: Vec2,
  mirror: boolean
): Stroke {
  const anchors = stroke.anchors.map((x) => ({ ...x, pos: { ...x.pos } }))
  const base = tripleIndex * 3
  const idx = slot === 'leading' ? base : base + 2
  anchors[idx].pos = { ...to }
  if (mirror) {
    const anchor = anchors[base + 1].pos
    const other = slot === 'leading' ? base + 2 : base
    anchors[other].pos = { x: 2 * anchor.x - to.x, y: 2 * anchor.y - to.y }
  }
  return { ...stroke, anchors }
}
