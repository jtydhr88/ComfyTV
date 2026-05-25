import type { Point } from './types'

export function catmullRomSpline(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point {
  const alpha = 0.5

  const getT = (t: number, p0: Point, p1: Point) => {
    const d = Math.hypot(p1.x - p0.x, p1.y - p0.y)
    return t + Math.pow(d, alpha)
  }

  const t0 = 0
  const t1 = getT(t0, p0, p1)
  const t2 = getT(t1, p1, p2)
  const t3 = getT(t2, p2, p3)

  const tInterp = t1 + (t2 - t1) * t

  const interp = (
    pA: Point,
    pB: Point,
    tA: number,
    tB: number,
    t: number
  ): Point => {
    if (Math.abs(tB - tA) < 0.0001) return pA
    const k = (t - tA) / (tB - tA)
    return add(mul(pA, 1 - k), mul(pB, k))
  }

  const A1 = interp(p0, p1, t0, t1, tInterp)
  const A2 = interp(p1, p2, t1, t2, tInterp)
  const A3 = interp(p2, p3, t2, t3, tInterp)

  const B1 = interp(A1, A2, t0, t2, tInterp)
  const B2 = interp(A2, A3, t1, t3, tInterp)

  const C = interp(B1, B2, t1, t2, tInterp)

  return C
}

function add(p1: Point, p2: Point): Point {
  return { x: p1.x + p2.x, y: p1.y + p2.y }
}

function mul(p: Point, s: number): Point {
  return { x: p.x * s, y: p.y * s }
}

export function resampleSegment(
  points: Point[],
  spacing: number,
  startOffset: number
): { points: Point[]; remainder: number } {
  if (points.length === 0) return { points: [], remainder: startOffset }

  const result: Point[] = []
  let currentDist = 0
  let nextSampleDist = startOffset

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]

    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const segmentLen = Math.hypot(dx, dy)

    if (segmentLen < 0.0001) {
      while (nextSampleDist <= currentDist) {
        result.push(p1)
        nextSampleDist += spacing
      }
      continue
    }

    while (nextSampleDist <= currentDist + segmentLen) {
      const t = (nextSampleDist - currentDist) / segmentLen

      const x = p1.x + t * dx
      const y = p1.y + t * dy
      result.push({ x, y })

      nextSampleDist += spacing
    }

    currentDist += segmentLen
  }

  const remainder = nextSampleDist - currentDist

  return { points: result, remainder }
}
