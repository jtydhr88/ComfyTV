import type { Vec2 } from '../node'

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export interface StepResult {
  dabs: Vec2[]
  carry: number
}

export function stepStroke(from: Vec2, to: Vec2, spacingPx: number, carry: number): StepResult {
  const s = Math.max(0.5, spacingPx)
  const segLen = dist(from, to)
  if (segLen <= 1e-9) return { dabs: [], carry }

  const dabs: Vec2[] = []
  const total = carry + segLen
  const n = Math.floor(total / s)
  for (let k = 1; k <= n; k++) {
    const t = (k * s - carry) / segLen
    dabs.push({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
  }
  return { dabs, carry: total - n * s }
}

export interface StrokePoint {
  x: number
  y: number
  pressure: number
}

export interface StepDabsResult {
  dabs: StrokePoint[]
  carry: number
}

export function stepDabs(from: StrokePoint, to: StrokePoint, spacingPx: number, carry: number): StepDabsResult {
  const s = Math.max(0.5, spacingPx)
  const segLen = dist(from, to)
  if (segLen <= 1e-9) return { dabs: [], carry }

  const dabs: StrokePoint[] = []
  const total = carry + segLen
  const n = Math.floor(total / s)
  for (let k = 1; k <= n; k++) {
    const t = (k * s - carry) / segLen
    dabs.push({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      pressure: from.pressure + (to.pressure - from.pressure) * t,
    })
  }
  return { dabs, carry: total - n * s }
}

const MAX_DEPTH = 10

function flatEnough(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, tol: number): boolean {
  const dx = x3 - x0
  const dy = y3 - y0
  const len = Math.hypot(dx, dy)
  if (len <= 1e-9) {
    return Math.hypot(x1 - x0, y1 - y0) <= tol && Math.hypot(x2 - x0, y2 - y0) <= tol
  }
  const d1 = Math.abs((x1 - x0) * dy - (y1 - y0) * dx) / len
  const d2 = Math.abs((x2 - x0) * dy - (y2 - y0) * dx) / len
  return d1 <= tol && d2 <= tol
}

function subdivide(
  out: StrokePoint[],
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
  p1: number, p2: number, t0: number, t1: number, tol: number, depth: number
): void {
  if (depth >= MAX_DEPTH || flatEnough(x0, y0, x1, y1, x2, y2, x3, y3, tol)) {
    out.push({ x: x3, y: y3, pressure: p1 + (p2 - p1) * t1 })
    return
  }
  const ax = (x0 + x1) / 2, ay = (y0 + y1) / 2
  const bx = (x1 + x2) / 2, by = (y1 + y2) / 2
  const cx = (x2 + x3) / 2, cy = (y2 + y3) / 2
  const abx = (ax + bx) / 2, aby = (ay + by) / 2
  const bcx = (bx + cx) / 2, bcy = (by + cy) / 2
  const mx = (abx + bcx) / 2, my = (aby + bcy) / 2
  const tm = (t0 + t1) / 2
  subdivide(out, x0, y0, ax, ay, abx, aby, mx, my, p1, p2, t0, tm, tol, depth + 1)
  subdivide(out, mx, my, bcx, bcy, cx, cy, x3, y3, p1, p2, tm, t1, tol, depth + 1)
}

export function flattenCatmullRom(
  p0: StrokePoint,
  p1: StrokePoint,
  p2: StrokePoint,
  p3: StrokePoint,
  tolerance = 0.25
): StrokePoint[] {
  const b1x = p1.x + (p2.x - p0.x) / 6
  const b1y = p1.y + (p2.y - p0.y) / 6
  const b2x = p2.x - (p3.x - p1.x) / 6
  const b2y = p2.y - (p3.y - p1.y) / 6
  const out: StrokePoint[] = []
  subdivide(out, p1.x, p1.y, b1x, b1y, b2x, b2y, p2.x, p2.y, p1.pressure, p2.pressure, 0, 1, tolerance, 0)
  return out
}
